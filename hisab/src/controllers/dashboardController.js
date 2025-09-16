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

// Get comprehensive chart data
export async function getChartData(req, res) {
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;
  const { startDate, endDate, period = '6months' } = req.query;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    // Get date range based on period
    let dateCondition = '';
    let params = [companyId];
    
    if (period === '6months') {
      dateCondition = `AND "invoiceDate" >= CURRENT_DATE - INTERVAL '6 months'`;
    } else if (period === '1year') {
      dateCondition = `AND "invoiceDate" >= CURRENT_DATE - INTERVAL '1 year'`;
    } else if (startDate && endDate) {
      dateCondition = `AND "invoiceDate" BETWEEN $2 AND $3`;
      params.push(startDate, endDate);
    }

    // Monthly revenue trend data
    const revenueQuery = `
      WITH months AS (
        SELECT 
          DATE_TRUNC('month', generate_series(
            DATE_TRUNC('month', CURRENT_DATE - INTERVAL '6 months'),
            DATE_TRUNC('month', CURRENT_DATE),
            '1 month'::interval
          )) AS month
      ),
      sales_data AS (
        SELECT 
          DATE_TRUNC('month', "invoiceDate") as month,
          SUM("netReceivable") as sales,
          SUM("paid_amount") as sales_paid
        FROM hisab.sales 
        WHERE "companyId" = $1 AND "deletedAt" IS NULL ${dateCondition}
        GROUP BY DATE_TRUNC('month', "invoiceDate")
      ),
      purchase_data AS (
        SELECT 
          DATE_TRUNC('month', "invoiceDate") as month,
          SUM("netPayable") as purchases,
          SUM("paid_amount") as purchases_paid
        FROM hisab.purchases 
        WHERE "companyId" = $1 AND "deletedAt" IS NULL ${dateCondition}
        GROUP BY DATE_TRUNC('month', "invoiceDate")
      ),
      expense_data AS (
        SELECT 
          DATE_TRUNC('month', "date") as month,
          SUM(amount) as expenses
        FROM hisab.expenses 
        WHERE "companyId" = $1 ${dateCondition.replace('"invoiceDate"', '"date"')}
        GROUP BY DATE_TRUNC('month', "date")
      ),
      income_data AS (
        SELECT 
          DATE_TRUNC('month', "date") as month,
          SUM(amount) as incomes
        FROM hisab.incomes 
        WHERE "companyId" = $1 ${dateCondition.replace('"invoiceDate"', '"date"')}
        GROUP BY DATE_TRUNC('month', "date")
      )
      SELECT 
        m.month,
        COALESCE(s.sales, 0) as sales,
        COALESCE(p.purchases, 0) as purchases,
        COALESCE(e.expenses, 0) as expenses,
        COALESCE(i.incomes, 0) as incomes,
        COALESCE(s.sales, 0) + COALESCE(i.incomes, 0) - COALESCE(p.purchases, 0) - COALESCE(e.expenses, 0) as profit
      FROM months m
      LEFT JOIN sales_data s ON m.month = s.month
      LEFT JOIN purchase_data p ON m.month = p.month
      LEFT JOIN expense_data e ON m.month = e.month
      LEFT JOIN income_data i ON m.month = i.month
      ORDER BY m.month
    `;

    // Payment status distribution
    const paymentStatusQuery = `
      WITH payment_stats AS (
        SELECT 
          COUNT(CASE WHEN "remaining_amount" = 0 THEN 1 END) as paid_count,
          COUNT(CASE WHEN "remaining_amount" > 0 AND "invoiceDate" >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as pending_count,
          COUNT(CASE WHEN "remaining_amount" > 0 AND "invoiceDate" < CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as overdue_count
        FROM (
          SELECT "remaining_amount", "invoiceDate" FROM hisab.sales WHERE "companyId" = $1 AND "deletedAt" IS NULL
          UNION ALL
          SELECT "remaining_amount", "invoiceDate" FROM hisab.purchases WHERE "companyId" = $1 AND "deletedAt" IS NULL
        ) combined
      )
      SELECT paid_count, pending_count, overdue_count FROM payment_stats
    `;

    // Top products performance
    const topProductsQuery = `
      SELECT 
        p.name,
        COALESCE(SUM(si."lineTotal"), 0) as revenue,
        COALESCE(SUM(si.quantity), 0) as quantity
      FROM hisab."products" p
      LEFT JOIN hisab.sale_items si ON p.id = si."productId"
      LEFT JOIN hisab.sales s ON si."saleId" = s.id AND s."deletedAt" IS NULL AND s."companyId" = $1
      WHERE p."companyId" = $1 AND p."deletedAt" IS NULL
      GROUP BY p.id, p.name
      HAVING COALESCE(SUM(si."lineTotal"), 0) > 0
      ORDER BY revenue DESC
      LIMIT 5
    `;

    // Execute queries
    const [revenueResult, paymentStatusResult, topProductsResult] = await Promise.all([
      client.query(revenueQuery, params),
      client.query(paymentStatusQuery, [companyId]),
      client.query(topProductsQuery, [companyId])
    ]);

    const chartData = {
      revenueTrend: {
        labels: revenueResult.rows.map(row => new Date(row.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })),
        salesData: revenueResult.rows.map(row => parseFloat(row.sales) || 0),
        purchasesData: revenueResult.rows.map(row => parseFloat(row.purchases) || 0),
        profitData: revenueResult.rows.map(row => parseFloat(row.profit) || 0),
        expensesData: revenueResult.rows.map(row => parseFloat(row.expenses) || 0),
        incomesData: revenueResult.rows.map(row => parseFloat(row.incomes) || 0)
      },
      paymentStatus: {
        labels: ['Paid', 'Pending', 'Overdue'],
        values: [
          parseInt(paymentStatusResult.rows[0]?.paid_count) || 0,
          parseInt(paymentStatusResult.rows[0]?.pending_count) || 0,
          parseInt(paymentStatusResult.rows[0]?.overdue_count) || 0
        ]
      },
      topProducts: {
        labels: topProductsResult.rows.map(row => row.name),
        revenue: topProductsResult.rows.map(row => parseFloat(row.revenue) || 0),
        quantity: topProductsResult.rows.map(row => parseFloat(row.quantity) || 0)
      }
    };

    return successResponse(res, {
      message: "Chart data fetched successfully",
      chartData,
      period,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching chart data:', error);
    return errorResponse(res, "Error fetching chart data", 500);
  } finally {
    client.release();
  }
}

// Get revenue chart data
export async function getRevenueChartData(req, res) {
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    const query = `
      WITH monthly_data AS (
        SELECT 
          DATE_TRUNC('month', generate_series(
            DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months'),
            DATE_TRUNC('month', CURRENT_DATE),
            '1 month'::interval
          )) AS month
      ),
      current_year AS (
        SELECT 
          DATE_TRUNC('month', "invoiceDate") as month,
          SUM("netReceivable") as amount
        FROM hisab.sales 
        WHERE "companyId" = $1 AND "deletedAt" IS NULL 
          AND "invoiceDate" >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', "invoiceDate")
      ),
      last_year AS (
        SELECT 
          DATE_TRUNC('month', "invoiceDate" + INTERVAL '1 year') as month,
          SUM("netReceivable") as amount
        FROM hisab.sales 
        WHERE "companyId" = $1 AND "deletedAt" IS NULL 
          AND "invoiceDate" >= CURRENT_DATE - INTERVAL '24 months'
          AND "invoiceDate" < CURRENT_DATE - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', "invoiceDate" + INTERVAL '1 year')
      )
      SELECT 
        TO_CHAR(m.month, 'Mon') as month_name,
        COALESCE(c.amount, 0) as current_year,
        COALESCE(l.amount, 0) as last_year
      FROM monthly_data m
      LEFT JOIN current_year c ON m.month = c.month
      LEFT JOIN last_year l ON m.month = l.month
      ORDER BY m.month
    `;

    const result = await client.query(query, [companyId]);

    return successResponse(res, {
      message: "Revenue chart data fetched successfully",
      data: {
        labels: result.rows.map(row => row.month_name),
        currentYear: result.rows.map(row => parseFloat(row.current_year) || 0),
        lastYear: result.rows.map(row => parseFloat(row.last_year) || 0)
      }
    });

  } catch (error) {
    console.error('Error fetching revenue chart data:', error);
    return errorResponse(res, "Error fetching revenue chart data", 500);
  } finally {
    client.release();
  }
}

// Get cash flow chart data
export async function getCashFlowChartData(req, res) {
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    const query = `
      WITH months AS (
        SELECT 
          DATE_TRUNC('month', generate_series(
            DATE_TRUNC('month', CURRENT_DATE - INTERVAL '6 months'),
            DATE_TRUNC('month', CURRENT_DATE),
            '1 month'::interval
          )) AS month
      ),
      inflows AS (
        SELECT 
          DATE_TRUNC('month', "invoiceDate") as month,
          SUM("paid_amount") as amount
        FROM hisab.sales 
        WHERE "companyId" = $1 AND "deletedAt" IS NULL 
          AND "invoiceDate" >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', "invoiceDate")
        
        UNION ALL
        
        SELECT 
          DATE_TRUNC('month', "date") as month,
          SUM("paid_amount") as amount
        FROM hisab.incomes 
        WHERE "companyId" = $1 
          AND "date" >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', "date")
      ),
      outflows AS (
        SELECT 
          DATE_TRUNC('month', "invoiceDate") as month,
          SUM("paid_amount") as amount
        FROM hisab.purchases 
        WHERE "companyId" = $1 AND "deletedAt" IS NULL 
          AND "invoiceDate" >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', "invoiceDate")
        
        UNION ALL
        
        SELECT 
          DATE_TRUNC('month', "date") as month,
          SUM("paid_amount") as amount
        FROM hisab.expenses 
        WHERE "companyId" = $1 
          AND "date" >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', "date")
      ),
      aggregated_inflows AS (
        SELECT month, SUM(amount) as total_inflow
        FROM inflows
        GROUP BY month
      ),
      aggregated_outflows AS (
        SELECT month, SUM(amount) as total_outflow
        FROM outflows
        GROUP BY month
      )
      SELECT 
        TO_CHAR(m.month, 'Mon YYYY') as month_name,
        COALESCE(i.total_inflow, 0) as inflow,
        COALESCE(o.total_outflow, 0) as outflow
      FROM months m
      LEFT JOIN aggregated_inflows i ON m.month = i.month
      LEFT JOIN aggregated_outflows o ON m.month = o.month
      ORDER BY m.month
    `;

    const result = await client.query(query, [companyId]);

    return successResponse(res, {
      message: "Cash flow chart data fetched successfully",
      data: {
        labels: result.rows.map(row => row.month_name),
        inflows: result.rows.map(row => parseFloat(row.inflow) || 0),
        outflows: result.rows.map(row => parseFloat(row.outflow) || 0)
      }
    });

  } catch (error) {
    console.error('Error fetching cash flow chart data:', error);
    return errorResponse(res, "Error fetching cash flow chart data", 500);
  } finally {
    client.release();
  }
}

// Get payment status chart data
export async function getPaymentStatusChartData(req, res) {
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    const query = `
      WITH payment_analysis AS (
        SELECT 
          'Sales' as category,
          COUNT(CASE WHEN "remaining_amount" = 0 THEN 1 END) as paid,
          COUNT(CASE WHEN "remaining_amount" > 0 AND "invoiceDate" >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as pending,
          COUNT(CASE WHEN "remaining_amount" > 0 AND "invoiceDate" < CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as overdue
        FROM hisab.sales 
        WHERE "companyId" = $1 AND "deletedAt" IS NULL
        
        UNION ALL
        
        SELECT 
          'Purchases' as category,
          COUNT(CASE WHEN "remaining_amount" = 0 THEN 1 END) as paid,
          COUNT(CASE WHEN "remaining_amount" > 0 AND "invoiceDate" >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as pending,
          COUNT(CASE WHEN "remaining_amount" > 0 AND "invoiceDate" < CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as overdue
        FROM hisab.purchases 
        WHERE "companyId" = $1 AND "deletedAt" IS NULL
      )
      SELECT 
        SUM(paid) as total_paid,
        SUM(pending) as total_pending,
        SUM(overdue) as total_overdue
      FROM payment_analysis
    `;

    const result = await client.query(query, [companyId]);
    const row = result.rows[0];

    return successResponse(res, {
      message: "Payment status chart data fetched successfully",
      data: {
        labels: ['Paid', 'Pending', 'Overdue'],
        values: [
          parseInt(row.total_paid) || 0,
          parseInt(row.total_pending) || 0,
          parseInt(row.total_overdue) || 0
        ]
      }
    });

  } catch (error) {
    console.error('Error fetching payment status chart data:', error);
    return errorResponse(res, "Error fetching payment status chart data", 500);
  } finally {
    client.release();
  }
}

// Get monthly trends data
export async function getMonthlyTrendsData(req, res) {
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    const query = `
      WITH quarterly_data AS (
        SELECT 
          EXTRACT(QUARTER FROM "invoiceDate") as quarter,
          'Q' || EXTRACT(QUARTER FROM "invoiceDate") as quarter_label,
          SUM("netReceivable") as sales,
          COUNT(*) as sales_count
        FROM hisab.sales 
        WHERE "companyId" = $1 AND "deletedAt" IS NULL 
          AND "invoiceDate" >= DATE_TRUNC('year', CURRENT_DATE)
        GROUP BY EXTRACT(QUARTER FROM "invoiceDate")
      ),
      customer_growth AS (
        SELECT 
          EXTRACT(QUARTER FROM "createdAt") as quarter,
          COUNT(*) as new_customers
        FROM hisab.contacts 
        WHERE "companyId" = $1 AND "deletedAt" IS NULL 
          AND "contactType" = 'customer'
          AND "createdAt" >= DATE_TRUNC('year', CURRENT_DATE)
        GROUP BY EXTRACT(QUARTER FROM "createdAt")
      ),
      product_performance AS (
        SELECT 
          EXTRACT(QUARTER FROM s."invoiceDate") as quarter,
          COUNT(DISTINCT si."productId") as products_sold
        FROM hisab.sale_items si
        JOIN hisab.sales s ON si."saleId" = s.id
        WHERE s."companyId" = $1 AND s."deletedAt" IS NULL 
          AND s."invoiceDate" >= DATE_TRUNC('year', CURRENT_DATE)
        GROUP BY EXTRACT(QUARTER FROM s."invoiceDate")
      )
      SELECT 
        q.quarter_label,
        COALESCE(q.sales, 0) as revenue,
        COALESCE(c.new_customers, 0) as customer_growth,
        COALESCE(p.products_sold, 0) as product_sales
      FROM quarterly_data q
      LEFT JOIN customer_growth c ON q.quarter = c.quarter
      LEFT JOIN product_performance p ON q.quarter = p.quarter
      ORDER BY q.quarter
    `;

    const result = await client.query(query, [companyId]);

    return successResponse(res, {
      message: "Monthly trends data fetched successfully",
      data: {
        categories: result.rows.map(row => row.quarter_label),
        revenueGrowth: result.rows.map(row => parseFloat(row.revenue) || 0),
        customerGrowth: result.rows.map(row => parseInt(row.customer_growth) || 0),
        productSales: result.rows.map(row => parseInt(row.product_sales) || 0)
      }
    });

  } catch (error) {
    console.error('Error fetching monthly trends data:', error);
    return errorResponse(res, "Error fetching monthly trends data", 500);
  } finally {
    client.release();
  }
}

// Get dashboard insights and recommendations
export async function getDashboardInsights(req, res) {
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    const insightsQuery = `
      WITH current_month AS (
        SELECT 
          COALESCE(SUM("netReceivable"), 0) as current_sales
        FROM hisab.sales 
        WHERE "companyId" = $1 AND "deletedAt" IS NULL
          AND DATE_TRUNC('month', "invoiceDate") = DATE_TRUNC('month', CURRENT_DATE)
      ),
      last_month AS (
        SELECT 
          COALESCE(SUM("netReceivable"), 0) as last_sales
        FROM hisab.sales 
        WHERE "companyId" = $1 AND "deletedAt" IS NULL
          AND DATE_TRUNC('month', "invoiceDate") = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
      ),
      overdue_analysis AS (
        SELECT 
          COUNT(*) as overdue_count,
          COALESCE(SUM("remaining_amount"), 0) as overdue_amount
        FROM (
          SELECT "remaining_amount" FROM hisab.sales 
          WHERE "companyId" = $1 AND "deletedAt" IS NULL 
            AND "remaining_amount" > 0 AND "invoiceDate" < CURRENT_DATE - INTERVAL '30 days'
          UNION ALL
          SELECT "remaining_amount" FROM hisab.purchases 
          WHERE "companyId" = $1 AND "deletedAt" IS NULL 
            AND "remaining_amount" > 0 AND "invoiceDate" < CURRENT_DATE - INTERVAL '30 days'
        ) overdue_items
      ),
      top_customer AS (
        SELECT c.name as top_customer_name, SUM(s."netReceivable") as total_amount
        FROM hisab.contacts c
        JOIN hisab.sales s ON c.id = s."contactId"
        WHERE c."companyId" = $1 AND c."contactType" = 'customer' 
          AND c."deletedAt" IS NULL AND s."deletedAt" IS NULL
          AND s."invoiceDate" >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '3 months')
        GROUP BY c.id, c.name
        ORDER BY total_amount DESC
        LIMIT 1
      )
      SELECT 
        cm.current_sales,
        lm.last_sales,
        oa.overdue_count,
        oa.overdue_amount,
        tc.top_customer_name,
        CASE 
          WHEN lm.last_sales > 0 THEN ROUND(((cm.current_sales - lm.last_sales) / lm.last_sales) * 100, 2)
          ELSE 0
        END as sales_growth_percentage,
        CASE 
          WHEN oa.overdue_count > 5 THEN 'high'
          WHEN oa.overdue_count > 2 THEN 'medium'
          ELSE 'low'
        END as overdue_risk_level
      FROM current_month cm, last_month lm, overdue_analysis oa, top_customer tc
    `;

    const result = await client.query(insightsQuery, [companyId]);
    const insights = result.rows[0];

    // Generate recommendations based on data
    const recommendations = [];
    
    if (parseFloat(insights.sales_growth_percentage) < 0) {
      recommendations.push({
        type: 'warning',
        title: 'Sales Declining',
        message: 'Sales have decreased compared to last month. Consider reviewing your sales strategy.',
        action: 'Review Sales Performance',
        icon: '📉'
      });
    } else if (parseFloat(insights.sales_growth_percentage) > 10) {
      recommendations.push({
        type: 'success',
        title: 'Strong Sales Growth',
        message: `Sales increased by ${insights.sales_growth_percentage}% this month. Great job!`,
        action: 'Maintain Momentum',
        icon: '📈'
      });
    }

    if (insights.overdue_risk_level === 'high') {
      recommendations.push({
        type: 'danger',
        title: 'High Overdue Risk',
        message: `You have ${insights.overdue_count} overdue payments totaling ₹${parseFloat(insights.overdue_amount).toLocaleString('en-IN')}.`,
        action: 'Follow Up on Payments',
        icon: '⚠️'
      });
    }

    if (insights.top_customer_name) {
      recommendations.push({
        type: 'info',
        title: 'Top Performing Customer',
        message: `${insights.top_customer_name} is your top customer this quarter.`,
        action: 'Strengthen Relationship',
        icon: '⭐'
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        type: 'success',
        title: 'Business Health Good',
        message: 'Your business metrics are looking healthy. Keep up the good work!',
        action: 'Continue Current Strategy',
        icon: '✅'
      });
    }

    return successResponse(res, {
      message: "Dashboard insights fetched successfully",
      insights: {
        salesGrowth: parseFloat(insights.sales_growth_percentage) || 0,
        overdueRisk: insights.overdue_risk_level,
        topCustomer: insights.top_customer_name,
        overdueCount: parseInt(insights.overdue_count) || 0,
        overdueAmount: parseFloat(insights.overdue_amount) || 0,
        currentSales: parseFloat(insights.current_sales) || 0,
        lastMonthSales: parseFloat(insights.last_sales) || 0
      },
      recommendations
    });

  } catch (error) {
    console.error('Error fetching dashboard insights:', error);
    return errorResponse(res, "Error fetching dashboard insights", 500);
  } finally {
    client.release();
  }
}

// Get recent activities for dashboard
export async function getRecentActivities(req, res) {
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    const activitiesQuery = `
      WITH recent_sales AS (
        SELECT 
          'sale' as activity_type,
          s."invoiceNumber" as reference,
          s."invoiceDate" as activity_date,
          c.name as contact_name,
          s."netReceivable" as amount,
          s.status,
          s."createdAt" as created_at
        FROM hisab.sales s
        LEFT JOIN hisab.contacts c ON s."contactId" = c.id
        WHERE s."companyId" = $1 AND s."deletedAt" IS NULL
        ORDER BY s."createdAt" DESC
        LIMIT 5
      ),
      recent_purchases AS (
        SELECT 
          'purchase' as activity_type,
          p."invoiceNumber" as reference,
          p."invoiceDate" as activity_date,
          c.name as contact_name,
          p."netPayable" as amount,
          p.status,
          p."createdAt" as created_at
        FROM hisab.purchases p
        LEFT JOIN hisab.contacts c ON p."contactId" = c.id
        WHERE p."companyId" = $1 AND p."deletedAt" IS NULL
        ORDER BY p."createdAt" DESC
        LIMIT 5
      ),
      recent_payments AS (
        SELECT 
          'payment' as activity_type,
          'PAY-' || pay.id as reference,
          pay."date" as activity_date,
          c.name as contact_name,
          pay.amount,
          'completed' as status,
          pay."createdAt" as created_at
        FROM hisab.payments pay
        LEFT JOIN hisab.contacts c ON pay."contactId" = c.id
        WHERE pay."companyId" = $1 AND pay."deletedAt" IS NULL
        ORDER BY pay."createdAt" DESC
        LIMIT 5
      )
      SELECT * FROM recent_sales
      UNION ALL
      SELECT * FROM recent_purchases
      UNION ALL
      SELECT * FROM recent_payments
      ORDER BY created_at DESC
      LIMIT 15
    `;

    const result = await client.query(activitiesQuery, [companyId]);

    return successResponse(res, {
      message: "Recent activities fetched successfully",
      activities: result.rows.map(activity => ({
        ...activity,
        amount: parseFloat(activity.amount) || 0,
        timeAgo: getTimeAgo(activity.created_at)
      }))
    });

  } catch (error) {
    console.error('Error fetching recent activities:', error);
    return errorResponse(res, "Error fetching recent activities", 500);
  } finally {
    client.release();
  }
}

// Helper function to calculate time ago
function getTimeAgo(date) {
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now - past) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  return `${Math.floor(diffInSeconds / 2592000)} months ago`;
} 