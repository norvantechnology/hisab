import pool from "../config/dbConnection.js";
import { errorResponse, successResponse, uploadFileToS3 } from "../utils/index.js";
import { handlePaymentAllocationsOnTransactionDelete } from "../utils/paymentAllocationUtils.js";
import { sendEmail } from "../utils/emailUtils.js";
import { sendWhatsAppDocument, sendWhatsAppTextMessage, isValidWhatsAppNumber } from "../utils/whatsappService.js";
import { generatePDFFromTemplate, generateInvoicePDFFileName, createSalesInvoiceTemplateData } from "../utils/templatePDFGenerator.js";

export async function createSale(req, res) {
  const client = await pool.connect();

  const {
    invoiceNumber,
    invoiceDate,
    contactId,
    bankAccountId,
    taxType,
    rateType,
    discountScope,
    discountValueType,
    discountValue,
    status,
    internalNotes = '',
    transportationCharge = 0,
    roundOff = 0,
    basicAmount,
    totalItemDiscount,
    invoiceDiscount,
    totalDiscount,
    taxAmount,
    netReceivable,
    items
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

  // At least one of contactId or bankAccountId should be provided
  if (!contactId && !bankAccountId) {
    return errorResponse(res, "Either contactId or bankAccountId is required", 400);
  }

  try {
    await client.query("BEGIN");

    // Validate products and check stock availability
    for (const item of items) {
      const { productId, quantity, serialNumbers = [] } = item;
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

      // Check stock availability for inventory-tracked products
      if (product.isInventoryTracked) {
        const availableStock = parseFloat(product.currentStock) || 0;
        if (quantity > availableStock) {
          await client.query("ROLLBACK");
          return errorResponse(res, `Insufficient stock for product ${productId}. Available: ${availableStock}, Required: ${quantity}`, 400);
        }
      }

      // Validate serial numbers for serialized products
      if (product.isSerialized && product.isInventoryTracked) {
        if (!Array.isArray(serialNumbers) || serialNumbers.length === 0) {
          await client.query("ROLLBACK");
          return errorResponse(res, `Serial numbers required for serialized product ${productId}`, 400);
        }

        if (serialNumbers.length !== quantity) {
          await client.query("ROLLBACK");
          return errorResponse(res, `Serial numbers count must match quantity for product ${productId}`, 400);
        }

        // Check if serial numbers exist in inventory
        for (const serialObj of serialNumbers) {
          const serialNumber = serialObj.serialNumber;
          const existingSerial = await client.query(
            `SELECT "id" FROM hisab."serialNumbers" 
             WHERE "companyId" = $1 AND "productId" = $2 AND "serialNumber" = $3 AND "status" = 'in_stock'`,
            [companyId, productId, serialNumber]
          );

          if (existingSerial.rows.length === 0) {
            await client.query("ROLLBACK");
            return errorResponse(res, `Serial number ${serialNumber} not available in inventory for product ${productId}`, 400);
          }
        }
      }
    }

    // Calculate remaining_amount and paid_amount based on status
    let remainingAmount, paidAmount;
    if (status === 'paid') {
      remainingAmount = 0;
      paidAmount = netReceivable;
    } else {
      remainingAmount = netReceivable;
      paidAmount = 0;
    }

    // Create sale record with new schema
    const saleResult = await client.query(
      `INSERT INTO hisab."sales" (
        "companyId", "userId", "bankAccountId", "contactId", "invoiceNumber", "invoiceDate",
        "taxType", "rateType", "discountScope", "discountValueType", "discountValue",
        "basicAmount", "totalItemDiscount", "invoiceDiscount", "totalDiscount", "taxAmount",
        "transportationCharge", "roundOff", "netReceivable", "status", "remaining_amount", "paid_amount", "internalNotes"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING *`,
      [
        companyId, userId, bankAccountId, contactId, invoiceNumber, invoiceDate,
        taxType, rateType, discountScope, discountValueType, discountValue,
        basicAmount, totalItemDiscount, invoiceDiscount, totalDiscount, taxAmount,
        transportationCharge, roundOff, netReceivable, status, remainingAmount, paidAmount, internalNotes
      ]
    );

    const saleId = saleResult.rows[0].id;

    // Create sale items with new schema
    for (const item of items) {
      const {
        productId, quantity, rate, rateType: itemRateType, taxRate = 0, taxAmount = 0,
        discountType = 'rupees', discountValue = 0, discountAmount = 0,
        lineBasic, lineTotal, serialNumbers = []
      } = item;

      const saleItemResult = await client.query(
        `INSERT INTO hisab."sale_items" (
          "saleId", "productId", quantity, rate, "discountType", "discountValue", "discountAmount",
          "taxRate", "taxAmount", "lineBasic", "lineTotal", "rateType"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [saleId, productId, quantity, rate, discountType, discountValue, discountAmount, 
         taxRate, taxAmount, lineBasic, lineTotal, itemRateType || rateType]
      );

      const saleItemId = saleItemResult.rows[0].id;

      // Update product stock
      await client.query(
        `UPDATE hisab."products" 
         SET "currentStock" = "currentStock" - $1, "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = $2 AND "companyId" = $3`,
        [quantity, productId, companyId]
      );

      // Handle serial numbers for serialized products
      if (serialNumbers && serialNumbers.length > 0) {
        for (const serialObj of serialNumbers) {
          const serialNumber = serialObj.serialNumber;
          
          // Mark serial number as sold in main serialNumbers table
          await client.query(
            `UPDATE hisab."serialNumbers" 
             SET "status" = 'sold', "updatedAt" = CURRENT_TIMESTAMP
             WHERE "companyId" = $1 AND "productId" = $2 AND "serialNumber" = $3`,
            [companyId, productId, serialNumber]
          );

          // Create sale serial number record
          await client.query(
            `INSERT INTO hisab."sale_serial_numbers" (
              "saleId", "saleItemId", "productId", "serialNumber"
            ) VALUES ($1, $2, $3, $4)`,
            [saleId, saleItemId, productId, serialNumber]
          );
        }
      }
    }

    // Update bank balance if it's a bank-based sale and status is paid
    if (bankAccountId && status === 'paid') {
      await client.query(
        `UPDATE hisab."bankAccounts" 
         SET "currentBalance" = "currentBalance" + $1, "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = $2 AND "companyId" = $3`,
        [netReceivable, bankAccountId, companyId]
      );
    }

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Sale invoice created successfully",
      sale: saleResult.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Sale creation error:", error);
    return errorResponse(res, "Failed to create sale invoice", 500);
  } finally {
    client.release();
  }
}

export async function updateSale(req, res) {
  const client = await pool.connect();

  const {
    id,
    invoiceNumber,
    invoiceDate,
    contactId,
    bankAccountId,
    taxType,
    rateType,
    discountScope,
    discountValueType,
    discountValue,
    status,
    internalNotes = '',
    transportationCharge = 0,
    roundOff = 0,
    basicAmount,
    totalItemDiscount,
    invoiceDiscount,
    totalDiscount,
    taxAmount,
    netReceivable,
    items
  } = req.body;

  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  if (!id) {
    return errorResponse(res, "Sale ID is required", 400);
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

  try {
    await client.query("BEGIN");

    // Validate products and serial numbers
    for (const item of items) {
      const { productId, quantity, serialNumbers = [] } = item;
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

      // Validate serial numbers for serialized products
      if (product.isSerialized && product.isInventoryTracked) {
        if (!Array.isArray(serialNumbers) || serialNumbers.length === 0) {
          await client.query("ROLLBACK");
          return errorResponse(res, `Serial numbers required for serialized product ${productId}`, 400);
        }

        if (serialNumbers.length !== quantity) {
          await client.query("ROLLBACK");
          return errorResponse(res, `Serial numbers count must match quantity for product ${productId}`, 400);
        }

        // Check if serial numbers exist in inventory
        for (const serialObj of serialNumbers) {
          const serialNumber = serialObj.serialNumber;
          const existingSerial = await client.query(
            `SELECT "id" FROM hisab."serialNumbers" 
             WHERE "companyId" = $1 AND "productId" = $2 AND "serialNumber" = $3 AND "status" = 'in_stock'`,
            [companyId, productId, serialNumber]
          );

          if (existingSerial.rows.length === 0) {
            await client.query("ROLLBACK");
            return errorResponse(res, `Serial number ${serialNumber} not available in inventory for product ${productId}`, 400);
          }
        }
      }
    }

    // Get current payment status before updating
    const currentSaleQuery = await client.query(
      `SELECT "paid_amount", "remaining_amount", "netReceivable" FROM hisab."sales" 
       WHERE "id" = $1 AND "companyId" = $2`,
      [id, companyId]
    );
    
    const currentSale = currentSaleQuery.rows[0];
    const currentPaidAmount = parseFloat(currentSale.paid_amount || 0);
    const oldNetReceivable = parseFloat(currentSale.netReceivable || 0);
    
    // Calculate new remaining amount based on the new total and existing payments
    let remainingAmount, paidAmount;
    
    if (currentPaidAmount > 0) {
      // Keep existing paid amount, calculate new remaining
      paidAmount = Math.min(currentPaidAmount, netReceivable);
      remainingAmount = Math.max(0, netReceivable - paidAmount);
    } else {
      // No payments made yet
      if (status === 'paid') {
        remainingAmount = 0;
        paidAmount = netReceivable;
      } else {
        remainingAmount = netReceivable;
        paidAmount = 0;
      }
    }

    // Delete existing sale items and serial numbers
    await client.query(
      `DELETE FROM hisab."sale_serial_numbers" WHERE "saleId" = $1`,
      [id]
    );

    await client.query(
      `DELETE FROM hisab."sale_items" WHERE "saleId" = $1`,
      [id]
    );

    // Update sale record with new schema
    await client.query(
      `UPDATE hisab."sales" SET
        "invoiceNumber" = $1, "invoiceDate" = $2, "contactId" = $3, "bankAccountId" = $4,
        "taxType" = $5, "rateType" = $6, "discountScope" = $7, "discountValueType" = $8, "discountValue" = $9,
        "basicAmount" = $10, "totalItemDiscount" = $11, "invoiceDiscount" = $12, "totalDiscount" = $13,
        "taxAmount" = $14, "transportationCharge" = $15, "roundOff" = $16, "netReceivable" = $17,
        "status" = $18, "remaining_amount" = $19, "paid_amount" = $20, "internalNotes" = $21, "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $22 AND "companyId" = $23`,
      [
        invoiceNumber, invoiceDate, contactId, bankAccountId,
        taxType, rateType, discountScope, discountValueType, discountValue,
        basicAmount, totalItemDiscount, invoiceDiscount, totalDiscount,
        taxAmount, transportationCharge, roundOff, netReceivable,
        status, remainingAmount, paidAmount, internalNotes, id, companyId
      ]
    );

    // Add new items and update inventory
    for (const item of items) {
      const {
        productId, quantity, rate, rateType: itemRateType, taxRate = 0, taxAmount = 0,
        discountType = 'rupees', discountValue = 0, discountAmount = 0,
        lineBasic, lineTotal, serialNumbers = []
      } = item;

      const itemRes = await client.query(
        `INSERT INTO hisab."sale_items" (
          "saleId", "productId", quantity, rate, "discountType", "discountValue", "discountAmount",
          "taxRate", "taxAmount", "lineBasic", "lineTotal", "rateType"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [id, productId, quantity, rate, discountType, discountValue, discountAmount,
         taxRate, taxAmount, lineBasic, lineTotal, itemRateType || rateType]
      );

      const saleItemId = itemRes.rows[0].id;

      await client.query(
        `UPDATE hisab."products"
         SET "currentStock" = "currentStock" - $1, "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = $2 AND "companyId" = $3`,
        [quantity, productId, companyId]
      );

      // Handle serial numbers for serialized products
      if (serialNumbers && serialNumbers.length > 0) {
        for (const serialObj of serialNumbers) {
          const serialNumber = serialObj.serialNumber;
          
          // Mark serial number as sold
          await client.query(
            `UPDATE hisab."serialNumbers" 
             SET "status" = 'sold', "updatedAt" = CURRENT_TIMESTAMP
             WHERE "companyId" = $1 AND "productId" = $2 AND "serialNumber" = $3`,
            [companyId, productId, serialNumber]
          );

          // Create sale serial number record
          await client.query(
            `INSERT INTO hisab."sale_serial_numbers" (
              "saleId", "saleItemId", "productId", "serialNumber"
            ) VALUES ($1, $2, $3, $4)`,
            [id, saleItemId, productId, serialNumber]
          );
        }
      }
    }

    // Update bank balance if it's a bank-based sale and status is paid
    if (bankAccountId && status === 'paid') {
      await client.query(
        `UPDATE hisab."bankAccounts" 
         SET "currentBalance" = "currentBalance" + $1, "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = $2 AND "companyId" = $3`,
        [netReceivable, bankAccountId, companyId]
      );
    }

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Sale invoice updated successfully",
      saleId: id
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error in updateSale:", error);
    return errorResponse(res, "Failed to update sale invoice", 500);
  } finally {
    client.release();
  }
}

export async function deleteSale(req, res) {
  const { id } = req.query;
  const companyId = req.currentUser?.companyId;
  const userId = req.currentUser?.id;

  if (!companyId || !userId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  if (!id) {
    return errorResponse(res, "Sale ID is required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Get sale details
    const saleQuery = await client.query(
      `SELECT * FROM hisab."sales" WHERE "id" = $1 AND "companyId" = $2 FOR UPDATE`,
      [id, companyId]
    );

    if (saleQuery.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Sale not found", 404);
    }

    const sale = saleQuery.rows[0];

    // Get sale items
    const itemsQuery = await client.query(
      `SELECT * FROM hisab."sale_items" WHERE "saleId" = $1`,
      [id]
    );

    const items = itemsQuery.rows;

    // Reverse inventory changes
    for (const item of items) {
      // Restore product stock
      await client.query(
        `UPDATE hisab."products" 
         SET "currentStock" = "currentStock" + $1, "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = $2 AND "companyId" = $3`,
        [item.quantity, item.productId, companyId]
      );

      // Restore serial numbers
      await client.query(
        `UPDATE hisab."serialNumbers" 
         SET "status" = 'in_stock', "saleDate" = NULL
         WHERE "companyId" = $1 AND "productId" = $2 AND "serialNumber" IN (
           SELECT "serialNumber" FROM hisab."sale_serial_numbers" 
           WHERE "saleItemId" = $3
         )`,
        [companyId, item.productId, item.id]
      );
    }

    // Delete sale serial numbers
    await client.query(`DELETE FROM hisab."sale_serial_numbers" WHERE "saleId" = $1`, [id]);

    // Delete sale items
    await client.query(`DELETE FROM hisab."sale_items" WHERE "saleId" = $1`, [id]);

    // Soft delete sale
    await client.query(
      `UPDATE hisab."sales" 
       SET "deletedAt" = CURRENT_TIMESTAMP, "deletedBy" = $1, "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $2`,
      [userId, id]
    );

    // CRITICAL: Handle payment allocations before deleting
    await handlePaymentAllocationsOnTransactionDelete(client, 'sale', id, companyId, userId);

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Sale invoice deleted successfully"
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Sale deletion error:", error);
    return errorResponse(res, "Failed to delete sale invoice", 500);
  } finally {
    client.release();
  }
}

export async function getSale(req, res) {
  const { id } = req.query;
  const companyId = req.currentUser?.companyId;

  if (!companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  if (!id) {
    return errorResponse(res, "Sale ID is required", 400);
  }

  const client = await pool.connect();

  try {
    // Get sale details with related data
    const saleQuery = `
      SELECT 
        s.*,
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
        ba."accountName",
        ba."accountType",
        u."name" as "createdByName"
      FROM hisab."sales" s
      LEFT JOIN hisab."contacts" c ON s."contactId" = c.id
      LEFT JOIN hisab."bankAccounts" ba ON s."bankAccountId" = ba.id
      LEFT JOIN hisab."users" u ON s."userId" = u.id
      WHERE s."id" = $1 AND s."companyId" = $2 AND s."deletedAt" IS NULL
    `;

    const saleResult = await client.query(saleQuery, [id, companyId]);

    if (saleResult.rows.length === 0) {
      return errorResponse(res, "Sale not found", 404);
    }

    const sale = saleResult.rows[0];

    // Get sale items with product details
    const itemsQuery = `
      SELECT 
        si.*,
        p."name" as "productName",
        p."itemCode" as "productCode",
        p."currentStock",
        p."isInventoryTracked",
        p."isSerialized"
      FROM hisab."sale_items" si
      LEFT JOIN hisab."products" p ON si."productId" = p.id
      WHERE si."saleId" = $1
      ORDER BY si."createdAt"
    `;

    const itemsResult = await client.query(itemsQuery, [id]);

    // Get serial numbers for each item
    const itemsWithSerialNumbers = await Promise.all(
      itemsResult.rows.map(async (item) => {
        const serialNumbersQuery = await client.query(
          `SELECT "serialNumber" FROM hisab."sale_serial_numbers" 
           WHERE "saleItemId" = $1 ORDER BY "createdAt"`,
          [item.id]
        );

        return {
          ...item,
          serialNumbers: serialNumbersQuery.rows.map(row => row.serialNumber)
        };
      })
    );

    return successResponse(res, {
      sale: {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        invoiceDate: sale.invoiceDate,
        contactId: sale.contactId,
        bankAccountId: sale.bankAccountId,
        taxType: sale.taxType,
        rateType: sale.rateType,
        discountScope: sale.discountScope, // Use correct schema field
        discountValueType: sale.discountValueType,
        discountValue: parseFloat(sale.discountValue || 0),
        status: sale.status,
        internalNotes: sale.internalNotes,
        transportationCharge: parseFloat(sale.transportationCharge || 0),
        roundOff: parseFloat(sale.roundOff || 0),
        basicAmount: parseFloat(sale.basicAmount || 0),
        totalItemDiscount: parseFloat(sale.totalItemDiscount || 0),
        invoiceDiscount: parseFloat(sale.invoiceDiscount || 0),
        totalDiscount: parseFloat(sale.totalDiscount || 0),
        taxAmount: parseFloat(sale.taxAmount || 0),
        netReceivable: parseFloat(sale.netReceivable || 0),
        remainingAmount: parseFloat(sale.remaining_amount || 0),
        paidAmount: parseFloat(sale.paid_amount || 0),
        createdAt: sale.createdAt,
        updatedAt: sale.updatedAt,
        
        // Contact and bank account details for edit form
        contact: sale.contactId ? {
          id: sale.contactId,
          name: sale.contactName,
          email: sale.contactEmail,
          mobile: sale.contactMobile,
          gstin: sale.contactGstin,
          billingAddress1: sale.contactBillingAddress1,
          billingAddress2: sale.contactBillingAddress2,
          billingCity: sale.contactBillingCity,
          billingState: sale.contactBillingState,
          billingPincode: sale.contactBillingPincode,
          billingCountry: sale.contactBillingCountry
        } : null,
        
        bankAccount: sale.bankAccountId ? {
          id: sale.bankAccountId,
          name: sale.accountName,
          type: sale.accountType
        } : null,
        
        items: itemsWithSerialNumbers.map(item => ({
          id: item.id,
          productId: item.productId,
          name: item.productName,
          code: item.productCode,
          quantity: parseFloat(item.quantity || 0),
          rate: parseFloat(item.rate || 0),
          rateType: item.rateType || 'without_tax',
          discountType: item.discountType || 'rupees',
          discountValue: parseFloat(item.discountValue || 0),
          discountAmount: parseFloat(item.discountAmount || 0),
          taxRate: parseFloat(item.taxRate || 0),
          taxAmount: parseFloat(item.taxAmount || 0),
          lineBasic: parseFloat(item.lineBasic || 0),
          lineTotal: parseFloat(item.lineTotal || 0),
          isSerialized: item.isSerialized || false,
          serialNumbers: item.serialNumbers || [],
          currentStock: parseFloat(item.currentStock || 0)
        }))
      }
    });

  } catch (error) {
    console.error("Sale fetch error:", error);
    return errorResponse(res, "Failed to fetch sale invoice", 500);
  } finally {
    client.release();
  }
}

// Generate Sales Invoice PDF - Optimized for speed
export async function generateSalesInvoicePDF(req, res) {
  const { id, copies } = req.query;
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!id) {
    return errorResponse(res, "Sale ID is required", 400);
  }
  
  if (!userId || !companyId) {
    return errorResponse(res, "Authentication required", 401);
  }

  // Get user's default copy preference if copies not specified
  let numCopies = 2; // fallback default
  if (copies) {
    numCopies = parseInt(copies);
  } else {
    // Fetch user's default copy preference
    try {
      const copyQuery = `
        SELECT "defaultCopies"
        FROM hisab."userCopyPreferences" 
        WHERE "userId" = $1 AND "companyId" = $2 AND "moduleType" = 'sales'
      `;
      const copyResult = await pool.query(copyQuery, [userId, companyId]);
      if (copyResult.rows.length > 0) {
        numCopies = copyResult.rows[0].defaultCopies;
      }
    } catch (error) {
      console.error('Error fetching copy preference:', error);
      // Continue with default of 2
    }
  }

  // Validate copies parameter
  if (![1, 2, 4].includes(numCopies)) {
    return errorResponse(res, "Copies must be 1, 2, or 4", 400);
  }

  const client = await pool.connect();

  try {
    // Fetch sale details with all related data
    const saleQuery = `
      SELECT 
        s.*,
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
      FROM hisab."sales" s
      LEFT JOIN hisab."contacts" c ON s."contactId" = c.id
      LEFT JOIN hisab."bankAccounts" ba ON s."bankAccountId" = ba.id
      LEFT JOIN hisab."companies" comp ON s."companyId" = comp.id
      WHERE s."id" = $1 AND s."companyId" = $2 AND s."deletedAt" IS NULL
    `;

    // Fetch sale details and items
    const [saleResult, itemsResult] = await Promise.all([
      client.query(saleQuery, [id, companyId]),
      client.query(`
        SELECT 
          si.*,
          p."name" as "productName",
          p."itemCode" as "productCode"
        FROM hisab."sale_items" si
        LEFT JOIN hisab."products" p ON si."productId" = p.id
        WHERE si."saleId" = $1
        ORDER BY si."id"
      `, [id])
    ]);

    if (saleResult.rows.length === 0) {
      return errorResponse(res, "Sale not found", 404);
    }

    const sale = saleResult.rows[0];
    const items = itemsResult.rows;

    // Prepare data for template
    const invoiceData = {
      sale: {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        invoiceDate: sale.invoiceDate,
        status: sale.status,
        taxType: sale.taxType,
        discountType: sale.discountType,
        discountValue: sale.discountValue,
        basicAmount: sale.basicAmount,
        totalDiscount: sale.totalDiscount,
        taxAmount: sale.taxAmount,
        transportationCharge: sale.transportationCharge,
        roundOff: sale.roundOff,
        netReceivable: sale.netReceivable,
        internalNotes: sale.internalNotes
      },
      company: {
        name: sale.companyName,
        logoUrl: sale.logoUrl,
        address1: sale.address1,
        address2: sale.address2,
        city: sale.city,
        state: sale.state,
        pincode: sale.pincode,
        country: sale.country,
        gstin: sale.companyGstin
      },
      contact: {
        name: sale.contactName,
        email: sale.contactEmail,
        mobile: sale.contactMobile,
        gstin: sale.contactGstin,
        billingAddress1: sale.contactBillingAddress1,
        billingAddress2: sale.contactBillingAddress2,
        billingCity: sale.contactBillingCity,
        billingState: sale.contactBillingState,
        billingPincode: sale.contactBillingPincode,
        billingCountry: sale.contactBillingCountry
      },
      bankAccount: {
        accountName: sale.bankAccountName,
        accountType: sale.bankAccountType
      },
      items: items.map(item => ({
        ...item,
        name: item.productName,
        code: item.productCode,
        serialNumbers: item.serialNumbers || []
      }))
    };

    // Create template data
    const templateData = createSalesInvoiceTemplateData(invoiceData);

    // Generate PDF using user's default template
    const { pdfBuffer, template } = await generatePDFFromTemplate(templateData, {
      userId,
      companyId,
      moduleType: 'sales',
      templateId: null, // Use user's default template
      copies: numCopies
    });

    // Generate filename
    const pdfFileName = generateInvoicePDFFileName(templateData, 'sales');

    // Upload to S3
    const pdfUrl = await uploadFileToS3(pdfBuffer, pdfFileName);

    return successResponse(res, {
      message: `Sales invoice PDF generated successfully with ${numCopies} ${numCopies === 1 ? 'copy' : 'copies'}`,
      pdfUrl: pdfUrl,
      fileName: pdfFileName,
      template: {
        id: template.id,
        name: template.name
      },
      copies: numCopies,
      actionType: 'generated'
    });

  } catch (error) {
    console.error("Error generating sales invoice PDF:", error);
    
    if (error.message?.includes('No template found')) {
      return errorResponse(res, "No suitable template found for sales invoices", 404);
    } else if (error.message?.includes('not found')) {
      return errorResponse(res, "Sale or related data not found", 404);
    } else {
      return errorResponse(res, "Failed to generate sales invoice PDF", 500);
    }
  } finally {
    client.release();
  }
}

export async function listSales(req, res) {
  const companyId = req.currentUser?.companyId;
  const {
    page = 1,
    limit = 10,
    search,
    status,
    startDate,
    endDate,
    customerId,
    invoiceNumber
  } = req.query;

  if (!companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    let query = `
      SELECT 
        s.*,
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
        ba."accountName",
        ba."accountType",
        u."name" as "createdByName"
      FROM hisab."sales" s
      LEFT JOIN hisab."contacts" c ON s."contactId" = c.id
      LEFT JOIN hisab."bankAccounts" ba ON s."bankAccountId" = ba.id
      LEFT JOIN hisab."users" u ON s."userId" = u.id
      WHERE s."companyId" = $1 AND s."deletedAt" IS NULL
    `;
    const params = [companyId];
    let paramCount = 1;

    // Apply filters
    if (search) {
      paramCount++;
      query += ` AND (
        s."invoiceNumber" ILIKE $${paramCount} OR 
        c."name" ILIKE $${paramCount} OR 
        ba."accountName" ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }

    if (status) {
      paramCount++;
      query += ` AND s."status" = $${paramCount}`;
      params.push(status);
    }

    if (startDate) {
      paramCount++;
      query += ` AND s."invoiceDate" >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND s."invoiceDate" <= $${paramCount}`;
      params.push(endDate);
    }

    if (customerId) {
      paramCount++;
      query += ` AND s."contactId" = $${paramCount}`;
      params.push(customerId);
    }

    if (invoiceNumber) {
      paramCount++;
      query += ` AND s."invoiceNumber" ILIKE $${paramCount}`;
      params.push(`%${invoiceNumber}%`);
    }

    // Count total records
    const countQuery = `SELECT COUNT(*) FROM (${query}) as total`;
    const countResult = await client.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Apply pagination
    const offset = (page - 1) * limit;
    query += ` ORDER BY s."createdAt" DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await client.query(query, params);

    // Fetch items and serial numbers for each sale
    const salesWithItems = await Promise.all(
      result.rows.map(async (sale) => {
        // Get sale items with product details
        const itemsQuery = `
          SELECT 
            si.*,
            p."name" as "productName",
            p."itemCode" as "productCode",
            p."currentStock",
            p."isInventoryTracked",
            p."isSerialized"
          FROM hisab."sale_items" si
          LEFT JOIN hisab."products" p ON si."productId" = p.id
          WHERE si."saleId" = $1
          ORDER BY si."createdAt"
        `;

        const itemsResult = await client.query(itemsQuery, [sale.id]);

        // Get serial numbers for each item
        const itemsWithSerialNumbers = await Promise.all(
          itemsResult.rows.map(async (item) => {
            const serialNumbersQuery = await client.query(
              `SELECT "serialNumber" FROM hisab."sale_serial_numbers" 
               WHERE "saleItemId" = $1 ORDER BY "createdAt"`,
              [item.id]
            );

            return {
              ...item,
              serialNumbers: serialNumbersQuery.rows.map(row => row.serialNumber)
            };
          })
        );

        return {
          id: sale.id,
          invoiceNumber: sale.invoiceNumber,
          status: sale.status,
          invoiceDate: sale.invoiceDate,
          taxType: sale.taxType,
          rateType: sale.rateType,
          discountType: sale.discountType,
          discountScope: sale.discountScope, // Add missing field
          discountValueType: sale.discountValueType,
          discountValue: parseFloat(sale.discountValue || 0),
          roundOff: parseFloat(sale.roundOff || 0),
          internalNotes: sale.internalNotes,
          basicAmount: parseFloat(sale.basicAmount || 0),
          totalItemDiscount: parseFloat(sale.totalItemDiscount || 0), // Add missing field
          invoiceDiscount: parseFloat(sale.invoiceDiscount || 0), // Add missing field
          totalDiscount: parseFloat(sale.totalDiscount || 0),
          taxAmount: parseFloat(sale.taxAmount || 0),
          transportationCharge: parseFloat(sale.transportationCharge || 0),
          netReceivable: parseFloat(sale.netReceivable || 0),
          remainingAmount: parseFloat(sale.remaining_amount || 0),
          paidAmount: parseFloat(sale.paid_amount || 0),
          createdAt: sale.createdAt,
          updatedAt: sale.updatedAt,

          // Payment details
          paymentMethod: sale.bankAccountId ? 'bank' : 'credit',
          bankAccount: sale.bankAccountId ? {
            id: sale.bankAccountId,
            name: sale.accountName,
            type: sale.accountType
          } : null,
          contact: sale.contactId ? {
            id: sale.contactId,
            name: sale.contactName,
            mobile: sale.contactMobile,
            email: sale.contactEmail,
            gstin: sale.contactGstin,
            billingAddress1: sale.contactBillingAddress1,
            billingAddress2: sale.contactBillingAddress2,
            billingCity: sale.contactBillingCity,
            billingState: sale.contactBillingState,
            billingPincode: sale.contactBillingPincode,
            billingCountry: sale.contactBillingCountry
          } : null,

          // Creator details
          createdBy: {
            name: sale.createdByName
          },

          // Items
          itemsCount: itemsWithSerialNumbers.length,
          items: itemsWithSerialNumbers.map(item => ({
            id: item.id,
            productId: item.productId,
            name: item.productName,
            code: item.productCode,
            quantity: parseFloat(item.quantity || 0), // Ensure number
            rate: parseFloat(item.rate || 0), // Ensure number
            rateType: item.rateType,
            discount: parseFloat(item.discount || 0), // Ensure number
            discountRate: parseFloat(item.discountRate || 0), // Ensure number
            discountType: item.discountType,
            discountValue: parseFloat(item.discountValue || 0), // Add missing field
            discountAmount: parseFloat(item.discountAmount || 0), // Add missing field
            taxRate: parseFloat(item.taxRate || 0), // Ensure number
            taxAmount: parseFloat(item.taxAmount || 0), // Ensure number
            total: parseFloat(item.total || 0), // Ensure number
            lineBasic: parseFloat(item.lineBasic || 0), // Add missing field
            lineTotal: parseFloat(item.lineTotal || 0), // Add missing field
            serialNumbers: item.serialNumbers,
            isInventoryTracked: item.isInventoryTracked,
            isSerialized: item.isSerialized,
            currentStock: parseFloat(item.currentStock || 0) // Ensure number
          }))
        };
      })
    );

    return successResponse(res, {
      sales: salesWithItems,
      pagination: {
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error("Sales list error:", error);
    return errorResponse(res, "Failed to fetch sales", 500);
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
      `SELECT "invoiceNumber" FROM hisab."sales" 
       WHERE "companyId" = $1 
       ORDER BY "invoiceNumber" DESC 
       LIMIT 1`,
      [companyId]
    );

    let nextInvoiceNumber = "SI-0001";

    if (lastInvoiceRes.rows.length > 0) {
      const lastInvoiceNumber = lastInvoiceRes.rows[0].invoiceNumber;
      
      // Extract the number part and increment it
      const match = lastInvoiceNumber.match(/SI-(\d+)/);
      if (match) {
        const lastNumber = parseInt(match[1]);
        const nextNumber = lastNumber + 1;
        nextInvoiceNumber = `SI-${nextNumber.toString().padStart(4, '0')}`;
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

export async function shareSalesInvoice(req, res) {
  const { id } = req.params;
  const { shareType, recipient, description } = req.body; // shareType: 'email' or 'whatsapp'
  const companyId = req.currentUser?.companyId;
  const userId = req.currentUser?.id;

  if (!id || !shareType || !recipient) {
    return errorResponse(res, "Invoice ID, share type, and recipient are required", 400);
  }

  if (!['email', 'whatsapp'].includes(shareType)) {
    return errorResponse(res, "Share type must be either 'email' or 'whatsapp'", 400);
  }

  if (!companyId || !userId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    // Get sale details with all related data
    const saleQuery = `
      SELECT 
        s.*,
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
      FROM hisab."sales" s
      LEFT JOIN hisab."contacts" c ON s."contactId" = c.id
      LEFT JOIN hisab."bankAccounts" ba ON s."bankAccountId" = ba.id
      LEFT JOIN hisab."companies" comp ON s."companyId" = comp.id
      WHERE s."id" = $1 AND s."companyId" = $2 AND s."deletedAt" IS NULL
    `;

    const [saleResult, itemsResult] = await Promise.all([
      client.query(saleQuery, [id, companyId]),
      client.query(`
        SELECT 
          si.*,
          p."name" as "productName",
          p."itemCode" as "productCode",
          p."currentStock",
          p."isInventoryTracked",
          p."isSerialized"
        FROM hisab."sale_items" si
        LEFT JOIN hisab."products" p ON si."productId" = p.id
        WHERE si."saleId" = $1
        ORDER BY si.id
      `, [id])
    ]);

    if (saleResult.rows.length === 0) {
      return errorResponse(res, "Sales invoice not found", 404);
    }

    const sale = saleResult.rows[0];
    const items = itemsResult.rows;

    // Prepare data for PDF generation
    const pdfData = {
      sale: {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        invoiceDate: sale.invoiceDate,
        status: sale.status,
        taxType: sale.taxType,
        discountType: sale.discountType,
        discountValue: sale.discountValue,
        basicAmount: sale.basicAmount,
        totalDiscount: sale.totalDiscount,
        taxAmount: sale.taxAmount,
        transportationCharge: sale.transportationCharge,
        roundOff: sale.roundOff,
        netReceivable: sale.netReceivable,
        internalNotes: sale.internalNotes
      },
      company: {
        name: sale.companyName,
        logoUrl: sale.logoUrl,
        address1: sale.address1,
        address2: sale.address2,
        city: sale.city,
        state: sale.state,
        pincode: sale.pincode,
        country: sale.country,
        gstin: sale.companyGstin
      },
      contact: {
        name: sale.contactName,
        email: sale.contactEmail,
        mobile: sale.contactMobile,
        gstin: sale.contactGstin,
        billingAddress1: sale.contactBillingAddress1,
        billingAddress2: sale.contactBillingAddress2,
        billingCity: sale.contactBillingCity,
        billingState: sale.contactBillingState,
        billingPincode: sale.contactBillingPincode,
        billingCountry: sale.contactBillingCountry
      },
      bankAccount: {
        accountName: sale.bankAccountName,
        accountType: sale.bankAccountType
      },
      items: items
    };

    // Create template data and generate PDF using user's default template
    const templateData = createSalesInvoiceTemplateData(pdfData);
    const { pdfBuffer, template } = await generatePDFFromTemplate(templateData, {
      userId: req.currentUser?.id,
      companyId: req.currentUser?.companyId,
      moduleType: 'sales',
      templateId: null
    });
    const pdfFileName = generateInvoicePDFFileName(templateData, 'sales');

    // Generate default description if not provided
    const defaultDescription = description || `Sales Invoice #${sale.invoiceNumber} from ${sale.companyName}. 
Amount: ₹${parseFloat(sale.netReceivable || 0).toFixed(2)}. 
Date: ${new Date(sale.invoiceDate).toLocaleDateString('en-IN')}.
Thank you for your business!`;

    if (shareType === 'email') {
      // Send via email
      await sendEmail({
        to: recipient,
        subject: `Sales Invoice #${sale.invoiceNumber} - ${sale.companyName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #16a34a 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="margin: 0; font-size: 28px;">Sales Invoice</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">${sale.companyName}</p>
            </div>
            
            <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; line-height: 1.6; color: #333;">
                Dear Customer,
              </p>
              
              <p style="font-size: 16px; line-height: 1.6; color: #333;">
                ${defaultDescription}
              </p>
              
              <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; color: #16a34a;">Invoice Details:</h3>
                <p style="margin: 5px 0; color: #333;"><strong>Invoice Number:</strong> ${sale.invoiceNumber}</p>
                <p style="margin: 5px 0; color: #333;"><strong>Date:</strong> ${new Date(sale.invoiceDate).toLocaleDateString('en-IN')}</p>
                <p style="margin: 5px 0; color: #333;"><strong>Amount:</strong> ₹${parseFloat(sale.netReceivable || 0).toFixed(2)}</p>
                <p style="margin: 5px 0; color: #333;"><strong>Status:</strong> ${sale.status}</p>
              </div>
              
              <p style="font-size: 14px; line-height: 1.6; color: #666;">
                Please find the detailed invoice attached as a PDF document.
              </p>
              
              <p style="font-size: 14px; line-height: 1.6; color: #666;">
                If you have any questions regarding this invoice, please contact us.
              </p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 12px;">
                <p>This is an automated message from ${sale.companyName}</p>
              </div>
            </div>
          </div>
        `,
        attachments: [{
          filename: pdfFileName,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }]
      });

      return successResponse(res, {
        message: "Sales invoice shared successfully via email",
        shareType: 'email',
        recipient: recipient
      });

    } else if (shareType === 'whatsapp') {
      // Validate WhatsApp number
      if (!isValidWhatsAppNumber(recipient)) {
        return errorResponse(res, "Invalid WhatsApp number format", 400);
      }

      try {
        // Upload PDF to S3 for WhatsApp sharing
        const pdfUrl = await uploadFileToS3(pdfBuffer, pdfFileName);
        
        // Send document via WhatsApp Business API
        await sendWhatsAppDocument(
          recipient,
          pdfUrl,
          pdfFileName,
          defaultDescription
        );

        return successResponse(res, {
          message: "Sales invoice shared successfully via WhatsApp",
          shareType: 'whatsapp',
          recipient: recipient
        });

      } catch (whatsappError) {
        console.error('WhatsApp API failed, falling back to web link:', whatsappError);
        
        // Fallback: Upload PDF and provide web link
        const pdfUrl = await uploadFileToS3(pdfBuffer, pdfFileName);
        const whatsappMessage = `${defaultDescription}

📄 Download Invoice: ${pdfUrl}

This link is valid for download.`;

        return successResponse(res, {
          message: "WhatsApp API unavailable. Web link prepared for manual sharing.",
          shareType: 'whatsapp',
          recipient: recipient,
          whatsappMessage: whatsappMessage,
          pdfUrl: pdfUrl,
          // Frontend can use this to open WhatsApp with pre-filled message
          whatsappUrl: `https://wa.me/${recipient.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMessage)}`,
          fallbackMode: true
        });
      }
    }

  } catch (error) {
    console.error("Error sharing sales invoice:", error);
    return errorResponse(res, "Failed to share sales invoice", 500);
  } finally {
    client.release();
  }
} 

// Get complete sales invoice data for printing/preview
export async function getSalesInvoiceForPrint(req, res) {
  const { id } = req.params;
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!id) {
    return errorResponse(res, "Sale ID is required", 400);
  }
  
  if (!userId || !companyId) {
    return errorResponse(res, "Authentication required", 401);
  }

  const client = await pool.connect();

  try {
    // Fetch sale details with all related data (same as PDF generation)
    const saleQuery = `
      SELECT 
        s.*,
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
      FROM hisab."sales" s
      LEFT JOIN hisab."contacts" c ON s."contactId" = c.id
      LEFT JOIN hisab."bankAccounts" ba ON s."bankAccountId" = ba.id
      LEFT JOIN hisab."companies" comp ON s."companyId" = comp.id
      WHERE s."id" = $1 AND s."companyId" = $2 AND s."deletedAt" IS NULL
    `;

    // Fetch sale details and items
    const [saleResult, itemsResult] = await Promise.all([
      client.query(saleQuery, [id, companyId]),
      client.query(`
        SELECT 
          si.*,
          p."name" as "productName",
          p."itemCode" as "productCode"
        FROM hisab."sale_items" si
        LEFT JOIN hisab."products" p ON si."productId" = p.id
        WHERE si."saleId" = $1
        ORDER BY si."id"
      `, [id])
    ]);

    if (saleResult.rows.length === 0) {
      return errorResponse(res, "Sale not found", 404);
    }

    const sale = saleResult.rows[0];
    const items = itemsResult.rows;

    // Prepare complete data for frontend printing
    const invoiceData = {
      sale: {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        invoiceDate: sale.invoiceDate,
        status: sale.status,
        taxType: sale.taxType,
        discountType: sale.discountType,
        discountValue: sale.discountValue,
        basicAmount: sale.basicAmount,
        totalDiscount: sale.totalDiscount,
        taxAmount: sale.taxAmount,
        transportationCharge: sale.transportationCharge,
        roundOff: sale.roundOff,
        netReceivable: sale.netReceivable,
        internalNotes: sale.internalNotes
      },
      company: {
        name: sale.companyName,
        logoUrl: sale.logoUrl,
        address1: sale.address1,
        address2: sale.address2,
        city: sale.city,
        state: sale.state,
        pincode: sale.pincode,
        country: sale.country,
        gstin: sale.companyGstin
      },
      contact: {
        name: sale.contactName,
        email: sale.contactEmail,
        mobile: sale.contactMobile,
        gstin: sale.contactGstin,
        billingAddress1: sale.contactBillingAddress1,
        billingAddress2: sale.contactBillingAddress2,
        billingCity: sale.contactBillingCity,
        billingState: sale.contactBillingState,
        billingPincode: sale.contactBillingPincode,
        billingCountry: sale.contactBillingCountry
      },
      bankAccount: {
        accountName: sale.bankAccountName,
        accountType: sale.bankAccountType
      },
      items: items.map(item => ({
        ...item,
        name: item.productName,
        code: item.productCode,
        serialNumbers: item.serialNumbers || []
      }))
    };

    // Create template data using the same function as PDF generation
    const templateData = createSalesInvoiceTemplateData(invoiceData);

    return successResponse(res, {
      invoiceData: templateData,
      message: "Sales invoice data retrieved successfully"
    });

  } catch (error) {
    console.error('Error fetching sales invoice for print:', error);
    return errorResponse(res, "Failed to fetch sales invoice data", 500);
  } finally {
    client.release();
  }
}

