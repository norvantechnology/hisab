import pool from "../config/dbConnection.js";
import { errorResponse, successResponse, sendEmail } from "../utils/index.js";
import { calculateContactCurrentBalance } from "../utils/balanceCalculator.js";

// UPDATED: Removed helper function calculateUpdatedCurrentBalance since we no longer store currentBalance
// The balance is always calculated real-time from transactions

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

  if (!companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  if (!name) {
    return errorResponse(res, "Contact name is required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // UPDATED: Removed currentBalance and currentBalanceType from insert
    // Opening balance is used as the starting point for calculations
    const query = `
      INSERT INTO hisab."contacts" (
        "companyId", gstin, name, mobile, email, "dueDays", "contactType",
        "billingAddress1", "billingAddress2", "billingCity", "billingPincode", 
        "billingState", "billingCountry", "isShippingSame", "shippingAddress1", 
        "shippingAddress2", "shippingCity", "shippingPincode", "shippingState", 
        "shippingCountry", "openingBalance", "openingBalanceType", 
        "enablePortal", "notes", "createdBy"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      RETURNING *
    `;

    const result = await client.query(query, [
      companyId, gstin, name, mobile, email, dueDays, contactType,
      billingAddress1, billingAddress2, billingCity, billingPincode,
      billingState, billingCountry, isShippingSame, shippingAddress1, 
      shippingAddress2, shippingCity, shippingPincode, shippingState, 
      shippingCountry, openingBalance, openingBalanceType, 
      enablePortal, notes, currentUserId
    ]);

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
  const startTime = Date.now();
  
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
    // UPDATED: Removed currentBalance and currentBalanceType from SELECT
    let query = `
      SELECT 
        id, gstin, name, mobile, email, "dueDays", "contactType",
        "billingAddress1", "billingAddress2", "billingCity", "billingPincode",
        "billingState", "billingCountry", "shippingAddress1", "shippingAddress2",
        "shippingCity", "shippingPincode", "shippingState", "shippingCountry",
        "isShippingSame", "openingBalance", "openingBalanceType", 
        "enablePortal", notes,
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

    // UPDATED: Balance type filter now uses calculated balance instead of stored currentBalanceType
    // We'll filter after calculation since we don't store balance in DB anymore

    // Contact type filter
    if (contactType && ['customer', 'vendor'].includes(contactType)) {
      paramCount++;
      query += ` AND "contactType" = $${paramCount}`;
      params.push(contactType);
    }

    // Date range filter
    if (startDate && endDate) {
      paramCount++;
      query += ` AND "createdAt" BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(startDate, endDate);
      paramCount++;
    }

    // Get total count for pagination
    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = await client.query(countQuery, params);
    const totalContacts = parseInt(countResult.rows[0].total);

    // Apply sorting
    query += ` ORDER BY "createdAt" DESC`;

    // Apply pagination if not skipped
    if (skipPagination !== 'true') {
      const offset = (page - 1) * limit;
      query += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limit, offset);
    }
    
    const result = await client.query(query, params);
    let contacts = result.rows;

    // UPDATED: Always calculate balance since we don't store it
    if (includeCalculatedBalance === 'true') {
      // Pre-fetch all transaction data in batches for better performance
      const contactIds = contacts.map(c => c.id);
      
      const batchStartTime = Date.now();
      
      // Batch queries for better performance
      const [purchasesData, salesData, incomesData, expensesData] = await Promise.all([
        client.query(`
          SELECT "contactId", COALESCE(SUM("remaining_amount"), 0) as totalPending
           FROM hisab."purchases" 
          WHERE "contactId" = ANY($1) AND "companyId" = $2 AND "deletedAt" IS NULL
          GROUP BY "contactId"
        `, [contactIds, companyId]),
        
        client.query(`
          SELECT "contactId", COALESCE(SUM("remaining_amount"), 0) as totalPending
           FROM hisab."sales" 
          WHERE "contactId" = ANY($1) AND "companyId" = $2 AND "deletedAt" IS NULL
          GROUP BY "contactId"
        `, [contactIds, companyId]),
        
        client.query(`
          SELECT "contactId", COALESCE(SUM("remaining_amount"), 0) as totalPending
           FROM hisab."incomes" 
          WHERE "contactId" = ANY($1) AND "companyId" = $2
          GROUP BY "contactId"
        `, [contactIds, companyId]),
        
        client.query(`
          SELECT "contactId", COALESCE(SUM("remaining_amount"), 0) as totalPending
           FROM hisab."expenses" 
          WHERE "contactId" = ANY($1) AND "companyId" = $2
          GROUP BY "contactId"
        `, [contactIds, companyId])
      ]);
      
      const batchQueryTime = Date.now();
      
      // Create lookup maps for O(1) access
      const purchasesMap = new Map();
      const salesMap = new Map();
      const incomesMap = new Map();
      const expensesMap = new Map();
      
      purchasesData.rows.forEach(row => purchasesMap.set(row.contactId, row));
      salesData.rows.forEach(row => salesMap.set(row.contactId, row));
      incomesData.rows.forEach(row => incomesMap.set(row.contactId, row));
      expensesData.rows.forEach(row => expensesMap.set(row.contactId, row));
      
      // Process each contact with pre-fetched data
      for (let contact of contacts) {
        try {
          // Calculate real-time balance
              const balanceResult = await calculateContactCurrentBalance(client, contact.id, companyId);
              contact.calculatedBalance = {
                amount: balanceResult.balance,
                type: balanceResult.balanceType
              };
              contact.balanceBreakdown = balanceResult.breakdown;
            } catch (balanceError) {
          // Fallback to opening balance if calculation fails
              contact.calculatedBalance = {
            amount: Number(contact.openingBalance || 0),
            type: contact.openingBalanceType || 'payable'
              };
              contact.balanceBreakdown = {
            openingBalance: Number(contact.openingBalance || 0),
            openingBalanceType: contact.openingBalanceType || 'payable',
            totalOutstandingPurchases: 0,
            totalOutstandingSales: 0,
            totalOutstandingExpenses: 0,
            totalOutstandingIncomes: 0,
            totalCurrentBalanceAdjustments: 0
          };
        }
            }
          } else {
      // Use opening balance as fallback when calculated balance is not requested
      contacts.forEach(contact => {
          contact.calculatedBalance = {
          amount: Number(contact.openingBalance || 0),
          type: contact.openingBalanceType || 'payable'
        };
      });
    }

    // UPDATED: Apply balance type filter after calculation
    if (balanceType && ['payable', 'receivable'].includes(balanceType)) {
      contacts = contacts.filter(contact => 
        contact.calculatedBalance?.type === balanceType
      );
    }

    const endTime = Date.now();

    return successResponse(res, {
      contacts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalContacts,
        pages: Math.ceil(totalContacts / limit)
      },
      performance: {
        totalTime: endTime - startTime,
        includeCalculatedBalance: includeCalculatedBalance === 'true'
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
        openingBalance: parseFloat(contact.openingBalance),
        openingBalanceType: contact.openingBalanceType
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

  // Validate GSTIN format if provided
  if (gstin && gstin.trim() !== '') {
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstinRegex.test(gstin)) {
      return errorResponse(res, "Invalid GSTIN format", 400);
    }
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // First verify contact belongs to company and get current values
    const verifyQuery = `
      SELECT "id", "openingBalance", "openingBalanceType"
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

    const newOpeningBalance = Math.abs(parseFloat(openingBalance) || 0);
    const newOpeningBalanceType = openingBalanceType;

    // UPDATED: Removed currentBalance and currentBalanceType from update
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
        "enablePortal" = $22,
        "notes" = $23,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $24
      RETURNING *
    `;

    // Convert empty GSTIN to null
    const gstinValue = gstin && gstin.trim() !== '' ? gstin : null;
    
    const params = [
      gstinValue, name, mobile, email, dueDays, contactType,
      billingAddress1, billingAddress2, billingCity, billingPincode,
      billingState, billingCountry, isShippingSame,
      shippingAddress1, shippingAddress2, shippingCity, shippingPincode,
      shippingState, shippingCountry, newOpeningBalance, newOpeningBalanceType, 
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
        newOpeningBalanceType
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
        "isShippingSame", "openingBalance", "openingBalanceType", 
        "enablePortal", notes,
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
        openingBalance: parseFloat(contact.openingBalance),
        openingBalanceType: contact.openingBalanceType
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



// UPDATED: Removed updateContactCurrentBalance function since we no longer store balance
// export async function updateContactCurrentBalance(req, res) {
//   // This function is no longer needed since we don't store currentBalance in database
//   // Balance is always calculated real-time using calculateContactCurrentBalance
// }

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

    // Get contact details - UPDATED: removed currentBalance and currentBalanceType
    const contactQuery = await client.query(
      `SELECT "id", "name", "openingBalance", "openingBalanceType"
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
        openingBalanceType: contact.openingBalanceType
        // UPDATED: Removed storedBalance and storedBalanceType since we don't store balance anymore
      },
      breakdown,
      calculatedBalance: {
        amount: balance,
        type: balanceType
      },
      // UPDATED: Removed storedBalance object since we don't store balance anymore
      pendingInfo: {
        // Pending amounts by transaction type
        pendingByType: {
          purchases: {
            count: parseInt(pendingInfo.count),
            totalAmount: parseFloat(pendingInfo.total),
            type: 'payable', // We owe them for purchases
            description: 'Amount we owe them for purchases'
          },
          sales: {
            count: parseInt(pendingSalesInfo.count),
            totalAmount: parseFloat(pendingSalesInfo.total),
            type: 'receivable', // They owe us for sales
            description: 'Amount they owe us for sales'
          },
          expenses: {
            count: breakdown.totalOutstandingExpenses > 0 ? 1 : 0,
            totalAmount: breakdown.totalOutstandingExpenses,
            type: 'payable', // We owe them for expenses
            description: 'Amount we owe them for expenses'
          },
          incomes: {
            count: breakdown.totalOutstandingIncomes > 0 ? 1 : 0,
            totalAmount: breakdown.totalOutstandingIncomes,
            type: 'receivable', // They owe us for incomes
            description: 'Amount they owe us for incomes'
          }
        },
        
        // Summary totals
        totalPayable: breakdown.totalOutstandingPurchases + breakdown.totalOutstandingExpenses,
        totalReceivable: breakdown.totalOutstandingSales + breakdown.totalOutstandingIncomes,
        
        // Detailed transaction lists
        pendingPurchases: pendingPurchases,
        pendingSales: pendingSales
      },
      calculation: {
        formula: "Opening Balance + Pending Purchases + Pending Expenses - Pending Sales - Pending Incomes",
        explanation: `Based on opening balance (${breakdown.openingBalanceType} ₹${breakdown.openingBalance}), pending purchases (₹${breakdown.totalOutstandingPurchases}), pending expenses (₹${breakdown.totalOutstandingExpenses}), pending sales (₹${breakdown.totalOutstandingSales}), and pending incomes (₹${breakdown.totalOutstandingIncomes})`
      }
    });

  } catch (error) {
    console.error(error);
    return errorResponse(res, "Error calculating contact current balance", 500);
  } finally {
    client.release();
  }
}

// UPDATED: Removed updateAllContactsCurrentBalance function since we no longer store balance
// export async function updateAllContactsCurrentBalance(req, res) {
//   // This function is no longer needed since we don't store currentBalance in database
//   // Balance is always calculated real-time using calculateContactCurrentBalance
// }

// Get simple pending balance summary for a contact
export async function getContactPendingBalanceSummary(req, res) {
  const { contactId } = req.params;
  const companyId = req.currentUser?.companyId;

  if (!companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    // Get contact basic info - UPDATED: removed currentBalance and currentBalanceType
    const contactQuery = await client.query(
      `SELECT "id", "name", "openingBalance", "openingBalanceType"
       FROM hisab."contacts" 
       WHERE "id" = $1 AND "companyId" = $2`,
      [contactId, companyId]
    );

    if (contactQuery.rows.length === 0) {
      return errorResponse(res, "Contact not found", 404);
    }

    const contact = contactQuery.rows[0];

    // Calculate real-time balance
    const { balance, balanceType } = await calculateContactCurrentBalance(client, contactId, companyId);

    // Get simplified pending summary
    const summaryQuery = await client.query(
      `SELECT 
         (SELECT COALESCE(SUM("remaining_amount"), 0) FROM hisab."purchases" 
          WHERE "contactId" = $1 AND "companyId" = $2 AND "status" = 'pending' AND "deletedAt" IS NULL) as pendingPurchases,
         (SELECT COALESCE(SUM("remaining_amount"), 0) FROM hisab."sales" 
          WHERE "contactId" = $1 AND "companyId" = $2 AND "status" = 'pending' AND "deletedAt" IS NULL) as pendingSales,
         (SELECT COALESCE(SUM("remaining_amount"), 0) FROM hisab."expenses" 
          WHERE "contactId" = $1 AND "companyId" = $2 AND "status" = 'pending') as pendingExpenses,
         (SELECT COALESCE(SUM("remaining_amount"), 0) FROM hisab."incomes" 
          WHERE "contactId" = $1 AND "companyId" = $2 AND "status" = 'pending') as pendingIncomes`,
      [contactId, companyId]
    );

    const summary = summaryQuery.rows[0];

    return successResponse(res, {
      contact: {
        id: contact.id,
        name: contact.name
      },
      currentBalance: {
        amount: balance,
        type: balanceType
      },
      openingBalance: {
        amount: parseFloat(contact.openingBalance || 0),
        type: contact.openingBalanceType
      },
      pending: {
        purchases: parseFloat(summary.pendingPurchases || 0),
        sales: parseFloat(summary.pendingSales || 0),
        expenses: parseFloat(summary.pendingExpenses || 0),
        incomes: parseFloat(summary.pendingIncomes || 0)
      },
      // UPDATED: Removed storedBalance comparison since we don't store balance anymore
      summary: {
        totalPendingPayable: parseFloat(summary.pendingPurchases || 0) + parseFloat(summary.pendingExpenses || 0),
        totalPendingReceivable: parseFloat(summary.pendingSales || 0) + parseFloat(summary.pendingIncomes || 0),
        netPendingAmount: (parseFloat(summary.pendingPurchases || 0) + parseFloat(summary.pendingExpenses || 0)) - 
                          (parseFloat(summary.pendingSales || 0) + parseFloat(summary.pendingIncomes || 0))
      }
    });

  } catch (error) {
    console.error(error);
    return errorResponse(res, "Error fetching contact balance summary", 500);
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
          gstin: contact.gstin && contact.gstin.trim() !== '' ? contact.gstin : null,
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

        // UPDATED: Removed currentBalance and currentBalanceType from insert
        const insertQuery = `
          INSERT INTO hisab."contacts" (
            "companyId", "gstin", "name", "mobile", "email", "dueDays", "contactType",
            "billingAddress1", "billingAddress2", "billingCity", "billingPincode", 
            "billingState", "billingCountry", "isShippingSame",
            "shippingAddress1", "shippingAddress2", "shippingCity", "shippingPincode",
            "shippingState", "shippingCountry", "openingBalance", "openingBalanceType",
            "enablePortal", "notes", "createdBy"
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
          contactData.enablePortal, contactData.notes, currentUserId
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

      // Portal access email sent successfully

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

