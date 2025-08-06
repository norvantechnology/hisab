import pool from "../config/dbConnection.js";
import { errorResponse, successResponse, sendEmail } from "../utils/index.js";
import { calculateContactCurrentBalance } from "../utils/balanceCalculator.js";

// Helper function to calculate updated current balance when opening balance changes
function calculateUpdatedCurrentBalance(
  oldOpeningBalance,
  oldOpeningBalanceType,
  oldCurrentBalance,
  oldCurrentBalanceType,
  newOpeningBalance,
  newOpeningBalanceType
) {
  // Calculate the difference in opening balance
  const openingBalanceDiff = newOpeningBalance - oldOpeningBalance;
  
  // Calculate the impact on current balance based on opening balance type change
  let newCurrentBalance = oldCurrentBalance;
  let newCurrentBalanceType = oldCurrentBalanceType;
  
  if (oldOpeningBalanceType === newOpeningBalanceType) {
    // Same type, just adjust the amount
    if (oldOpeningBalanceType === 'payable') {
      newCurrentBalance = oldCurrentBalance + openingBalanceDiff;
    } else {
      newCurrentBalance = oldCurrentBalance - openingBalanceDiff;
    }
  } else {
    // Different types, need to recalculate
    if (oldOpeningBalanceType === 'payable' && newOpeningBalanceType === 'receivable') {
      // Was payable, now receivable
      newCurrentBalance = oldCurrentBalance + oldOpeningBalance + newOpeningBalance;
      newCurrentBalanceType = 'receivable';
    } else if (oldOpeningBalanceType === 'receivable' && newOpeningBalanceType === 'payable') {
      // Was receivable, now payable
      newCurrentBalance = oldCurrentBalance + oldOpeningBalance + newOpeningBalance;
      newCurrentBalanceType = 'payable';
    }
  }
  
  // Ensure balance is positive
  newCurrentBalance = Math.abs(newCurrentBalance);
  
  return {
    balance: newCurrentBalance,
    balanceType: newCurrentBalanceType
  };
}

export async function createContact(req, res) {
  const {
    gstin,
    name,
    mobile,
    email,
    dueDays,
    contactType = 'customer', // Default to customer
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
        "companyId", "gstin", "name", "mobile", "email", "dueDays", "contactType",
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
      companyId, gstin, name, mobile, email, dueDays, contactType,
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
    skipPagination = false,
    includeCalculatedBalance = 'true' // Default to true to always show calculated balance
  } = req.query;

  if (!companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    let query = `
      SELECT 
        id, gstin, name, mobile, email, "dueDays", "contactType",
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

    // Contact type filter
    if (contactType && ['customer', 'vendor'].includes(contactType)) {
      paramCount++;
      query += ` AND "contactType" = $${paramCount}`;
      params.push(contactType);
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

    let contacts = result.rows.map(contact => ({
      ...contact,
      currentBalance: parseFloat(contact.currentBalance),
      openingBalance: parseFloat(contact.openingBalance)
    }));

    // Always include calculated balance and pending purchase information
    for (let contact of contacts) {
      try {
        // Get calculated balance
        const { balance, balanceType, breakdown } = await calculateContactCurrentBalance(client, contact.id, companyId);
        
        // Get pending purchases summary
        const pendingSummaryQuery = await client.query(
          `SELECT 
             COUNT(*) as count,
             COALESCE(SUM("remaining_amount"), 0) as totalRemaining
           FROM hisab."purchases" 
           WHERE "contactId" = $1 AND "companyId" = $2 AND "status" = 'pending' AND "deletedAt" IS NULL`,
          [contact.id, companyId]
        );

        // Get pending sales summary
        const pendingSalesSummaryQuery = await client.query(
          `SELECT 
             COUNT(*) as count,
             COALESCE(SUM("remaining_amount"), 0) as totalRemaining
           FROM hisab."sales" 
           WHERE "contactId" = $1 AND "companyId" = $2 AND "status" = 'pending' AND "deletedAt" IS NULL`,
          [contact.id, companyId]
        );

        // Get pending incomes summary
        const pendingIncomesSummaryQuery = await client.query(
          `SELECT 
             COUNT(*) as count,
             COALESCE(SUM("remaining_amount"), 0) as totalRemaining
           FROM hisab."incomes" 
           WHERE "contactId" = $1 AND "companyId" = $2 AND "status" = 'pending'`,
          [contact.id, companyId]
        );

        // Get pending expenses summary
        const pendingExpensesSummaryQuery = await client.query(
          `SELECT 
             COUNT(*) as count,
             COALESCE(SUM("remaining_amount"), 0) as totalRemaining
           FROM hisab."expenses" 
           WHERE "contactId" = $1 AND "companyId" = $2 AND "status" = 'pending'`,
          [contact.id, companyId]
        );

        const pendingInfo = pendingSummaryQuery.rows[0];
        const pendingSalesInfo = pendingSalesSummaryQuery.rows[0];
        const pendingIncomesInfo = pendingIncomesSummaryQuery.rows[0];
        const pendingExpensesInfo = pendingExpensesSummaryQuery.rows[0];

        contact.calculatedBalance = {
          amount: balance,
          type: balanceType
        };
        contact.balanceBreakdown = breakdown;
        contact.pendingInfo = {
          pendingPurchasesCount: parseInt(pendingInfo.count),
          totalPendingPurchaseAmount: parseFloat(pendingInfo.totalRemaining),
          pendingSalesCount: parseInt(pendingSalesInfo.count),
          totalPendingSalesAmount: parseFloat(pendingSalesInfo.totalRemaining),
          pendingIncomesCount: parseInt(pendingIncomesInfo.count),
          totalPendingIncomeAmount: parseFloat(pendingIncomesInfo.totalRemaining),
          pendingExpensesCount: parseInt(pendingExpensesInfo.count),
          totalPendingExpenseAmount: parseFloat(pendingExpensesInfo.totalRemaining),
          hasDiscrepancy: Math.abs(balance - parseFloat(contact.currentBalance)) > 0.01
        };
      } catch (error) {
        console.error(`Error calculating balance for contact ${contact.id}:`, error);
        contact.calculatedBalance = {
          amount: contact.currentBalance,
          type: contact.currentBalanceType
        };
        contact.balanceBreakdown = null;
        contact.pendingInfo = {
          pendingPurchasesCount: 0,
          totalPendingPurchaseAmount: 0,
          pendingSalesCount: 0,
          totalPendingSalesAmount: 0,
          pendingIncomesCount: 0,
          totalPendingIncomeAmount: 0,
          pendingExpensesCount: 0,
          totalPendingExpenseAmount: 0,
          hasDiscrepancy: false
        };
      }
    }

    const responseData = {
      contacts
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
    contactType,
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
        "contactType" = $6,
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
      gstin, name, mobile, email, dueDays, contactType,
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
        id, gstin, name, mobile, email, "dueDays",
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



// Update contact current balance based on all transactions
export async function updateContactCurrentBalance(req, res) {
  const { contactId } = req.params;
  const companyId = req.currentUser?.companyId;

  if (!companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Calculate new current balance
    const { balance, balanceType, breakdown } = await calculateContactCurrentBalance(client, contactId, companyId);

    // Update contact with new balance
    await client.query(
      `UPDATE hisab."contacts" 
       SET "currentBalance" = $1, "currentBalanceType" = $2, "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $3 AND "companyId" = $4`,
      [balance, balanceType, contactId, companyId]
    );

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Contact current balance updated successfully",
      contactId,
      currentBalance: balance,
      currentBalanceType: balanceType,
      breakdown
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error updating contact current balance", 500);
  } finally {
    client.release();
  }
}

// Get contact current balance with detailed breakdown
export async function getContactCurrentBalance(req, res) {
  const { contactId } = req.params;
  const companyId = req.currentUser?.companyId;

  if (!companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    // Calculate current balance
    const { balance, balanceType, breakdown } = await calculateContactCurrentBalance(client, contactId, companyId);

    // Get contact details
    const contactQuery = await client.query(
      `SELECT "id", "name", "currentBalance", "currentBalanceType", "openingBalance", "openingBalanceType"
       FROM hisab."contacts" 
       WHERE "id" = $1 AND "companyId" = $2`,
      [contactId, companyId]
    );

    if (contactQuery.rows.length === 0) {
      return errorResponse(res, "Contact not found", 404);
    }

    const contact = contactQuery.rows[0];

    // Get detailed pending purchases information
    const pendingPurchasesQuery = await client.query(
      `SELECT 
         "id",
         "invoiceNumber",
         "invoiceDate",
         "netPayable",
         "paid_amount",
         "remaining_amount",
         "status",
         "createdAt"
       FROM hisab."purchases" 
       WHERE "contactId" = $1 AND "companyId" = $2 AND "status" = 'pending' AND "deletedAt" IS NULL
       ORDER BY "invoiceDate" ASC`,
      [contactId, companyId]
    );

    // Get detailed pending sales information
    const pendingSalesQuery = await client.query(
      `SELECT 
         "id",
         "invoiceNumber",
         "invoiceDate",
         "netReceivable",
         "paid_amount",
         "remaining_amount",
         "status",
         "createdAt"
       FROM hisab."sales" 
       WHERE "contactId" = $1 AND "companyId" = $2 AND "status" = 'pending' AND "deletedAt" IS NULL
       ORDER BY "invoiceDate" ASC`,
      [contactId, companyId]
    );

    // Get pending purchases count and total
    const pendingSummaryQuery = await client.query(
      `SELECT COUNT(*) as count, COALESCE(SUM("remaining_amount"), 0) as total
       FROM hisab."purchases" 
       WHERE "contactId" = $1 AND "companyId" = $2 AND "status" = 'pending' AND "deletedAt" IS NULL`,
      [contactId, companyId]
    );

    // Get pending sales count and total
    const pendingSalesSummaryQuery = await client.query(
      `SELECT COUNT(*) as count, COALESCE(SUM("remaining_amount"), 0) as total
       FROM hisab."sales" 
       WHERE "contactId" = $1 AND "companyId" = $2 AND "status" = 'pending' AND "deletedAt" IS NULL`,
      [contactId, companyId]
    );

    const pendingInfo = pendingSummaryQuery.rows[0];
    const pendingSalesInfo = pendingSalesSummaryQuery.rows[0];

    // Process pending purchases for detailed view
    const pendingPurchases = pendingPurchasesQuery.rows.map(purchase => ({
      id: purchase.id,
      invoiceNumber: purchase.invoiceNumber,
      invoiceDate: purchase.invoiceDate,
      netPayable: parseFloat(purchase.netPayable || 0),
      paidAmount: parseFloat(purchase.paid_amount || 0),
      remainingAmount: parseFloat(purchase.remaining_amount || 0),
      status: purchase.status,
      createdAt: purchase.createdAt
    }));

    // Process pending sales for detailed view
    const pendingSales = pendingSalesQuery.rows.map(sale => ({
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      invoiceDate: sale.invoiceDate,
      netReceivable: parseFloat(sale.netReceivable || 0),
      paidAmount: parseFloat(sale.paid_amount || 0),
      remainingAmount: parseFloat(sale.remaining_amount || 0),
      status: sale.status,
      createdAt: sale.createdAt
    }));

    return successResponse(res, {
      contact: {
        id: contact.id,
        name: contact.name,
        currentBalance: balance,
        currentBalanceType: balanceType,
        openingBalance: parseFloat(contact.openingBalance),
        openingBalanceType: contact.openingBalanceType,
        storedBalance: parseFloat(contact.currentBalance),
        storedBalanceType: contact.currentBalanceType
      },
      breakdown,
      calculatedBalance: {
        amount: balance,
        type: balanceType
      },
      storedBalance: {
        amount: parseFloat(contact.currentBalance),
        type: contact.currentBalanceType
      },
      pendingInfo: {
        pendingPurchasesCount: parseInt(pendingInfo.count),
        totalPendingPurchaseAmount: parseFloat(pendingInfo.total),
        pendingSalesCount: parseInt(pendingSalesInfo.count),
        totalPendingSalesAmount: parseFloat(pendingSalesInfo.total),
        hasDiscrepancy: Math.abs(balance - parseFloat(contact.currentBalance)) > 0.01,
        pendingPurchases: pendingPurchases,
        pendingSales: pendingSales
      },
      calculation: {
        formula: "Stored Current Balance + Opening Balance + Pending Purchases + Pending Expenses - Pending Sales - Pending Incomes - Current Balance Payments + Receipts Received + Adjustments",
        explanation: `Based on stored current balance (${breakdown.storedCurrentBalanceType} ${breakdown.storedCurrentBalance}), opening balance (${breakdown.openingBalanceType} ${breakdown.openingBalance}), pending purchases (${breakdown.totalPendingPurchases}), pending expenses (${breakdown.totalPendingExpenses}), pending sales (${breakdown.totalPendingSales}), pending incomes (${breakdown.totalPendingIncomes}), current balance payments (${breakdown.totalCurrentBalancePayments}), receipts received (${breakdown.totalReceiptsFromContact}), and adjustments (${breakdown.totalAdjustments})`
      }
    });

  } catch (error) {
    console.error(error);
    return errorResponse(res, "Error calculating contact current balance", 500);
  } finally {
    client.release();
  }
}

// Update all contacts current balance (for maintenance)
export async function updateAllContactsCurrentBalance(req, res) {
  const companyId = req.currentUser?.companyId;

  if (!companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Get all contacts
    const contactsQuery = await client.query(
      `SELECT "id" FROM hisab."contacts" WHERE "companyId" = $1 AND "deletedAt" IS NULL`,
      [companyId]
    );

    const results = [];
    const errors = [];

    for (const contact of contactsQuery.rows) {
      try {
        const { balance, balanceType, breakdown } = await calculateContactCurrentBalance(client, contact.id, companyId);

        await client.query(
          `UPDATE hisab."contacts" 
           SET "currentBalance" = $1, "currentBalanceType" = $2, "updatedAt" = CURRENT_TIMESTAMP
           WHERE "id" = $3`,
          [balance, balanceType, contact.id]
        );

        results.push({
          contactId: contact.id,
          currentBalance: balance,
          currentBalanceType: balanceType,
          success: true
        });
      } catch (error) {
        console.error(`Error updating contact ${contact.id}:`, error);
        errors.push({
          contactId: contact.id,
          error: error.message,
          success: false
        });
      }
    }

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Contact balances updated",
      totalContacts: contactsQuery.rows.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error updating contact balances", 500);
  } finally {
    client.release();
  }
}

// Get simple pending balance summary for a contact
export async function getContactPendingBalanceSummary(req, res) {
  const { contactId } = req.params;
  const companyId = req.currentUser?.companyId;

  if (!companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    // Get contact basic info
    const contactQuery = await client.query(
      `SELECT "id", "name", "currentBalance", "currentBalanceType", "openingBalance", "openingBalanceType"
       FROM hisab."contacts" 
       WHERE "id" = $1 AND "companyId" = $2`,
      [contactId, companyId]
    );

    if (contactQuery.rows.length === 0) {
      return errorResponse(res, "Contact not found", 404);
    }

    const contact = contactQuery.rows[0];

    // Get pending purchases summary
    const pendingSummaryQuery = await client.query(
      `SELECT 
         COUNT(*) as count,
         COALESCE(SUM("remaining_amount"), 0) as totalRemaining,
         COALESCE(SUM("netPayable"), 0) as totalNetPayable,
         COALESCE(SUM("paid_amount"), 0) as totalPaid
       FROM hisab."purchases" 
       WHERE "contactId" = $1 AND "companyId" = $2 AND "status" = 'pending' AND "deletedAt" IS NULL`,
      [contactId, companyId]
    );

    // Get pending sales summary
    const pendingSalesSummaryQuery = await client.query(
      `SELECT 
         COUNT(*) as count,
         COALESCE(SUM("remaining_amount"), 0) as totalRemaining,
         COALESCE(SUM("netReceivable"), 0) as totalNetReceivable,
         COALESCE(SUM("paid_amount"), 0) as totalPaid
       FROM hisab."sales" 
       WHERE "contactId" = $1 AND "companyId" = $2 AND "status" = 'pending' AND "deletedAt" IS NULL`,
      [contactId, companyId]
    );

    // Get pending expenses summary (amounts we owe to contact)
    const pendingExpensesQuery = await client.query(
      `SELECT 
         COUNT(*) as count,
         COALESCE(SUM("amount"), 0) as totalAmount
       FROM hisab."expenses" 
       WHERE "contactId" = $1 AND "companyId" = $2 AND "status" = 'pending'`,
      [contactId, companyId]
    );

    // Get pending incomes summary (amounts contact owes us)
    const pendingIncomesQuery = await client.query(
      `SELECT 
         COUNT(*) as count,
         COALESCE(SUM("amount"), 0) as totalAmount
       FROM hisab."incomes" 
       WHERE "contactId" = $1 AND "companyId" = $2 AND "status" = 'pending'`,
      [contactId, companyId]
    );

    // Get payments summary
    const paymentsSummaryQuery = await client.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN p."paymentType" = 'payment' THEN pa."paidAmount" ELSE 0 END), 0) as totalPayments,
         COALESCE(SUM(CASE WHEN p."paymentType" = 'receipt' THEN pa."paidAmount" ELSE 0 END), 0) as totalReceipts
       FROM hisab."payments" p
       LEFT JOIN hisab."payment_allocations" pa ON p."id" = pa."paymentId"
       WHERE p."contactId" = $1 AND p."companyId" = $2 AND p."deletedAt" IS NULL`,
      [contactId, companyId]
    );

    const pendingInfo = pendingSummaryQuery.rows[0];
    const pendingSalesInfo = pendingSalesSummaryQuery.rows[0];
    const pendingExpensesInfo = pendingExpensesQuery.rows[0];
    const pendingIncomesInfo = pendingIncomesQuery.rows[0];
    const paymentsInfo = paymentsSummaryQuery.rows[0];

    // Calculate current pending balance
    const openingBalance = parseFloat(contact.openingBalance || 0);
    const openingBalanceType = contact.openingBalanceType;
    const storedCurrentBalance = parseFloat(contact.currentBalance || 0);
    const storedCurrentBalanceType = contact.currentBalanceType;
    const totalPendingPurchases = parseFloat(pendingInfo.totalRemaining || 0);
    const totalPendingSales = parseFloat(pendingSalesInfo.totalRemaining || 0);
    const totalPendingExpenses = parseFloat(pendingExpensesInfo.totalAmount || 0);
    const totalPendingIncomes = parseFloat(pendingIncomesInfo.totalAmount || 0);
    const totalPayments = parseFloat(paymentsInfo.totalPayments || 0);
    const totalReceipts = parseFloat(paymentsInfo.totalReceipts || 0);

    let currentPendingBalance = 0;
    
    // Start with stored current balance
    if (storedCurrentBalanceType === 'payable') {
      currentPendingBalance = storedCurrentBalance; // We owe them
    } else {
      currentPendingBalance = -storedCurrentBalance; // They owe us
    }
    
    // Add opening balance impact
    if (openingBalanceType === 'payable') {
      currentPendingBalance += openingBalance; // We owe them
    } else {
      currentPendingBalance -= openingBalance; // They owe us
    }
    
    // Add pending transactions
    currentPendingBalance += totalPendingPurchases + totalPendingExpenses - totalPendingSales - totalPendingIncomes - totalPayments + totalReceipts;

    let currentPendingBalanceType = currentPendingBalance > 0 ? 'payable' : 'receivable';
    if (currentPendingBalance === 0) currentPendingBalanceType = 'payable';
    currentPendingBalance = Math.abs(currentPendingBalance);

    return successResponse(res, {
      contact: {
        id: contact.id,
        name: contact.name,
        openingBalance: openingBalance,
        openingBalanceType: openingBalanceType,
        storedBalance: storedCurrentBalance,
        storedBalanceType: storedCurrentBalanceType
      },
      pendingSummary: {
        pendingPurchasesCount: parseInt(pendingInfo.count),
        totalNetPayable: parseFloat(pendingInfo.totalNetPayable),
        totalPaid: parseFloat(pendingInfo.totalPaid),
        totalRemaining: parseFloat(pendingInfo.totalRemaining),
        pendingSalesCount: parseInt(pendingSalesInfo.count),
        totalNetReceivable: parseFloat(pendingSalesInfo.totalNetReceivable),
        totalSalesPaid: parseFloat(pendingSalesInfo.totalPaid),
        totalSalesRemaining: parseFloat(pendingSalesInfo.totalRemaining),
        pendingExpensesCount: parseInt(pendingExpensesInfo.count),
        totalPendingExpenses: totalPendingExpenses,
        pendingIncomesCount: parseInt(pendingIncomesInfo.count),
        totalPendingIncomes: totalPendingIncomes,
        totalPayments: totalPayments,
        totalReceipts: totalReceipts,
        currentPendingBalance: currentPendingBalance,
        currentPendingBalanceType: currentPendingBalanceType
      },
      calculation: {
        formula: "Stored Current Balance + Opening Balance + Pending Purchases + Pending Expenses - Pending Sales - Pending Incomes - Current Balance Payments + Receipts Received",
        breakdown: {
          storedCurrentBalance: `${storedCurrentBalanceType} ${storedCurrentBalance}`,
          openingBalance: `${openingBalanceType} ${openingBalance}`,
          pendingPurchases: totalPendingPurchases,
          pendingExpenses: totalPendingExpenses,
          pendingSales: totalPendingSales,
          pendingIncomes: totalPendingIncomes,
          paymentsMade: totalPayments,
          receiptsReceived: totalReceipts,
          result: `${currentPendingBalanceType} ${currentPendingBalance}`
        }
      }
    });

  } catch (error) {
    console.error(error);
    return errorResponse(res, "Error getting pending balance summary", 500);
  } finally {
    client.release();
  }
}

export async function bulkImportContacts(req, res) {
  const { contacts } = req.body;
  const companyId = req.currentUser?.companyId;
  const currentUserId = req.currentUser?.id;

  if (!companyId || !currentUserId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  if (!Array.isArray(contacts) || contacts.length === 0) {
    return errorResponse(res, "No contacts data provided", 400);
  }

  if (contacts.length > 1000) {
    return errorResponse(res, "Maximum 1000 contacts can be imported at once", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const results = {
      success: [],
      errors: [],
      total: contacts.length
    };

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const rowNumber = i + 1;

      try {
        // Validate required fields
        if (!contact.name) {
          results.errors.push({
            row: rowNumber,
            error: "Name is required"
          });
          continue;
        }

        // Validate email format if provided
        if (contact.email && contact.email.trim() !== '') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(contact.email)) {
            results.errors.push({
              row: rowNumber,
              error: "Invalid email format"
            });
            continue;
          }
        }

        // Validate mobile format if provided
        if (contact.mobile && contact.mobile.trim() !== '') {
          const mobileRegex = /^[0-9]{10}$/;
          const cleanMobile = contact.mobile.toString().replace(/\D/g, '');
          if (!mobileRegex.test(cleanMobile)) {
            results.errors.push({
              row: rowNumber,
              error: "Mobile must be 10 digits"
            });
            continue;
          }
          contact.mobile = cleanMobile;
        }

        // Validate GSTIN format if provided
        if (contact.gstin && contact.gstin.trim() !== '') {
          const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
          if (!gstinRegex.test(contact.gstin)) {
            results.errors.push({
              row: rowNumber,
              error: "Invalid GSTIN format"
            });
            continue;
          }
        }

        // Check for duplicate GSTIN if provided
        if (contact.gstin && contact.gstin.trim() !== '') {
          const duplicateCheck = await client.query(
            `SELECT id FROM hisab.contacts 
             WHERE "companyId" = $1 AND gstin = $2 AND "deletedAt" IS NULL`,
            [companyId, contact.gstin]
          );
          
          if (duplicateCheck.rows.length > 0) {
            results.errors.push({
              row: rowNumber,
              error: "GSTIN already exists"
            });
            continue;
          }
        }

        // Prepare contact data with defaults
        const contactData = {
          gstin: contact.gstin || null,
          name: contact.name.trim(),
          mobile: contact.mobile || null,
          email: contact.email || null,
          dueDays: parseInt(contact.dueDays) || 0,
          contactType: contact.contactType || 'customer',
          billingAddress1: contact.billingAddress1 || '',
          billingAddress2: contact.billingAddress2 || '',
          billingCity: contact.billingCity || '',
          billingPincode: contact.billingPincode || '',
          billingState: contact.billingState || '',
          billingCountry: contact.billingCountry || 'India',
          isShippingSame: contact.isShippingSame === 'true' || contact.isShippingSame === true,
          shippingAddress1: contact.shippingAddress1 || contact.billingAddress1 || '',
          shippingAddress2: contact.shippingAddress2 || contact.billingAddress2 || '',
          shippingCity: contact.shippingCity || contact.billingCity || '',
          shippingPincode: contact.shippingPincode || contact.billingPincode || '',
          shippingState: contact.shippingState || contact.billingState || '',
          shippingCountry: contact.shippingCountry || contact.billingCountry || 'India',
          openingBalance: Math.abs(parseFloat(contact.openingBalance) || 0),
          openingBalanceType: contact.openingBalanceType || 'payable',
          enablePortal: contact.enablePortal === 'true' || contact.enablePortal === true,
          notes: contact.notes || ''
        };

        // Set current balance equal to opening balance
        const currentBalance = contactData.openingBalance;
        const currentBalanceType = contactData.openingBalanceType;

        const insertQuery = `
          INSERT INTO hisab."contacts" (
            "companyId", "gstin", "name", "mobile", "email", "dueDays", "contactType",
            "billingAddress1", "billingAddress2", "billingCity", "billingPincode", 
            "billingState", "billingCountry", "isShippingSame",
            "shippingAddress1", "shippingAddress2", "shippingCity", "shippingPincode",
            "shippingState", "shippingCountry", "openingBalance", "openingBalanceType",
            "currentBalance", "currentBalanceType", "enablePortal", "notes", "createdBy"
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
          RETURNING id, name
        `;

        const params = [
          companyId, contactData.gstin, contactData.name, contactData.mobile, 
          contactData.email, contactData.dueDays, contactData.contactType,
          contactData.billingAddress1, contactData.billingAddress2, contactData.billingCity, 
          contactData.billingPincode, contactData.billingState, contactData.billingCountry, 
          contactData.isShippingSame, contactData.shippingAddress1, contactData.shippingAddress2,
          contactData.shippingCity, contactData.shippingPincode, contactData.shippingState, 
          contactData.shippingCountry, contactData.openingBalance, contactData.openingBalanceType,
          currentBalance, currentBalanceType, contactData.enablePortal, contactData.notes, currentUserId
        ];

        const result = await client.query(insertQuery, params);
        
        results.success.push({
          row: rowNumber,
          id: result.rows[0].id,
          name: result.rows[0].name
        });

      } catch (error) {
        console.error(`Error importing contact at row ${rowNumber}:`, error);
        results.errors.push({
          row: rowNumber,
          error: error.message || "Unknown error occurred"
        });
      }
    }

    await client.query("COMMIT");

    return successResponse(res, {
      message: `Import completed. ${results.success.length} contacts imported successfully, ${results.errors.length} errors.`,
      results
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Bulk import error:", error);
    return errorResponse(res, "Error importing contacts", 500);
  } finally {
    client.release();
  }
}

// Generate portal access for a contact
export async function generateContactPortalAccess(req, res) {
  const { contactId } = req.params;
  const { expiryHours = 24 } = req.body; // Default to 24 hours if not provided
  const { companyId } = req.currentUser;

  if (!companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  // Validate expiry hours
  const validExpiryHours = [1, 6, 12, 24, 72, 168, 720];
  if (!validExpiryHours.includes(expiryHours)) {
    return errorResponse(res, "Invalid expiry time. Please select from the available options.", 400);
  }

  const client = await pool.connect();

  try {
    // Check if contact exists and belongs to the company
    const contactQuery = `
      SELECT id, name, email, "enablePortal"
      FROM hisab.contacts 
      WHERE id = $1 AND "companyId" = $2 AND "deletedAt" IS NULL
    `;
    
    const contactResult = await client.query(contactQuery, [contactId, companyId]);
    
    if (contactResult.rows.length === 0) {
      return errorResponse(res, "Contact not found", 404);
    }

    const contact = contactResult.rows[0];

    if (!contact.enablePortal) {
      return errorResponse(res, "Portal access is not enabled for this contact", 400);
    }

    if (!contact.email) {
      return errorResponse(res, "Contact must have an email address to enable portal access", 400);
    }

    // Generate portal access token
    const crypto = await import('crypto');
    const portalAccessToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiry = new Date(Date.now() + expiryHours * 60 * 60 * 1000); // Convert hours to milliseconds

    // Update contact with portal access token
    const updateQuery = `
      UPDATE hisab.contacts 
      SET "portalAccessToken" = $1, "portalAccessTokenExpiry" = $2, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING id, name, email, "portalAccessToken", "portalAccessTokenExpiry"
    `;

    const updateResult = await client.query(updateQuery, [portalAccessToken, tokenExpiry, contactId]);

    // Send email with portal access link
    const portalUrl = `${process.env.FRONTEND_URL}/portal/login?token=${portalAccessToken}`;
    
    // Format expiry time for email
    const formatExpiryTime = (hours) => {
      if (hours === 1) return '1 hour';
      if (hours < 24) return `${hours} hours`;
      if (hours === 24) return '1 day';
      if (hours === 72) return '3 days';
      if (hours === 168) return '1 week';
      if (hours === 720) return '1 month';
      return `${hours} hours`;
    };
    
    try {
      await sendEmail({
        to: contact.email,
        subject: 'Your Customer Portal Access',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="margin: 0; font-size: 28px;">Welcome to Your Customer Portal</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Access your account information and transactions</p>
            </div>
            
            <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; line-height: 1.6; color: #333;">
                Dear <strong>${contact.name}</strong>,
              </p>
              
              <p style="font-size: 16px; line-height: 1.6; color: #333;">
                Your customer portal access has been activated! You can now view your account information, 
                transaction history, and payment details through our secure customer portal.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${portalUrl}" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; 
                          padding: 15px 30px; 
                          text-decoration: none; 
                          border-radius: 25px; 
                          font-weight: bold; 
                          display: inline-block;
                          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                  Access Your Portal
                </a>
              </div>
              
              <p style="font-size: 14px; line-height: 1.6; color: #666;">
                <strong>Important Notes:</strong>
              </p>
              <ul style="font-size: 14px; line-height: 1.6; color: #666;">
                <li>This access link is valid for ${formatExpiryTime(expiryHours)}</li>
                <li>Keep your access token secure and don't share it with others</li>
                <li>You can view your transaction history, account balance, and profile information</li>
                <li>If you need assistance, please contact your account manager</li>
              </ul>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                <p style="font-size: 12px; color: #999; text-align: center;">
                  This is an automated message. Please do not reply to this email.
                </p>
              </div>
            </div>
          </div>
        `
      });

      console.log(`Portal access email sent to ${contact.email} with ${expiryHours} hour expiry`);

    } catch (emailError) {
      console.error('Error sending portal access email:', emailError);
      // Don't fail the request if email fails, just log the error
    }

    return successResponse(res, {
      message: `Portal access token generated and email sent successfully. Token will expire in ${formatExpiryTime(expiryHours)}.`,
      contact: {
        id: updateResult.rows[0].id,
        name: updateResult.rows[0].name,
        email: updateResult.rows[0].email,
        portalAccessToken: updateResult.rows[0].portalAccessToken,
        portalAccessTokenExpiry: updateResult.rows[0].portalAccessTokenExpiry
      }
    });

  } catch (error) {
    console.error("Error generating portal access:", error);
    return errorResponse(res, "Failed to generate portal access", 500);
  } finally {
    client.release();
  }
}

