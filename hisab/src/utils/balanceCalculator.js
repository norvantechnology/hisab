// Calculate contact current balance based on all transactions
export async function calculateContactCurrentBalance(client, contactId, companyId) {
  try {
    console.log(`\n🔍 STARTING BALANCE CALCULATION for Contact ${contactId} in Company ${companyId}`);
    
    // Get contact details
    const contactQuery = await client.query(
      `SELECT "id", "name", "openingBalance", "openingBalanceType", "currentBalance", "currentBalanceType"
       FROM hisab."contacts" 
       WHERE "id" = $1 AND "companyId" = $2`,
      [contactId, companyId]
    );

    if (contactQuery.rows.length === 0) {
      throw new Error("Contact not found");
    }

    const contact = contactQuery.rows[0];
    console.log(`Contact: ${contact.name} (ID: ${contact.id})`);
    
    const { openingBalance, openingBalanceType, currentBalance, currentBalanceType } = contact;
    const openingBalanceAmount = parseFloat(openingBalance || 0);
    const currentBalanceAmount = parseFloat(currentBalance || 0);
    
    console.log(`Current DB State: ${currentBalanceAmount} ${currentBalanceType}, Opening: ${openingBalanceAmount} ${openingBalanceType}`);

    // Calculate total pending purchases (amounts we owe to this contact)
    const pendingPurchasesQuery = await client.query(
      `SELECT 
         "id",
         "invoiceNumber",
         "netPayable",
         "remaining_amount",
         "status"
       FROM hisab."purchases" 
       WHERE "contactId" = $1 AND "companyId" = $2 AND "deletedAt" IS NULL
       ORDER BY "id"`,
      [contactId, companyId]
    );

    let totalPendingPurchases = 0;

    console.log(`\n=== PURCHASES DEBUG for Contact ${contactId} ===`);
    console.log(`Found ${pendingPurchasesQuery.rows.length} purchases:`);

    for (const purchase of pendingPurchasesQuery.rows) {
      const remainingAmount = parseFloat(purchase.remaining_amount || 0);
      const status = purchase.status;

      console.log(`Purchase ID ${purchase.id} (${purchase.invoiceNumber}):`, {
        remainingAmount,
        status
      });

      if (status === 'pending') {
        totalPendingPurchases += remainingAmount;
        console.log(`  -> Added ${remainingAmount} to pending (Total: ${totalPendingPurchases})`);
      } else if (status === 'paid') {
        console.log(`  -> Skipped paid purchase (no impact on current balance)`);
      }
    }
    console.log(`=== PURCHASES TOTAL: Pending=${totalPendingPurchases} ===\n`);

    // Calculate total pending sales (amounts this contact owes us)
    const pendingSalesQuery = await client.query(
      `SELECT 
         "id",
         "invoiceNumber",
         "netReceivable",
         "remaining_amount",
         "status"
       FROM hisab."sales" 
       WHERE "contactId" = $1 AND "companyId" = $2 AND "deletedAt" IS NULL
       ORDER BY "id"`,
      [contactId, companyId]
    );

    let totalPendingSales = 0;

    console.log(`\n=== SALES DEBUG for Contact ${contactId} ===`);
    console.log(`Found ${pendingSalesQuery.rows.length} sales:`);

    for (const sale of pendingSalesQuery.rows) {
      const remainingAmount = parseFloat(sale.remaining_amount || 0);
      const status = sale.status;

      console.log(`Sale ID ${sale.id} (${sale.invoiceNumber}):`, {
        remainingAmount,
        status
      });

      if (status === 'pending') {
        totalPendingSales += remainingAmount;
        console.log(`  -> Added ${remainingAmount} to pending (Total: ${totalPendingSales})`);
      } else if (status === 'paid') {
        console.log(`  -> Skipped paid sale (no impact on current balance)`);
      }
    }
    console.log(`=== SALES TOTAL: Pending=${totalPendingSales} ===\n`);

    // Calculate total pending expenses (amounts we owe to this contact)
    const pendingExpensesQuery = await client.query(
      `SELECT 
         "id",
         "amount",
         "remaining_amount",
         "status",
         "notes"
       FROM hisab."expenses" 
       WHERE "contactId" = $1 AND "companyId" = $2 AND "status" = 'pending'
       ORDER BY "id"`,
      [contactId, companyId]
    );

    let totalPendingExpenses = 0;

    console.log(`\n=== PENDING EXPENSES DEBUG for Contact ${contactId} ===`);
    console.log(`Found ${pendingExpensesQuery.rows.length} pending expenses:`);

    for (const expense of pendingExpensesQuery.rows) {
      const remainingAmount = parseFloat(expense.remaining_amount || 0);
      totalPendingExpenses += remainingAmount;
      console.log(`Expense ID ${expense.id}: ${remainingAmount} (Total: ${totalPendingExpenses})`);
    }
    console.log(`=== PENDING EXPENSES TOTAL: ${totalPendingExpenses} ===\n`);

    // Calculate total pending incomes (amounts this contact owes us)
    const pendingIncomesQuery = await client.query(
      `SELECT 
         "id",
         "amount",
         "remaining_amount",
         "status",
         "notes"
       FROM hisab."incomes" 
       WHERE "contactId" = $1 AND "companyId" = $2 AND "status" = 'pending'
       ORDER BY "id"`,
      [contactId, companyId]
    );

    let totalPendingIncomes = 0;

    console.log(`\n=== PENDING INCOMES DEBUG for Contact ${contactId} ===`);
    console.log(`Found ${pendingIncomesQuery.rows.length} pending incomes:`);

    for (const income of pendingIncomesQuery.rows) {
      const remainingAmount = parseFloat(income.remaining_amount || 0);
      totalPendingIncomes += remainingAmount;
      console.log(`Income ID ${income.id}: ${remainingAmount} (Total: ${totalPendingIncomes})`);
    }
    console.log(`=== PENDING INCOMES TOTAL: ${totalPendingIncomes} ===\n`);

    // SIMPLIFIED BALANCE CALCULATION - ONLY PENDING AMOUNTS
    // Balance = Current Balance + Pending Purchases + Pending Expenses - Pending Sales - Pending Incomes
    let calculatedBalance = 0;
    let calculatedBalanceType = 'payable';

    console.log(`\n=== SIMPLIFIED BALANCE CALCULATION for Contact ${contactId} ===`);
    console.log(`Current Balance: ${currentBalanceAmount} (${currentBalanceType})`);
    console.log(`Components:`);
    console.log(`  + Pending Purchases: ${totalPendingPurchases} (we owe them)`);
    console.log(`  + Pending Expenses: ${totalPendingExpenses} (we owe them)`);
    console.log(`  - Pending Sales: ${totalPendingSales} (they owe us)`);
    console.log(`  - Pending Incomes: ${totalPendingIncomes} (they owe us)`);

    // Start with current balance
    if (currentBalanceType === 'payable') {
      calculatedBalance = currentBalanceAmount; // We owe them
    } else {
      calculatedBalance = -currentBalanceAmount; // They owe us  
    }

    // Add pending purchases (we owe them for these)
    calculatedBalance += totalPendingPurchases;

    // Add pending expenses (we owe them for these)
    calculatedBalance += totalPendingExpenses;

    // Subtract pending sales (they owe us for these, so reduces what we owe them)
    calculatedBalance -= totalPendingSales;

    // Subtract pending incomes (they owe us for these, so reduces what we owe them)
    calculatedBalance -= totalPendingIncomes;

    console.log(`Calculation: ${currentBalanceType === 'payable' ? currentBalanceAmount : -currentBalanceAmount} + ${totalPendingPurchases} + ${totalPendingExpenses} - ${totalPendingSales} - ${totalPendingIncomes} = ${calculatedBalance}`);

    // Determine balance type and amount
    if (calculatedBalance > 0) {
      calculatedBalanceType = 'payable'; // We owe them
      console.log(`Result: ${calculatedBalance} payable (we owe them)`);
    } else if (calculatedBalance < 0) {
      calculatedBalanceType = 'receivable'; // They owe us
      calculatedBalance = Math.abs(calculatedBalance);
      console.log(`Result: ${calculatedBalance} receivable (they owe us)`);
    } else {
      calculatedBalanceType = 'payable'; // Default to payable when balance is 0
      calculatedBalance = 0;
      console.log(`Result: 0 (balanced)`);
    }
    console.log(`=== SIMPLIFIED RESULT: ${calculatedBalance} ${calculatedBalanceType} ===\n`);

    // Debug logging
    console.log(`Balance calculation for contact ${contactId}:`, {
      currentBalance: currentBalanceAmount,
      currentBalanceType,
      totalPendingPurchases,
      totalPendingSales,
      totalPendingExpenses,
      totalPendingIncomes,
      calculatedBalance,
      calculatedBalanceType
    });

    return {
      balance: calculatedBalance,
      balanceType: calculatedBalanceType,
      breakdown: {
        currentBalance: currentBalanceAmount,
        currentBalanceType,
        totalPendingPurchases,
        totalPendingSales,
        totalPendingExpenses,
        totalPendingIncomes,
        calculatedBalance,
        calculatedBalanceType
      }
    };
  } catch (error) {
    console.error('Error calculating contact balance:', error);
    throw error;
  }
}

// Update contact balance after sale operations
export async function updateContactBalanceAfterSale(client, contactId, companyId, saleAmount, status) {
  try {
    if (!contactId) return; // No contact involved (bank sale)

    // Recalculate the complete balance using the comprehensive calculation
    const { balance, balanceType } = await calculateContactCurrentBalance(client, contactId, companyId);
    
    await client.query(
      `UPDATE hisab."contacts" 
       SET "currentBalance" = $1, "currentBalanceType" = $2, "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $3 AND "companyId" = $4`,
      [balance, balanceType, contactId, companyId]
    );
  } catch (error) {
    console.error('Error updating contact balance after sale:', error);
    // Don't throw error to avoid rolling back the sale transaction
  }
} 