import pool from "../config/dbConnection.js";
import { errorResponse, successResponse } from "../utils/index.js";

export async function createContact(req, res) {
  const {
    gstin,
    name,
    mobile,
    email,
    dueDays,
    currency = 'INR',
    billingAddress1,
    billingAddress2,
    billingCity,
    billingPincode,
    billingState,
    billingCountry = 'India',
    isShippingSame = false,
    shippingAddress1,
    shippingAddress2,
    shippingCity,
    shippingPincode,
    shippingState,
    shippingCountry = 'India',
    openingBalance = 0.00,
    balanceType = 'payable',
    enablePortal = false,
    notes
  } = req.body;

  const companyId = req.currentUser?.companyId;
  const currentUserId = req.currentUser?.id;

  if (!companyId || !currentUserId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  if (!name) {
    return errorResponse(res, "Contact name is required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // If shipping same as billing, copy billing address to shipping
    const finalShipping = isShippingSame ? {
      shippingAddress1: billingAddress1,
      shippingAddress2: billingAddress2,
      shippingCity: billingCity,
      shippingPincode: billingPincode,
      shippingState: billingState,
      shippingCountry: billingCountry
    } : {
      shippingAddress1,
      shippingAddress2,
      shippingCity,
      shippingPincode,
      shippingState,
      shippingCountry
    };

    const insertQuery = `
      INSERT INTO hisab."contacts" (
        "companyId", "gstin", "name", "mobile", "email", "dueDays", "currency",
        "billingAddress1", "billingAddress2", "billingCity", "billingPincode", 
        "billingState", "billingCountry", "isShippingSame",
        "shippingAddress1", "shippingAddress2", "shippingCity", "shippingPincode",
        "shippingState", "shippingCountry", "openingBalance", "balanceType",
        "enablePortal", "notes", "createdBy"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      RETURNING *
    `;

    const params = [
      companyId, gstin, name, mobile, email, dueDays, currency,
      billingAddress1, billingAddress2, billingCity, billingPincode,
      billingState, billingCountry, isShippingSame,
      finalShipping.shippingAddress1, finalShipping.shippingAddress2,
      finalShipping.shippingCity, finalShipping.shippingPincode,
      finalShipping.shippingState, finalShipping.shippingCountry,
      openingBalance, balanceType, enablePortal, notes, currentUserId
    ];

    const result = await client.query(insertQuery, params);

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Contact created successfully",
      contact: result.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error creating contact", 500);
  } finally {
    client.release();
  }
}

export async function getContacts(req, res) {
  const companyId = req.currentUser?.companyId;
  const { 
    page = 1, 
    limit = 10, 
    search,
    balanceType,
    contactType, // 'customer' or 'vendor' (based on your schema)
    startDate,
    endDate
  } = req.query;

  if (!companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    let query = `
      SELECT 
        id, gstin, name, mobile, email, "dueDays", currency,
        "billingAddress1", "billingAddress2", "billingCity", "billingPincode",
        "billingState", "billingCountry", "shippingAddress1", "shippingAddress2",
        "shippingCity", "shippingPincode", "shippingState", "shippingCountry",
        "isShippingSame", "openingBalance", "balanceType", "enablePortal", notes,
        "createdBy", "createdAt", "updatedAt"
      FROM hisab.contacts
      WHERE "companyId" = $1
    `;
    const params = [companyId];
    let paramCount = 1;

    // Search filter
    if (search) {
      paramCount++;
      query += ` AND (
        name ILIKE $${paramCount} OR 
        mobile ILIKE $${paramCount} OR 
        email ILIKE $${paramCount} OR 
        gstin ILIKE $${paramCount} OR
        "billingCity" ILIKE $${paramCount} OR
        "billingState" ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }

    // Balance type filter (only 'payable' or 'receivable' per your constraint)
    if (balanceType && ['payable', 'receivable'].includes(balanceType)) {
      paramCount++;
      query += ` AND "balanceType" = $${paramCount}`;
      params.push(balanceType);
    }

    // Date range filter
    if (startDate) {
      paramCount++;
      query += ` AND "createdAt" >= $${paramCount}`;
      params.push(startDate);
    }
    if (endDate) {
      paramCount++;
      query += ` AND "createdAt" <= $${paramCount}`;
      params.push(endDate);
    }

    // Count total records
    const countQuery = `SELECT COUNT(*) FROM (${query}) as total`;
    const countResult = await client.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    // Add pagination and sorting
    query += ` ORDER BY name ASC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, (page - 1) * limit);

    const result = await client.query(query, params);

    return successResponse(res, {
      contacts: result.rows.map(contact => ({
        ...contact,
        openingBalance: parseFloat(contact.openingBalance) // Convert to number
      })),
      pagination: {
        total,
        totalPages,
        currentPage: parseInt(page),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error(error);
    return errorResponse(res, "Error fetching contacts", 500);
  } finally {
    client.release();
  }
}

export async function getContactDetails(req, res) {
  const companyId = req.currentUser?.companyId;
  const { id } = req.query;

  if (!companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    const query = `
      SELECT * FROM hisab."contacts"
      WHERE "id" = $1 AND "companyId" = $2
      LIMIT 1
    `;
    const result = await client.query(query, [id, companyId]);

    if (result.rows.length === 0) {
      return errorResponse(res, "Contact not found", 404);
    }

    return successResponse(res, {
      contact: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    return errorResponse(res, "Error fetching contact details", 500);
  } finally {
    client.release();
  }
}

export async function updateContact(req, res) {
  const {
    id,
    gstin,
    name,
    mobile,
    email,
    dueDays,
    currency,
    billingAddress1,
    billingAddress2,
    billingCity,
    billingPincode,
    billingState,
    billingCountry,
    isShippingSame,
    shippingAddress1,
    shippingAddress2,
    shippingCity,
    shippingPincode,
    shippingState,
    shippingCountry,
    openingBalance,
    balanceType,
    enablePortal,
    notes
  } = req.body;

  const companyId = req.currentUser?.companyId;

  if (!companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // First verify contact belongs to company
    const verifyQuery = `
      SELECT "id" FROM hisab."contacts"
      WHERE "id" = $1 AND "companyId" = $2
      LIMIT 1
    `;
    const verifyResult = await client.query(verifyQuery, [id, companyId]);

    if (verifyResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Contact not found or unauthorized", 404);
    }

    // If shipping same as billing, copy billing address to shipping
    const finalShipping = isShippingSame ? {
      shippingAddress1: billingAddress1,
      shippingAddress2: billingAddress2,
      shippingCity: billingCity,
      shippingPincode: billingPincode,
      shippingState: billingState,
      shippingCountry: billingCountry
    } : {
      shippingAddress1,
      shippingAddress2,
      shippingCity,
      shippingPincode,
      shippingState,
      shippingCountry
    };

    const updateQuery = `
      UPDATE hisab."contacts"
      SET
        "gstin" = $1,
        "name" = $2,
        "mobile" = $3,
        "email" = $4,
        "dueDays" = $5,
        "currency" = $6,
        "billingAddress1" = $7,
        "billingAddress2" = $8,
        "billingCity" = $9,
        "billingPincode" = $10,
        "billingState" = $11,
        "billingCountry" = $12,
        "isShippingSame" = $13,
        "shippingAddress1" = $14,
        "shippingAddress2" = $15,
        "shippingCity" = $16,
        "shippingPincode" = $17,
        "shippingState" = $18,
        "shippingCountry" = $19,
        "openingBalance" = $20,
        "balanceType" = $21,
        "enablePortal" = $22,
        "notes" = $23,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $24
      RETURNING *
    `;

    const params = [
      gstin, name, mobile, email, dueDays, currency,
      billingAddress1, billingAddress2, billingCity, billingPincode,
      billingState, billingCountry, isShippingSame,
      finalShipping.shippingAddress1, finalShipping.shippingAddress2,
      finalShipping.shippingCity, finalShipping.shippingPincode,
      finalShipping.shippingState, finalShipping.shippingCountry,
      openingBalance, balanceType, enablePortal, notes,
      id
    ];

    const result = await client.query(updateQuery, params);

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Contact updated successfully",
      contact: result.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error updating contact", 500);
  } finally {
    client.release();
  }
}

export async function deleteContact(req, res) {
  const { id } = req.query;
  const companyId = req.currentUser?.companyId;

  if (!companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // First verify contact belongs to company
    const verifyQuery = `
      SELECT "id" FROM hisab."contacts"
      WHERE "id" = $1 AND "companyId" = $2
      LIMIT 1
    `;
    const verifyResult = await client.query(verifyQuery, [id, companyId]);

    if (verifyResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Contact not found or unauthorized", 404);
    }

    const deleteQuery = `
      DELETE FROM hisab."contacts"
      WHERE "id" = $1
      RETURNING *
    `;
    const result = await client.query(deleteQuery, [id]);

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Contact deleted successfully",
      contact: result.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error deleting contact", 500);
  } finally {
    client.release();
  }
}