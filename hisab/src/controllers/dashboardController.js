import pool from "../config/dbConnection.js";
import { errorResponse, successResponse } from "../utils/index.js";

export async function getBusinessAnalytics(req, res) {
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;
  
  // Extract filter parameters
  const { startDate, endDate, status } = req.query;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    // Simple parameterized queries
    let params = [companyId];
    let paramIndex = 1;

    // 1. Financial Summary
    let salesConditions = 'WHERE "companyId" = $1 AND "deletedAt" IS NULL';
    let purchasesConditions = 'WHERE "companyId" = $1 AND "deletedAt" IS NULL';
    let expensesConditions = 'WHERE "companyId" = $1';
    let incomesConditions = 'WHERE "companyId" = $1';

    if (startDate) {
      paramIndex++;
      salesConditions += ` AND "invoiceDate" >= $${paramIndex}`;
      purchasesConditions += ` AND "invoiceDate" >= $${paramIndex}`;
      expensesConditions += ` AND "date" >= $${paramIndex}`;
      incomesConditions += ` AND "date" >= $${paramIndex}`;
      params.push(startDate);
    }

    if (endDate) {
      paramIndex++;
      salesConditions += ` AND "invoiceDate" <= $${paramIndex}`;
      purchasesConditions += ` AND "invoiceDate" <= $${paramIndex}`;
      expensesConditions += ` AND "date" <= $${paramIndex}`;
      incomesConditions += ` AND "date" <= $${paramIndex}`;
      params.push(endDate);
    }

    if (status && status !== 'all') {
      paramIndex++;
      salesConditions += ` AND status = $${paramIndex}`;
      purchasesConditions += ` AND status = $${paramIndex}`;
      expensesConditions += ` AND status = $${paramIndex}`;
      incomesConditions += ` AND status = $${paramIndex}`;
      params.push(status);
    }

    const financialSummaryQuery = `
      WITH sales_summary AS (
        SELECT 
          COALESCE(SUM("netReceivable"), 0) as total_sales,
          COALESCE(SUM("paid_amount"), 0) as sales_received,
          COALESCE(SUM("remaining_amount"), 0) as sales_pending,
          COUNT(id) as total_sales_count
        FROM hisab.sales
        ${salesConditions}
      ),
      purchase_summary AS (
        SELECT 
          COALESCE(SUM("netPayable"), 0) as total_purchases,
          COALESCE(SUM("paid_amount"), 0) as purchases_paid,
          COALESCE(SUM("remaining_amount"), 0) as purchases_pending,
          COUNT(id) as total_purchase_count
        FROM hisab.purchases
        ${purchasesConditions}
      ),
      expense_summary AS (
        SELECT 
          COALESCE(SUM(amount), 0) as total_expenses,
          COALESCE(SUM(paid_amount), 0) as expenses_paid,
          COALESCE(SUM(remaining_amount), 0) as expenses_pending,
          COUNT(id) as total_expense_count
        FROM hisab.expenses
        ${expensesConditions}
      ),
      income_summary AS (
        SELECT 
          COALESCE(SUM(amount), 0) as total_incomes,
          COALESCE(SUM(paid_amount), 0) as incomes_received,
          COALESCE(SUM(remaining_amount), 0) as incomes_pending,
          COUNT(id) as total_income_count
        FROM hisab.incomes
        ${incomesConditions}
      )
      SELECT 
        s.total_sales,
        s.sales_received,
        s.sales_pending,
        s.total_sales_count,
        p.total_purchases,
        p.purchases_paid,
        p.purchases_pending,
        p.total_purchase_count,
        e.total_expenses,
        e.expenses_paid,
        e.expenses_pending,
        e.total_expense_count,
        i.total_incomes,
        i.incomes_received,
        i.incomes_pending,
        i.total_income_count,
        (s.total_sales + i.total_incomes - p.total_purchases - e.total_expenses) as gross_profit,
        (s.sales_received + i.incomes_received - p.purchases_paid - e.expenses_paid) as net_cash_flow
      FROM sales_summary s, purchase_summary p, expense_summary e, income_summary i
    `;

    // 2. Top Products - Updated to use correct table and column names
    const topProductsQuery = `
      SELECT 
        p.id,
        p.name,
        p."itemCode",
        p.rate as current_rate,
        COALESCE(SUM(si.quantity), 0) as total_quantity_sold,
        COUNT(DISTINCT s.id) as invoice_count,
        -- Use lineTotal from sale_items table
        COALESCE(SUM(si."lineTotal"), 0) as total_sales_amount
      FROM hisab."products" p
      LEFT JOIN hisab.sale_items si ON p.id = si."productId"
      LEFT JOIN hisab.sales s ON si."saleId" = s.id AND s."deletedAt" IS NULL ${startDate || endDate || status ? `
        AND s."companyId" = $1 
        ${startDate ? `AND s."invoiceDate" >= $${params.indexOf(startDate) + 1}` : ''}
        ${endDate ? `AND s."invoiceDate" <= $${params.indexOf(endDate) + 1}` : ''}
        ${status && status !== 'all' ? `AND s.status = $${params.indexOf(status) + 1}` : ''}` : ''}
      WHERE p."companyId" = $1 AND p."deletedAt" IS NULL
      GROUP BY p.id, p.name, p."itemCode", p.rate
      HAVING COALESCE(SUM(si."lineTotal"), 0) > 0
      ORDER BY total_sales_amount DESC
      LIMIT 10
    `;

    // 3. Top Customers
    const topCustomersQuery = `
      SELECT 
        c.id,
        c.name,
        c.gstin,
        COALESCE(SUM(s."netReceivable"), 0) as total_sales,
        COALESCE(SUM(s."remaining_amount"), 0) as pending_amount,
        COUNT(s.id) as invoice_count
      FROM hisab.contacts c
      LEFT JOIN hisab.sales s ON c.id = s."contactId" AND s."deletedAt" IS NULL ${startDate || endDate || status ? `
        AND s."companyId" = $1 
        ${startDate ? `AND s."invoiceDate" >= $${params.indexOf(startDate) + 1}` : ''}
        ${endDate ? `AND s."invoiceDate" <= $${params.indexOf(endDate) + 1}` : ''}
        ${status && status !== 'all' ? `AND s.status = $${params.indexOf(status) + 1}` : ''}` : ''}
      WHERE c."companyId" = $1 
        AND c."contactType" = 'customer'
        AND c."deletedAt" IS NULL
      GROUP BY c.id, c.name, c.gstin
      HAVING COALESCE(SUM(s."netReceivable"), 0) > 0
      ORDER BY total_sales DESC
      LIMIT 10
    `;

    // 4. Bank Accounts - No filtering needed
    const bankSummaryQuery = `
      SELECT 
        ba.id,
        ba."accountName",
        ba."accountType",
        ba."currentBalance",
        ba."openingBalance",
        ba."isActive"
      FROM hisab."bankAccounts" ba
      WHERE ba."companyId" = $1 AND ba."deletedAt" IS NULL
      ORDER BY ba."currentBalance" DESC
    `;

    // 5. Outstanding Payments
    const outstandingQuery = `
      WITH outstanding_sales AS (
        SELECT 
          'sales' as type,
          s.id,
          s."invoiceNumber" as reference,
          s."invoiceDate" as date,
          c.name as contact_name,
          c.id as contact_id,
          s."remaining_amount" as amount,
          (CURRENT_DATE - s."invoiceDate"::date) as days_overdue
        FROM hisab.sales s
        LEFT JOIN hisab.contacts c ON s."contactId" = c.id
        WHERE s."companyId" = $1 AND s."deletedAt" IS NULL AND s."remaining_amount" > 0
          ${startDate ? `AND s."invoiceDate" >= $${params.indexOf(startDate) + 1}` : ''}
          ${endDate ? `AND s."invoiceDate" <= $${params.indexOf(endDate) + 1}` : ''}
          ${status && status !== 'all' ? `AND s.status = $${params.indexOf(status) + 1}` : ''}
      ),
      outstanding_purchases AS (
        SELECT 
          'purchases' as type,
          p.id,
          p."invoiceNumber" as reference,
          p."invoiceDate" as date,
          c.name as contact_name,
          c.id as contact_id,
          p."remaining_amount" as amount,
          (CURRENT_DATE - p."invoiceDate"::date) as days_overdue
        FROM hisab.purchases p
        LEFT JOIN hisab.contacts c ON p."contactId" = c.id
        WHERE p."companyId" = $1 AND p."deletedAt" IS NULL AND p."remaining_amount" > 0
          ${startDate ? `AND p."invoiceDate" >= $${params.indexOf(startDate) + 1}` : ''}
          ${endDate ? `AND p."invoiceDate" <= $${params.indexOf(endDate) + 1}` : ''}
          ${status && status !== 'all' ? `AND p.status = $${params.indexOf(status) + 1}` : ''}
      )
      SELECT * FROM outstanding_sales
      UNION ALL
      SELECT * FROM outstanding_purchases  
      ORDER BY amount DESC, days_overdue DESC
      LIMIT 20
    `;

    // Execute all queries
    const [
      financialResult,
      productsResult,
      customersResult,
      bankResult,
      outstandingResult
    ] = await Promise.all([
      client.query(financialSummaryQuery, params),
      client.query(topProductsQuery, params),
      client.query(topCustomersQuery, params),
      client.query(bankSummaryQuery, [companyId]),
      client.query(outstandingQuery, params)
    ]);

    const analytics = {
      financialSummary: financialResult.rows[0] || {},
      topProducts: productsResult.rows || [],
      topCustomers: customersResult.rows || [],
      bankAccounts: bankResult.rows || [],
      outstandingPayments: outstandingResult.rows || [],
      appliedFilters: { startDate, endDate, status }
    };

    return successResponse(res, {
      message: "Business analytics fetched successfully",
      analytics
    });

  } catch (error) {
    console.error('Error fetching business analytics:', error);
    return errorResponse(res, "Error fetching business analytics", 500);
  } finally {
    client.release();
  }
}

export async function getQuickStats(req, res) {
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    const quickStatsQuery = `
      WITH today_stats AS (
        SELECT 
          (SELECT COALESCE(SUM("netReceivable"), 0) FROM hisab.sales WHERE "companyId" = $1 AND "deletedAt" IS NULL AND "invoiceDate" = CURRENT_DATE) as today_sales,
          (SELECT COALESCE(SUM("netPayable"), 0) FROM hisab.purchases WHERE "companyId" = $1 AND "deletedAt" IS NULL AND "invoiceDate" = CURRENT_DATE) as today_purchases,
          (SELECT COALESCE(SUM(amount), 0) FROM hisab.expenses WHERE "companyId" = $1 AND "date" = CURRENT_DATE) as today_expenses,
          (SELECT COALESCE(SUM(amount), 0) FROM hisab.incomes WHERE "companyId" = $1 AND "date" = CURRENT_DATE) as today_incomes
      ),
      month_stats AS (
        SELECT 
          (SELECT COALESCE(SUM("netReceivable"), 0) FROM hisab.sales WHERE "companyId" = $1 AND "deletedAt" IS NULL AND DATE_TRUNC('month', "invoiceDate") = DATE_TRUNC('month', CURRENT_DATE)) as month_sales,
          (SELECT COALESCE(SUM("netPayable"), 0) FROM hisab.purchases WHERE "companyId" = $1 AND "deletedAt" IS NULL AND DATE_TRUNC('month', "invoiceDate") = DATE_TRUNC('month', CURRENT_DATE)) as month_purchases,
          (SELECT COALESCE(SUM(amount), 0) FROM hisab.expenses WHERE "companyId" = $1 AND DATE_TRUNC('month', "date") = DATE_TRUNC('month', CURRENT_DATE)) as month_expenses,
          (SELECT COALESCE(SUM(amount), 0) FROM hisab.incomes WHERE "companyId" = $1 AND DATE_TRUNC('month', "date") = DATE_TRUNC('month', CURRENT_DATE)) as month_incomes
      ),
      counts AS (
        SELECT 
          (SELECT COUNT(*) FROM hisab.sales WHERE "companyId" = $1 AND "deletedAt" IS NULL) as total_sales_invoices,
          (SELECT COUNT(*) FROM hisab.purchases WHERE "companyId" = $1 AND "deletedAt" IS NULL) as total_purchase_invoices,
          (SELECT COUNT(*) FROM hisab."products" WHERE "companyId" = $1 AND "deletedAt" IS NULL) as total_products,
          (SELECT COUNT(*) FROM hisab.contacts WHERE "companyId" = $1 AND "deletedAt" IS NULL) as total_contacts,
          (SELECT COUNT(*) FROM hisab."bankAccounts" WHERE "companyId" = $1 AND "deletedAt" IS NULL AND "isActive" = true) as active_bank_accounts
      ),
      total_bank_balance AS (
        SELECT COALESCE(SUM("currentBalance"), 0) as total_balance
        FROM hisab."bankAccounts" 
        WHERE "companyId" = $1 AND "deletedAt" IS NULL AND "isActive" = true
      )
      SELECT 
        t.*,
        m.*,
        c.*,
        b.total_balance
      FROM today_stats t, month_stats m, counts c, total_bank_balance b
    `;

    const result = await client.query(quickStatsQuery, [companyId]);

    return successResponse(res, {
      message: "Quick stats fetched successfully",
      stats: result.rows[0] || {}
    });

  } catch (error) {
    console.error('Error fetching quick stats:', error);
    return errorResponse(res, "Error fetching quick stats", 500);
  } finally {
    client.release();
  }
}

// Export dashboard data - NEW API
export async function exportDashboardData(req, res) {
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;
  const { format = 'csv', filters = {} } = req.query;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    // Get comprehensive dashboard data for export
    const exportQuery = `
      WITH sales_data AS (
        SELECT 
          'sales' as type,
          s."invoiceNumber" as reference,
          s."invoiceDate" as date,
          c.name as contact_name,
          s."netReceivable" as amount,
          s.status,
          s."paid_amount",
          s."remaining_amount"
        FROM hisab.sales s
        LEFT JOIN hisab.contacts c ON s."contactId" = c.id
        WHERE s."companyId" = $1 AND s."deletedAt" IS NULL
      ),
      purchase_data AS (
        SELECT 
          'purchases' as type,
          p."invoiceNumber" as reference,
          p."invoiceDate" as date,
          c.name as contact_name,
          p."netPayable" as amount,
          p.status,
          p."paid_amount",
          p."remaining_amount"
        FROM hisab.purchases p
        LEFT JOIN hisab.contacts c ON p."contactId" = c.id
        WHERE p."companyId" = $1 AND p."deletedAt" IS NULL
      ),
      expense_data AS (
        SELECT 
          'expenses' as type,
          'EXP-' || e.id as reference,
          e."date",
          c.name as contact_name,
          e.amount,
          e.status,
          e."paid_amount",
          e."remaining_amount"
        FROM hisab.expenses e
        LEFT JOIN hisab.contacts c ON e."contactId" = c.id
        WHERE e."companyId" = $1
      ),
      income_data AS (
        SELECT 
          'incomes' as type,
          'INC-' || i.id as reference,
          i."date",
          c.name as contact_name,
          i.amount,
          i.status,
          i."paid_amount",
          i."remaining_amount"
        FROM hisab.incomes i
        LEFT JOIN hisab.contacts c ON i."contactId" = c.id
        WHERE i."companyId" = $1
      )
      SELECT * FROM sales_data
      UNION ALL
      SELECT * FROM purchase_data
      UNION ALL
      SELECT * FROM expense_data
      UNION ALL
      SELECT * FROM income_data
      ORDER BY date DESC
    `;

    const result = await client.query(exportQuery, [companyId]);

    return successResponse(res, {
      message: "Dashboard data exported successfully",
      data: result.rows,
      format: format,
      exportedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error exporting dashboard data:', error);
    return errorResponse(res, "Error exporting dashboard data", 500);
  } finally {
    client.release();
  }
} 