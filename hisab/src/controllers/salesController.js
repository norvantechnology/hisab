import pool from "../config/dbConnection.js";
import { errorResponse, successResponse } from "../utils/index.js";

export async function createSale(req, res) {
  const client = await pool.connect();

  const {
    invoiceNumber,
    date,
    taxType,
    discountType,
    discountValue = 0,
    items,
    internalNotes = '',
    basicAmount,
    totalDiscount,
    taxAmount,
    roundOff = 0,
    netReceivable,
    billToBank,
    billToContact,
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

  // Handle both billToBank and billToContact - they can both be present
  if (billToBank) {
    bankAccountId = parseInt(billToBank);
  }
  
  if (billToContact) {
    contactId = parseInt(billToContact);
  }

  // At least one of them should be provided
  if (!billToBank && !billToContact) {
    return errorResponse(res, "Either billToBank or billToContact is required", 400);
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

      // Check stock availability for inventory tracked products
      if (product.isInventoryTracked) {
        if (product.currentStock < quantity) {
          await client.query("ROLLBACK");
          return errorResponse(res, `Insufficient stock for product ${productId}. Available: ${product.currentStock}, Required: ${quantity}`, 400);
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
        for (const serialNumber of serialNumbers) {
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

    // Create sale record
    const saleResult = await client.query(
      `INSERT INTO hisab."sales" (
        "companyId", "userId", "bankAccountId", "contactId", "invoiceNumber", "invoiceDate",
        "taxType", "discountType", "discountValue", "roundOff", "internalNotes",
        "basicAmount", "totalDiscount", "taxAmount", "netReceivable", "status"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        companyId, userId, bankAccountId, contactId, invoiceNumber, date,
        taxType, discountType, discountValue, roundOff, internalNotes,
        basicAmount, totalDiscount, taxAmount, netReceivable, status
      ]
    );

    const saleId = saleResult.rows[0].id;

    // Create sale items and update inventory
    for (const item of items) {
      const {
        productId, quantity, rate, taxRate = 0, taxAmount = 0,
        discount = 0, discountRate = 0, total, serialNumbers = []
      } = item;

      // Insert sale item
      const saleItemResult = await client.query(
        `INSERT INTO hisab."sale_items" (
          "saleId", "productId", quantity, rate, "taxRate", "taxAmount",
          discount, "discountRate", total
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [saleId, productId, quantity, rate, taxRate, taxAmount, discount, discountRate, total]
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
      if (serialNumbers.length > 0) {
        for (const serialNumber of serialNumbers) {
          // Mark serial number as sold
          await client.query(
            `UPDATE hisab."serialNumbers" 
             SET "status" = 'sold', "saleDate" = CURRENT_TIMESTAMP
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
    date,
    taxType,
    discountType,
    discountValue = 0,
    items,
    internalNotes = '',
    basicAmount,
    totalDiscount,
    taxAmount,
    roundOff = 0,
    netReceivable,
    billToBank,
    billToContact,
    status
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

  let bankAccountId = null;
  let contactId = null;

  // Handle both billToBank and billToContact - they can both be present
  if (billToBank) {
    bankAccountId = parseInt(billToBank);
  }
  
  if (billToContact) {
    contactId = parseInt(billToContact);
  }

  // At least one of them should be provided
  if (!billToBank && !billToContact) {
    return errorResponse(res, "Either billToBank or billToContact is required", 400);
  }

  try {
    await client.query("BEGIN");

    // Get existing sale
    const existingSaleQuery = await client.query(
      `SELECT * FROM hisab."sales" WHERE "id" = $1 AND "companyId" = $2 FOR UPDATE`,
      [id, companyId]
    );

    if (existingSaleQuery.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Sale not found", 404);
    }

    const existingSale = existingSaleQuery.rows[0];

    // Get existing sale items
    const existingItemsQuery = await client.query(
      `SELECT * FROM hisab."sale_items" WHERE "saleId" = $1`,
      [id]
    );

    const existingItems = existingItemsQuery.rows;

    // Reverse existing inventory changes
    for (const existingItem of existingItems) {
      // Restore product stock
      await client.query(
        `UPDATE hisab."products" 
         SET "currentStock" = "currentStock" + $1, "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = $2 AND "companyId" = $3`,
        [existingItem.quantity, existingItem.productId, companyId]
      );

      // Restore serial numbers
      await client.query(
        `UPDATE hisab."serialNumbers" 
         SET "status" = 'in_stock', "saleDate" = NULL
         WHERE "companyId" = $1 AND "productId" = $2 AND "serialNumber" IN (
           SELECT "serialNumber" FROM hisab."sale_serial_numbers" 
           WHERE "saleItemId" = $3
         )`,
        [companyId, existingItem.productId, existingItem.id]
      );
    }

    // Delete existing sale items and serial numbers
    await client.query(`DELETE FROM hisab."sale_serial_numbers" WHERE "saleId" = $1`, [id]);
    await client.query(`DELETE FROM hisab."sale_items" WHERE "saleId" = $1`, [id]);

    // Validate new items and check stock availability
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

      // Check stock availability for inventory tracked products
      if (product.isInventoryTracked) {
        if (product.currentStock < quantity) {
          await client.query("ROLLBACK");
          return errorResponse(res, `Insufficient stock for product ${productId}. Available: ${product.currentStock}, Required: ${quantity}`, 400);
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
        for (const serialNumber of serialNumbers) {
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

    // Update sale record
    await client.query(
      `UPDATE hisab."sales" SET
        "bankAccountId" = $1, "contactId" = $2, "invoiceNumber" = $3, "invoiceDate" = $4,
        "taxType" = $5, "discountType" = $6, "discountValue" = $7, "roundOff" = $8,
        "internalNotes" = $9, "basicAmount" = $10, "totalDiscount" = $11,
        "taxAmount" = $12, "netReceivable" = $13, "status" = $14, "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $15`,
      [
        bankAccountId, contactId, invoiceNumber, date, taxType, discountType,
        discountValue, roundOff, internalNotes, basicAmount, totalDiscount,
        taxAmount, netReceivable, status, id
      ]
    );

    // Create new sale items and update inventory
    for (const item of items) {
      const {
        productId, quantity, rate, taxRate = 0, taxAmount = 0,
        discount = 0, discountRate = 0, total, serialNumbers = []
      } = item;

      // Insert sale item
      const saleItemResult = await client.query(
        `INSERT INTO hisab."sale_items" (
          "saleId", "productId", quantity, rate, "taxRate", "taxAmount",
          discount, "discountRate", total
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [id, productId, quantity, rate, taxRate, taxAmount, discount, discountRate, total]
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
      if (serialNumbers.length > 0) {
        for (const serialNumber of serialNumbers) {
          // Mark serial number as sold
          await client.query(
            `UPDATE hisab."serialNumbers" 
             SET "status" = 'sold', "saleDate" = CURRENT_TIMESTAMP
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
      sale: { id, ...req.body }
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Sale update error:", error);
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
        ...sale,
        items: itemsWithSerialNumbers
      }
    });

  } catch (error) {
    console.error("Sale fetch error:", error);
    return errorResponse(res, "Failed to fetch sale invoice", 500);
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
          ...sale,
          items: itemsWithSerialNumbers
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