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

    // UPDATED: Get contact's calculated balance instead of stored balance
    const contactBalanceQuery = `
      SELECT 
        "openingBalance",
        "openingBalanceType"
      FROM hisab.contacts 
      WHERE id = $1 AND "deletedAt" IS NULL
    `;
    
    const contactBalanceResult = await client.query(contactBalanceQuery, [contactId]);
    const contactBalance = contactBalanceResult.rows[0] || {
      openingBalance: 0,
      openingBalanceType: 'payable'
    };

    // Calculate real-time balance
    const { balance: mainPanelBalance, balanceType: mainPanelBalanceType } = 
      await calculateContactCurrentBalance(client, contactId, req.currentUser.companyId);

    // Calculate portal perspective balance (SIMPLE REVERSE - just negate the result)
    // If calculateContactCurrentBalance returns +₹2000 → Portal shows -₹2000
    // If calculateContactCurrentBalance returns -₹2000 → Portal shows +₹2000
    const portalCurrentBalance = -mainPanelBalance;
    const portalCurrentBalanceType = mainPanelBalanceType === 'payable' ? 'receivable' : 'payable';

    // For type='all' or type='transactions', fetch all transaction types (excluding payments)
    if (!type || type === 'all' || type === 'transactions') {
      
      // Get all sales transactions
      const salesQuery = `
        SELECT 
          'sale' as type,
          id,
          "invoiceNumber",
          "invoiceDate" as date,
          "netReceivable" as amount,
          "paid_amount" as paidAmount,
          "remaining_amount" as remainingAmount,
          status,
          "createdAt",
          'They owe you' as description
        FROM hisab.sales 
        WHERE "contactId" = $1 AND "deletedAt" IS NULL
        ORDER BY "invoiceDate" DESC
      `;
      
      const salesResult = await client.query(salesQuery, [contactId]);
      transactions.push(...salesResult.rows.map(row => ({ ...row, type: 'sale' })));

      // Get all purchase transactions
      const purchaseQuery = `
        SELECT 
          'purchase' as type,
          id,
          "invoiceNumber",
          "invoiceDate" as date,
          "netPayable" as amount,
          "paid_amount" as paidAmount,
          "remaining_amount" as remainingAmount,
          status,
          "createdAt",
          'You owe them' as description
        FROM hisab.purchases 
        WHERE "contactId" = $1 AND "deletedAt" IS NULL
        ORDER BY "invoiceDate" DESC
      `;
      
      const purchaseResult = await client.query(purchaseQuery, [contactId]);
      transactions.push(...purchaseResult.rows.map(row => ({ ...row, type: 'purchase' })));

      // Get all income transactions
      const incomeQuery = `
        SELECT 
          'income' as type,
          id,
          amount,
          "remaining_amount" as remainingAmount,
          status,
          "createdAt" as date,
          "createdAt",
          'They owe you' as description
        FROM hisab.incomes 
        WHERE "contactId" = $1
        ORDER BY "createdAt" DESC
      `;
      
      const incomeResult = await client.query(incomeQuery, [contactId]);
      transactions.push(...incomeResult.rows.map(row => ({ ...row, type: 'income' })));

      // Get all expense transactions
      const expenseQuery = `
        SELECT 
          'expense' as type,
          id,
          amount,
          "remaining_amount" as remainingAmount,
          status,
          "createdAt" as date,
          "createdAt",
          'You owe them' as description
        FROM hisab.expenses 
        WHERE "contactId" = $1
        ORDER BY "createdAt" DESC
      `;
      
      const expenseResult = await client.query(expenseQuery, [contactId]);
      transactions.push(...expenseResult.rows.map(row => ({ ...row, type: 'expense' })));

      // Sort all transactions by date
      transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

      totalCount = transactions.length;

      // Apply pagination
      const offset = (page - 1) * limit;
      transactions = transactions.slice(offset, offset + limit);
      
    } else if (type === 'sales') {
      // For sales only
      const offset = (page - 1) * limit;
      
      const salesQuery = `
        SELECT 
          'sale' as type,
          id,
          "invoiceNumber",
          "invoiceDate" as date,
          "netReceivable" as amount,
          "paid_amount" as paidAmount,
          "remaining_amount" as remainingAmount,
          status,
          "createdAt",
          'They owe you' as description
        FROM hisab.sales 
        WHERE "contactId" = $1 AND "deletedAt" IS NULL
        ${status ? `AND status = '${status}'` : ''}
        ORDER BY "invoiceDate" DESC
        LIMIT $2 OFFSET $3
      `;
      
      const countQuery = `
        SELECT COUNT(*) as total
        FROM hisab.sales 
        WHERE "contactId" = $1 AND "deletedAt" IS NULL
        ${status ? `AND status = '${status}'` : ''}
      `;

      const [salesResult, countResult] = await Promise.all([
        client.query(salesQuery, [contactId, limit, offset]),
        client.query(countQuery, [contactId])
      ]);

      transactions = salesResult.rows.map(row => ({ ...row, type: 'sale' }));
      totalCount = parseInt(countResult.rows[0].total);
    }

    // Calculate summary data
    const response = {
      transactions: transactions.map(transaction => ({
        ...transaction,
        amount: parseFloat(transaction.amount || 0),
        paidAmount: parseFloat(transaction.paidAmount || 0),
        remainingAmount: parseFloat(transaction.remainingAmount || 0),
        date: transaction.date
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      },
      balance: {
        currentBalance: Math.abs(portalCurrentBalance),
        currentBalanceType: portalCurrentBalanceType,
        openingBalance: parseFloat(contactBalance.openingBalance || 0),
        openingBalanceType: contactBalance.openingBalanceType,
        // Main panel balance (for reference)
        mainPanelBalance: mainPanelBalance,
        mainPanelBalanceType: mainPanelBalanceType // Use the calculated balance type as main panel balance type
      }
    };

    return successResponse(res, response);

  } catch (error) {
    console.error("Error getting contact transactions:", error);
    return errorResponse(res, "Error fetching contact transactions", 500);
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

    // First, let's check if the contact exists
    const contactCheck = await client.query(
      'SELECT id, name FROM hisab.contacts WHERE id = $1 AND "enablePortal" = true AND "deletedAt" IS NULL',
      [contactId]
    );

    if (contactCheck.rows.length === 0) {
      return errorResponse(res, "Contact not found or portal not enabled", 404);
    }

    // Use the same balance calculation function as main panel
    const { balance: mainPanelBalance, balanceType: mainPanelBalanceType } = await calculateContactCurrentBalance(client, contactId, req.currentUser.companyId);

    // Calculate portal perspective balance (SIMPLE REVERSE - just negate the result)
    // If calculateContactCurrentBalance returns +₹2000 → Portal shows -₹2000
    // If calculateContactCurrentBalance returns -₹2000 → Portal shows +₹2000
    const portalNetPosition = -mainPanelBalance;

    // Simple queries to check each table individually
    const salesCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM("netReceivable"), 0) as total FROM hisab.sales WHERE "contactId" = $1 AND "deletedAt" IS NULL',
      [contactId]
    );

    const purchasesCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM("netPayable"), 0) as total FROM hisab.purchases WHERE "contactId" = $1 AND "deletedAt" IS NULL',
      [contactId]
    );

    const incomesCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM("amount"), 0) as total FROM hisab.incomes WHERE "contactId" = $1',
      [contactId]
    );

    const expensesCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM("amount"), 0) as total FROM hisab.expenses WHERE "contactId" = $1',
      [contactId]
    );

    const paymentsCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM("amount"), 0) as total FROM hisab.payments WHERE "contactId" = $1 AND "deletedAt" IS NULL',
      [contactId]
    );

    // More detailed checks for paid and pending
    const salesPaidCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM("netReceivable"), 0) as total FROM hisab.sales WHERE "contactId" = $1 AND "status" = \'paid\' AND "deletedAt" IS NULL',
      [contactId]
    );

    const salesPendingCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM("netReceivable"), 0) as total FROM hisab.sales WHERE "contactId" = $1 AND "status" = \'pending\' AND "deletedAt" IS NULL',
      [contactId]
    );

    const purchasesPaidCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM("netPayable"), 0) as total FROM hisab.purchases WHERE "contactId" = $1 AND "status" = \'paid\' AND "deletedAt" IS NULL',
      [contactId]
    );

    const purchasesPendingCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM("netPayable"), 0) as total FROM hisab.purchases WHERE "contactId" = $1 AND "status" = \'pending\' AND "deletedAt" IS NULL',
      [contactId]
    );

    const incomesPaidCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM("amount"), 0) as total FROM hisab.incomes WHERE "contactId" = $1 AND "status" = \'paid\'',
      [contactId]
    );

    const incomesPendingCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM("amount"), 0) as total FROM hisab.incomes WHERE "contactId" = $1 AND "status" = \'pending\'',
      [contactId]
    );

    const expensesPaidCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM("amount"), 0) as total FROM hisab.expenses WHERE "contactId" = $1 AND "status" = \'paid\'',
      [contactId]
    );

    const expensesPendingCheck = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM("amount"), 0) as total FROM hisab.expenses WHERE "contactId" = $1 AND "status" = \'pending\'',
      [contactId]
    );

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



    // Get contact's current balance using the same function as main panel
    const { balance: mainPanelBalance, balanceType: mainPanelBalanceType } = await calculateContactCurrentBalance(client, contactId, req.currentUser.companyId);

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

    // Get payments received (Total Received - Payments)
    const paymentsQuery = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM hisab.payments 
      WHERE "contactId" = $1 AND "deletedAt" IS NULL
    `;
    const paymentsResult = await client.query(paymentsQuery, [contactId]);
    const paymentsReceived = parseFloat(paymentsResult.rows[0]?.total || 0);

    // Get paid expenses (Total Received - Expenses)
    const expensesPaidQuery = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM hisab.expenses 
      WHERE "contactId" = $1 AND status = 'paid'
    `;
    const expensesPaidResult = await client.query(expensesPaidQuery, [contactId]);
    const expensesPaid = parseFloat(expensesPaidResult.rows[0]?.total || 0);

    // Calculate Total Received
    const totalReceived = salesPaid + paymentsReceived - expensesPaid;

    // Get pending sales (Pending Receivable - Sales)
    const salesPendingQuery = `
      SELECT COALESCE(SUM("netReceivable"), 0) as total
      FROM hisab.sales 
      WHERE "contactId" = $1 AND status = 'pending' AND "deletedAt" IS NULL
    `;
    const salesPendingResult = await client.query(salesPendingQuery, [contactId]);
    const salesPending = parseFloat(salesPendingResult.rows[0]?.total || 0);

    // Get pending expenses (Pending Receivable - Expenses)
    const expensesPendingQuery = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM hisab.expenses 
      WHERE "contactId" = $1 AND status = 'pending'
    `;
    const expensesPendingResult = await client.query(expensesPendingQuery, [contactId]);
    const expensesPending = parseFloat(expensesPendingResult.rows[0]?.total || 0);

    // Calculate Pending Receivable
    const pendingReceivable = salesPending - expensesPending;

    // Get pending purchases (You Owe - Purchases)
    const purchasesPendingQuery = `
      SELECT COALESCE(SUM("netPayable"), 0) as total
      FROM hisab.purchases 
      WHERE "contactId" = $1 AND status = 'pending' AND "deletedAt" IS NULL
    `;
    const purchasesPendingResult = await client.query(purchasesPendingQuery, [contactId]);
    const purchasesPending = parseFloat(purchasesPendingResult.rows[0]?.total || 0);

    // Get pending incomes (You Owe - Incomes)
    const incomesPendingQuery = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM hisab.incomes 
      WHERE "contactId" = $1 AND status = 'pending'
    `;
    const incomesPendingResult = await client.query(incomesPendingQuery, [contactId]);
    const incomesPending = parseFloat(incomesPendingResult.rows[0]?.total || 0);

    // Calculate You Owe
    const youOwe = purchasesPending - incomesPending;

    const dashboardSummary = {
      totalReceived: totalReceived,
      pendingReceivable: pendingReceivable,
      youOwe: youOwe,
      netPosition: portalNetPosition,
      breakdown: {
        salesPaid,
        paymentsReceived,
        expensesPaid,
        salesPending,
        expensesPending,
        purchasesPending,
        incomesPending
      }
    };

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
        "openingBalance", "openingBalanceType",
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
        // UPDATED: currentBalance removed since we don't store it anymore
        // Balance is calculated real-time when needed
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
        "openingBalance", "openingBalanceType",
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
    const statsResult = await client.query(statsQuery, [contactId]);
    const stats = statsResult.rows[0];

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
    
    // Net balance calculation (from business perspective)
    let actualBalance = salesAndIncomes - purchasesAndExpenses - payments;
    
    // For portal perspective, we need to reverse the sign
    // If business shows customer owes +₹1000, portal should show customer owes -₹1000 (i.e., business owes customer ₹1000)
    const portalBalance = -actualBalance;
    
    // Get opening balance
    const openingBalance = parseFloat(contact.openingBalance || 0);
    const openingBalanceType = contact.openingBalanceType;

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
        currentBalance: Math.abs(portalBalance),
        currentBalanceType: portalBalance > 0 ? 'receivable' : portalBalance < 0 ? 'payable' : 'payable',
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