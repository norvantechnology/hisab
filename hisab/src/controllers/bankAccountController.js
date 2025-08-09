import pool from "../config/dbConnection.js";
import { errorResponse, successResponse } from "../utils/index.js";
import { generateBankStatementPDF } from '../utils/bankStatementPDFGenerator.js';

export async function createBankAccount(req, res) {
  const { accountType, accountName, openingBalance, isActive = true } = req.body;
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access - user or company not identified", 401);
  }

  if (!accountType || !accountName) {
    return errorResponse(res, "Account type and account name are required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const companyCheck = await client.query(
      `SELECT id FROM hisab."companies" WHERE id = $1 AND "userId" = $2`,
      [companyId, userId]
    );

    if (companyCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Company not found or unauthorized", 404);
    }

    const insertQuery = `
      INSERT INTO hisab."bankAccounts" (
        "userId", "companyId", "accountType", "accountName", 
        "currentBalance", "openingBalance", "isActive",
        "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const result = await client.query(insertQuery, [
      userId,
      companyId,
      accountType,
      accountName,
      openingBalance || 0,
      openingBalance || 0,
      isActive
    ]);

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Bank account created successfully",
      account: result.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error creating bank account", 500);
  } finally {
    client.release();
  }
}


export async function getBankAccounts(req, res) {
  const { includeInactive } = req.query;
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access - user or company not identified", 401);
  }

  const client = await pool.connect();

  try {
    let query = `
      SELECT * FROM hisab."bankAccounts" 
      WHERE "companyId" = $1 AND "deletedAt" IS NULL
    `;
    const params = [companyId];

    if (includeInactive !== 'true') {
      query += ` AND "isActive" = true`;
    }

    query += ` ORDER BY "createdAt" ASC`;

    const result = await client.query(query, params);

    return successResponse(res, {
      accounts: result.rows
    });

  } catch (error) {
    console.error(error);
    return errorResponse(res, "Error fetching bank accounts", 500);
  } finally {
    client.release();
  }
}

export async function updateBankAccount(req, res) {
  const { accountType, accountName, currentBalance, id, isActive } = req.body;
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access - user or company not identified", 401);
  }

  if (!id) {
    return errorResponse(res, "Account ID is required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const accountCheck = await client.query(
      `SELECT id FROM hisab."bankAccounts" 
       WHERE id = $1 AND "companyId" = $2 AND "deletedAt" IS NULL`,
      [id, companyId]
    );

    if (accountCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Account not found or unauthorized", 404);
    }

    const updateQuery = `
      UPDATE hisab."bankAccounts"
      SET 
        "accountType" = COALESCE($3, "accountType"),
        "accountName" = COALESCE($4, "accountName"),
        "currentBalance" = COALESCE($5, "currentBalance"),
        "isActive" = COALESCE($6, "isActive"),
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1 AND "companyId" = $2
      RETURNING *
    `;

    const result = await client.query(updateQuery, [
      id,
      companyId,
      accountType,
      accountName,
      currentBalance,
      isActive
    ]);

    await client.query("COMMIT");
    if (result.rows.length === 0) {
      return errorResponse(res, "Failed to update bank account", 500);
    }

    return successResponse(res, {
      message: "Bank account updated successfully",
      account: result.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error updating bank account", 500);
  } finally {
    client.release();
  }
}


export async function deleteBankAccount(req, res) {
  const { id } = req.query;
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access - user or company not identified", 401);
  }

  if (!id) {
    return errorResponse(res, "Account ID is required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verify account belongs to user and company, and isn't already deleted
    const accountCheck = await client.query(
      `SELECT id FROM hisab."bankAccounts" 
       WHERE id = $1 AND "companyId" = $2 AND "deletedAt" IS NULL`,
      [id, companyId]
    );

    if (accountCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Account not found or unauthorized", 404);
    }

    const deleteQuery = `
      UPDATE hisab."bankAccounts"
      SET 
        "deletedAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await client.query(deleteQuery, [id]);

    await client.query("COMMIT");

    if (result.rows.length === 0) {
      return errorResponse(res, "Failed to delete bank account", 500);
    }

    return successResponse(res, {
      message: "Bank account deleted successfully",
      account: result.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error deleting bank account", 500);
  } finally {
    client.release();
  }
}

export async function deactivateBankAccount(req, res) {
  const { id } = req.query;
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access - user or company not identified", 401);
  }

  if (!id) {
    return errorResponse(res, "Account ID is required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verify account belongs to user and company, and isn't deleted
    const accountCheck = await client.query(
      `SELECT id FROM hisab."bankAccounts" 
       WHERE id = $1 AND "companyId" = $2 AND "deletedAt" IS NULL`,
      [id,  companyId]
    );

    if (accountCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Account not found or unauthorized", 404);
    }

    const updateQuery = `
      UPDATE hisab."bankAccounts"
      SET 
        "isActive" = false,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await client.query(updateQuery, [id]);

    await client.query("COMMIT");

    if (result.rows.length === 0) {
      return errorResponse(res, "Failed to deactivate bank account", 500);
    }

    return successResponse(res, {
      message: "Bank account deactivated successfully",
      account: result.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error deactivating bank account", 500);
  } finally {
    client.release();
  }
}

export async function activateBankAccount(req, res) {
  const { id } = req.query;
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access - user or company not identified", 401);
  }

  if (!id) {
    return errorResponse(res, "Account ID is required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verify account belongs to user and company, and isn't deleted
    const accountCheck = await client.query(
      `SELECT id FROM hisab."bankAccounts" 
       WHERE id = $1 AND "companyId" = $2 AND "deletedAt" IS NULL`,
      [id, companyId]
    );

    if (accountCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Account not found or unauthorized", 404);
    }

    const updateQuery = `
      UPDATE hisab."bankAccounts"
      SET 
        "isActive" = true,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await client.query(updateQuery, [id]);

    await client.query("COMMIT");

    if (result.rows.length === 0) {
      return errorResponse(res, "Failed to activate bank account", 500);
    }

    return successResponse(res, {
      message: "Bank account activated successfully",
      account: result.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error activating bank account", 500);
  } finally {
    client.release();
  }
}

// Get bank statement with all transactions
export async function getBankStatement(req, res) {
  const { bankAccountId } = req.params;
  const { 
    startDate, 
    endDate, 
    page = 1, 
    limit = 50,
    transactionType = 'all' // all, transfers, expenses, incomes, sales, purchases, payments
  } = req.query;
  
  const companyId = req.currentUser?.companyId;

  if (!companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    // Verify bank account exists and belongs to company
    const bankQuery = await client.query(
      `SELECT id, "accountName", "accountType", "currentBalance", "openingBalance"
       FROM hisab."bankAccounts" 
       WHERE id = $1 AND "companyId" = $2 AND "deletedAt" IS NULL`,
      [bankAccountId, companyId]
    );

    if (bankQuery.rows.length === 0) {
      return errorResponse(res, "Bank account not found", 404);
    }

    const bankAccount = bankQuery.rows[0];
    const offset = (page - 1) * limit;

    // Build date filter
    let dateFilter = "";
    let dateParams = [];
    if (startDate && endDate) {
      dateFilter = "AND date BETWEEN $1 AND $2";
      dateParams = [startDate, endDate];
    } else if (startDate) {
      dateFilter = "AND date >= $1";
      dateParams = [startDate];
    } else if (endDate) {
      dateFilter = "AND date <= $1";
      dateParams = [endDate];
    }

    // Get bank transfers affecting this bank account
    let transfersQuery = "";
    if (transactionType === 'all' || transactionType === 'transfers') {
      const transferDateFilter = dateFilter.replace(/date/g, 'bt.date');
      transfersQuery = `
        SELECT 
          'transfer' as transaction_type,
          bt.id::text as id,
          bt."transferNumber" as reference,
          bt.date,
          bt.description,
          CASE 
            WHEN bt."fromBankId" = $${dateParams.length + 1} THEN -bt.amount
            WHEN bt."toBankId" = $${dateParams.length + 1} THEN bt.amount
            ELSE 0
          END as amount,
          CASE 
            WHEN bt."fromBankId" = $${dateParams.length + 1} THEN 'outgoing'
            WHEN bt."toBankId" = $${dateParams.length + 1} THEN 'incoming'
          END as type,
          CASE 
            WHEN bt."fromBankId" = $${dateParams.length + 1} THEN ba2."accountName"
            WHEN bt."toBankId" = $${dateParams.length + 1} THEN ba1."accountName"
          END as contact_name,
          'Bank Transfer' as category,
          bt."createdAt",
          CASE 
            WHEN bt."fromBankId" = $${dateParams.length + 1} THEN CONCAT('To: ', ba2."accountName")
            WHEN bt."toBankId" = $${dateParams.length + 1} THEN CONCAT('From: ', ba1."accountName")
          END as bank_contact,
          NULL::text as original_transaction_id,
          NULL::text as original_transaction_type
        FROM hisab."bankTransfers" bt
        LEFT JOIN hisab."bankAccounts" ba1 ON bt."fromBankId" = ba1.id
        LEFT JOIN hisab."bankAccounts" ba2 ON bt."toBankId" = ba2.id
        WHERE (bt."fromBankId" = $${dateParams.length + 1} OR bt."toBankId" = $${dateParams.length + 1})
        AND bt."companyId" = $${dateParams.length + 2}
        AND bt."deletedAt" IS NULL
        ${transferDateFilter}
      `;
    }

    // Get payments affecting this bank account
    let paymentsQuery = "";
    if (transactionType === 'all' || transactionType === 'payments') {
      const paymentDateFilter = dateFilter.replace(/date/g, 'p.date');
      paymentsQuery = `
        SELECT 
          'payment' as transaction_type,
          p.id::text as id,
          p."paymentNumber" as reference,
          p.date,
          COALESCE(p.description, CONCAT(p."paymentType", ' Payment')) as description,
          CASE 
            WHEN p."paymentType" = 'payment' THEN -p.amount
            WHEN p."paymentType" = 'receipt' THEN p.amount
            ELSE -p.amount
          END as amount,
          p."paymentType" as type,
          c.name as contact_name,
          CONCAT('Payment - ', p."paymentType") as category,
          p."createdAt",
          CONCAT(c.name, ' (', p."paymentType", ')') as bank_contact,
          NULL::text as original_transaction_id,
          NULL::text as original_transaction_type
        FROM hisab."payments" p
        LEFT JOIN hisab."contacts" c ON p."contactId" = c.id
        WHERE p."bankId" = $${dateParams.length + 1}
        AND p."companyId" = $${dateParams.length + 2}
        AND p."deletedAt" IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM hisab."payment_allocations" pa 
          WHERE pa."paymentId" = p.id
        )
        ${paymentDateFilter}
      `;
    }

    // Get payment allocations with transaction details
    let paymentAllocationsQuery = "";
    if (transactionType === 'all' || transactionType === 'payments') {
      const allocationDateFilter = dateFilter.replace(/date/g, 'p.date');
      paymentAllocationsQuery = `
        SELECT 
          'payment_allocation' as transaction_type,
          CONCAT(p.id, '-', pa.id)::text as id,
          CONCAT(p."paymentNumber", '-', pa."allocationType") as reference,
          p.date,
          CONCAT(
            CASE 
              WHEN pa."allocationType" = 'purchase' THEN 'Purchase Payment'
              WHEN pa."allocationType" = 'sale' THEN 'Sale Receipt'
              WHEN pa."allocationType" = 'expense' THEN 'Expense Payment'
              WHEN pa."allocationType" = 'income' THEN 'Income Receipt'
              WHEN pa."allocationType" = 'current-balance' THEN 'Balance Payment'
              ELSE 'Payment'
            END,
            ' (', p."paymentNumber", ')',
            CASE 
              WHEN c.name IS NOT NULL THEN CONCAT(' - ', c.name)
              ELSE ''
            END
          ) as description,
          CASE 
            WHEN pa."allocationType" IN ('sale', 'income') THEN 
              -- Sales and Income payments are always INFLOWS (money coming in)
              pa."paidAmount"
            WHEN pa."allocationType" IN ('purchase', 'expense') THEN 
              -- Purchase and Expense payments are always OUTFLOWS (money going out)
              -pa."paidAmount"
            WHEN pa."allocationType" = 'current-balance' THEN 
              -- For current-balance, direction depends on balance type
              CASE 
                WHEN pa."balanceType" = 'receivable' THEN 
                  -- They owe us, so we're receiving money back (INFLOW)
                  pa."paidAmount"
                WHEN pa."balanceType" = 'payable' THEN 
                  -- We owe them, so we're paying money back (OUTFLOW)
                  -pa."paidAmount"
                ELSE -pa."paidAmount"
              END
            ELSE 
              -- Default case: use payment type
              CASE 
                WHEN p."paymentType" = 'payment' THEN -pa."paidAmount"
                WHEN p."paymentType" = 'receipt' THEN pa."paidAmount"
                ELSE -pa."paidAmount"
              END
          END as amount,
          p."paymentType" as type,
          c.name as contact_name,
          CONCAT(
            CASE 
              WHEN pa."allocationType" = 'purchase' THEN 'Purchase'
              WHEN pa."allocationType" = 'sale' THEN 'Sale'
              WHEN pa."allocationType" = 'expense' THEN 'Expense'
              WHEN pa."allocationType" = 'income' THEN 'Income'
              WHEN pa."allocationType" = 'current-balance' THEN 'Balance'
              ELSE 'Payment'
            END,
            ' Payment'
          ) as category,
          p."createdAt",
          CONCAT(c.name, ' (', pa."allocationType", ')') as bank_contact,
          COALESCE(pa."purchaseId", pa."saleId", pa."expenseId", pa."incomeId")::text as original_transaction_id,
          pa."allocationType" as original_transaction_type
        FROM hisab."payment_allocations" pa
        JOIN hisab."payments" p ON pa."paymentId" = p.id
        LEFT JOIN hisab."contacts" c ON p."contactId" = c.id
        WHERE p."bankId" = $${dateParams.length + 1}
        AND p."companyId" = $${dateParams.length + 2}
        AND p."deletedAt" IS NULL
        AND pa."paidAmount" > 0
        ${allocationDateFilter}
      `;
    }

    // Get expenses affecting this bank account
    let expensesQuery = "";
    if (transactionType === 'all' || transactionType === 'expenses') {
      const expenseDateFilter = dateFilter.replace(/date/g, 'e.date');
      expensesQuery = `
        SELECT 
          'expense' as transaction_type,
          e.id::text as id,
          CONCAT('EXP-', e.id) as reference,
          e.date,
          COALESCE(e.notes, 'Expense') as description,
          -e.amount as amount,
          'expense' as type,
          c.name as contact_name,
          'Expense' as category,
          e."createdAt",
          CASE 
            WHEN c.name IS NOT NULL THEN c.name
            WHEN e."bankAccountId" IS NOT NULL THEN CONCAT(ba."accountName", ' (Bank)')
            ELSE 'Direct Expense'
          END as bank_contact,
          e.id::text as original_transaction_id,
          'expense' as original_transaction_type
        FROM hisab."expenses" e
        LEFT JOIN hisab."contacts" c ON e."contactId" = c.id
        LEFT JOIN hisab."bankAccounts" ba ON e."bankAccountId" = ba.id
        WHERE e."bankAccountId" = $${dateParams.length + 1}
        AND e."companyId" = $${dateParams.length + 2}
        AND e."status" = 'paid'
        AND NOT EXISTS (
          SELECT 1 FROM hisab."payment_allocations" pa 
          WHERE pa."expenseId" = e.id
        )
        ${expenseDateFilter}
      `;
    }

    // Get incomes affecting this bank account
    let incomesQuery = "";
    if (transactionType === 'all' || transactionType === 'incomes') {
      const incomeDateFilter = dateFilter.replace(/date/g, 'i.date');
      incomesQuery = `
        SELECT 
          'income' as transaction_type,
          i.id::text as id,
          CONCAT('INC-', i.id) as reference,
          i.date,
          COALESCE(i.notes, 'Income') as description,
          i.amount as amount,
          'income' as type,
          c.name as contact_name,
          'Income' as category,
          i."createdAt",
          CASE 
            WHEN c.name IS NOT NULL THEN c.name
            WHEN i."bankAccountId" IS NOT NULL THEN CONCAT(ba."accountName", ' (Bank)')
            ELSE 'Direct Income'
          END as bank_contact,
          i.id::text as original_transaction_id,
          'income' as original_transaction_type
        FROM hisab."incomes" i
        LEFT JOIN hisab."contacts" c ON i."contactId" = c.id
        LEFT JOIN hisab."bankAccounts" ba ON i."bankAccountId" = ba.id
        WHERE i."bankAccountId" = $${dateParams.length + 1}
        AND i."companyId" = $${dateParams.length + 2}
        AND i."status" = 'paid'
        AND NOT EXISTS (
          SELECT 1 FROM hisab."payment_allocations" pa 
          WHERE pa."incomeId" = i.id
        )
        ${incomeDateFilter}
      `;
    }

    // Get sales affecting this bank account (only when paid directly through bank)
    let salesQuery = "";
    if (transactionType === 'all' || transactionType === 'sales') {
      const saleDateFilter = dateFilter.replace(/date/g, 's."invoiceDate"');
      salesQuery = `
        SELECT 
          'sale' as transaction_type,
          s.id::text as id,
          s."invoiceNumber" as reference,
          s."invoiceDate" as date,
          COALESCE(s."internalNotes", 'Sales Invoice') as description,
          s."netReceivable" as amount,
          'sale' as type,
          c.name as contact_name,
          'Sale' as category,
          s."createdAt",
          CASE 
            WHEN c.name IS NOT NULL THEN CONCAT(c.name, ' (Customer)')
            WHEN s."bankAccountId" IS NOT NULL THEN CONCAT(ba."accountName", ' (Bank)')
            ELSE 'Direct Sale'
          END as bank_contact,
          s.id::text as original_transaction_id,
          'sale' as original_transaction_type
        FROM hisab."sales" s
        LEFT JOIN hisab."contacts" c ON s."contactId" = c.id
        LEFT JOIN hisab."bankAccounts" ba ON s."bankAccountId" = ba.id
        WHERE s."bankAccountId" = $${dateParams.length + 1}
        AND s."companyId" = $${dateParams.length + 2}
        AND s."deletedAt" IS NULL
        AND s."status" = 'paid'
        AND NOT EXISTS (
          SELECT 1 FROM hisab."payment_allocations" pa 
          WHERE pa."saleId" = s.id
        )
        ${saleDateFilter}
      `;
    }

    // Get purchases affecting this bank account (only when paid directly through bank)
    let purchasesQuery = "";
    if (transactionType === 'all' || transactionType === 'purchases') {
      const purchaseDateFilter = dateFilter.replace(/date/g, 'p."invoiceDate"');
      purchasesQuery = `
        SELECT 
          'purchase' as transaction_type,
          p.id::text as id,
          p."invoiceNumber" as reference,
          p."invoiceDate" as date,
          COALESCE(p."internalNotes", 'Purchase Invoice') as description,
          -p."netPayable" as amount,
          'purchase' as type,
          c.name as contact_name,
          'Purchase' as category,
          p."createdAt",
          CASE 
            WHEN c.name IS NOT NULL THEN CONCAT(c.name, ' (Supplier)')
            WHEN p."bankAccountId" IS NOT NULL THEN CONCAT(ba."accountName", ' (Bank)')
            ELSE 'Direct Purchase'
          END as bank_contact,
          p.id::text as original_transaction_id,
          'purchase' as original_transaction_type
        FROM hisab."purchases" p
        LEFT JOIN hisab."contacts" c ON p."contactId" = c.id
        LEFT JOIN hisab."bankAccounts" ba ON p."bankAccountId" = ba.id
        WHERE p."bankAccountId" = $${dateParams.length + 1}
        AND p."companyId" = $${dateParams.length + 2}
        AND p."deletedAt" IS NULL
        AND p."status" = 'paid'
        AND NOT EXISTS (
          SELECT 1 FROM hisab."payment_allocations" pa 
          WHERE pa."purchaseId" = p.id
        )
        ${purchaseDateFilter}
      `;
    }

    // Combine all queries
    const allQueries = [transfersQuery, paymentsQuery, paymentAllocationsQuery, expensesQuery, incomesQuery, salesQuery, purchasesQuery]
      .filter(query => query !== "")
      .join(" UNION ALL ");

    if (!allQueries) {
      return successResponse(res, {
        bankAccount,
        transactions: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          totalPages: 0
        }
      });
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM (${allQueries}) as combined_transactions`;
    const countParams = [...dateParams, bankAccountId, companyId];
    const countResult = await client.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const finalQuery = `
      ${allQueries}
      ORDER BY date ASC, "createdAt" ASC
      LIMIT $${countParams.length + 1} OFFSET $${countParams.length + 2}
    `;
    const finalParams = [...countParams, limit, offset];
    const result = await client.query(finalQuery, finalParams);

    // Calculate running balance
    const transactions = result.rows.map((transaction, index) => {
      const amount = parseFloat(transaction.amount || 0);
      return {
        ...transaction,
        amount: amount,
        runningBalance: 0 // Will be calculated below
      };
    });

    // Calculate running balance starting from opening balance
    // Show balance AFTER each transaction (more intuitive)
    let runningBalance = parseFloat(bankAccount.openingBalance || 0);
    
    // Since transactions are now ordered by date ASC (oldest first), 
    // we can calculate running balance directly
    transactions.forEach((transaction, index) => {
      runningBalance += transaction.amount; // Add transaction amount
      transaction.runningBalance = Math.round(runningBalance * 100) / 100; // Round to 2 decimal places
    });

    // Calculate summary statistics
    const totalInflows = transactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalOutflows = transactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return successResponse(res, {
      bankAccount,
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      },
      summary: {
        openingBalance: parseFloat(bankAccount.openingBalance || 0),
        totalInflows: Math.round(totalInflows * 100) / 100,
        totalOutflows: Math.round(totalOutflows * 100) / 100,
        currentBalance: Math.round(runningBalance * 100) / 100
      }
    });

  } catch (error) {
    console.error("Error getting bank statement:", error);
    return errorResponse(res, "Error retrieving bank statement", 500);
  } finally {
    client.release();
  }
}

export async function exportBankStatementPDF(req, res) {
  const { bankAccountId } = req.params;
  const { 
    startDate, 
    endDate, 
    transactionType = 'all'
  } = req.query;
  
  const companyId = req.currentUser?.companyId;

  if (!companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    // Verify bank account exists and belongs to company
    const bankQuery = await client.query(
      `SELECT ba.id, ba."accountName", ba."accountType", ba."currentBalance", ba."openingBalance",
              c.name as "companyName", c."logoUrl" as "companyLogo"
       FROM hisab."bankAccounts" ba
       LEFT JOIN hisab."companies" c ON ba."companyId" = c.id
       WHERE ba.id = $1 AND ba."companyId" = $2 AND ba."deletedAt" IS NULL`,
      [bankAccountId, companyId]
    );

    if (bankQuery.rows.length === 0) {
      return errorResponse(res, "Bank account not found", 404);
    }

    const bankAccount = bankQuery.rows[0];

    // Build date filter
    let dateFilter = "";
    let dateParams = [];
    if (startDate && endDate) {
      dateFilter = "AND date BETWEEN $1 AND $2";
      dateParams = [startDate, endDate];
    } else if (startDate) {
      dateFilter = "AND date >= $1";
      dateParams = [startDate];
    } else if (endDate) {
      dateFilter = "AND date <= $1";
      dateParams = [endDate];
    }

    // Get bank transfers affecting this bank account
    let transfersQuery = "";
    if (transactionType === 'all' || transactionType === 'transfers') {
      const transferDateFilter = dateFilter.replace(/date/g, 'bt.date');
      transfersQuery = `
        SELECT 
          'transfer' as transaction_type,
          bt.id::text as id,
          bt."transferNumber" as reference,
          bt.date,
          bt.description,
          CASE 
            WHEN bt."fromBankId" = $${dateParams.length + 1} THEN -bt.amount
            WHEN bt."toBankId" = $${dateParams.length + 1} THEN bt.amount
            ELSE 0
          END as amount,
          CASE 
            WHEN bt."fromBankId" = $${dateParams.length + 1} THEN 'outgoing'
            WHEN bt."toBankId" = $${dateParams.length + 1} THEN 'incoming'
          END as type,
          CASE 
            WHEN bt."fromBankId" = $${dateParams.length + 1} THEN ba2."accountName"
            WHEN bt."toBankId" = $${dateParams.length + 1} THEN ba1."accountName"
          END as contact_name,
          'Bank Transfer' as category,
          bt."createdAt",
          CASE 
            WHEN bt."fromBankId" = $${dateParams.length + 1} THEN CONCAT('To: ', ba2."accountName")
            WHEN bt."toBankId" = $${dateParams.length + 1} THEN CONCAT('From: ', ba1."accountName")
          END as bank_contact,
          NULL::text as original_transaction_id,
          NULL::text as original_transaction_type
        FROM hisab."bankTransfers" bt
        LEFT JOIN hisab."bankAccounts" ba1 ON bt."fromBankId" = ba1.id
        LEFT JOIN hisab."bankAccounts" ba2 ON bt."toBankId" = ba2.id
        WHERE (bt."fromBankId" = $${dateParams.length + 1} OR bt."toBankId" = $${dateParams.length + 1})
        AND bt."companyId" = $${dateParams.length + 2}
        AND bt."deletedAt" IS NULL
        ${transferDateFilter}
      `;
    }

    // Get payments affecting this bank account
    let paymentsQuery = "";
    if (transactionType === 'all' || transactionType === 'payments') {
      const paymentDateFilter = dateFilter.replace(/date/g, 'p.date');
      paymentsQuery = `
        SELECT 
          'payment' as transaction_type,
          p.id::text as id,
          p."paymentNumber" as reference,
          p.date,
          COALESCE(p.description, CONCAT(p."paymentType", ' Payment')) as description,
          CASE 
            WHEN p."paymentType" = 'payment' THEN -p.amount
            WHEN p."paymentType" = 'receipt' THEN p.amount
            ELSE -p.amount
          END as amount,
          p."paymentType" as type,
          c.name as contact_name,
          CONCAT('Payment - ', p."paymentType") as category,
          p."createdAt",
          CONCAT(c.name, ' (', p."paymentType", ')') as bank_contact,
          NULL::text as original_transaction_id,
          NULL::text as original_transaction_type
        FROM hisab."payments" p
        LEFT JOIN hisab."contacts" c ON p."contactId" = c.id
        WHERE p."bankId" = $${dateParams.length + 1}
        AND p."companyId" = $${dateParams.length + 2}
        AND p."deletedAt" IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM hisab."payment_allocations" pa 
          WHERE pa."paymentId" = p.id
        )
        ${paymentDateFilter}
      `;
    }

    // Get payment allocations with transaction details
    let paymentAllocationsQuery = "";
    if (transactionType === 'all' || transactionType === 'payments') {
      const allocationDateFilter = dateFilter.replace(/date/g, 'p.date');
      paymentAllocationsQuery = `
        SELECT 
          'payment_allocation' as transaction_type,
          CONCAT(p.id, '-', pa.id)::text as id,
          CONCAT(p."paymentNumber", '-', pa."allocationType") as reference,
          p.date,
          CONCAT(
            CASE 
              WHEN pa."allocationType" = 'purchase' THEN 'Purchase Payment'
              WHEN pa."allocationType" = 'sale' THEN 'Sale Receipt'
              WHEN pa."allocationType" = 'expense' THEN 'Expense Payment'
              WHEN pa."allocationType" = 'income' THEN 'Income Receipt'
              WHEN pa."allocationType" = 'current-balance' THEN 'Balance Payment'
              ELSE 'Payment'
            END,
            ' (', p."paymentNumber", ')',
            CASE 
              WHEN c.name IS NOT NULL THEN CONCAT(' - ', c.name)
              ELSE ''
            END
          ) as description,
          CASE 
            WHEN pa."allocationType" IN ('sale', 'income') THEN 
              -- Sales and Income payments are always INFLOWS (money coming in)
              pa."paidAmount"
            WHEN pa."allocationType" IN ('purchase', 'expense') THEN 
              -- Purchase and Expense payments are always OUTFLOWS (money going out)
              -pa."paidAmount"
            WHEN pa."allocationType" = 'current-balance' THEN 
              -- For current-balance, direction depends on balance type
              CASE 
                WHEN pa."balanceType" = 'receivable' THEN 
                  -- They owe us, so we're receiving money back (INFLOW)
                  pa."paidAmount"
                WHEN pa."balanceType" = 'payable' THEN 
                  -- We owe them, so we're paying money back (OUTFLOW)
                  -pa."paidAmount"
                ELSE -pa."paidAmount"
              END
            ELSE 
              -- Default case: use payment type
              CASE 
                WHEN p."paymentType" = 'payment' THEN -pa."paidAmount"
                WHEN p."paymentType" = 'receipt' THEN pa."paidAmount"
                ELSE -pa."paidAmount"
              END
          END as amount,
          p."paymentType" as type,
          c.name as contact_name,
          CONCAT(
            CASE 
              WHEN pa."allocationType" = 'purchase' THEN 'Purchase'
              WHEN pa."allocationType" = 'sale' THEN 'Sale'
              WHEN pa."allocationType" = 'expense' THEN 'Expense'
              WHEN pa."allocationType" = 'income' THEN 'Income'
              WHEN pa."allocationType" = 'current-balance' THEN 'Balance'
              ELSE 'Payment'
            END,
            ' Payment'
          ) as category,
          p."createdAt",
          CONCAT(c.name, ' (', pa."allocationType", ')') as bank_contact,
          COALESCE(pa."purchaseId", pa."saleId", pa."expenseId", pa."incomeId")::text as original_transaction_id,
          pa."allocationType" as original_transaction_type
        FROM hisab."payment_allocations" pa
        JOIN hisab."payments" p ON pa."paymentId" = p.id
        LEFT JOIN hisab."contacts" c ON p."contactId" = c.id
        WHERE p."bankId" = $${dateParams.length + 1}
        AND p."companyId" = $${dateParams.length + 2}
        AND p."deletedAt" IS NULL
        AND pa."paidAmount" > 0
        ${allocationDateFilter}
      `;
    }

    // Get expenses affecting this bank account
    let expensesQuery = "";
    if (transactionType === 'all' || transactionType === 'expenses') {
      const expenseDateFilter = dateFilter.replace(/date/g, 'e.date');
      expensesQuery = `
        SELECT 
          'expense' as transaction_type,
          e.id::text as id,
          CONCAT('EXP-', e.id) as reference,
          e.date,
          COALESCE(e.notes, 'Expense') as description,
          -e.amount as amount,
          'expense' as type,
          c.name as contact_name,
          'Expense' as category,
          e."createdAt",
          CASE 
            WHEN c.name IS NOT NULL THEN c.name
            WHEN e."bankAccountId" IS NOT NULL THEN CONCAT(ba."accountName", ' (Bank)')
            ELSE 'Direct Expense'
          END as bank_contact,
          e.id::text as original_transaction_id,
          'expense' as original_transaction_type
        FROM hisab."expenses" e
        LEFT JOIN hisab."contacts" c ON e."contactId" = c.id
        LEFT JOIN hisab."bankAccounts" ba ON e."bankAccountId" = ba.id
        WHERE e."bankAccountId" = $${dateParams.length + 1}
        AND e."companyId" = $${dateParams.length + 2}
        AND e."status" = 'paid'
        AND NOT EXISTS (
          SELECT 1 FROM hisab."payment_allocations" pa 
          WHERE pa."expenseId" = e.id
        )
        ${expenseDateFilter}
      `;
    }

    // Get incomes affecting this bank account
    let incomesQuery = "";
    if (transactionType === 'all' || transactionType === 'incomes') {
      const incomeDateFilter = dateFilter.replace(/date/g, 'i.date');
      incomesQuery = `
        SELECT 
          'income' as transaction_type,
          i.id::text as id,
          CONCAT('INC-', i.id) as reference,
          i.date,
          COALESCE(i.notes, 'Income') as description,
          i.amount as amount,
          'income' as type,
          c.name as contact_name,
          'Income' as category,
          i."createdAt",
          CASE 
            WHEN c.name IS NOT NULL THEN c.name
            WHEN i."bankAccountId" IS NOT NULL THEN CONCAT(ba."accountName", ' (Bank)')
            ELSE 'Direct Income'
          END as bank_contact,
          i.id::text as original_transaction_id,
          'income' as original_transaction_type
        FROM hisab."incomes" i
        LEFT JOIN hisab."contacts" c ON i."contactId" = c.id
        LEFT JOIN hisab."bankAccounts" ba ON i."bankAccountId" = ba.id
        WHERE i."bankAccountId" = $${dateParams.length + 1}
        AND i."companyId" = $${dateParams.length + 2}
        AND i."status" = 'paid'
        AND NOT EXISTS (
          SELECT 1 FROM hisab."payment_allocations" pa 
          WHERE pa."incomeId" = i.id
        )
        ${incomeDateFilter}
      `;
    }

    // Get sales affecting this bank account (only when paid directly through bank)
    let salesQuery = "";
    if (transactionType === 'all' || transactionType === 'sales') {
      const saleDateFilter = dateFilter.replace(/date/g, 's."invoiceDate"');
      salesQuery = `
        SELECT 
          'sale' as transaction_type,
          s.id::text as id,
          s."invoiceNumber" as reference,
          s."invoiceDate" as date,
          COALESCE(s."internalNotes", 'Sales Invoice') as description,
          s."netReceivable" as amount,
          'sale' as type,
          c.name as contact_name,
          'Sale' as category,
          s."createdAt",
          CASE 
            WHEN c.name IS NOT NULL THEN CONCAT(c.name, ' (Customer)')
            WHEN s."bankAccountId" IS NOT NULL THEN CONCAT(ba."accountName", ' (Bank)')
            ELSE 'Direct Sale'
          END as bank_contact,
          s.id::text as original_transaction_id,
          'sale' as original_transaction_type
        FROM hisab."sales" s
        LEFT JOIN hisab."contacts" c ON s."contactId" = c.id
        LEFT JOIN hisab."bankAccounts" ba ON s."bankAccountId" = ba.id
        WHERE s."bankAccountId" = $${dateParams.length + 1}
        AND s."companyId" = $${dateParams.length + 2}
        AND s."deletedAt" IS NULL
        AND s."status" = 'paid'
        AND NOT EXISTS (
          SELECT 1 FROM hisab."payment_allocations" pa 
          WHERE pa."saleId" = s.id
        )
        ${saleDateFilter}
      `;
    }

    // Get purchases affecting this bank account (only when paid directly through bank)
    let purchasesQuery = "";
    if (transactionType === 'all' || transactionType === 'purchases') {
      const purchaseDateFilter = dateFilter.replace(/date/g, 'p."invoiceDate"');
      purchasesQuery = `
        SELECT 
          'purchase' as transaction_type,
          p.id::text as id,
          p."invoiceNumber" as reference,
          p."invoiceDate" as date,
          COALESCE(p."internalNotes", 'Purchase Invoice') as description,
          -p."netPayable" as amount,
          'purchase' as type,
          c.name as contact_name,
          'Purchase' as category,
          p."createdAt",
          CASE 
            WHEN c.name IS NOT NULL THEN CONCAT(c.name, ' (Supplier)')
            WHEN p."bankAccountId" IS NOT NULL THEN CONCAT(ba."accountName", ' (Bank)')
            ELSE 'Direct Purchase'
          END as bank_contact,
          p.id::text as original_transaction_id,
          'purchase' as original_transaction_type
        FROM hisab."purchases" p
        LEFT JOIN hisab."contacts" c ON p."contactId" = c.id
        LEFT JOIN hisab."bankAccounts" ba ON p."bankAccountId" = ba.id
        WHERE p."bankAccountId" = $${dateParams.length + 1}
        AND p."companyId" = $${dateParams.length + 2}
        AND p."deletedAt" IS NULL
        AND p."status" = 'paid'
        AND NOT EXISTS (
          SELECT 1 FROM hisab."payment_allocations" pa 
          WHERE pa."purchaseId" = p.id
        )
        ${purchaseDateFilter}
      `;
    }

    // Combine all queries
    const allQueries = [transfersQuery, paymentsQuery, paymentAllocationsQuery, expensesQuery, incomesQuery, salesQuery, purchasesQuery]
      .filter(query => query !== "")
      .join(" UNION ALL ");

    if (!allQueries) {
      return errorResponse(res, "No transactions found", 404);
    }

    // Get all transactions for PDF (no pagination)
    const finalQuery = `
      ${allQueries}
      ORDER BY date ASC, "createdAt" ASC
    `;
    const finalParams = [...dateParams, bankAccountId, companyId];
    const result = await client.query(finalQuery, finalParams);

    // Calculate running balance
    const transactions = result.rows.map((transaction, index) => {
      const amount = parseFloat(transaction.amount || 0);
      return {
        ...transaction,
        amount: amount,
        runningBalance: 0
      };
    });

    // Calculate running balance starting from opening balance
    let runningBalance = parseFloat(bankAccount.openingBalance);
    transactions.forEach(transaction => {
      runningBalance += transaction.amount;
      transaction.runningBalance = runningBalance;
    });

    // Generate PDF
    const pdfBuffer = await generateBankStatementPDF(bankAccount, transactions, {
      startDate,
      endDate,
      transactionType
    });

    // Set response headers for PDF download
    const fileName = `bank_statement_${bankAccount.accountName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);

  } catch (error) {
    console.error("Error exporting bank statement PDF:", error);
    return errorResponse(res, "Error generating PDF", 500);
  } finally {
    client.release();
  }
}

// Get comprehensive transaction tracking for bank account
export async function getBankTransactionTracking(req, res) {
  const { bankAccountId } = req.params;
  const { 
    startDate, 
    endDate, 
    page = 1, 
    limit = 50,
    includePayments = 'true'
  } = req.query;
  
  const companyId = req.currentUser?.companyId;

  if (!companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    // Verify bank account exists and belongs to company
    const bankQuery = await client.query(
      `SELECT id, "accountName", "accountType", "currentBalance", "openingBalance"
       FROM hisab."bankAccounts" 
       WHERE id = $1 AND "companyId" = $2 AND "deletedAt" IS NULL`,
      [bankAccountId, companyId]
    );

    if (bankQuery.rows.length === 0) {
      return errorResponse(res, "Bank account not found", 404);
    }

    const bankAccount = bankQuery.rows[0];
    const offset = (page - 1) * limit;

    // Build date filter
    let dateFilter = "";
    let dateParams = [];
    if (startDate && endDate) {
      dateFilter = "AND date BETWEEN $1 AND $2";
      dateParams = [startDate, endDate];
    } else if (startDate) {
      dateFilter = "AND date >= $1";
      dateParams = [startDate];
    } else if (endDate) {
      dateFilter = "AND date <= $1";
      dateParams = [endDate];
    }

    // Get all transactions including payments
    const comprehensiveQuery = `
      WITH all_transactions AS (
        -- Direct bank transfers
        SELECT 
          'transfer' as transaction_type,
          bt.id,
          bt."transferNumber" as reference,
          bt.date,
          bt.description,
          CASE 
            WHEN bt."fromBankId" = $${dateParams.length + 1} THEN -bt.amount
            WHEN bt."toBankId" = $${dateParams.length + 1} THEN bt.amount
            ELSE 0
          END as amount,
          CASE 
            WHEN bt."fromBankId" = $${dateParams.length + 1} THEN 'outgoing'
            WHEN bt."toBankId" = $${dateParams.length + 1} THEN 'incoming'
          END as type,
          'Bank Transfer' as category,
          bt."createdAt",
          NULL as original_transaction_id,
          NULL as original_transaction_type,
          NULL as payment_id,
          NULL as payment_number
        FROM hisab."bankTransfers" bt
        WHERE (bt."fromBankId" = $${dateParams.length + 1} OR bt."toBankId" = $${dateParams.length + 1})
        AND bt."companyId" = $${dateParams.length + 2}
        AND bt."deletedAt" IS NULL
        ${dateFilter.replace(/date/g, 'bt.date')}

        UNION ALL

        -- Direct expenses
        SELECT 
          'expense' as transaction_type,
          e.id,
          CONCAT('EXP-', e.id) as reference,
          e.date,
          COALESCE(e.notes, 'Expense') as description,
          -e.amount as amount,
          'expense' as type,
          'Expense' as category,
          e."createdAt",
          e.id as original_transaction_id,
          'expense' as original_transaction_type,
          NULL as payment_id,
          NULL as payment_number
        FROM hisab."expenses" e
        WHERE e."bankAccountId" = $${dateParams.length + 1}
        AND e."companyId" = $${dateParams.length + 2}
        AND e."status" = 'paid'
        ${dateFilter.replace(/date/g, 'e.date')}

        UNION ALL

        -- Direct incomes
        SELECT 
          'income' as transaction_type,
          i.id,
          CONCAT('INC-', i.id) as reference,
          i.date,
          COALESCE(i.notes, 'Income') as description,
          i.amount as amount,
          'income' as type,
          'Income' as category,
          i."createdAt",
          i.id as original_transaction_id,
          'income' as original_transaction_type,
          NULL as payment_id,
          NULL as payment_number
        FROM hisab."incomes" i
        WHERE i."bankAccountId" = $${dateParams.length + 1}
        AND i."companyId" = $${dateParams.length + 2}
        AND i."status" = 'paid'
        ${dateFilter.replace(/date/g, 'i.date')}

        UNION ALL

        -- Direct sales
        SELECT 
          'sale' as transaction_type,
          s.id,
          s."invoiceNumber" as reference,
          s."invoiceDate" as date,
          COALESCE(s."internalNotes", 'Sales Invoice') as description,
          s."netReceivable" as amount,
          'sale' as type,
          'Sale' as category,
          s."createdAt",
          s.id as original_transaction_id,
          'sale' as original_transaction_type,
          NULL as payment_id,
          NULL as payment_number
        FROM hisab."sales" s
        WHERE s."bankAccountId" = $${dateParams.length + 1}
        AND s."companyId" = $${dateParams.length + 2}
        AND s."deletedAt" IS NULL
        AND s."status" = 'paid'
        ${dateFilter.replace(/date/g, 's."invoiceDate"')}

        UNION ALL

        -- Direct purchases
        SELECT 
          'purchase' as transaction_type,
          p.id,
          p."invoiceNumber" as reference,
          p."invoiceDate" as date,
          COALESCE(p."internalNotes", 'Purchase Invoice') as description,
          -p."netPayable" as amount,
          'purchase' as type,
          'Purchase' as category,
          p."createdAt",
          p.id as original_transaction_id,
          'purchase' as original_transaction_type,
          NULL as payment_id,
          NULL as payment_number
        FROM hisab."purchases" p
        WHERE p."bankAccountId" = $${dateParams.length + 1}
        AND p."companyId" = $${dateParams.length + 2}
        AND p."deletedAt" IS NULL
        AND p."status" = 'paid'
        ${dateFilter.replace(/date/g, 'p."invoiceDate"')}

        ${includePayments === 'true' ? `
        UNION ALL

        -- Payment allocations
        SELECT 
          'payment_allocation' as transaction_type,
          pa.id,
          CONCAT(p."paymentNumber", '-', pa."allocationType") as reference,
          p.date,
          CONCAT(
            CASE 
              WHEN pa."allocationType" = 'purchase' THEN 'Purchase Payment'
              WHEN pa."allocationType" = 'sale' THEN 'Sale Receipt'
              WHEN pa."allocationType" = 'expense' THEN 'Expense Payment'
              WHEN pa."allocationType" = 'income' THEN 'Income Receipt'
              WHEN pa."allocationType" = 'current-balance' THEN 'Balance Payment'
              ELSE 'Payment'
            END,
            ' (', p."paymentNumber", ')',
            CASE 
              WHEN c.name IS NOT NULL THEN CONCAT(' - ', c.name)
              ELSE ''
            END
          ) as description,
          CASE 
            WHEN pa."allocationType" IN ('sale', 'income') THEN 
              -- Sales and Income payments are always INFLOWS (money coming in)
              pa."paidAmount"
            WHEN pa."allocationType" IN ('purchase', 'expense') THEN 
              -- Purchase and Expense payments are always OUTFLOWS (money going out)
              -pa."paidAmount"
            WHEN pa."allocationType" = 'current-balance' THEN 
              -- For current-balance, direction depends on balance type
              CASE 
                WHEN pa."balanceType" = 'receivable' THEN 
                  -- They owe us, so we're receiving money back (INFLOW)
                  pa."paidAmount"
                WHEN pa."balanceType" = 'payable' THEN 
                  -- We owe them, so we're paying money back (OUTFLOW)
                  -pa."paidAmount"
                ELSE -pa."paidAmount"
              END
            ELSE 
              -- Default case: use payment type
              CASE 
                WHEN p."paymentType" = 'payment' THEN -pa."paidAmount"
                WHEN p."paymentType" = 'receipt' THEN pa."paidAmount"
                ELSE -pa."paidAmount"
              END
          END as amount,
          p."paymentType" as type,
          CONCAT(
            CASE 
              WHEN pa."allocationType" = 'purchase' THEN 'Purchase'
              WHEN pa."allocationType" = 'sale' THEN 'Sale'
              WHEN pa."allocationType" = 'expense' THEN 'Expense'
              WHEN pa."allocationType" = 'income' THEN 'Income'
              WHEN pa."allocationType" = 'current-balance' THEN 'Balance'
              ELSE 'Payment'
            END,
            ' Payment'
          ) as category,
          p."createdAt",
          COALESCE(pa."purchaseId", pa."saleId", pa."expenseId", pa."incomeId") as original_transaction_id,
          pa."allocationType" as original_transaction_type,
          p.id as payment_id,
          p."paymentNumber" as payment_number
        FROM hisab."payment_allocations" pa
        JOIN hisab."payments" p ON pa."paymentId" = p.id
        WHERE p."bankId" = $${dateParams.length + 1}
        AND p."companyId" = $${dateParams.length + 2}
        AND p."deletedAt" IS NULL
        ${dateFilter.replace(/date/g, 'p.date')}
        ` : ''}
      )
      SELECT 
        *,
        CASE 
          WHEN amount > 0 THEN 'credit'
          WHEN amount < 0 THEN 'debit'
          ELSE 'neutral'
        END as balance_impact
      FROM all_transactions
      ORDER BY date DESC, "createdAt" DESC
      LIMIT $${dateParams.length + 3} OFFSET $${dateParams.length + 4}
    `;

    const params = [...dateParams, bankAccountId, companyId, limit, offset];
    const result = await client.query(comprehensiveQuery, params);

    // Get total count for pagination
    const countQuery = `
      WITH all_transactions AS (
        -- Direct bank transfers
        SELECT bt.id FROM hisab."bankTransfers" bt
        WHERE (bt."fromBankId" = $1 OR bt."toBankId" = $1)
        AND bt."companyId" = $2 AND bt."deletedAt" IS NULL
        ${dateFilter.replace(/date/g, 'bt.date')}

        UNION ALL

        -- Direct expenses
        SELECT e.id FROM hisab."expenses" e
        WHERE e."bankAccountId" = $1 AND e."companyId" = $2 AND e."status" = 'paid'
        ${dateFilter.replace(/date/g, 'e.date')}

        UNION ALL

        -- Direct incomes
        SELECT i.id FROM hisab."incomes" i
        WHERE i."bankAccountId" = $1 AND i."companyId" = $2 AND i."status" = 'paid'
        ${dateFilter.replace(/date/g, 'i.date')}

        UNION ALL

        -- Direct sales
        SELECT s.id FROM hisab."sales" s
        WHERE s."bankAccountId" = $1 AND s."companyId" = $2 AND s."deletedAt" IS NULL AND s."status" = 'paid'
        ${dateFilter.replace(/date/g, 's."invoiceDate"')}

        UNION ALL

        -- Direct purchases
        SELECT p.id FROM hisab."purchases" p
        WHERE p."bankAccountId" = $1 AND p."companyId" = $2 AND p."deletedAt" IS NULL AND p."status" = 'paid'
        ${dateFilter.replace(/date/g, 'p."invoiceDate"')}

        ${includePayments === 'true' ? `
        UNION ALL

        -- Payment allocations
        SELECT pa.id FROM hisab."payment_allocations" pa
        JOIN hisab."payments" p ON pa."paymentId" = p.id
        WHERE p."bankId" = $1 AND p."companyId" = $2 AND p."deletedAt" IS NULL
        ${dateFilter.replace(/date/g, 'p.date')}
        ` : ''}
      )
      SELECT COUNT(*) as total FROM all_transactions
    `;

    const countResult = await client.query(countQuery, [...dateParams, bankAccountId, companyId]);
    const total = parseInt(countResult.rows[0].total);

    return successResponse(res, {
      bankAccount,
      transactions: result.rows,
      pagination: {
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        limit: parseInt(limit)
      },
      summary: {
        totalTransactions: total,
        totalCredits: result.rows.filter(t => t.balance_impact === 'credit').reduce((sum, t) => sum + Math.abs(t.amount), 0),
        totalDebits: result.rows.filter(t => t.balance_impact === 'debit').reduce((sum, t) => sum + Math.abs(t.amount), 0),
        netBalance: result.rows.reduce((sum, t) => sum + t.amount, 0)
      }
    });

  } catch (error) {
    console.error('Error getting bank transaction tracking:', error);
    return errorResponse(res, "Error fetching transaction tracking", 500);
  } finally {
    client.release();
  }
}