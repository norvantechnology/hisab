import crypto from "crypto";
import bcrypt from "bcrypt";
import pool from "../config/dbConnection.js";
import { generateToken, sendOtpEmail, errorResponse, successResponse } from "../utils/index.js";
import { calculateContactCurrentBalance } from "../utils/balanceCalculator.js";


// Portal login for contacts
export async function portalLogin(req, res) {
  const { token } = req.body;

  if (!token) {
    return errorResponse(res, "Access token is required", 400);
  }

  const client = await pool.connect();

  try {
    // Find contact by portal access token
    const contactQuery = `
      SELECT id, name, email, "companyId", "enablePortal", "portalAccessToken", "portalAccessTokenExpiry"
      FROM hisab.contacts 
      WHERE "portalAccessToken" = $1 AND "enablePortal" = true AND "deletedAt" IS NULL
    `;
    
    const contactResult = await client.query(contactQuery, [token]);
    
    if (contactResult.rows.length === 0) {
      return errorResponse(res, "Invalid or expired access token", 401);
    }

    const contact = contactResult.rows[0];

    // Check if token is expired
    if (new Date() > new Date(contact.portalAccessTokenExpiry)) {
      return errorResponse(res, "Access token has expired", 401);
    }

    // Generate portal session token
    const tokenPayload = {
      id: contact.id,
      name: contact.name,
      email: contact.email,
      companyId: contact.companyId,
      type: 'portal_contact'
    };
    
    const portalToken = generateToken(tokenPayload);

    return successResponse(res, {
      message: "Portal login successful",
      token: portalToken,
      contact: {
        id: contact.id,
        name: contact.name,
        email: contact.email
      }
    });

  } catch (error) {
    console.error("Error in portal login:", error);
    return errorResponse(res, "Failed to authenticate portal access", 500);
  } finally {
    client.release();
  }
}

// Get contact's transactions (sales, purchases, payments, incomes, expenses)
export async function getContactTransactions(req, res) {
  const { contactId } = req.params;
  const { page = 1, limit = 10, type, status } = req.query;

  console.log('getContactTransactions called with:', { contactId, page, limit, type, status });

  const client = await pool.connect();

  try {
    // For portal users, they can only access their own data
    const portalContactId = req.currentUser.id;
    
    // Verify the contact is accessing their own data
    if (parseInt(contactId) !== portalContactId) {
      return errorResponse(res, "Unauthorized access to other contact's data", 403);
    }

    let transactions = [];
    let totalCount = 0;

    // Get contact's current balance and opening balance from database
    const contactBalanceQuery = `
      SELECT 
        "currentBalance",
        "currentBalanceType",
        "openingBalance",
        "openingBalanceType"
      FROM hisab.contacts 
      WHERE id = $1 AND "deletedAt" IS NULL
    `;
    
    const contactBalanceResult = await client.query(contactBalanceQuery, [contactId]);
    const contactBalance = contactBalanceResult.rows[0] || {
      currentBalance: 0,
      currentBalanceType: 'payable',
      openingBalance: 0,
      openingBalanceType: 'payable'
    };

    // Calculate portal perspective balance (SIMPLE REVERSE - just negate the stored current balance)
    // If contact table shows +₹2000 → Portal shows -₹2000
    // If contact table shows -₹2000 → Portal shows +₹2000
    const mainPanelBalance = parseFloat(contactBalance.currentBalance || 0);
    const portalCurrentBalance = -mainPanelBalance;
    const portalCurrentBalanceType = contactBalance.currentBalanceType === 'payable' ? 'payable' : 'receivable';

    // For type='all' or type='transactions', fetch all transaction types (excluding payments)
    if (!type || type === 'all' || type === 'transactions') {
      console.log('Fetching all transaction types for contact:', contactId);
      
      // Get all sales transactions
      const salesQuery = `
        SELECT 
          'sale' as type,
          id,
          "invoiceNumber",
          "invoiceDate" as date,
          "basicAmount",
          "taxAmount",
          "totalDiscount",
          "netReceivable" as total_amount,
          "remaining_amount" as pending_amount,
          "paid_amount",
          status,
          "createdAt",
          'Sale Invoice' as description
        FROM hisab.sales 
        WHERE "contactId" = $1 AND "deletedAt" IS NULL
        ORDER BY "invoiceDate" ASC
      `;
      
      const salesResult = await client.query(salesQuery, [contactId]);
      console.log('Sales query result:', salesResult.rows.length, 'rows');
      transactions.push(...salesResult.rows.map(row => ({ ...row, type: 'sale' })));

      // Get all purchase transactions
      const purchaseQuery = `
        SELECT 
          'purchase' as type,
          id,
          "invoiceNumber",
          "invoiceDate" as date,
          "basicAmount",
          "taxAmount",
          "totalDiscount",
          "netPayable" as total_amount,
          "remaining_amount" as pending_amount,
          "paid_amount",
          status,
          "createdAt",
          'Purchase Invoice' as description
        FROM hisab.purchases 
        WHERE "contactId" = $1 AND "deletedAt" IS NULL
        ORDER BY "invoiceDate" ASC
      `;
      
      const purchaseResult = await client.query(purchaseQuery, [contactId]);
      console.log('Purchase query result:', purchaseResult.rows.length, 'rows');
      transactions.push(...purchaseResult.rows.map(row => ({ ...row, type: 'purchase' })));

      // Get all income transactions
      const incomeQuery = `
        SELECT 
          'income' as type,
          id,
          CONCAT('INC-', id) as "invoiceNumber",
          "date",
          amount as total_amount,
          "remaining_amount" as pending_amount,
          "paid_amount",
          amount as "basicAmount",
          0 as "taxAmount",
          0 as "totalDiscount",
          status,
          "createdAt",
          COALESCE(notes, 'Income Transaction') as description
        FROM hisab.incomes 
        WHERE "contactId" = $1
        ORDER BY "date" ASC
      `;
      
      const incomeResult = await client.query(incomeQuery, [contactId]);
      console.log('Income query result:', incomeResult.rows.length, 'rows');
      transactions.push(...incomeResult.rows.map(row => ({ ...row, type: 'income' })));

      // Get all expense transactions
      const expenseQuery = `
        SELECT 
          'expense' as type,
          id,
          CONCAT('EXP-', id) as "invoiceNumber",
          "date",
          amount as total_amount,
          "remaining_amount" as pending_amount,
          "paid_amount",
          amount as "basicAmount",
          0 as "taxAmount",
          0 as "totalDiscount",
          status,
          "createdAt",
          COALESCE(notes, 'Expense Transaction') as description
        FROM hisab.expenses 
        WHERE "contactId" = $1
        ORDER BY "date" ASC
      `;
      
      const expenseResult = await client.query(expenseQuery, [contactId]);
      console.log('Expense query result:', expenseResult.rows.length, 'rows');
      transactions.push(...expenseResult.rows.map(row => ({ ...row, type: 'expense' })));

      // Sort all transactions by date (oldest first, newest last)
      transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

      // Get total count for all types (excluding payments)
      const countQuery = `
        SELECT 
          (SELECT COUNT(*) FROM hisab.sales WHERE "contactId" = $1 AND "deletedAt" IS NULL) +
          (SELECT COUNT(*) FROM hisab.purchases WHERE "contactId" = $1 AND "deletedAt" IS NULL) +
          (SELECT COUNT(*) FROM hisab.incomes WHERE "contactId" = $1) +
          (SELECT COUNT(*) FROM hisab.expenses WHERE "contactId" = $1) as total
      `;
      
      const countResult = await client.query(countQuery, [contactId]);
      totalCount = parseInt(countResult.rows[0].total);

      console.log('Total transactions found:', totalCount);
      console.log('Transactions before pagination:', transactions.length);

      // Apply pagination
      const offset = (page - 1) * limit;
      transactions = transactions.slice(offset, offset + limit);
      
      console.log('Transactions after pagination:', transactions.length);
    } else if (type === 'sales') {
      // For sales only
      const offset = (page - 1) * limit;
      
      const salesQuery = `
        SELECT 
          'sale' as type,
          id,
          "invoiceNumber",
          "invoiceDate" as date,
          "basicAmount",
          "taxAmount",
          "totalDiscount",
          "netReceivable" as total_amount,
          "remaining_amount" as pending_amount,
          "paid_amount",
          status,
          "createdAt",
          'Sale Invoice' as description
        FROM hisab.sales 
        WHERE "contactId" = $1 AND "deletedAt" IS NULL
        ORDER BY "invoiceDate" ASC
        LIMIT $2 OFFSET $3
      `;
      
      const salesResult = await client.query(salesQuery, [contactId, limit, offset]);
      transactions = salesResult.rows.map(row => ({ ...row, type: 'sale' }));

      // Get total count for sales only
      const countQuery = `SELECT COUNT(*) FROM hisab.sales WHERE "contactId" = $1 AND "deletedAt" IS NULL`;
      const countResult = await client.query(countQuery, [contactId]);
      totalCount = parseInt(countResult.rows[0].count);
    } else if (type === 'purchases') {
      // For purchases only
      const offset = (page - 1) * limit;
      
      const purchaseQuery = `
        SELECT 
          'purchase' as type,
          id,
          "invoiceNumber",
          "invoiceDate" as date,
          "basicAmount",
          "taxAmount",
          "totalDiscount",
          "netPayable" as total_amount,
          "remaining_amount" as pending_amount,
          "paid_amount",
          status,
          "createdAt",
          'Purchase Invoice' as description
        FROM hisab.purchases 
        WHERE "contactId" = $1 AND "deletedAt" IS NULL
        ORDER BY "invoiceDate" ASC
        LIMIT $2 OFFSET $3
      `;
      
      const purchaseResult = await client.query(purchaseQuery, [contactId, limit, offset]);
      transactions = purchaseResult.rows.map(row => ({ ...row, type: 'purchase' }));

      // Get total count for purchases only
      const countQuery = `SELECT COUNT(*) FROM hisab.purchases WHERE "contactId" = $1 AND "deletedAt" IS NULL`;
      const countResult = await client.query(countQuery, [contactId]);
      totalCount = parseInt(countResult.rows[0].count);
    } else if (type === 'incomes') {
      // For incomes only
      const offset = (page - 1) * limit;
      
      const incomeQuery = `
        SELECT 
          'income' as type,
          id,
          CONCAT('INC-', id) as "invoiceNumber",
          "date",
          amount as total_amount,
          "remaining_amount" as pending_amount,
          "paid_amount",
          amount as "basicAmount",
          0 as "taxAmount",
          0 as "totalDiscount",
          status,
          "createdAt",
          COALESCE(notes, 'Income Transaction') as description
        FROM hisab.incomes 
        WHERE "contactId" = $1
        ORDER BY "date" ASC
        LIMIT $2 OFFSET $3
      `;
      
      const incomeResult = await client.query(incomeQuery, [contactId, limit, offset]);
      transactions = incomeResult.rows.map(row => ({ ...row, type: 'income' }));

      // Get total count for incomes only
      const countQuery = `SELECT COUNT(*) FROM hisab.incomes WHERE "contactId" = $1`;
      const countResult = await client.query(countQuery, [contactId]);
      totalCount = parseInt(countResult.rows[0].count);
    } else if (type === 'expenses') {
      // For expenses only
      const offset = (page - 1) * limit;
      
      const expenseQuery = `
        SELECT 
          'expense' as type,
          id,
          CONCAT('EXP-', id) as "invoiceNumber",
          "date",
          amount as total_amount,
          "remaining_amount" as pending_amount,
          "paid_amount",
          amount as "basicAmount",
          0 as "taxAmount",
          0 as "totalDiscount",
          status,
          "createdAt",
          COALESCE(notes, 'Expense Transaction') as description
        FROM hisab.expenses 
        WHERE "contactId" = $1
        ORDER BY "date" ASC
        LIMIT $2 OFFSET $3
      `;
      
      const expenseResult = await client.query(expenseQuery, [contactId, limit, offset]);
      transactions = expenseResult.rows.map(row => ({ ...row, type: 'expense' }));

      // Get total count for expenses only
      const countQuery = `SELECT COUNT(*) FROM hisab.expenses WHERE "contactId" = $1`;
      const countResult = await client.query(countQuery, [contactId]);
      totalCount = parseInt(countResult.rows[0].count);
    }

    // Filter by status if provided
    if (status && status !== 'all') {
      transactions = transactions.filter(t => t.status === status);
    }

    const response = {
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      },
      // Add balance information to response header
      balanceInfo: {
        currentBalance: portalCurrentBalance,
        currentBalanceType: portalCurrentBalanceType,
        openingBalance: contactBalance.openingBalance,
        openingBalanceType: contactBalance.openingBalanceType,
        // Main panel balance (for reference)
        mainPanelBalance: mainPanelBalance,
        mainPanelBalanceType: contactBalance.currentBalanceType // Use the stored current balance type as main panel balance type
      }
    };

    console.log('Sending response:', response);
    return successResponse(res, response);

  } catch (error) {
    console.error("Error getting contact transactions:", error);
    return errorResponse(res, "Failed to get transactions", 500);
  } finally {
    client.release();
  }
}

// Get contact's financial summary for dashboard
export async function getContactFinancialSummary(req, res) {
  const { contactId } = req.params;

  const client = await pool.connect();

  try {
    // For portal users, they can only access their own data
    const portalContactId = req.currentUser.id;
    
    // Verify the contact is accessing their own data
    if (parseInt(contactId) !== portalContactId) {
      return errorResponse(res, "Unauthorized access to other contact's data", 403);
    }

    console.log('=== FINANCIAL SUMMARY DEBUG ===');
    console.log('Contact ID:', contactId);
    console.log('Portal Contact ID:', portalContactId);

    // First, let's check if the contact exists
    const contactCheck = await client.query(
      'SELECT id, name FROM hisab.contacts WHERE id = $1 AND "enablePortal" = true AND "deletedAt" IS NULL',
      [contactId]
    );
    console.log('Contact check result:', contactCheck.rows);

    if (contactCheck.rows.length === 0) {
      return errorResponse(res, "Contact not found or portal not enabled", 404);
    }

    // Use the same balance calculation function as main panel
    const { balance: mainPanelBalance, balanceType: mainPanelBalanceType } = await calculateContactCurrentBalance(client, contactId, req.currentUser.companyId);
    
    console.log('Main Panel Balance (calculated):', mainPanelBalance, mainPanelBalanceType);

    // Calculate portal perspective balance (SIMPLE REVERSE - just negate the result)
    // If calculateContactCurrentBalance returns +₹2000 → Portal shows -₹2000
    // If calculateContactCurrentBalance returns -₹2000 → Portal shows +₹2000
    const portalNetPosition = -mainPanelBalance;

    console.log('Portal Net Position:', portalNetPosition);

    // Simple queries to check each table individually
    const salesCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM("netReceivable"), 0) as total FROM hisab.sales WHERE "contactId" = $1 AND "deletedAt" IS NULL',
      [contactId]
    );
    console.log('Sales check:', salesCheck.rows[0]);

    const purchasesCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM("netPayable"), 0) as total FROM hisab.purchases WHERE "contactId" = $1 AND "deletedAt" IS NULL',
      [contactId]
    );
    console.log('Purchases check:', purchasesCheck.rows[0]);

    const incomesCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM hisab.incomes WHERE "contactId" = $1',
      [contactId]
    );
    console.log('Incomes check:', incomesCheck.rows[0]);

    const expensesCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM hisab.expenses WHERE "contactId" = $1',
      [contactId]
    );
    console.log('Expenses check:', expensesCheck.rows[0]);

    const paymentsCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM hisab.payments WHERE "contactId" = $1 AND "deletedAt" IS NULL',
      [contactId]
    );
    console.log('Payments check:', paymentsCheck.rows[0]);

    // Now let's check status-specific queries
    const salesPaidCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM("netReceivable"), 0) as total FROM hisab.sales WHERE "contactId" = $1 AND status = $2 AND "deletedAt" IS NULL',
      [contactId, 'paid']
    );
    console.log('Sales paid check:', salesPaidCheck.rows[0]);

    const salesPendingCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM("netReceivable"), 0) as total FROM hisab.sales WHERE "contactId" = $1 AND status = $2 AND "deletedAt" IS NULL',
      [contactId, 'pending']
    );
    console.log('Sales pending check:', salesPendingCheck.rows[0]);

    const purchasesPaidCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM("netPayable"), 0) as total FROM hisab.purchases WHERE "contactId" = $1 AND status = $2 AND "deletedAt" IS NULL',
      [contactId, 'paid']
    );
    console.log('Purchases paid check:', purchasesPaidCheck.rows[0]);

    const purchasesPendingCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM("netPayable"), 0) as total FROM hisab.purchases WHERE "contactId" = $1 AND status = $2 AND "deletedAt" IS NULL',
      [contactId, 'pending']
    );
    console.log('Purchases pending check:', purchasesPendingCheck.rows[0]);

    const incomesPaidCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM hisab.incomes WHERE "contactId" = $1 AND status = $2',
      [contactId, 'paid']
    );
    console.log('Incomes paid check:', incomesPaidCheck.rows[0]);

    const incomesPendingCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM hisab.incomes WHERE "contactId" = $1 AND status = $2',
      [contactId, 'pending']
    );
    console.log('Incomes pending check:', incomesPendingCheck.rows[0]);

    // Add missing expense queries
    const expensesPaidCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM hisab.expenses WHERE "contactId" = $1 AND status = $2',
      [contactId, 'paid']
    );
    console.log('Expenses paid check:', expensesPaidCheck.rows[0]);

    const expensesPendingCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM hisab.expenses WHERE "contactId" = $1 AND status = $2',
      [contactId, 'pending']
    );
    console.log('Expenses pending check:', expensesPendingCheck.rows[0]);

    // Calculate financial summary with the correct portal perspective
    const financialSummary = {
      // Total Paid Amount (Money received by contact from business - ONLY PAID transactions)
      // = Sales (paid) + Payments (received) + Expenses (paid - business paid to contact)
      totalPaidAmount: parseFloat(salesPaidCheck.rows[0].total) + parseFloat(paymentsCheck.rows[0].total) + parseFloat(expensesPaidCheck.rows[0].total),
      
      // Total Pending Amount (Money owed TO the contact - ONLY PENDING transactions)
      // = Sales (pending) + Expenses (pending - business owes to contact)
      totalPendingAmount: parseFloat(salesPendingCheck.rows[0].total) + parseFloat(expensesPendingCheck.rows[0].total),
      
      // Total Owed Amount (Money owed BY the contact - ONLY PENDING transactions)
      // = Purchases (pending) + Incomes (pending - contact owes to business)
      totalOwedAmount: parseFloat(purchasesPendingCheck.rows[0].total) + parseFloat(incomesPendingCheck.rows[0].total),
      
      // Total Transactions Count
      totalTransactions: parseInt(salesCheck.rows[0].count) + parseInt(purchasesCheck.rows[0].count) + 
                        parseInt(incomesCheck.rows[0].count) + parseInt(expensesCheck.rows[0].count) + parseInt(paymentsCheck.rows[0].count),
      
      // Detailed breakdowns with correct portal perspective
      sales: {
        paid: parseFloat(salesPaidCheck.rows[0].total),
        pending: parseFloat(salesPendingCheck.rows[0].total),
        total: parseFloat(salesCheck.rows[0].total),
        count: parseInt(salesCheck.rows[0].count)
      },
      purchases: {
        paid: parseFloat(purchasesPaidCheck.rows[0].total),
        pending: parseFloat(purchasesPendingCheck.rows[0].total),
        total: parseFloat(purchasesCheck.rows[0].total),
        count: parseInt(purchasesCheck.rows[0].count)
      },
      incomes: {
        // For portal: Incomes = Contact owes to business (Payable)
        paid: parseFloat(incomesPaidCheck.rows[0].total),
        pending: parseFloat(incomesPendingCheck.rows[0].total), // Contact owes this to business
        total: parseFloat(incomesCheck.rows[0].total),
        count: parseInt(incomesCheck.rows[0].count)
      },
      expenses: {
        // For portal: Expenses = Business owes to contact (Receivable)
        paid: parseFloat(expensesPaidCheck.rows[0].total), // Business paid this to contact
        pending: parseFloat(expensesPendingCheck.rows[0].total), // Business owes this to contact
        total: parseFloat(expensesCheck.rows[0].total),
        count: parseInt(expensesCheck.rows[0].count)
      },
      payments: {
        total: parseFloat(paymentsCheck.rows[0].total),
        count: parseInt(paymentsCheck.rows[0].count)
      },
      
      // Net Position (USING SAME CALCULATION AS MAIN PANEL, THEN REVERSED)
      // Main panel: +₹2000 (contact owes business) → Portal: -₹2000 (contact owes business)
      // Main panel: -₹2000 (contact is owed by business) → Portal: +₹2000 (contact is owed by business)
      netPosition: portalNetPosition
    };

    console.log('Final Financial Summary:', financialSummary);
    console.log('=== END FINANCIAL SUMMARY DEBUG ===');

    return successResponse(res, financialSummary);

  } catch (error) {
    console.error("Error getting contact financial summary:", error);
    return errorResponse(res, "Failed to get financial summary", 500);
  } finally {
    client.release();
  }
}

// Get dashboard financial summary for portal
export async function getDashboardFinancialSummary(req, res) {
  const { contactId } = req.params;

  const client = await pool.connect();

  try {
    // For portal users, they can only access their own data
    const portalContactId = req.currentUser.id;
    
    // Verify the contact is accessing their own data
    if (parseInt(contactId) !== portalContactId) {
      return errorResponse(res, "Unauthorized access to other contact's data", 403);
    }

    console.log('=== DASHBOARD FINANCIAL SUMMARY DEBUG ===');
    console.log('Contact ID:', contactId);

    // Get contact's current balance using the same function as main panel
    const { balance: mainPanelBalance, balanceType: mainPanelBalanceType } = await calculateContactCurrentBalance(client, contactId, req.currentUser.companyId);
    
    console.log('Main Panel Balance (calculated):', mainPanelBalance, mainPanelBalanceType);

    // Calculate portal perspective balance (SIMPLE REVERSE - just negate the result)
    const portalNetPosition = -mainPanelBalance;

    // Get paid sales amounts (Total Received - Sales)
    const salesPaidQuery = `
      SELECT COALESCE(SUM("netReceivable"), 0) as total
      FROM hisab.sales 
      WHERE "contactId" = $1 AND status = 'paid' AND "deletedAt" IS NULL
    `;
    const salesPaidResult = await client.query(salesPaidQuery, [contactId]);
    const salesPaid = parseFloat(salesPaidResult.rows[0]?.total || 0);
    console.log('Sales Paid:', salesPaid);

    // Get payments received (Total Received - Payments)
    const paymentsQuery = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM hisab.payments 
      WHERE "contactId" = $1 AND "deletedAt" IS NULL
    `;
    const paymentsResult = await client.query(paymentsQuery, [contactId]);
    const paymentsReceived = parseFloat(paymentsResult.rows[0]?.total || 0);
    console.log('Payments Received:', paymentsReceived);

    // Get paid expenses (Total Received - Expenses)
    const expensesPaidQuery = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM hisab.expenses 
      WHERE "contactId" = $1 AND status = 'paid'
    `;
    const expensesPaidResult = await client.query(expensesPaidQuery, [contactId]);
    const expensesPaid = parseFloat(expensesPaidResult.rows[0]?.total || 0);
    console.log('Expenses Paid:', expensesPaid);

    // Calculate Total Received
    const totalReceived = salesPaid + paymentsReceived + expensesPaid;
    console.log('Total Received:', totalReceived);

    // Get pending sales (Pending Receivable - Sales)
    const salesPendingQuery = `
      SELECT COALESCE(SUM("netReceivable"), 0) as total
      FROM hisab.sales 
      WHERE "contactId" = $1 AND status = 'pending' AND "deletedAt" IS NULL
    `;
    const salesPendingResult = await client.query(salesPendingQuery, [contactId]);
    const salesPending = parseFloat(salesPendingResult.rows[0]?.total || 0);
    console.log('Sales Pending:', salesPending);

    // Get pending expenses (Pending Receivable - Expenses)
    const expensesPendingQuery = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM hisab.expenses 
      WHERE "contactId" = $1 AND status = 'pending'
    `;
    const expensesPendingResult = await client.query(expensesPendingQuery, [contactId]);
    const expensesPending = parseFloat(expensesPendingResult.rows[0]?.total || 0);
    console.log('Expenses Pending:', expensesPending);

    // Calculate Pending Receivable
    const pendingReceivable = salesPending + expensesPending;
    console.log('Pending Receivable:', pendingReceivable);

    // Get pending purchases (You Owe - Purchases)
    const purchasesPendingQuery = `
      SELECT COALESCE(SUM("netPayable"), 0) as total
      FROM hisab.purchases 
      WHERE "contactId" = $1 AND status = 'pending' AND "deletedAt" IS NULL
    `;
    const purchasesPendingResult = await client.query(purchasesPendingQuery, [contactId]);
    const purchasesPending = parseFloat(purchasesPendingResult.rows[0]?.total || 0);
    console.log('Purchases Pending:', purchasesPending);

    // Get pending incomes (You Owe - Incomes)
    const incomesPendingQuery = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM hisab.incomes 
      WHERE "contactId" = $1 AND status = 'pending'
    `;
    const incomesPendingResult = await client.query(incomesPendingQuery, [contactId]);
    const incomesPending = parseFloat(incomesPendingResult.rows[0]?.total || 0);
    console.log('Incomes Pending:', incomesPending);

    // Calculate You Owe
    const youOwe = purchasesPending + incomesPending;
    console.log('You Owe:', youOwe);

    const dashboardSummary = {
      totalReceived: totalReceived,
      pendingReceivable: pendingReceivable,
      youOwe: youOwe,
      netPosition: portalNetPosition
    };

    console.log('Dashboard Financial Summary:', dashboardSummary);
    console.log('=== END DASHBOARD FINANCIAL SUMMARY DEBUG ===');

    return successResponse(res, dashboardSummary);

  } catch (error) {
    console.error("Error getting dashboard financial summary:", error);
    return errorResponse(res, "Failed to get dashboard financial summary", 500);
  } finally {
    client.release();
  }
}

// Get contact's account summary
export async function getContactSummary(req, res) {
  const { contactId } = req.params;

  const client = await pool.connect();

  try {
    // For portal users, they can only access their own data
    const portalContactId = req.currentUser.id;
    
    // Verify the contact is accessing their own data
    if (parseInt(contactId) !== portalContactId) {
      return errorResponse(res, "Unauthorized access to other contact's data", 403);
    }

    // Get contact details with more fields
    const contactQuery = `
      SELECT 
        id, name, email, mobile, gstin, "contactType", "enablePortal", 
        "currentBalance", "currentBalanceType", "openingBalance", "openingBalanceType",
        "dueDays", currency, "billingAddress1", "billingAddress2", "billingCity", 
        "billingPincode", "billingState", "billingCountry", notes
      FROM hisab.contacts 
      WHERE id = $1 AND "enablePortal" = true AND "deletedAt" IS NULL
    `;
    
    const contactResult = await client.query(contactQuery, [contactId]);
    
    if (contactResult.rows.length === 0) {
      return errorResponse(res, "Contact not found or portal access not enabled", 404);
    }

    const contact = contactResult.rows[0];

    // Get comprehensive transaction statistics
    const statsQuery = `
      SELECT 
        -- Sales Statistics
        (SELECT COUNT(*) FROM hisab.sales WHERE "contactId" = $1 AND "deletedAt" IS NULL) as totalSales,
        (SELECT COUNT(*) FROM hisab.sales WHERE "contactId" = $1 AND status = 'paid' AND "deletedAt" IS NULL) as paidSales,
        (SELECT COUNT(*) FROM hisab.sales WHERE "contactId" = $1 AND status = 'pending' AND "deletedAt" IS NULL) as pendingSales,
        (SELECT COALESCE(SUM("netReceivable"), 0) FROM hisab.sales WHERE "contactId" = $1 AND "deletedAt" IS NULL) as totalSalesAmount,
        (SELECT COALESCE(SUM("netReceivable"), 0) FROM hisab.sales WHERE "contactId" = $1 AND status = 'paid' AND "deletedAt" IS NULL) as paidSalesAmount,
        (SELECT COALESCE(SUM("netReceivable"), 0) FROM hisab.sales WHERE "contactId" = $1 AND status = 'pending' AND "deletedAt" IS NULL) as pendingSalesAmount,
        
        -- Purchase Statistics
        (SELECT COUNT(*) FROM hisab.purchases WHERE "contactId" = $1 AND "deletedAt" IS NULL) as totalPurchases,
        (SELECT COUNT(*) FROM hisab.purchases WHERE "contactId" = $1 AND status = 'paid' AND "deletedAt" IS NULL) as paidPurchases,
        (SELECT COUNT(*) FROM hisab.purchases WHERE "contactId" = $1 AND status = 'pending' AND "deletedAt" IS NULL) as pendingPurchases,
        (SELECT COALESCE(SUM("netPayable"), 0) FROM hisab.purchases WHERE "contactId" = $1 AND "deletedAt" IS NULL) as totalPurchaseAmount,
        (SELECT COALESCE(SUM("netPayable"), 0) FROM hisab.purchases WHERE "contactId" = $1 AND status = 'paid' AND "deletedAt" IS NULL) as paidPurchaseAmount,
        (SELECT COALESCE(SUM("netPayable"), 0) FROM hisab.purchases WHERE "contactId" = $1 AND status = 'pending' AND "deletedAt" IS NULL) as pendingPurchaseAmount,
        
        -- Income Statistics
        (SELECT COUNT(*) FROM hisab.incomes WHERE "contactId" = $1) as totalIncomes,
        (SELECT COUNT(*) FROM hisab.incomes WHERE "contactId" = $1 AND status = 'paid') as paidIncomes,
        (SELECT COUNT(*) FROM hisab.incomes WHERE "contactId" = $1 AND status = 'pending') as pendingIncomes,
        (SELECT COALESCE(SUM(amount), 0) FROM hisab.incomes WHERE "contactId" = $1) as totalIncomeAmount,
        (SELECT COALESCE(SUM(amount), 0) FROM hisab.incomes WHERE "contactId" = $1 AND status = 'paid') as paidIncomeAmount,
        (SELECT COALESCE(SUM(amount), 0) FROM hisab.incomes WHERE "contactId" = $1 AND status = 'pending') as pendingIncomeAmount,
        
        -- Expense Statistics
        (SELECT COUNT(*) FROM hisab.expenses WHERE "contactId" = $1) as totalExpenses,
        (SELECT COUNT(*) FROM hisab.expenses WHERE "contactId" = $1 AND status = 'paid') as paidExpenses,
        (SELECT COUNT(*) FROM hisab.expenses WHERE "contactId" = $1 AND status = 'pending') as pendingExpenses,
        (SELECT COALESCE(SUM(amount), 0) FROM hisab.expenses WHERE "contactId" = $1) as totalExpenseAmount,
        (SELECT COALESCE(SUM(amount), 0) FROM hisab.expenses WHERE "contactId" = $1 AND status = 'paid') as paidExpenseAmount,
        (SELECT COALESCE(SUM(amount), 0) FROM hisab.expenses WHERE "contactId" = $1 AND status = 'pending') as pendingExpenseAmount,
        
        -- Payment Statistics
        (SELECT COUNT(*) FROM hisab.payments WHERE "contactId" = $1 AND "deletedAt" IS NULL) as totalPayments,
        (SELECT COALESCE(SUM(amount), 0) FROM hisab.payments WHERE "contactId" = $1 AND "deletedAt" IS NULL) as totalPaymentAmount
    `;
    
    const statsResult = await client.query(statsQuery, [contactId]);
    const stats = statsResult.rows[0];

    // Calculate summary totals
    const summary = {
      // Transaction Counts
      totalTransactions: parseInt(stats.totalSales) + parseInt(stats.totalPurchases) + 
                        parseInt(stats.totalIncomes) + parseInt(stats.totalExpenses) + parseInt(stats.totalPayments),
      totalSales: parseInt(stats.totalSales),
      totalPurchases: parseInt(stats.totalPurchases),
      totalIncomes: parseInt(stats.totalIncomes),
      totalExpenses: parseInt(stats.totalExpenses),
      totalPayments: parseInt(stats.totalPayments),
      
      // Paid vs Pending Counts
      paidSales: parseInt(stats.paidSales),
      pendingSales: parseInt(stats.pendingSales),
      paidPurchases: parseInt(stats.paidPurchases),
      pendingPurchases: parseInt(stats.pendingPurchases),
      paidIncomes: parseInt(stats.paidIncomes),
      pendingIncomes: parseInt(stats.pendingIncomes),
      paidExpenses: parseInt(stats.paidExpenses),
      pendingExpenses: parseInt(stats.pendingExpenses),
      
      // Amount Totals
      totalSalesAmount: parseFloat(stats.totalSalesAmount),
      paidSalesAmount: parseFloat(stats.paidSalesAmount),
      pendingSalesAmount: parseFloat(stats.pendingSalesAmount),
      totalPurchaseAmount: parseFloat(stats.totalPurchaseAmount),
      paidPurchaseAmount: parseFloat(stats.paidPurchaseAmount),
      pendingPurchaseAmount: parseFloat(stats.pendingPurchaseAmount),
      totalIncomeAmount: parseFloat(stats.totalIncomeAmount),
      paidIncomeAmount: parseFloat(stats.paidIncomeAmount),
      pendingIncomeAmount: parseFloat(stats.pendingIncomeAmount),
      totalExpenseAmount: parseFloat(stats.totalExpenseAmount),
      paidExpenseAmount: parseFloat(stats.paidExpenseAmount),
      pendingExpenseAmount: parseFloat(stats.pendingExpenseAmount),
      totalPaymentAmount: parseFloat(stats.totalPaymentAmount),
      
      // Calculated Fields
      totalPaidAmount: parseFloat(stats.paidSalesAmount) + parseFloat(stats.paidIncomeAmount) + parseFloat(stats.totalPaymentAmount),
      totalPendingAmount: parseFloat(stats.pendingSalesAmount) + parseFloat(stats.pendingIncomeAmount),
      totalOwedAmount: parseFloat(stats.pendingPurchaseAmount) + parseFloat(stats.pendingExpenseAmount),
      netPosition: parseFloat(stats.totalSalesAmount) + parseFloat(stats.totalIncomeAmount) - 
                   parseFloat(stats.totalPurchaseAmount) - parseFloat(stats.totalExpenseAmount)
    };

    return successResponse(res, {
      contact: {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        mobile: contact.mobile,
        gstin: contact.gstin,
        contactType: contact.contactType,
        currentBalance: contact.currentBalance,
        currentBalanceType: contact.currentBalanceType,
        openingBalance: contact.openingBalance,
        openingBalanceType: contact.openingBalanceType,
        dueDays: contact.dueDays,
        currency: contact.currency,
        billingAddress1: contact.billingAddress1,
        billingAddress2: contact.billingAddress2,
        billingCity: contact.billingCity,
        billingPincode: contact.billingPincode,
        billingState: contact.billingState,
        billingCountry: contact.billingCountry,
        notes: contact.notes,
        enablePortal: contact.enablePortal
      },
      summary
    });

  } catch (error) {
    console.error("Error getting contact summary:", error);
    return errorResponse(res, "Failed to get contact summary", 500);
  } finally {
    client.release();
  }
} 

// Get detailed contact profile information for portal
export async function getContactProfile(req, res) {
  const { contactId } = req.params;

  const client = await pool.connect();

  try {
    // For portal users, they can only access their own data
    const portalContactId = req.currentUser.id;
    
    // Verify the contact is accessing their own data
    if (parseInt(contactId) !== portalContactId) {
      return errorResponse(res, "Unauthorized access to other contact's data", 403);
    }

    // Get detailed contact information
    const contactQuery = `
      SELECT 
        id, name, email, mobile, gstin, "contactType", "enablePortal", 
        "currentBalance", "currentBalanceType", "openingBalance", "openingBalanceType",
        "dueDays", currency, "billingAddress1", "billingAddress2", "billingCity", 
        "billingPincode", "billingState", "billingCountry", notes,
        "shippingAddress1", "shippingAddress2", "shippingCity", 
        "shippingPincode", "shippingState", "shippingCountry",
        "createdAt", "updatedAt"
      FROM hisab.contacts 
      WHERE id = $1 AND "enablePortal" = true AND "deletedAt" IS NULL
    `;
    
    const contactResult = await client.query(contactQuery, [contactId]);
    
    if (contactResult.rows.length === 0) {
      return errorResponse(res, "Contact not found or portal access not enabled", 404);
    }

    const contact = contactResult.rows[0];

    // Verify we have the correct contact
    console.log('Contact found:', {
      id: contact.id,
      name: contact.name,
      email: contact.email,
      contactType: contact.contactType,
      currentBalance: contact.currentBalance,
      currentBalanceType: contact.currentBalanceType
    });

    // Get transaction statistics for profile with better debugging
    console.log('=== PROFILE DEBUG ===');
    console.log('Contact ID:', contactId);
    console.log('Contact Name:', contact.name);
    console.log('Contact Email:', contact.email);

    // Check individual tables for data (for balance calculation, we need pending amounts)
    const salesCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM("netReceivable"), 0) as total FROM hisab.sales WHERE "contactId" = $1 AND status = $2 AND "deletedAt" IS NULL',
      [contactId, 'pending']
    );
    console.log('Pending Sales data:', salesCheck.rows[0]);

    const purchasesCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM("netPayable"), 0) as total FROM hisab.purchases WHERE "contactId" = $1 AND status = $2 AND "deletedAt" IS NULL',
      [contactId, 'pending']
    );
    console.log('Pending Purchases data:', purchasesCheck.rows[0]);

    const incomesCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM hisab.incomes WHERE "contactId" = $1 AND status = $2',
      [contactId, 'pending']
    );
    console.log('Pending Incomes data:', incomesCheck.rows[0]);

    const expensesCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM hisab.expenses WHERE "contactId" = $1 AND status = $2',
      [contactId, 'pending']
    );
    console.log('Pending Expenses data:', expensesCheck.rows[0]);

    const paymentsCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM hisab.payments WHERE "contactId" = $1 AND "deletedAt" IS NULL',
      [contactId]
    );
    console.log('All Payments data:', paymentsCheck.rows[0]);

    // Get transaction statistics for profile with improved query
    // For balance calculation, we need to consider:
    // - Pending sales (what customer owes to business)
    // - Pending purchases (what business owes to customer)
    // - Pending incomes (what customer owes to business)
    // - Pending expenses (what business owes to customer)
    // - All payments (what customer has paid to business)
    const statsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM hisab.sales WHERE "contactId" = $1 AND "deletedAt" IS NULL) as totalSales,
        (SELECT COUNT(*) FROM hisab.purchases WHERE "contactId" = $1 AND "deletedAt" IS NULL) as totalPurchases,
        (SELECT COUNT(*) FROM hisab.incomes WHERE "contactId" = $1) as totalIncomes,
        (SELECT COUNT(*) FROM hisab.expenses WHERE "contactId" = $1) as totalExpenses,
        (SELECT COUNT(*) FROM hisab.payments WHERE "contactId" = $1 AND "deletedAt" IS NULL) as totalPayments,
        (SELECT COALESCE(SUM("netReceivable"), 0) FROM hisab.sales WHERE "contactId" = $1 AND status = 'pending' AND "deletedAt" IS NULL) as totalSalesAmount,
        (SELECT COALESCE(SUM("netPayable"), 0) FROM hisab.purchases WHERE "contactId" = $1 AND status = 'pending' AND "deletedAt" IS NULL) as totalPurchaseAmount,
        (SELECT COALESCE(SUM(amount), 0) FROM hisab.incomes WHERE "contactId" = $1 AND status = 'pending') as totalIncomeAmount,
        (SELECT COALESCE(SUM(amount), 0) FROM hisab.expenses WHERE "contactId" = $1 AND status = 'pending') as totalExpenseAmount,
        (SELECT COALESCE(SUM(amount), 0) FROM hisab.payments WHERE "contactId" = $1 AND "deletedAt" IS NULL) as totalPaymentAmount
    `;
    console.log("statsQuery>", statsQuery);
    const statsResult = await client.query(statsQuery, [contactId]);
    const stats = statsResult.rows[0];
    console.log('Combined stats result:', stats);

    // Calculate actual current balance from transactions
    // For a customer (contact), the balance calculation should be:
    // - Sales (what customer owes to business) + Incomes (what customer owes to business)
    // - Purchases (what business owes to customer) + Expenses (what business owes to customer)
    // - Payments (what customer has already paid to business)
    // Positive balance means customer owes money to business (receivable)
    // Negative balance means business owes money to customer (payable)
    
    const salesAndIncomes = parseFloat(stats.totalSalesAmount) + parseFloat(stats.totalIncomeAmount);
    const purchasesAndExpenses = parseFloat(stats.totalPurchaseAmount) + parseFloat(stats.totalExpenseAmount);
    const payments = parseFloat(stats.totalPaymentAmount);
    
    // Balance = (Sales + Incomes) - (Purchases + Expenses) - Payments
    // This gives us the net amount the customer owes to the business
    const actualBalance = salesAndIncomes - purchasesAndExpenses - payments;
    
    // Calculate opening balance (balance before current transactions)
    const openingBalance = parseFloat(contact.openingBalance || 0);
    const openingBalanceType = contact.openingBalanceType || 'receivable';
    
    console.log('Balance calculation breakdown:');
    console.log('- Sales + Incomes:', salesAndIncomes);
    console.log('- Purchases + Expenses:', purchasesAndExpenses);
    console.log('- Payments:', payments);
    console.log('- Calculated balance:', actualBalance);
    console.log('- Opening balance:', openingBalance);
    console.log('- Opening balance type:', openingBalanceType);
    console.log('- Stored current balance:', contact.currentBalance);

    // Format the profile data
    const profileData = {
      contact: {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        mobile: contact.mobile,
        gstin: contact.gstin,
        contactType: contact.contactType,
        currency: contact.currency,
        dueDays: contact.dueDays,
        currentBalance: Math.abs(actualBalance),
        currentBalanceType: actualBalance > 0 ? 'receivable' : actualBalance < 0 ? 'payable' : contact.currentBalanceType,
        openingBalance: openingBalance,
        openingBalanceType: openingBalanceType,
        notes: contact.notes,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt
      },
      billingAddress: {
        address1: contact.billingAddress1,
        address2: contact.billingAddress2,
        city: contact.billingCity,
        pincode: contact.billingPincode,
        state: contact.billingState,
        country: contact.billingCountry
      },
      shippingAddress: {
        address1: contact.shippingAddress1,
        address2: contact.shippingAddress2,
        city: contact.shippingCity,
        pincode: contact.shippingPincode,
        state: contact.shippingState,
        country: contact.shippingCountry
      },
      statistics: {
        totalSales: parseInt(stats.totalSales) || 0,
        totalPurchases: parseInt(stats.totalPurchases) || 0,
        totalIncomes: parseInt(stats.totalIncomes) || 0,
        totalExpenses: parseInt(stats.totalExpenses) || 0,
        totalPayments: parseInt(stats.totalPayments) || 0,
        totalSalesAmount: parseFloat(stats.totalSalesAmount) || 0,
        totalPurchaseAmount: parseFloat(stats.totalPurchaseAmount) || 0,
        totalIncomeAmount: parseFloat(stats.totalIncomeAmount) || 0,
        totalExpenseAmount: parseFloat(stats.totalExpenseAmount) || 0,
        totalPaymentAmount: parseFloat(stats.totalPaymentAmount) || 0
      }
    };

    return successResponse(res, profileData);

  } catch (error) {
    console.error("Error getting contact profile:", error);
    return errorResponse(res, "Failed to get profile information", 500);
  } finally {
    client.release();
  }
} 