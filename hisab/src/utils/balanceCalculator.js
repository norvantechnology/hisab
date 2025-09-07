// Calculate contact current balance based on all transactions
export async function calculateContactCurrentBalance(client, contactId, companyId) {
  try {
    
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
    
    const { openingBalance, openingBalanceType, currentBalance, currentBalanceType } = contact;
    const openingBalanceAmount = parseFloat(openingBalance || 0);
    const currentBalanceAmount = parseFloat(currentBalance || 0);
    

    // Calculate total pending purchases (amounts we owe to this contact) - ONLY pending purchases
    const pendingPurchasesQuery = await client.query(
      `SELECT 
         "id",
         "invoiceNumber",
         "netPayable",
         "remaining_amount",
         "status"
       FROM hisab."purchases" 
       WHERE "contactId" = $1 AND "companyId" = $2 AND "status" = 'pending' AND "deletedAt" IS NULL
       ORDER BY "id"`,
      [contactId, companyId]
    );

    let totalPendingPurchases = 0;

    for (const purchase of pendingPurchasesQuery.rows) {
      const remainingAmount = parseFloat(purchase.remaining_amount || 0);
      const netPayable = parseFloat(purchase.netPayable || 0);
      const status = purchase.status;


      // Include only pending purchases using remaining_amount
      totalPendingPurchases += remainingAmount;
    }

    // Calculate total pending sales (amounts this contact owes us) - ONLY pending sales
    const pendingSalesQuery = await client.query(
      `SELECT 
         "id",
         "invoiceNumber",
         "netReceivable",
         "remaining_amount",
         "status"
       FROM hisab."sales" 
       WHERE "contactId" = $1 AND "companyId" = $2 AND "status" = 'pending' AND "deletedAt" IS NULL
       ORDER BY "id"`,
      [contactId, companyId]
    );

    let totalPendingSales = 0;

    for (const sale of pendingSalesQuery.rows) {
      const remainingAmount = parseFloat(sale.remaining_amount || 0);
      const netReceivable = parseFloat(sale.netReceivable || 0);
      const status = sale.status;

      // Include only pending sales using remaining_amount
      totalPendingSales += remainingAmount;
    }

    // Calculate total pending expenses (amounts we owe to this contact) - ONLY pending expenses
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


    for (const expense of pendingExpensesQuery.rows) {
      const remainingAmount = parseFloat(expense.remaining_amount || 0);
      const amount = parseFloat(expense.amount || 0);

      totalPendingExpenses += remainingAmount;
    }

    // Calculate total pending incomes (amounts this contact owes us) - ONLY pending incomes
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

    for (const income of pendingIncomesQuery.rows) {
      const remainingAmount = parseFloat(income.remaining_amount || 0);
      const amount = parseFloat(income.amount || 0);


      totalPendingIncomes += remainingAmount;
    }

    // PENDING TRANSACTIONS BALANCE CALCULATION
    // Balance = Current Balance + Opening Balance + Pending Purchases + Pending Expenses - Pending Sales - Pending Incomes
    let calculatedBalance = 0;
    let calculatedBalanceType = 'payable';

    // Start with current balance from database
    if (currentBalanceType === 'payable') {
      calculatedBalance = currentBalanceAmount; // We owe them
    } else {
      calculatedBalance = -currentBalanceAmount; // They owe us  
    }

    // Add opening balance (this represents the initial balance when contact was created)
    const beforeOpeningBalance = calculatedBalance;
    if (openingBalanceType === 'payable') {
      calculatedBalance += openingBalanceAmount; // We owe them
    } else if (openingBalanceType === 'receivable') {
      calculatedBalance -= openingBalanceAmount; // They owe us
    }

    // Add pending purchases (we owe them for these)
    const beforePurchases = calculatedBalance;
    calculatedBalance += totalPendingPurchases;

    // Add pending expenses (we owe them for these)
    const beforeExpenses = calculatedBalance;
    calculatedBalance += totalPendingExpenses;

    // Subtract pending sales (they owe us for these, so reduces what we owe them)
    const beforeSales = calculatedBalance;
    calculatedBalance -= totalPendingSales;

    // Subtract pending incomes (they owe us for these, so reduces what we owe them)
    const beforeIncomes = calculatedBalance;
    calculatedBalance -= totalPendingIncomes;

    // Determine balance type and amount
    if (calculatedBalance > 0) {
      calculatedBalanceType = 'payable'; // We owe them
    } else if (calculatedBalance < 0) {
      calculatedBalanceType = 'receivable'; // They owe us
      calculatedBalance = Math.abs(calculatedBalance);
    } else {
      calculatedBalanceType = 'payable'; // Default to payable when balance is 0
      calculatedBalance = 0;
    }

    return {
      balance: Number(calculatedBalance),
      balanceType: calculatedBalanceType,
      breakdown: {
        currentBalance: Number(currentBalanceAmount),
        currentBalanceType,
        openingBalance: Number(openingBalanceAmount),
        openingBalanceType,
        totalPendingPurchases: Number(totalPendingPurchases),
        totalPendingSales: Number(totalPendingSales),
        totalPendingExpenses: Number(totalPendingExpenses),
        totalPendingIncomes: Number(totalPendingIncomes),
        calculatedBalance: Number(calculatedBalance),
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