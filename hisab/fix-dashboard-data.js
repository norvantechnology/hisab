import pool from "./src/config/dbConnection.js";

async function fixDashboardData() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Starting dashboard data fix...');
    
    // Check current state
    const checkQuery = `
      SELECT 
        'sales' as table_name,
        COUNT(*) as total_records,
        COUNT(CASE WHEN "paid_amount" IS NULL THEN 1 END) as null_paid_amount,
        COUNT(CASE WHEN "remaining_amount" IS NULL THEN 1 END) as null_remaining_amount,
        COUNT(CASE WHEN "paid_amount" = 0 AND "remaining_amount" = 0 THEN 1 END) as both_zero
      FROM hisab.sales
      WHERE "deletedAt" IS NULL
      
      UNION ALL
      
      SELECT 
        'purchases' as table_name,
        COUNT(*) as total_records,
        COUNT(CASE WHEN "paid_amount" IS NULL THEN 1 END) as null_paid_amount,
        COUNT(CASE WHEN "remaining_amount" IS NULL THEN 1 END) as null_remaining_amount,
        COUNT(CASE WHEN "paid_amount" = 0 AND "remaining_amount" = 0 THEN 1 END) as both_zero
      FROM hisab.purchases
      WHERE "deletedAt" IS NULL
      
      UNION ALL
      
      SELECT 
        'expenses' as table_name,
        COUNT(*) as total_records,
        COUNT(CASE WHEN "paid_amount" IS NULL THEN 1 END) as null_paid_amount,
        COUNT(CASE WHEN "remaining_amount" IS NULL THEN 1 END) as null_remaining_amount,
        COUNT(CASE WHEN "paid_amount" = 0 AND "remaining_amount" = 0 THEN 1 END) as both_zero
      FROM hisab.expenses
      
      UNION ALL
      
      SELECT 
        'incomes' as table_name,
        COUNT(*) as total_records,
        COUNT(CASE WHEN "paid_amount" IS NULL THEN 1 END) as null_paid_amount,
        COUNT(CASE WHEN "remaining_amount" IS NULL THEN 1 END) as null_remaining_amount,
        COUNT(CASE WHEN "paid_amount" = 0 AND "remaining_amount" = 0 THEN 1 END) as both_zero
      FROM hisab.incomes
    `;
    
    const checkResult = await client.query(checkQuery);
    console.log('📊 Current Data State:');
    console.table(checkResult.rows);
    
    // Fix sales table
    console.log('🔧 Fixing sales table...');
    const fixSalesQuery = `
      UPDATE hisab.sales 
      SET 
        "paid_amount" = CASE 
          WHEN status = 'paid' THEN "netReceivable"
          ELSE COALESCE("paid_amount", 0)
        END,
        "remaining_amount" = CASE 
          WHEN status = 'paid' THEN 0
          ELSE COALESCE("remaining_amount", "netReceivable")
        END
      WHERE ("paid_amount" IS NULL OR "remaining_amount" IS NULL OR ("paid_amount" = 0 AND "remaining_amount" = 0))
        AND "deletedAt" IS NULL
    `;
    
    const salesResult = await client.query(fixSalesQuery);
    console.log(`✅ Fixed ${salesResult.rowCount} sales records`);
    
    // Fix purchases table
    console.log('🔧 Fixing purchases table...');
    const fixPurchasesQuery = `
      UPDATE hisab.purchases 
      SET 
        "paid_amount" = CASE 
          WHEN status = 'paid' THEN "netPayable"
          ELSE COALESCE("paid_amount", 0)
        END,
        "remaining_amount" = CASE 
          WHEN status = 'paid' THEN 0
          ELSE COALESCE("remaining_amount", "netPayable")
        END
      WHERE ("paid_amount" IS NULL OR "remaining_amount" IS NULL OR ("paid_amount" = 0 AND "remaining_amount" = 0))
        AND "deletedAt" IS NULL
    `;
    
    const purchasesResult = await client.query(fixPurchasesQuery);
    console.log(`✅ Fixed ${purchasesResult.rowCount} purchases records`);
    
    // Fix expenses table
    console.log('🔧 Fixing expenses table...');
    const fixExpensesQuery = `
      UPDATE hisab.expenses 
      SET 
        "paid_amount" = CASE 
          WHEN status = 'paid' THEN amount
          ELSE COALESCE("paid_amount", 0)
        END,
        "remaining_amount" = CASE 
          WHEN status = 'paid' THEN 0
          ELSE COALESCE("remaining_amount", amount)
        END
      WHERE "paid_amount" IS NULL OR "remaining_amount" IS NULL OR ("paid_amount" = 0 AND "remaining_amount" = 0)
    `;
    
    const expensesResult = await client.query(fixExpensesQuery);
    console.log(`✅ Fixed ${expensesResult.rowCount} expenses records`);
    
    // Fix incomes table
    console.log('🔧 Fixing incomes table...');
    const fixIncomesQuery = `
      UPDATE hisab.incomes 
      SET 
        "paid_amount" = CASE 
          WHEN status = 'paid' THEN amount
          ELSE COALESCE("paid_amount", 0)
        END,
        "remaining_amount" = CASE 
          WHEN status = 'paid' THEN 0
          ELSE COALESCE("remaining_amount", amount)
        END
      WHERE "paid_amount" IS NULL OR "remaining_amount" IS NULL OR ("paid_amount" = 0 AND "remaining_amount" = 0)
    `;
    
    const incomesResult = await client.query(fixIncomesQuery);
    console.log(`✅ Fixed ${incomesResult.rowCount} incomes records`);
    
    // Verify the fix
    console.log('🔍 Verifying fix...');
    const verifyResult = await client.query(checkQuery);
    console.log('📊 After Fix:');
    console.table(verifyResult.rows);
    
    console.log('✅ Dashboard data fix completed!');
    
  } catch (error) {
    console.error('❌ Error fixing dashboard data:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

// Run the fix
fixDashboardData(); 