import { constrainedMemory } from "process";
import pool from "../config/dbConnection.js";
import { errorResponse, successResponse, uploadFileToS3 } from "../utils/index.js";
import { generateFastPurchaseInvoicePDF, generateFastPurchaseInvoicePDFFileName, createFastPurchaseInvoiceHTML } from "../utils/fastPurchaseInvoicePDFGenerator.js";

export async function createPurchase(req, res) {
  const client = await pool.connect();

  const {
    invoiceNumber,
    date,
    taxType,
    rateType = 'without_tax',
    discountType,
    discountValueType = 'percentage',
    discountValue = 0,
    items,
    internalNotes = '',
    basicAmount,
    totalDiscount,
    taxAmount,
    roundOff = 0,
    netPayable,
    billFromBank,
    billFromContact,
    status
  } = req.body;

  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  if (!Array.isArray(items) || items.length === 0) {
    return errorResponse(res, "At least one item is required", 400);
  }

  if (items.some(item => !item.productId)) {
    return errorResponse(res, "All items must have a productId", 400);
  }

  if (!['paid', 'pending'].includes(status)) {
    return errorResponse(res, "Status must be either 'paid' or 'pending'", 400);
  }

  let bankAccountId = null;
  let contactId = null;

  // Handle both billFromBank and billFromContact - they can both be present
  if (billFromBank) {
    bankAccountId = parseInt(billFromBank);
  }
  
  if (billFromContact) {
    contactId = parseInt(billFromContact);
  }

  // At least one of them should be provided
  if (!billFromBank && !billFromContact) {
    return errorResponse(res, "Either billFromBank or billFromContact is required", 400);
  }

  try {
    await client.query("BEGIN");

    // Validate products and serial numbers
    for (const item of items) {
      const { productId, serialNumbers = [] } = item;
      const productRes = await client.query(
        `SELECT "id", "currentStock", "isInventoryTracked", "isSerialized" FROM hisab."products"
         WHERE "id" = $1 AND "companyId" = $2`,
        [productId, companyId]
      );

      if (productRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, `Product ${productId} not found`, 404);
      }

      const product = productRes.rows[0];

      if (product.isSerialized && product.isInventoryTracked) {
        if (!Array.isArray(serialNumbers) || serialNumbers.length === 0) {
          await client.query("ROLLBACK");
          return errorResponse(res, `Serial numbers required for serialized product ${productId}`, 400);
        }

        if (serialNumbers.length !== item.quantity) {
          await client.query("ROLLBACK");
          return errorResponse(res, `Serial numbers count must match quantity for product ${productId}`, 400);
        }

        for (const serialNumber of serialNumbers) {
          const existingSerial = await client.query(
            `SELECT "id" FROM hisab."serialNumbers" 
             WHERE "companyId" = $1 AND "productId" = $2 AND "serialNumber" = $3`,
            [companyId, productId, serialNumber]
          );

          if (existingSerial.rows.length > 0) {
            await client.query("ROLLBACK");
            return errorResponse(res, `Serial number ${serialNumber} already exists for product ${productId}`, 400);
          }
        }
      }
    }

    // Validate bank account exists (only if bank payment)
    if (bankAccountId) {
      const bankRes = await client.query(
        `SELECT "id" FROM hisab."bankAccounts"
         WHERE "id" = $1 AND "companyId" = $2`,
        [bankAccountId, companyId]
      );
      if (bankRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, `Bank account ${bankAccountId} not found`, 404);
      }
    }

    // Validate contact exists (only if contact payment)
    if (contactId) {
      const contactRes = await client.query(
        `SELECT "id" FROM hisab."contacts"
         WHERE "id" = $1 AND "companyId" = $2`,
        [contactId, companyId]
      );
      if (contactRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, `Contact ${contactId} not found`, 404);
      }
    }

    // Calculate remaining_amount and paid_amount based on status
    let remainingAmount, paidAmount;
    if (status === 'paid') {
      remainingAmount = 0;
      paidAmount = netPayable;
    } else {
      remainingAmount = netPayable;
      paidAmount = 0;
    }

    const purchaseRes = await client.query(
      `INSERT INTO hisab."purchases"
       ("companyId", "userId", "bankAccountId", "contactId", "invoiceNumber", 
        "invoiceDate", "taxType", "rateType", "discountType", "discountValueType", 
        "discountValue", "roundOff", "internalNotes", "basicAmount", "totalDiscount", 
        "taxAmount", "netPayable", "status", "remaining_amount", "paid_amount")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       RETURNING id`,
      [
        companyId, userId, bankAccountId, contactId, invoiceNumber, date,
        taxType, rateType, discountType, discountValueType, discountValue,
        roundOff, internalNotes, basicAmount, totalDiscount, taxAmount, netPayable, status,
        remainingAmount, paidAmount
      ]
    );
    const purchaseId = purchaseRes.rows[0].id;

    for (const item of items) {
      const { productId, quantity: qty, rate, rateType: itemRateType, taxRate, taxAmount: itemTaxAmount,
        discount, discountRate, total, serialNumbers = [] } = item;

      const purchaseItemResult = await client.query(
        `INSERT INTO hisab."purchase_items"
         ("purchaseId", "companyId", "productId", "qty", "rate", "rateType", "discount", 
         "discountRate", "taxRate", "taxAmount", "total", "serialNumbers")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id`,
        [
          purchaseId, companyId, productId, qty, rate, itemRateType || rateType, discount,
          discountRate, taxRate, itemTaxAmount, total,
          serialNumbers.length > 0 ? serialNumbers : null
        ]
      );
      
      const purchaseItemId = purchaseItemResult.rows[0].id;

      await client.query(
        `UPDATE hisab."products"
         SET "currentStock" = "currentStock" + $1
         WHERE "id" = $2 AND "companyId" = $3`,
        [qty, productId, companyId]
      );

      const productRes = await client.query(
        `SELECT "isInventoryTracked", "isSerialized" FROM hisab."products"
         WHERE "id" = $1 AND "companyId" = $2`,
        [productId, companyId]
      );

      const product = productRes.rows[0];

      if (product.isSerialized && product.isInventoryTracked && serialNumbers.length > 0) {
        for (const serialNumber of serialNumbers) {
          await client.query(
            `INSERT INTO hisab."serialNumbers"
             ("companyId", "productId", "serialNumber", "status", "purchaseDate", "purchaseItemId")
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [companyId, productId, serialNumber, 'in_stock', date, purchaseItemId]
          );
        }
      }
    }

    // Only update bank balance if status is 'paid' and bank account is provided
    if (bankAccountId && status === 'paid') {
      await client.query(
        `UPDATE hisab."bankAccounts"
         SET "currentBalance" = "currentBalance" - $1
         WHERE "id" = $2 AND "companyId" = $3`,
        [netPayable, bankAccountId, companyId]
      );
    }

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Purchase created successfully",
      purchaseId,
      status
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error in createPurchase:", error);
    
    // Provide more specific error messages
    if (error.code === '23503') {
      if (error.constraint === 'serialNumbers_purchaseItemId_fkey') {
        return errorResponse(res, "Error creating serial numbers: Invalid purchase item reference", 400);
      }
      return errorResponse(res, "Foreign key constraint violation", 400);
    } else if (error.code === '23505') {
      return errorResponse(res, "Duplicate entry found", 400);
    } else if (error.code === '23514') {
      return errorResponse(res, "Data validation failed", 400);
    } else if (error.code === '42P01') {
      return errorResponse(res, "Database table not found", 500);
    } else if (error.code === '42703') {
      return errorResponse(res, "Database column not found", 500);
    }
    
    // Check for specific error messages
    if (error.message.includes('stock')) {
      return errorResponse(res, error.message, 400);
    }
    if (error.message.includes('serial')) {
      return errorResponse(res, error.message, 400);
    }

    return errorResponse(res, "Failed to create purchase", 500);
  } finally {
    client.release();
  }
}

export async function updatePurchase(req, res) {
  const client = await pool.connect();

  const {
    id: purchaseId,
    invoiceNumber,
    date,
    taxType,
    rateType = 'without_tax',
    discountType,
    discountValueType = 'percentage',
    discountValue = 0,
    items = [],
    internalNotes = '',
    basicAmount,
    totalDiscount,
    taxAmount,
    roundOff = 0,
    netPayable,
    billFromBank,
    billFromContact,
    status
  } = req.body;

  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  if (!purchaseId || isNaN(purchaseId)) {
    return errorResponse(res, "Invalid purchase ID", 400);
  }

  if (!Array.isArray(items) || items.length === 0) {
    return errorResponse(res, "At least one item is required", 400);
  }

  if (items.some(item => !item.productId)) {
    return errorResponse(res, "All items must have a productId", 400);
  }

  if (status && !['paid', 'pending'].includes(status)) {
    return errorResponse(res, "Status must be either 'paid' or 'pending'", 400);
  }

  let bankAccountId = null;
  let contactId = null;

  // Handle both billFromBank and billFromContact - they can both be present
  if (billFromBank) {
    bankAccountId = parseInt(billFromBank);
  }
  
  if (billFromContact) {
    contactId = parseInt(billFromContact);
  }

  // At least one of them should be provided
  if (!billFromBank && !billFromContact) {
    return errorResponse(res, "Either billFromBank or billFromContact is required", 400);
  }

  try {
    await client.query("BEGIN");

    const purchaseRes = await client.query(
      `SELECT * FROM hisab."purchases" 
       WHERE id = $1 AND "companyId" = $2 AND "deletedAt" IS NULL
       FOR UPDATE`,
      [purchaseId, companyId]
    );

    if (purchaseRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Purchase not found", 404);
    }

    const oldPurchase = purchaseRes.rows[0];
    const finalStatus = status || oldPurchase.status;

    for (const item of items) {
      const { productId, serialNumbers = [] } = item;
      const productRes = await client.query(
        `SELECT "id", "currentStock", "isInventoryTracked", "isSerialized" 
         FROM hisab."products"
         WHERE "id" = $1 AND "companyId" = $2
         FOR UPDATE`,
        [productId, companyId]
      );

      if (productRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, `Product ${productId} not found`, 404);
      }

      const product = productRes.rows[0];

      if (product.isSerialized && product.isInventoryTracked) {
        if (!Array.isArray(serialNumbers) || serialNumbers.length === 0) {
          await client.query("ROLLBACK");
          return errorResponse(res, `Serial numbers required for serialized product ${productId}`, 400);
        }

        if (serialNumbers.length !== item.quantity) {
          await client.query("ROLLBACK");
          return errorResponse(res, `Serial numbers count must match quantity for product ${productId}`, 400);
        }

        for (const serialNumber of serialNumbers) {
          const existingSerial = await client.query(
            `SELECT "id" FROM hisab."serialNumbers" 
             WHERE "companyId" = $1 AND "productId" = $2 AND "serialNumber" = $3
             AND ("purchaseItemId" NOT IN (
               SELECT id FROM hisab."purchase_items" WHERE "purchaseId" = $4
             ) OR "purchaseItemId" IS NULL)`,
            [companyId, productId, serialNumber, purchaseId]
          );

          if (existingSerial.rows.length > 0) {
            await client.query("ROLLBACK");
            return errorResponse(res, `Serial number ${serialNumber} already exists for product ${productId}`, 400);
          }
        }
      }
    }

    // Validate bank account exists (only if bank payment)
    if (bankAccountId) {
      const bankRes = await client.query(
        `SELECT "id" FROM hisab."bankAccounts"
         WHERE "id" = $1 AND "companyId" = $2
         FOR UPDATE`,
        [bankAccountId, companyId]
      );

      if (bankRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, `Bank account ${bankAccountId} not found`, 404);
      }
    }

    // Validate contact exists (only if contact payment)
    if (contactId) {
      const contactRes = await client.query(
        `SELECT "id" FROM hisab."contacts"
         WHERE "id" = $1 AND "companyId" = $2
         FOR UPDATE`,
        [contactId, companyId]
      );

      if (contactRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, `Contact ${contactId} not found`, 404);
      }
    }

    const oldItemsRes = await client.query(
      `SELECT pi.*, p."isInventoryTracked", p."isSerialized" 
       FROM hisab."purchase_items" pi
       JOIN hisab."products" p ON pi."productId" = p."id" AND pi."companyId" = p."companyId"
       WHERE pi."purchaseId" = $1 AND pi."companyId" = $2`,
      [purchaseId, companyId]
    );

    // Reverse inventory changes from old purchase
    for (const oldItem of oldItemsRes.rows) {
      await client.query(
        `UPDATE hisab."products"
         SET "currentStock" = "currentStock" - $1
         WHERE "id" = $2 AND "companyId" = $3`,
        [oldItem.qty, oldItem.productId, companyId]
      );

      if (oldItem.isSerialized && oldItem.isInventoryTracked) {
        await client.query(
          `DELETE FROM hisab."serialNumbers"
           WHERE "companyId" = $1 AND "productId" = $2 AND "purchaseItemId" = $3`,
          [companyId, oldItem.productId, oldItem.id]
        );
      }
    }

    // Reverse bank balance changes from old purchase (only if it was paid via bank)
    if (oldPurchase.bankAccountId && oldPurchase.status === 'paid') {
      await client.query(
        `UPDATE hisab."bankAccounts"
         SET "currentBalance" = "currentBalance" + $1
         WHERE "id" = $2 AND "companyId" = $3`,
        [oldPurchase.netPayable, oldPurchase.bankAccountId, companyId]
      );
    }

    await client.query(
      `DELETE FROM hisab."purchase_items" 
       WHERE "purchaseId" = $1 AND "companyId" = $2`,
      [purchaseId, companyId]
    );

    // Get current payment status before updating
    const currentPurchaseQuery = await client.query(
      `SELECT "paid_amount", "remaining_amount", "netPayable" FROM hisab."purchases" 
       WHERE "id" = $1 AND "companyId" = $2`,
      [purchaseId, companyId]
    );
    
    const currentPurchase = currentPurchaseQuery.rows[0];
    const currentPaidAmount = parseFloat(currentPurchase.paid_amount || 0);
    const oldNetPayable = parseFloat(currentPurchase.netPayable || 0);
    
    // Calculate new remaining amount based on the new total and existing payments
    let remainingAmount, paidAmount;
    
    if (currentPaidAmount > 0) {
      // There are existing payments, preserve them
      paidAmount = currentPaidAmount;
      
      // If the new total is different, adjust the remaining amount
      if (netPayable !== oldNetPayable) {
        remainingAmount = Math.max(0, netPayable - currentPaidAmount);
        
        // If paid amount exceeds new total, adjust accordingly
        if (currentPaidAmount >= netPayable) {
          remainingAmount = 0;
          // Note: We keep paidAmount as is, even if it exceeds netPayable
          // This creates an overpayment scenario that can be handled separately
        }
      } else {
        // Total didn't change, keep existing remaining amount
        remainingAmount = parseFloat(currentPurchase.remaining_amount || 0);
      }
    } else {
      // No existing payments, use status-based logic
      if (finalStatus === 'paid') {
        remainingAmount = 0;
        paidAmount = netPayable;
      } else {
        remainingAmount = netPayable;
        paidAmount = 0;
      }
    }

    await client.query(
      `UPDATE hisab."purchases"
       SET "bankAccountId" = $1,
           "contactId" = $2,
           "invoiceNumber" = $3,
           "invoiceDate" = $4,
           "taxType" = $5,
           "rateType" = $6,
           "discountType" = $7,
           "discountValue" = $8,
           "discountValueType" = $9,
           "roundOff" = $10,
           "internalNotes" = $11,
           "basicAmount" = $12,
           "totalDiscount" = $13,
           "taxAmount" = $14,
           "netPayable" = $15,
           "status" = $16,
           "remaining_amount" = $17,
           "paid_amount" = $18,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $19 AND "companyId" = $20`,
      [
        bankAccountId,
        contactId,
        invoiceNumber,
        date,
        taxType,
        rateType,
        discountType,
        discountValue,
        discountValueType,
        roundOff,
        internalNotes,
        basicAmount,
        totalDiscount,
        taxAmount,
        netPayable,
        finalStatus,
        remainingAmount,
        paidAmount,
        purchaseId,
        companyId
      ]
    );

    // Add new items and update inventory
    for (const item of items) {
      const {
        productId,
        quantity: qty,
        rate,
        rateType: itemRateType,
        taxRate,
        taxAmount: itemTaxAmount,
        discount,
        discountRate,
        total,
        serialNumbers = []
      } = item;

      const itemRes = await client.query(
        `INSERT INTO hisab."purchase_items"
         ("purchaseId", "companyId", "productId", "qty", "rate", "rateType", "discount", 
         "discountRate", "taxRate", "taxAmount", "total", "serialNumbers")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id`,
        [
          purchaseId, companyId, productId, qty, rate, itemRateType || rateType, discount,
          discountRate, taxRate, itemTaxAmount, total,
          serialNumbers.length > 0 ? serialNumbers : null
        ]
      );

      const purchaseItemId = itemRes.rows[0].id;

      await client.query(
        `UPDATE hisab."products"
         SET "currentStock" = "currentStock" + $1
         WHERE "id" = $2 AND "companyId" = $3`,
        [qty, productId, companyId]
      );

      const productRes = await client.query(
        `SELECT "isInventoryTracked", "isSerialized" FROM hisab."products"
         WHERE "id" = $1 AND "companyId" = $2`,
        [productId, companyId]
      );

      const product = productRes.rows[0];

      if (product.isSerialized && product.isInventoryTracked && serialNumbers.length > 0) {
        for (const serialNumber of serialNumbers) {
          await client.query(
            `INSERT INTO hisab."serialNumbers"
             ("companyId", "productId", "serialNumber", "status", "purchaseDate", "purchaseItemId")
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [companyId, productId, serialNumber, 'in_stock', date, purchaseItemId]
          );
        }
      }
    }

    // Only update bank balance if status is 'paid' and bank account is provided
    if (bankAccountId && finalStatus === 'paid') {
      await client.query(
        `UPDATE hisab."bankAccounts"
         SET "currentBalance" = "currentBalance" - $1
         WHERE "id" = $2 AND "companyId" = $3`,
        [netPayable, bankAccountId, companyId]
      );
    }

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Purchase updated successfully",
      purchaseId,
      status: finalStatus
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error in updatePurchase:", error);
    
    // Provide more specific error messages
    if (error.code === '23503') {
      if (error.constraint === 'serialNumbers_purchaseItemId_fkey') {
        return errorResponse(res, "Error creating serial numbers: Invalid purchase item reference", 400);
      }
      return errorResponse(res, "Foreign key constraint violation", 400);
    } else if (error.code === '23505') {
      return errorResponse(res, "Duplicate entry found", 400);
    } else if (error.code === '23514') {
      return errorResponse(res, "Data validation failed", 400);
    } else if (error.code === '42P01') {
      return errorResponse(res, "Database table not found", 500);
    } else if (error.code === '42703') {
      return errorResponse(res, "Database column not found", 500);
    }
    
    // Check for specific error messages
    if (error.message.includes('stock')) {
      return errorResponse(res, error.message, 400);
    }
    if (error.message.includes('serial')) {
      return errorResponse(res, error.message, 400);
    }

    return errorResponse(res, "Failed to update purchase", 500);
  } finally {
    client.release();
  }
}

export async function deletePurchase(req, res) {
  const { id } = req.query;  // Get ID from URL params (e.g., DELETE /purchases/:id)
  const companyId = req.currentUser?.companyId;
  const userId = req.currentUser?.id;

  if (!id || !companyId || !userId) {
    return errorResponse(res, "Invalid request", 400);
  }

  if (isNaN(parseInt(id))) {
    return errorResponse(res, "Invalid purchase ID", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Get the purchase with FOR UPDATE lock to prevent concurrent modifications
    const purchaseRes = await client.query(
      `SELECT * FROM hisab."purchases"
       WHERE "id" = $1 AND "companyId" = $2 AND "deletedAt" IS NULL
       FOR UPDATE`,
      [id, companyId]
    );

    if (purchaseRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Purchase not found", 404);
    }

    const purchase = purchaseRes.rows[0];

    // Get all purchase items with product details and FOR UPDATE lock on products
    const itemsRes = await client.query(
      `SELECT pi.*, p."isInventoryTracked", p."isSerialized", p."currentStock"
       FROM hisab."purchase_items" pi
       JOIN hisab."products" p ON pi."productId" = p."id" AND pi."companyId" = p."companyId"
       WHERE pi."purchaseId" = $1 AND pi."companyId" = $2
       FOR UPDATE OF p`,
      [id, companyId]
    );

    // Validate inventory before deletion
    for (const item of itemsRes.rows) {
      if (item.isInventoryTracked) {
        console.log("item.currentStock", item.currentStock)
        console.log("item.qty", item.qty)

        // Convert both values to numbers for proper comparison
        const currentStock = parseFloat(item.currentStock);
        const requiredQty = parseFloat(item.qty);

        console.log("currentStock (parsed)", currentStock)
        console.log("requiredQty (parsed)", requiredQty)
        console.log("currentStock < requiredQty", currentStock < requiredQty)

        // Check if we have enough stock to deduct
        if (currentStock < requiredQty) {
          await client.query("ROLLBACK");
          return errorResponse(res,
            `Insufficient stock for product ID ${item.productId}. Current: ${currentStock}, Required: ${requiredQty}`,
            400
          );
        }

        // For serialized products, check if serial numbers are still available
        if (item.isSerialized) {
          const serialsInStock = await client.query(
            `SELECT COUNT(*) as count FROM hisab."serialNumbers"
       WHERE "companyId" = $1 AND "productId" = $2 AND "purchaseItemId" = $3 AND "status" = 'in_stock'`,
            [companyId, item.productId, item.id]
          );

          if (parseInt(serialsInStock.rows[0].count) < requiredQty) {
            await client.query("ROLLBACK");
            return errorResponse(res,
              `Some serial numbers for product ID ${item.productId} have already been sold and cannot be deleted`,
              400
            );
          }
        }
      }
    }

    // Reverse inventory changes
    for (const item of itemsRes.rows) {
      if (item.isInventoryTracked) {
        // Reduce product stock (reverse the addition from purchase)
        await client.query(
          `UPDATE hisab."products"
           SET "currentStock" = "currentStock" - $1,
               "updatedAt" = CURRENT_TIMESTAMP
           WHERE "id" = $2 AND "companyId" = $3`,
          [item.qty, item.productId, companyId]
        );

        // For serialized products, remove serial numbers
        if (item.isSerialized) {
          await client.query(
            `DELETE FROM hisab."serialNumbers"
             WHERE "companyId" = $1 AND "productId" = $2 AND "purchaseItemId" = $3`,
            [companyId, item.productId, item.id]
          );
        }
      }
    }

    // Reverse bank account balance changes (only if purchase was paid via bank)
    if (purchase.bankAccountId && purchase.status === 'paid') {
      // Get current bank balance and lock the row
      const bankRes = await client.query(
        `SELECT "currentBalance" FROM hisab."bankAccounts"
         WHERE "id" = $1 AND "companyId" = $2
         FOR UPDATE`,
        [purchase.bankAccountId, companyId]
      );

      if (bankRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, "Bank account not found", 404);
      }

      // Add back the amount to bank account (reverse the deduction from purchase)
      await client.query(
        `UPDATE hisab."bankAccounts"
         SET "currentBalance" = "currentBalance" + $1,
             "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = $2 AND "companyId" = $3`,
        [purchase.netPayable, purchase.bankAccountId, companyId]
      );
    }

    // Soft delete purchase items first
    await client.query(
      `UPDATE hisab."purchase_items"
       SET "deletedAt" = CURRENT_TIMESTAMP
       WHERE "purchaseId" = $1 AND "companyId" = $2`,
      [id, companyId]
    );

    // Soft delete the purchase
    await client.query(
      `UPDATE hisab."purchases"
       SET "deletedAt" = CURRENT_TIMESTAMP,
           "deletedBy" = $1,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $2 AND "companyId" = $3`,
      [userId, id, companyId]
    );

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Purchase deleted successfully",
      purchaseId: id,
      deletedItems: itemsRes.rows.length,
      reversedAmount: purchase.status === 'paid' ? purchase.netPayable : 0
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete purchase error:", error);

    // Provide more specific error messages
    if (error.code === '23503') {
      return errorResponse(res, "Foreign key constraint violation - cannot delete purchase with related records", 400);
    } else if (error.code === '23505') {
      return errorResponse(res, "Duplicate entry found", 400);
    } else if (error.code === '23514') {
      return errorResponse(res, "Data validation failed", 400);
    } else if (error.code === '42P01') {
      return errorResponse(res, "Database table not found", 500);
    } else if (error.code === '42703') {
      return errorResponse(res, "Database column not found", 500);
    }
    
    // Check for custom error messages
    if (error.message.includes('stock')) {
      return errorResponse(res, error.message, 400);
    }
    if (error.message.includes('serial')) {
      return errorResponse(res, error.message, 400);
    }

    return errorResponse(res, "Failed to delete purchase", 500);
  } finally {
    client.release();
  }
}

export async function getPurchase(req, res) {
  const { id } = req.query;


  const companyId = req.currentUser?.companyId;
  if (!id || !companyId) {
    return errorResponse(res, "Invalid request", 400);
  }

  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT 
        p.*,
        c."name" as "contactName",
        c."email" as "contactEmail",
        c."mobile" as "contactMobile",
        c."gstin" as "contactGstin",
        c."billingAddress1" as "contactBillingAddress1",
        c."billingAddress2" as "contactBillingAddress2",
        c."billingCity" as "contactBillingCity",
        c."billingState" as "contactBillingState",
        c."billingPincode" as "contactBillingPincode",
        c."billingCountry" as "contactBillingCountry",
        ba."accountName" as "bankAccountName",
        ba."accountType" as "bankAccountType"
       FROM hisab."purchases" p
       LEFT JOIN hisab."contacts" c ON p."contactId" = c."id"
       LEFT JOIN hisab."bankAccounts" ba ON p."bankAccountId" = ba."id"
       WHERE p.id = $1 AND p."companyId" = $2 AND p."deletedAt" IS NULL`,
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, "Purchase not found", 404);
    }

    const purchase = result.rows[0];

    const itemsQuery = `
      SELECT pi.*, p."name" as "productName", p."itemCode" as "productCode",
             p."isInventoryTracked", p."isSerialized"
      FROM hisab."purchase_items" pi
      JOIN hisab."products" p ON pi."productId" = p."id" AND pi."companyId" = p."companyId"
      WHERE pi."purchaseId" = $1 AND pi."companyId" = $2
    `;

    const items = await client.query(itemsQuery, [id, companyId]);

    const itemsWithSerials = await Promise.all(
      items.rows.map(async (item) => {
        let serialNumbers = [];

        if (item.isInventoryTracked && item.isSerialized) {
          const serialsRes = await client.query(
            `SELECT "serialNumber" FROM hisab."serialNumbers"
             WHERE "companyId" = $1 AND "productId" = $2 AND "purchaseDate" = $3`,
            [companyId, item.productId, purchase.invoiceDate]
          );
          serialNumbers = serialsRes.rows.map(row => row.serialNumber);
        }

        return {
          id: item.id,
          productId: item.productId,
          name: item.productName,
          code: item.productCode,
          quantity: item.qty,
          rate: parseFloat(item.rate || 0),
          rateType: item.rateType || 'without_tax',
          taxRate: parseFloat(item.taxRate || 0),
          taxAmount: parseFloat(item.taxAmount || 0),
          discount: parseFloat(item.discount || 0),
          discountRate: parseFloat(item.discountRate || 0),
          total: parseFloat(item.total || 0),
          isSerialized: item.isSerialized || false,
          isInventoryTracked: item.isInventoryTracked || false,
          serialNumbers
        };
      })
    );

    return successResponse(res, {
      purchase,
      items: itemsWithSerials
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete error:", error);
    return errorResponse(res, "Failed to delete purchase", 500);
  } finally {
    client.release();
  }
}

// Generate Purchase Invoice PDF - Optimized for speed
export async function generatePurchaseInvoicePDF(req, res) {
  const { id } = req.query;
  const companyId = req.currentUser?.companyId;

  if (!id) {
    return errorResponse(res, "Purchase ID is required", 400);
  }
  
  if (!companyId) {
    return errorResponse(res, "Company ID is required. Please ensure you are authenticated.", 401);
  }

  const client = await pool.connect();

  try {
    // Optimized: Fetch purchase details and items in parallel for faster response
    const [purchaseResult, itemsResult] = await Promise.all([
      client.query(`
        SELECT 
          p.*,
          c."name" as "contactName",
          c."email" as "contactEmail",
          c."mobile" as "contactMobile",
          c."gstin" as "contactGstin",
          c."billingAddress1" as "contactBillingAddress1",
          c."billingAddress2" as "contactBillingAddress2",
          c."billingCity" as "contactBillingCity",
          c."billingState" as "contactBillingState",
          c."billingPincode" as "contactBillingPincode",
          c."billingCountry" as "contactBillingCountry",
          ba."accountName" as "bankAccountName",
          ba."accountType" as "bankAccountType",
          comp."name" as "companyName",
          comp."logoUrl",
          comp."address1",
          comp."address2", 
          comp."city",
          comp."state",
          comp."pincode",
          comp."country",
          comp."gstin" as "companyGstin"
        FROM hisab."purchases" p
        LEFT JOIN hisab."contacts" c ON p."contactId" = c.id
        LEFT JOIN hisab."bankAccounts" ba ON p."bankAccountId" = ba.id
        LEFT JOIN hisab."companies" comp ON p."companyId" = comp.id
        WHERE p."id" = $1 AND p."companyId" = $2 AND p."deletedAt" IS NULL
      `, [id, companyId]),
      
      client.query(`
        SELECT 
          pi.*,
          p."name" as "productName",
          p."itemCode" as "productCode",
          p."currentStock",
          p."isInventoryTracked",
          p."isSerialized"
        FROM hisab."purchase_items" pi
        LEFT JOIN hisab."products" p ON pi."productId" = p.id
        WHERE pi."purchaseId" = $1 AND pi."companyId" = $2
        ORDER BY pi.id
      `, [id, companyId])
    ]);

    if (purchaseResult.rows.length === 0) {
      return errorResponse(res, "Purchase not found", 404);
    }

    const purchase = purchaseResult.rows[0];
    const items = itemsResult.rows;

    // Prepare data for PDF generation
    const pdfData = {
      purchase: {
        id: purchase.id,
        invoiceNumber: purchase.invoiceNumber,
        invoiceDate: purchase.invoiceDate,
        status: purchase.status,
        taxType: purchase.taxType,
        discountType: purchase.discountType,
        discountValue: purchase.discountValue,
        basicAmount: purchase.basicAmount,
        totalDiscount: purchase.totalDiscount,
        taxAmount: purchase.taxAmount,
        roundOff: purchase.roundOff,
        netPayable: purchase.netPayable,
        internalNotes: purchase.internalNotes
      },
      company: {
        name: purchase.companyName,
        logoUrl: purchase.logoUrl,
        address1: purchase.address1,
        address2: purchase.address2,
        city: purchase.city,
        state: purchase.state,
        pincode: purchase.pincode,
        country: purchase.country,
        gstin: purchase.companyGstin
      },
      contact: {
        name: purchase.contactName,
        email: purchase.contactEmail,
        mobile: purchase.contactMobile,
        gstin: purchase.contactGstin,
        billingAddress1: purchase.contactBillingAddress1,
        billingAddress2: purchase.contactBillingAddress2,
        billingCity: purchase.contactBillingCity,
        billingState: purchase.contactBillingState,
        billingPincode: purchase.contactBillingPincode,
        billingCountry: purchase.contactBillingCountry
      },
      bankAccount: {
        accountName: purchase.bankAccountName,
        accountType: purchase.bankAccountType
      },
      items: items
    };

    // Generate HTML content
    const htmlContent = createFastPurchaseInvoiceHTML(pdfData);

    // Generate unique filename
    const pdfFileName = generateFastPurchaseInvoicePDFFileName(purchase.invoiceNumber, purchase.companyName);

    // Generate PDF buffer
    const pdfBuffer = await generateFastPurchaseInvoicePDF(htmlContent);

    // Upload to S3
    const pdfUrl = await uploadFileToS3(pdfBuffer, pdfFileName);

    return successResponse(res, {
      message: "Purchase invoice PDF generated successfully",
      pdfUrl: pdfUrl,
      fileName: pdfFileName,
      actionType: 'generated'
    });

  } catch (error) {
    console.error("Error generating purchase invoice PDF:", error);
    
    // Handle specific error types
    if (error.message?.includes('not found')) {
      return errorResponse(res, "Purchase or related data not found", 404);
    } else if (error.message?.includes('PDF generation failed')) {
      return errorResponse(res, "Failed to generate PDF document", 500);
    } else if (error.message?.includes('upload failed')) {
      return errorResponse(res, "Failed to upload PDF to cloud storage", 500);
    } else {
    return errorResponse(res, "Failed to generate purchase invoice PDF", 500);
    }
  } finally {
    client.release();
  }
}

export async function listPurchases(req, res) {
  const companyId = req.currentUser?.companyId;
  const userId = req.currentUser?.id;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const {
    page = 1,
    limit = 20,
    search = '',
    status = '',
    invoiceNumber = '',
    startDate = null,
    endDate = null,
    sortBy = 'createdAt',
    sortOrder = 'DESC',
    includeSerialNumbers = 'true' // New parameter to optionally include serial numbers
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const client = await pool.connect();

  try {
    // Build dynamic WHERE clause
    let whereConditions = [`p."companyId" = $1`, `p."deletedAt" IS NULL`];
    let queryParams = [companyId];
    let paramIndex = 2;

    // Search filter (contact name or bank account name)
    if (search) {
      whereConditions.push(
        `(c."name" ILIKE $${paramIndex} OR ba."accountName" ILIKE $${paramIndex})`
      );
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Status filter
    if (status) {
      whereConditions.push(`p."status" = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    // Invoice number filter
    if (invoiceNumber) {
      whereConditions.push(`p."invoiceNumber" ILIKE $${paramIndex}`);
      queryParams.push(`%${invoiceNumber}%`);
      paramIndex++;
    }

    // Date range filters
    if (startDate) {
      whereConditions.push(`p."invoiceDate" >= $${paramIndex}`);
      queryParams.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      whereConditions.push(`p."invoiceDate" <= $${paramIndex}`);
      queryParams.push(endDate);
      paramIndex++;
    }

    // Validate sort parameters
    const validSortFields = ['createdAt', 'invoiceDate', 'invoiceNumber', 'netPayable', 'basicAmount'];
    const validSortOrders = ['ASC', 'DESC'];

    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const finalSortOrder = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    const whereClause = whereConditions.join(' AND ');

    // Store the params for count/stats queries (before adding limit/offset)
    const baseQueryParams = [...queryParams];

    // Main query - Get purchases first
    const purchasesQuery = `
      SELECT 
        p."id",
        p."invoiceNumber",
        p."invoiceDate",
        p."taxType",
        p."rateType",
        p."discountType",
        p."discountValueType",
        p."discountValue",
        p."roundOff",
        p."internalNotes",
        p."basicAmount",
        p."totalDiscount",
        p."taxAmount",
        p."status",
        p."netPayable",
        p."remaining_amount",
        p."paid_amount",
        p."createdAt",
        p."updatedAt",
        
        -- Bank account details
        ba."id" as "bankAccountId",
        ba."accountName" as "bankAccountName",
        ba."accountType" as "bankAccountType",
        
        -- Contact details
        c."id" as "contactId",
        c."name" as "contactName",
        c."mobile" as "contactMobile",
        c."email" as "contactEmail",
        c."gstin" as "contactGstin",
        c."billingAddress1" as "contactBillingAddress1",
        c."billingAddress2" as "contactBillingAddress2",
        c."billingCity" as "contactBillingCity",
        c."billingState" as "contactBillingState",
        c."billingPincode" as "contactBillingPincode",
        c."billingCountry" as "contactBillingCountry",
        
        -- User details
        u."name" as "createdByName",
        u."email" as "createdByEmail"
        
      FROM hisab."purchases" p
      LEFT JOIN hisab."bankAccounts" ba ON p."bankAccountId" = ba."id"
      LEFT JOIN hisab."contacts" c ON p."contactId" = c."id"
      LEFT JOIN hisab."users" u ON p."userId" = u."id"
      WHERE ${whereClause}
      ORDER BY p."${finalSortBy}" ${finalSortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    // Add limit and offset to params for purchases query
    queryParams.push(parseInt(limit), offset);

    // Count query
    const countQuery = `
      SELECT COUNT(DISTINCT p."id") as total
      FROM hisab."purchases" p
      LEFT JOIN hisab."bankAccounts" ba ON p."bankAccountId" = ba."id"
      LEFT JOIN hisab."contacts" c ON p."contactId" = c."id"
      WHERE ${whereClause}
    `;

    // Get summary statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as "totalPurchases",
        COALESCE(SUM(p."netPayable"), 0) as "totalAmount",
        COALESCE(SUM(p."basicAmount"), 0) as "totalBasicAmount",
        COALESCE(SUM(p."totalDiscount"), 0) as "totalDiscountAmount",
        COALESCE(SUM(p."taxAmount"), 0) as "totalTaxAmount",
        COALESCE(AVG(p."netPayable"), 0) as "averageAmount",
        COUNT(CASE WHEN p."bankAccountId" IS NOT NULL THEN 1 END) as "bankPayments",
        COUNT(CASE WHEN p."contactId" IS NOT NULL THEN 1 END) as "creditPurchases"
      FROM hisab."purchases" p
      LEFT JOIN hisab."bankAccounts" ba ON p."bankAccountId" = ba."id"
      LEFT JOIN hisab."contacts" c ON p."contactId" = c."id"
      WHERE ${whereClause}
    `;

    const [purchasesResult, countResult, statsResult] = await Promise.all([
      client.query(purchasesQuery, queryParams),
      client.query(countQuery, baseQueryParams),
      client.query(statsQuery, baseQueryParams)
    ]);

    // Get items for all purchases if any found
    let purchases = [];

    if (purchasesResult.rows.length > 0) {
      const purchaseIds = purchasesResult.rows.map(p => p.id);

      // Get all items for these purchases
      const itemsQuery = `
        SELECT 
          pi."id",
          pi."purchaseId",
          pi."productId",
          pi."qty",
          pi."rate",
          pi."rateType",
          pi."discount",
          pi."discountRate",
          pi."taxRate",
          pi."taxAmount",
          pi."total",
          pi."serialNumbers" as "storedSerialNumbers",
          pr."name" as "productName",
          pr."itemCode" as "productCode",
          pr."isInventoryTracked",
          pr."isSerialized"
        FROM hisab."purchase_items" pi
        JOIN hisab."products" pr ON pi."productId" = pr."id" AND pi."companyId" = pr."companyId"
        WHERE pi."purchaseId" = ANY($1) AND pi."companyId" = $2
        ORDER BY pi."purchaseId", pi."id"
      `;

      const itemsResult = await client.query(itemsQuery, [purchaseIds, companyId]);

      // Get serial numbers if requested
      let serialNumbersMap = new Map();
      if (includeSerialNumbers === 'true') {
        // Method 1: Try to get from serialNumbers table using purchaseItemId
        // (This is the correct approach based on your create/update functions)
        const serialsQuery = `
          SELECT 
            pi."id" as "purchaseItemId",
            pi."purchaseId",
            pi."productId",
            COALESCE(
              json_agg(
                CASE 
                  WHEN sn."serialNumber" IS NOT NULL 
                  THEN sn."serialNumber" 
                  ELSE NULL 
                END
              ) FILTER (WHERE sn."serialNumber" IS NOT NULL), 
              '[]'::json
            ) as "serialNumbers"
          FROM hisab."purchase_items" pi
          LEFT JOIN hisab."serialNumbers" sn ON sn."purchaseItemId" = pi."id" AND sn."companyId" = pi."companyId"
          WHERE pi."purchaseId" = ANY($1) AND pi."companyId" = $2
          GROUP BY pi."id", pi."purchaseId", pi."productId"
        `;

        const serialsResult = await client.query(serialsQuery, [purchaseIds, companyId]);

        // Create a map for quick lookup
        serialsResult.rows.forEach(row => {
          const key = `${row.purchaseItemId}`;
          serialNumbersMap.set(key, row.serialNumbers || []);
        });
      }

      // Group items by purchase
      const itemsByPurchase = new Map();
      itemsResult.rows.forEach(item => {
        if (!itemsByPurchase.has(item.purchaseId)) {
          itemsByPurchase.set(item.purchaseId, []);
        }

        // Get serial numbers for this item
        let serialNumbers = [];
        if (includeSerialNumbers === 'true') {
          // First try from serialNumbers table
          serialNumbers = serialNumbersMap.get(`${item.id}`) || [];

          // If no serial numbers found in serialNumbers table and we have stored serial numbers
          // (fallback for data stored directly in purchase_items table)
          if (serialNumbers.length === 0 && item.storedSerialNumbers) {
            serialNumbers = Array.isArray(item.storedSerialNumbers) ? item.storedSerialNumbers : [];
          }
        }

        itemsByPurchase.get(item.purchaseId).push({
          id: item.id,
          productId: item.productId,
          name: item.productName,
          code: item.productCode,
          quantity: item.qty,
          rate: parseFloat(item.rate || 0),
          rateType: item.rateType || 'without_tax',
          discount: parseFloat(item.discount || 0),
          discountRate: parseFloat(item.discountRate || 0),
          taxRate: parseFloat(item.taxRate || 0),
          taxAmount: parseFloat(item.taxAmount || 0),
          total: parseFloat(item.total || 0),
          serialNumbers: serialNumbers,
          isInventoryTracked: item.isInventoryTracked,
          isSerialized: item.isSerialized
        });
      });

      // Process purchases with their items
      purchases = purchasesResult.rows.map(row => {
        const items = itemsByPurchase.get(row.id) || [];

        return {
          id: row.id,
          invoiceNumber: row.invoiceNumber,
          status: row.status,
          invoiceDate: row.invoiceDate,
          taxType: row.taxType,
          rateType: row.rateType,
          discountType: row.discountType,
          discountValueType: row.discountValueType,
          discountValue: parseFloat(row.discountValue || 0),
          roundOff: parseFloat(row.roundOff || 0),
          internalNotes: row.internalNotes,
          basicAmount: parseFloat(row.basicAmount || 0),
          totalDiscount: parseFloat(row.totalDiscount || 0),
          taxAmount: parseFloat(row.taxAmount || 0),
          netPayable: parseFloat(row.netPayable || 0),
          remainingAmount: parseFloat(row.remaining_amount || 0),
          paidAmount: parseFloat(row.paid_amount || 0),
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,

          // Payment details
          paymentMethod: row.bankAccountId ? 'bank' : 'credit',
          bankAccount: row.bankAccountId ? {
            id: row.bankAccountId,
            name: row.bankAccountName,
            type: row.bankAccountType
          } : null,
          contact: row.contactId ? {
            id: row.contactId,
            name: row.contactName,
            mobile: row.contactMobile,
            email: row.contactEmail,
            gstin: row.contactGstin,
            billingAddress1: row.contactBillingAddress1,
            billingAddress2: row.contactBillingAddress2,
            billingCity: row.contactBillingCity,
            billingState: row.contactBillingState,
            billingPincode: row.contactBillingPincode,
            billingCountry: row.contactBillingCountry
          } : null,

          // Creator details
          createdBy: {
            name: row.createdByName,
            email: row.createdByEmail
          },

          // Items
          itemsCount: items.length,
          items: items
        };
      });
    }

    return successResponse(res, {
      purchases,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(parseInt(countResult.rows[0].total) / parseInt(limit))
      },
      stats: {
        totalPurchases: parseInt(statsResult.rows[0].totalPurchases || 0),
        totalAmount: parseFloat(statsResult.rows[0].totalAmount || 0),
        totalBasicAmount: parseFloat(statsResult.rows[0].totalBasicAmount || 0),
        totalDiscountAmount: parseFloat(statsResult.rows[0].totalDiscountAmount || 0),
        totalTaxAmount: parseFloat(statsResult.rows[0].totalTaxAmount || 0),
        averageAmount: parseFloat(statsResult.rows[0].averageAmount || 0),
        bankPayments: parseInt(statsResult.rows[0].bankPayments || 0),
        creditPurchases: parseInt(statsResult.rows[0].creditPurchases || 0)
      }
    });

  } catch (error) {
    console.error("List purchases error:", error);
    return errorResponse(res, "Failed to fetch purchases list", 500);
  } finally {
    client.release();
  }
}

export async function getNextInvoiceNumber(req, res) {
  const client = await pool.connect();
  const companyId = req.currentUser?.companyId;

  if (!companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  try {
    // Get the last invoice number for this company
    const lastInvoiceRes = await client.query(
      `SELECT "invoiceNumber" FROM hisab."purchases" 
       WHERE "companyId" = $1 
       ORDER BY "invoiceNumber" DESC 
       LIMIT 1`,
      [companyId]
    );

    let nextInvoiceNumber = "PI-0001";

    if (lastInvoiceRes.rows.length > 0) {
      const lastInvoiceNumber = lastInvoiceRes.rows[0].invoiceNumber;
      
      // Extract the number part and increment it
      const match = lastInvoiceNumber.match(/PI-(\d+)/);
      if (match) {
        const lastNumber = parseInt(match[1]);
        const nextNumber = lastNumber + 1;
        nextInvoiceNumber = `PI-${nextNumber.toString().padStart(4, '0')}`;
      }
    }

    return successResponse(res, { nextInvoiceNumber });
  } catch (error) {
    console.error('Error getting next invoice number:', error);
    return errorResponse(res, "Failed to get next invoice number", 500);
  } finally {
    client.release();
  }
}
