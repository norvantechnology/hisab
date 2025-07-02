import pool from "../config/dbConnection.js";
import { errorResponse, successResponse } from "../utils/index.js";

export async function createPurchase(req, res) {
  const client = await pool.connect();

  const {
    bankAccountId,
    invoiceNumber,
    invoiceDate,
    taxType,
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

      const taxCategoryId = productRes.rows[0].taxCategoryId;

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

    const purchaseInsert = `
        INSERT INTO hisab."purchases"
        ("companyId", "userId", "bankAccountId", "invoiceNumber", "invoiceDate",
         "taxType", "discountType", "globalDiscount", "roundOff", "internalNotes",
         "basicAmount", "netPayable")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING id
      `;
    const purchaseValues = [
      companyId, userId, bankAccountId, invoiceNumber, invoiceDate,
      taxType, discountType, globalDiscount, roundOff, internalNotes,
      basicAmount, finalAmount
    ];
    const purchaseRes = await client.query(purchaseInsert, purchaseValues);
    const purchaseId = purchaseRes.rows[0].id;

    for (const item of itemRows) {
      const { productId, qty, rate, discount, taxPercent, total } = item;

      await client.query(`
          INSERT INTO hisab."purchase_items"
          ("purchaseId", "productId", "qty", "rate", "discount", "taxPercent", "total")
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [purchaseId, productId, qty, rate, discount, taxPercent, total]);

      await client.query(`
          UPDATE hisab."products"
          SET "currentStock" = "currentStock" + $1
          WHERE id = $2 AND "companyId" = $3
        `, [qty, productId, companyId]);
    }

    await client.query(`
        UPDATE hisab."bankAccounts"
        SET "currentBalance" = "currentBalance" - $1
        WHERE id = $2 AND "companyId" = $3
      `, [finalAmount, bankAccountId, companyId]);

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
// Placeholder stubs for other endpoints
export async function updatePurchase(req, res) { return errorResponse(res, "Not implemented", 501); }
export async function deletePurchase(req, res) { return errorResponse(res, "Not implemented", 501); }
export async function getPurchase(req, res) { return errorResponse(res, "Not implemented", 501); }
export async function listPurchases(req, res) { return errorResponse(res, "Not implemented", 501); }
