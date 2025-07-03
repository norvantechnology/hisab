import pool from "../config/dbConnection.js";
import { errorResponse, successResponse } from "../utils/index.js";

export async function createPurchase(req, res) {
  const client = await pool.connect();

  const {
    bankAccountId,
    invoiceNumber,
    invoiceDate,
    taxType: taxCategoryId,
    discountType,
    globalDiscount = 0,
    roundOff = 0,
    internalNotes = '',
    items // [{ productId, qty, rate, discount }]
  } = req.body;

  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  if (!Array.isArray(items) || items.length === 0) {
    return errorResponse(res, "At least one item is required", 400);
  }

  try {
    await client.query("BEGIN");

    let basicAmount = 0;
    const itemRows = [];

    for (const item of items) {
      const { productId, qty, rate, discount = 0 } = item;

      const productRes = await client.query(`
        SELECT "taxCategoryId" FROM hisab."products"
        WHERE "id" = $1 AND "companyId" = $2`,
        [productId, companyId]
      );

      if (productRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, `Product ${productId} not found`, 404);
      }

      let taxPercent = 0;
      if (taxCategoryId) {
        const taxRes = await client.query(`
          SELECT rate FROM hisab."taxCategories"
          WHERE id = $1`,
          [taxCategoryId]
        );
        taxPercent = parseFloat(taxRes.rows[0]?.rate || 0);
      }

      let lineTotal = qty * rate - discount;
      lineTotal += lineTotal * (taxPercent / 100);

      basicAmount += lineTotal;

      itemRows.push({ productId, qty, rate, discount, taxPercent, total: lineTotal });
    }

    let finalAmount = basicAmount;
    if (discountType === 'global') {
      finalAmount -= globalDiscount;
    }
    finalAmount += roundOff;

    const purchaseInsert = `
      INSERT INTO hisab."purchases"
      ("companyId", "userId", "bankAccountId", "invoiceNumber", "invoiceDate",
      "taxType", "discountType", "globalDiscount", "roundOff", "internalNotes",
      "basicAmount", "netPayable")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING id`;

    const purchaseValues = [
      companyId, userId, bankAccountId, invoiceNumber, invoiceDate,
      taxCategoryId, discountType, globalDiscount, roundOff, internalNotes,
      basicAmount, finalAmount
    ];

    const purchaseRes = await client.query(purchaseInsert, purchaseValues);
    const purchaseId = purchaseRes.rows[0].id;

    for (const item of itemRows) {
      const { productId, qty, rate, discount, taxPercent, total } = item;

      await client.query(`
        INSERT INTO hisab."purchase_items"
        ("purchaseId", "companyId", "productId", "qty", "rate", "discount", "taxPercent", "total")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [purchaseId, companyId, productId, qty, rate, discount, taxPercent, total]);

      await client.query(`
        UPDATE hisab."products"
        SET "currentStock" = "currentStock" + $1
        WHERE id = $2 AND "companyId" = $3`,
        [qty, productId, companyId]);
    }

    await client.query(`
      UPDATE hisab."bankAccounts"
      SET "currentBalance" = "currentBalance" - $1
      WHERE id = $2 AND "companyId" = $3`,
      [finalAmount, bankAccountId, companyId]);

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Purchase created successfully",
      purchaseId
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error in createPurchase:", error);
    return errorResponse(res, "Purchase creation failed", 500);
  } finally {
    client.release();
  }
};

export async function updatePurchase(req, res) {
  const client = await pool.connect();

  const purchaseId = req.params.id;
  const {
    bankAccountId,
    invoiceNumber,
    invoiceDate,
    taxType,
    discountType,
    globalDiscount = 0,
    roundOff = 0,
    internalNotes = '',
    items = [] // [{ productId, qty, rate, discount }]
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

  try {
    await client.query("BEGIN");

    // Check existing purchase
    const purchaseCheck = await client.query(
      `SELECT * FROM hisab."purchases" 
       WHERE id = $1 AND "companyId" = $2 AND "deletedAt" IS NULL`,
      [purchaseId, companyId]
    );

    if (purchaseCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Purchase not found", 404);
    }

    // Reverse previous inventory stock and bank balance
    const previousItems = await client.query(
      `SELECT * FROM hisab."purchase_items" 
       WHERE "purchaseId" = $1 AND "companyId" = $2`,
      [purchaseId, companyId]
    );

    for (const item of previousItems.rows) {
      await client.query(
        `UPDATE hisab."products"
         SET "currentStock" = "currentStock" - $1
         WHERE id = $2 AND "companyId" = $3`,
        [item.qty, item.productId, companyId]
      );
    }

    await client.query(
      `DELETE FROM hisab."purchase_items" 
       WHERE "purchaseId" = $1 AND "companyId" = $2`,
      [purchaseId, companyId]
    );

    let basicAmount = 0;
    const itemRows = [];

    for (const item of items) {
      const { productId, qty, rate, discount = 0 } = item;

      const productRes = await client.query(
        `SELECT "taxCategoryId" FROM hisab."products" 
         WHERE "id" = $1 AND "companyId" = $2`,
        [productId, companyId]
      );

      if (productRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, `Product ${productId} not found`, 404);
      }

      const taxCategoryId = productRes.rows[0].taxCategoryId;

      let taxPercent = 0;
      if (taxCategoryId) {
        const taxRes = await client.query(
          `SELECT rate FROM hisab."taxCategories" WHERE id = $1`,
          [taxCategoryId]
        );
        taxPercent = parseFloat(taxRes.rows[0]?.rate || 0);
      }

      let lineTotal = qty * rate - discount;
      if (taxType === 'exclusive') {
        lineTotal += lineTotal * (taxPercent / 100);
      }

      basicAmount += lineTotal;

      itemRows.push({ productId, qty, rate, discount, taxPercent, total: lineTotal });
    }

    let finalAmount = basicAmount;
    if (discountType === 'global') {
      finalAmount -= globalDiscount;
    }
    finalAmount += roundOff;

    // Update Purchase
    await client.query(
      `UPDATE hisab."purchases"
       SET "bankAccountId" = $1,
           "invoiceNumber" = $2,
           "invoiceDate" = $3,
           "taxType" = $4,
           "discountType" = $5,
           "globalDiscount" = $6,
           "roundOff" = $7,
           "internalNotes" = $8,
           "basicAmount" = $9,
           "netPayable" = $10,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $11 AND "companyId" = $12`,
      [
        bankAccountId,
        invoiceNumber,
        invoiceDate,
        taxType,
        discountType,
        globalDiscount,
        roundOff,
        internalNotes,
        basicAmount,
        finalAmount,
        purchaseId,
        companyId
      ]
    );

    for (const item of itemRows) {
      const { productId, qty, rate, discount, taxPercent, total } = item;

      await client.query(
        `INSERT INTO hisab."purchase_items"
        ("companyId", "purchaseId", "productId", "qty", "rate", "discount", "taxPercent", "total")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [companyId, purchaseId, productId, qty, rate, discount, taxPercent, total]
      );

      await client.query(
        `UPDATE hisab."products"
         SET "currentStock" = "currentStock" + $1
         WHERE id = $2 AND "companyId" = $3`,
        [qty, productId, companyId]
      );
    }

    // Adjust bank balance: revert old balance, subtract new
    await client.query(
      `UPDATE hisab."bankAccounts"
       SET "currentBalance" = "currentBalance" + $1 - $2
       WHERE id = $3 AND "companyId" = $4`,
      [purchaseCheck.rows[0].netPayable, finalAmount, bankAccountId, companyId]
    );

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Purchase updated successfully",
      purchaseId
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error in updatePurchase:", error);
    return errorResponse(res, "Failed to update purchase", 500);
  } finally {
    client.release();
  }
}

export async function deletePurchase(req, res) {
  const { id } = req.params;
  const companyId = req.currentUser?.companyId;

  if (!id || !companyId) {
    return errorResponse(res, "Invalid request", 400);
  }

  const client = await pool.connect();

  try {
    await client.query(`
      UPDATE hisab."purchases"
      SET "deletedAt" = CURRENT_TIMESTAMP
      WHERE id = $1 AND "companyId" = $2
    `, [id, companyId]);

    return successResponse(res, { message: "Purchase deleted (soft)" });

  } catch (error) {
    console.error("Delete error:", error);
    return errorResponse(res, "Failed to delete", 500);
  } finally {
    client.release();
  }
}

export async function getPurchase(req, res) {
  const { id } = req.params;
  const companyId = req.currentUser?.companyId;

  if (!id || !companyId) {
    return errorResponse(res, "Invalid request", 400);
  }

  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT * FROM hisab."purchases"
      WHERE id = $1 AND "companyId" = $2 AND "deletedAt" IS NULL`, [id, companyId]);

    if (result.rows.length === 0) {
      return errorResponse(res, "Purchase not found", 404);
    }

    const purchase = result.rows[0];

    const items = await client.query(`
      SELECT * FROM hisab."purchase_items"
      WHERE "purchaseId" = $1 AND "companyId" = $2`,
      [id, companyId]);

    return successResponse(res, { purchase, items: items.rows });
  } catch (error) {
    console.error("Get error:", error);
    return errorResponse(res, "Failed to fetch", 500);
  } finally {
    client.release();
  }
}

export async function listPurchases(req, res) {
  const companyId = req.currentUser?.companyId;
  const { page = 1, limit = 20, search = '' } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const client = await pool.connect();

  try {
    const list = await client.query(`
      SELECT * FROM hisab."purchases"
      WHERE "companyId" = $1 AND "deletedAt" IS NULL
      AND ("invoiceNumber" ILIKE $2 OR "internalNotes" ILIKE $2)
      ORDER BY "createdAt" DESC
      LIMIT $3 OFFSET $4
    `, [companyId, `%${search}%`, limit, offset]);

    const count = await client.query(`
      SELECT COUNT(*) FROM hisab."purchases"
      WHERE "companyId" = $1 AND "deletedAt" IS NULL
      AND ("invoiceNumber" ILIKE $2 OR "internalNotes" ILIKE $2)
    `, [companyId, `%${search}%`]);

    return successResponse(res, {
      purchases: list.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(count.rows[0].count)
      }
    });
  } catch (error) {
    console.error("List error:", error);
    return errorResponse(res, "Failed to fetch list", 500);
  } finally {
    client.release();
  }
}
