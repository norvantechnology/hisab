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
    openingBalanceType = 'payable',
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

    // Set current balance equal to opening balance for new contacts
    const currentBalance = Math.abs(parseFloat(openingBalance) || 0);
    const currentBalanceType = openingBalanceType;

    const insertQuery = `
      INSERT INTO hisab."contacts" (
        "companyId", "gstin", "name", "mobile", "email", "dueDays", "currency",
        "billingAddress1", "billingAddress2", "billingCity", "billingPincode", 
        "billingState", "billingCountry", "isShippingSame",
        "shippingAddress1", "shippingAddress2", "shippingCity", "shippingPincode",
        "shippingState", "shippingCountry", "openingBalance", "openingBalanceType",
        "currentBalance", "currentBalanceType", "enablePortal", "notes", "createdBy"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
      RETURNING *
    `;

    const params = [
      companyId, gstin, name, mobile, email, dueDays, currency,
      billingAddress1, billingAddress2, billingCity, billingPincode,
      billingState, billingCountry, isShippingSame,
      finalShipping.shippingAddress1, finalShipping.shippingAddress2,
      finalShipping.shippingCity, finalShipping.shippingPincode,
      finalShipping.shippingState, finalShipping.shippingCountry,
      Math.abs(parseFloat(openingBalance) || 0), openingBalanceType,
      currentBalance, currentBalanceType, enablePortal, notes, currentUserId
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

// Calculate new current balance when opening balance changes
function calculateUpdatedCurrentBalance(
  oldOpeningBalance, 
  oldOpeningBalanceType,
  currentBalance, 
  currentBalanceType,
  newOpeningBalance, 
  newOpeningBalanceType
) {
  // Calculate the net transaction effect (difference between current and opening)
  let netTransactionEffect = 0;
  
  if (oldOpeningBalanceType === currentBalanceType) {
    // Same type: net effect is the difference
    netTransactionEffect = currentBalance - oldOpeningBalance;
  } else {
    // Different types: net effect is the sum (they cancelled each other out and flipped)
    netTransactionEffect = currentBalance + oldOpeningBalance;
    // If old opening was payable and current is receivable, net effect should be negative
    if (oldOpeningBalanceType === 'payable' && currentBalanceType === 'receivable') {
      netTransactionEffect = -netTransactionEffect;
    }
  }
  
  // Apply the net transaction effect to the new opening balance
  let newCurrentBalance = newOpeningBalance;
  let newCurrentBalanceType = newOpeningBalanceType;
  
  if (newOpeningBalanceType === 'payable') {
    // If opening is payable (we owe them), apply the net effect
    newCurrentBalance = newOpeningBalance + netTransactionEffect;
  } else {
    // If opening is receivable (they owe us), apply the net effect
    newCurrentBalance = newOpeningBalance + netTransactionEffect;
  }
  
  // Handle negative balances by flipping the type
  if (newCurrentBalance < 0) {
    newCurrentBalance = Math.abs(newCurrentBalance);
    newCurrentBalanceType = newCurrentBalanceType === 'payable' ? 'receivable' : 'payable';
  }
  
  return {
    balance: newCurrentBalance,
    balanceType: newCurrentBalanceType
  };
}

export async function getContacts(req, res) {
  const companyId = req.currentUser?.companyId;
  const {
    page = 1,
    limit = 10,
    search,
    balanceType,
    contactType,
    startDate,
    endDate,
    skipPagination = false
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
        "isShippingSame", "currentBalance", "openingBalance", "openingBalanceType", 
        "currentBalanceType", "enablePortal", notes,
        "createdBy", "createdAt", "updatedAt", "deletedAt"
      FROM hisab.contacts
      WHERE "companyId" = $1 AND "deletedAt" IS NULL
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

    // Balance type filter (current balance type)
    if (balanceType && ['payable', 'receivable'].includes(balanceType)) {
      paramCount++;
      query += ` AND "currentBalanceType" = $${paramCount}`;
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

    // Apply pagination only if skipPagination is false
    if (!skipPagination) {
      const totalPages = Math.ceil(total / limit);
      query += ` ORDER BY name ASC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limit, (page - 1) * limit);
    } else {
      query += ` ORDER BY name ASC`;
    }

    const result = await client.query(query, params);

    const responseData = {
      contacts: result.rows.map(contact => ({
        ...contact,
        currentBalance: parseFloat(contact.currentBalance),
        openingBalance: parseFloat(contact.openingBalance)
      }))
    };

    // Add pagination info only if pagination is not skipped
    if (!skipPagination) {
      responseData.pagination = {
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        limit: parseInt(limit)
      };
    }

    return successResponse(res, responseData);

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
      SELECT *
      FROM hisab.contacts
      WHERE "id" = $1 AND "companyId" = $2 AND "deletedAt" IS NULL
      LIMIT 1
    `;
    const result = await client.query(query, [id, companyId]);

    if (result.rows.length === 0) {
      return errorResponse(res, "Contact not found", 404);
    }

    const contact = result.rows[0];

    return successResponse(res, {
      contact: {
        ...contact,
        currentBalance: parseFloat(contact.currentBalance),
        openingBalance: parseFloat(contact.openingBalance)
      }
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
    openingBalanceType,
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

    // First verify contact belongs to company and get current values
    const verifyQuery = `
      SELECT "id", "openingBalance", "openingBalanceType", "currentBalance", "currentBalanceType"
      FROM hisab."contacts"
      WHERE "id" = $1 AND "companyId" = $2 AND "deletedAt" IS NULL
      LIMIT 1
    `;
    const verifyResult = await client.query(verifyQuery, [id, companyId]);

    if (verifyResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Contact not found or unauthorized", 404);
    }

    const currentContact = verifyResult.rows[0];
    const oldOpeningBalance = parseFloat(currentContact.openingBalance) || 0;
    const oldOpeningBalanceType = currentContact.openingBalanceType;
    const oldCurrentBalance = parseFloat(currentContact.currentBalance) || 0;
    const oldCurrentBalanceType = currentContact.currentBalanceType;

    const newOpeningBalance = Math.abs(parseFloat(openingBalance) || 0);
    const newOpeningBalanceType = openingBalanceType;

    // Calculate new current balance based on the opening balance change
    const { balance: newCurrentBalance, balanceType: newCurrentBalanceType } = 
      calculateUpdatedCurrentBalance(
        oldOpeningBalance,
        oldOpeningBalanceType,
        oldCurrentBalance,
        oldCurrentBalanceType,
        newOpeningBalance,
        newOpeningBalanceType
      );

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
        "openingBalanceType" = $21,
        "currentBalance" = $22,
        "currentBalanceType" = $23,
        "enablePortal" = $24,
        "notes" = $25,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $26
      RETURNING *
    `;

    const params = [
      gstin, name, mobile, email, dueDays, currency,
      billingAddress1, billingAddress2, billingCity, billingPincode,
      billingState, billingCountry, isShippingSame,
      finalShipping.shippingAddress1, finalShipping.shippingAddress2,
      finalShipping.shippingCity, finalShipping.shippingPincode,
      finalShipping.shippingState, finalShipping.shippingCountry,
      newOpeningBalance, newOpeningBalanceType, 
      newCurrentBalance, newCurrentBalanceType,
      enablePortal, notes, id
    ];

    const result = await client.query(updateQuery, params);

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Contact updated successfully",
      contact: result.rows[0],
      balanceAdjustment: {
        oldOpeningBalance,
        newOpeningBalance,
        oldOpeningBalanceType,
        newOpeningBalanceType,
        oldCurrentBalance,
        newCurrentBalance,
        oldCurrentBalanceType,
        newCurrentBalanceType
      }
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
  const currentUserId = req.currentUser?.id;

  if (!companyId || !currentUserId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // First verify contact belongs to company and is not already deleted
    const verifyQuery = `
      SELECT "id", "name" FROM hisab."contacts"
      WHERE "id" = $1 AND "companyId" = $2 AND "deletedAt" IS NULL
      LIMIT 1
    `;
    const verifyResult = await client.query(verifyQuery, [id, companyId]);

    if (verifyResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Contact not found or already deleted", 404);
    }

    // Soft delete: Update deletedAt timestamp
    const deleteQuery = `
      UPDATE hisab."contacts"
      SET 
        "deletedAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
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

// Optional: Function to restore deleted contacts
export async function restoreContact(req, res) {
  const { id } = req.query;
  const companyId = req.currentUser?.companyId;
  const currentUserId = req.currentUser?.id;

  if (!companyId || !currentUserId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // First verify contact belongs to company and is deleted
    const verifyQuery = `
      SELECT "id", "name" FROM hisab."contacts"
      WHERE "id" = $1 AND "companyId" = $2 AND "deletedAt" IS NOT NULL
      LIMIT 1
    `;
    const verifyResult = await client.query(verifyQuery, [id, companyId]);

    if (verifyResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Contact not found or not deleted", 404);
    }

    // Restore: Set deletedAt to NULL
    const restoreQuery = `
      UPDATE hisab."contacts"
      SET 
        "deletedAt" = NULL,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $1
      RETURNING *
    `;
    const result = await client.query(restoreQuery, [id]);

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Contact restored successfully",
      contact: result.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error restoring contact", 500);
  } finally {
    client.release();
  }
}

// Optional: Function to get deleted contacts
export async function getDeletedContacts(req, res) {
  const companyId = req.currentUser?.companyId;
  const {
    page = 1,
    limit = 10,
    search,
    skipPagination = false
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
        "isShippingSame", "currentBalance", "openingBalance", "openingBalanceType", 
        "currentBalanceType", "enablePortal", notes,
        "createdBy", "createdAt", "updatedAt", "deletedAt"
      FROM hisab.contacts
      WHERE "companyId" = $1 AND "deletedAt" IS NOT NULL
    `;
    const params = [companyId];
    let paramCount = 1;

    // Search filter
    if (search) {
      paramCount++;
      query += ` AND (
        name ILIKE ${paramCount} OR 
        mobile ILIKE ${paramCount} OR 
        email ILIKE ${paramCount} OR 
        gstin ILIKE ${paramCount} OR
        "billingCity" ILIKE ${paramCount} OR
        "billingState" ILIKE ${paramCount}
      )`;
      params.push(`%${search}%`);
    }

    // Count total records
    const countQuery = `SELECT COUNT(*) FROM (${query}) as total`;
    const countResult = await client.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Apply pagination only if skipPagination is false
    if (!skipPagination) {
      query += ` ORDER BY "deletedAt" DESC LIMIT ${paramCount + 1} OFFSET ${paramCount + 2}`;
      params.push(limit, (page - 1) * limit);
    } else {
      query += ` ORDER BY "deletedAt" DESC`;
    }

    const result = await client.query(query, params);

    const responseData = {
      contacts: result.rows.map(contact => ({
        ...contact,
        currentBalance: parseFloat(contact.currentBalance),
        openingBalance: parseFloat(contact.openingBalance)
      }))
    };

    // Add pagination info only if pagination is not skipped
    if (!skipPagination) {
      responseData.pagination = {
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        limit: parseInt(limit)
      };
    }

    return successResponse(res, responseData);

  } catch (error) {
    console.error(error);
    return errorResponse(res, "Error fetching deleted contacts", 500);
  } finally {
    client.release();
  }
}