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

    // 2. Top Products - Simple fixed calculation
    const topProductsQuery = `
      SELECT 
        p.id,
        p.name,
        p."itemCode",
        p.rate as current_rate,
        COALESCE(SUM(si.quantity), 0) as total_quantity_sold,
        COUNT(DISTINCT s.id) as invoice_count,
        -- For single product invoices: use netReceivable, for multi: use line total
        COALESCE(SUM(
          CASE 
            WHEN (SELECT COUNT(*) FROM hisab.sale_items si2 WHERE si2."saleId" = s.id) = 1
            THEN s."netReceivable"
            ELSE si.total
          END
        ), 0) as total_sales_amount
      FROM hisab.products p
      LEFT JOIN hisab.sale_items si ON p.id = si."productId"
      LEFT JOIN hisab.sales s ON si."saleId" = s.id AND s."deletedAt" IS NULL ${startDate || endDate || status ? `
        AND s."companyId" = $1 
        ${startDate ? `AND s."invoiceDate" >= $${params.indexOf(startDate) + 1}` : ''}
        ${endDate ? `AND s."invoiceDate" <= $${params.indexOf(endDate) + 1}` : ''}
        ${status && status !== 'all' ? `AND s.status = $${params.indexOf(status) + 1}` : ''}` : ''}
      WHERE p."companyId" = $1 AND p."deletedAt" IS NULL
      GROUP BY p.id, p.name, p."itemCode", p.rate
      HAVING COALESCE(SUM(
        CASE 
          WHEN (SELECT COUNT(*) FROM hisab.sale_items si2 WHERE si2."saleId" = s.id) = 1
          THEN s."netReceivable"
          ELSE si.total
        END
      ), 0) > 0
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

export async function getCashFlowAnalytics(req, res) {
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;
  const { period = '6months' } = req.query;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    let dateCondition = '';
    switch (period) {
      case '3months':
        dateCondition = "AND date >= CURRENT_DATE - INTERVAL '3 months'";
        break;
      case '6months':
        dateCondition = "AND date >= CURRENT_DATE - INTERVAL '6 months'";
        break;
      case '1year':
        dateCondition = "AND date >= CURRENT_DATE - INTERVAL '1 year'";
        break;
      default:
        dateCondition = "AND date >= CURRENT_DATE - INTERVAL '6 months'";
    }

    const cashFlowQuery = `
      WITH cash_inflows AS (
        -- Sales receipts
        SELECT 
          DATE_TRUNC('month', s."invoiceDate") as month,
          'sales' as source,
          COALESCE(SUM(s."paid_amount"), 0) as amount
        FROM hisab.sales s
        WHERE s."companyId" = $1 
          AND s."deletedAt" IS NULL 
          ${dateCondition.replace('date', 's."invoiceDate"')}
        GROUP BY DATE_TRUNC('month', s."invoiceDate")
        
        UNION ALL
        
        -- Income receipts
        SELECT 
          DATE_TRUNC('month', i."date") as month,
          'incomes' as source,
          COALESCE(SUM(i."paid_amount"), 0) as amount
        FROM hisab.incomes i
        WHERE i."companyId" = $1 
          ${dateCondition.replace('date', 'i."date"')}
        GROUP BY DATE_TRUNC('month', i."date")
        
        UNION ALL
        
        -- Payments received
        SELECT 
          DATE_TRUNC('month', p."date") as month,
          'receipts' as source,
          COALESCE(SUM(CASE WHEN p."paymentType" = 'receipt' THEN p.amount END), 0) as amount
        FROM hisab.payments p
        WHERE p."companyId" = $1 
          AND p."deletedAt" IS NULL 
          ${dateCondition.replace('date', 'p."date"')}
        GROUP BY DATE_TRUNC('month', p."date")
      ),
      cash_outflows AS (
        -- Purchase payments
        SELECT 
          DATE_TRUNC('month', p."invoiceDate") as month,
          'purchases' as source,
          COALESCE(SUM(p."paid_amount"), 0) as amount
        FROM hisab.purchases p
        WHERE p."companyId" = $1 
          AND p."deletedAt" IS NULL 
          ${dateCondition.replace('date', 'p."invoiceDate"')}
        GROUP BY DATE_TRUNC('month', p."invoiceDate")
        
        UNION ALL
        
        -- Expense payments
        SELECT 
          DATE_TRUNC('month', e."date") as month,
          'expenses' as source,
          COALESCE(SUM(e."paid_amount"), 0) as amount
        FROM hisab.expenses e
        WHERE e."companyId" = $1 
          ${dateCondition.replace('date', 'e."date"')}
        GROUP BY DATE_TRUNC('month', e."date")
        
        UNION ALL
        
        -- Payments made
        SELECT 
          DATE_TRUNC('month', p."date") as month,
          'payments' as source,
          COALESCE(SUM(CASE WHEN p."paymentType" = 'payment' THEN p.amount END), 0) as amount
        FROM hisab.payments p
        WHERE p."companyId" = $1 
          AND p."deletedAt" IS NULL 
          ${dateCondition.replace('date', 'p."date"')}
        GROUP BY DATE_TRUNC('month', p."date")
      ),
      combined_flow AS (
        SELECT month, 'inflow' as type, source, amount FROM cash_inflows WHERE amount > 0
        UNION ALL
        SELECT month, 'outflow' as type, source, amount FROM cash_outflows WHERE amount > 0
      )
      SELECT 
        month,
        COALESCE(SUM(CASE WHEN type = 'inflow' THEN amount END), 0) as total_inflow,
        COALESCE(SUM(CASE WHEN type = 'outflow' THEN amount END), 0) as total_outflow,
        (COALESCE(SUM(CASE WHEN type = 'inflow' THEN amount END), 0) - 
         COALESCE(SUM(CASE WHEN type = 'outflow' THEN amount END), 0)) as net_flow,
        json_agg(
          json_build_object('source', source, 'type', type, 'amount', amount)
        ) FILTER (WHERE amount > 0) as details
      FROM combined_flow
      GROUP BY month
      ORDER BY month
    `;

    const cashFlowResult = await client.query(cashFlowQuery, [companyId]);

    return successResponse(res, {
      message: "Cash flow analytics fetched successfully",
      cashFlow: cashFlowResult.rows || []
    });

  } catch (error) {
    console.error('Error fetching cash flow analytics:', error);
    return errorResponse(res, "Error fetching cash flow analytics", 500);
  } finally {
    client.release();
  }
}

export async function getProductPerformance(req, res) {
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;
  const { period = '3months' } = req.query;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    let dateCondition = '';
    switch (period) {
      case '1month':
        dateCondition = "AND s.\"invoiceDate\" >= CURRENT_DATE - INTERVAL '1 month'";
        break;
      case '3months':
        dateCondition = "AND s.\"invoiceDate\" >= CURRENT_DATE - INTERVAL '3 months'";
        break;
      case '6months':
        dateCondition = "AND s.\"invoiceDate\" >= CURRENT_DATE - INTERVAL '6 months'";
        break;
      case '1year':
        dateCondition = "AND s.\"invoiceDate\" >= CURRENT_DATE - INTERVAL '1 year'";
        break;
    }

    const productPerformanceQuery = `
      WITH product_sales AS (
        SELECT 
          p.id,
          p.name,
          p."itemCode",
          p."itemType",
          p.rate as current_rate,
          p."currentStock",
          sc.name as category_name,
          COALESCE(SUM(si.quantity), 0) as total_quantity_sold,
          COALESCE(SUM(si.total), 0) as total_revenue,
          COALESCE(AVG(si.rate), 0) as avg_selling_price,
          COUNT(DISTINCT s.id) as transaction_count,
          MAX(s."invoiceDate") as last_sale_date
        FROM hisab.products p
        LEFT JOIN hisab.sale_items si ON p.id = si."productId"
        LEFT JOIN hisab.sales s ON si."saleId" = s.id AND s."deletedAt" IS NULL ${dateCondition}
        LEFT JOIN hisab."stockCategories" sc ON p."stockCategoryId" = sc.id
        WHERE p."companyId" = $1 AND p."deletedAt" IS NULL
        GROUP BY p.id, p.name, p."itemCode", p."itemType", p.rate, p."currentStock", sc.name
      ),
      product_purchases AS (
        SELECT 
          p.id,
          COALESCE(SUM(pi.total), 0) as total_cost,
          COALESCE(AVG(pi.rate), 0) as avg_purchase_price
        FROM hisab.products p
        LEFT JOIN hisab.purchase_items pi ON p.id = pi."productId"
        LEFT JOIN hisab.purchases pu ON pi."purchaseId" = pu.id AND pu."deletedAt" IS NULL ${dateCondition.replace('s."invoiceDate"', 'pu."invoiceDate"')}
        WHERE p."companyId" = $1 AND p."deletedAt" IS NULL
        GROUP BY p.id
      )
      SELECT 
        ps.*,
        pp.total_cost,
        pp.avg_purchase_price,
        CASE 
          WHEN pp.total_cost > 0 THEN ps.total_revenue - pp.total_cost
          ELSE ps.total_revenue
        END as profit,
        CASE 
          WHEN pp.total_cost > 0 AND ps.total_revenue > 0 
          THEN ((ps.total_revenue - pp.total_cost) / ps.total_revenue * 100)
          ELSE 0
        END as profit_margin_percentage
      FROM product_sales ps
      LEFT JOIN product_purchases pp ON ps.id = pp.id
      ORDER BY ps.total_revenue DESC
    `;

    const productResult = await client.query(productPerformanceQuery, [companyId]);

    return successResponse(res, {
      message: "Product performance analytics fetched successfully",
      products: productResult.rows || []
    });

  } catch (error) {
    console.error('Error fetching product performance:', error);
    return errorResponse(res, "Error fetching product performance", 500);
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
          (SELECT COUNT(*) FROM hisab.products WHERE "companyId" = $1 AND "deletedAt" IS NULL) as total_products,
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

// Get filter options for the dashboard
export async function getDashboardFilters(req, res) {
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    const filtersQuery = `
      WITH date_ranges AS (
        SELECT 
          MIN(earliest_date) as earliest_transaction,
          MAX(latest_date) as latest_transaction
        FROM (
          SELECT MIN("invoiceDate") as earliest_date, MAX("invoiceDate") as latest_date FROM hisab.sales WHERE "companyId" = $1 AND "deletedAt" IS NULL
          UNION ALL
          SELECT MIN("invoiceDate") as earliest_date, MAX("invoiceDate") as latest_date FROM hisab.purchases WHERE "companyId" = $1 AND "deletedAt" IS NULL
          UNION ALL
          SELECT MIN("date") as earliest_date, MAX("date") as latest_date FROM hisab.expenses WHERE "companyId" = $1
          UNION ALL
          SELECT MIN("date") as earliest_date, MAX("date") as latest_date FROM hisab.incomes WHERE "companyId" = $1
        ) combined_dates
      ),
      categories AS (
        SELECT id, name FROM hisab."stockCategories" WHERE "companyId" = $1 ORDER BY name
      ),
      account_types AS (
        SELECT DISTINCT "accountType" FROM hisab."bankAccounts" WHERE "companyId" = $1 ORDER BY "accountType"
      )
      SELECT 
        (SELECT row_to_json(d) FROM date_ranges d) as date_ranges,
        (SELECT array_agg(row_to_json(c)) FROM categories c) as product_categories,
        (SELECT array_agg(row_to_json(a)) FROM account_types a) as account_types
    `;

    const result = await client.query(filtersQuery, [companyId]);
    const filterData = result.rows[0];

    const filters = {
      dateRanges: filterData.date_ranges || {},
      productCategories: filterData.product_categories || [],
      accountTypes: filterData.account_types || [],
      statusOptions: [
        { value: 'all', label: 'All Status' },
        { value: 'paid', label: 'Paid' },
        { value: 'pending', label: 'Pending' }
      ],
      contactTypes: [
        { value: 'all', label: 'All Contacts' },
        { value: 'customer', label: 'Customers' },
        { value: 'vendor', label: 'Vendors' }
      ]
    };

    return successResponse(res, {
      message: "Dashboard filters fetched successfully",
      filters
    });

  } catch (error) {
    console.error('Error fetching dashboard filters:', error);
    return errorResponse(res, "Error fetching dashboard filters", 500);
  } finally {
    client.release();
  }
} 