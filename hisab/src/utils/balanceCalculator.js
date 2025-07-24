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
         "paid_amount",
         "remaining_amount",
         "status"
       FROM hisab."purchases" 
       WHERE "contactId" = $1 AND "companyId" = $2 AND "deletedAt" IS NULL
       ORDER BY "id"`,
      [contactId, companyId]
    );

    let totalPendingPurchases = 0;
    let totalPaidPurchases = 0;

    console.log(`\n=== PURCHASES DEBUG for Contact ${contactId} ===`);
    console.log(`Found ${pendingPurchasesQuery.rows.length} purchases:`);

    for (const purchase of pendingPurchasesQuery.rows) {
      const netPayable = parseFloat(purchase.netPayable || 0);
      const paidAmount = parseFloat(purchase.paid_amount || 0);
      const remainingAmount = parseFloat(purchase.remaining_amount || 0);
      const status = purchase.status;

      console.log(`Purchase ID ${purchase.id} (${purchase.invoiceNumber}):`, {
        netPayable,
        paidAmount,
        remainingAmount,
        status
      });

      if (status === 'pending') {
        // For pending purchases, we owe the remaining amount
        const pendingAmount = remainingAmount > 0 ? remainingAmount : (netPayable - paidAmount);
        totalPendingPurchases += Math.max(0, pendingAmount);
        console.log(`  -> Added ${Math.max(0, pendingAmount)} to pending (Total: ${totalPendingPurchases})`);
      } else if (status === 'paid') {
        // For paid purchases, we've already paid the full amount
        totalPaidPurchases += netPayable;
        console.log(`  -> Added ${netPayable} to paid (Total: ${totalPaidPurchases})`);
      }
    }
    console.log(`=== PURCHASES TOTAL: Pending=${totalPendingPurchases}, Paid=${totalPaidPurchases} ===\n`);

    // Calculate total pending sales (amounts this contact owes us)
    const pendingSalesQuery = await client.query(
      `SELECT 
         "id",
         "invoiceNumber",
         "netReceivable",
         "paid_amount",
         "remaining_amount",
         "status"
       FROM hisab."sales" 
       WHERE "contactId" = $1 AND "companyId" = $2 AND "deletedAt" IS NULL
       ORDER BY "id"`,
      [contactId, companyId]
    );

    let totalPendingSales = 0;
    let totalPaidSales = 0;

    console.log(`\n=== SALES DEBUG for Contact ${contactId} ===`);
    console.log(`Found ${pendingSalesQuery.rows.length} sales:`);

    for (const sale of pendingSalesQuery.rows) {
      const netReceivable = parseFloat(sale.netReceivable || 0);
      const paidAmount = parseFloat(sale.paid_amount || 0);
      const remainingAmount = parseFloat(sale.remaining_amount || 0);
      const status = sale.status;

      console.log(`Sale ID ${sale.id} (${sale.invoiceNumber}):`, {
        netReceivable,
        paidAmount,
        remainingAmount,
        status
      });

      if (status === 'pending') {
        // For pending sales, they owe us the remaining amount
        const pendingAmount = remainingAmount > 0 ? remainingAmount : (netReceivable - paidAmount);
        totalPendingSales += Math.max(0, pendingAmount);
        console.log(`  -> Added ${Math.max(0, pendingAmount)} to pending (Total: ${totalPendingSales})`);
      } else if (status === 'paid') {
        // For paid sales, they've already paid us the full amount
        totalPaidSales += netReceivable;
        console.log(`  -> Added ${netReceivable} to paid (Total: ${totalPaidSales})`);
      }
    }
    console.log(`=== SALES TOTAL: Pending=${totalPendingSales}, Paid=${totalPaidSales} ===\n`);

    // Calculate total pending expenses (amounts we owe to this contact)
    const pendingExpensesQuery = await client.query(
      `SELECT 
         "id",
         "amount",
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
      const amount = parseFloat(expense.amount || 0);
      totalPendingExpenses += amount;
      console.log(`Expense ID ${expense.id}: ${amount} (Total: ${totalPendingExpenses})`);
    }
    console.log(`=== PENDING EXPENSES TOTAL: ${totalPendingExpenses} ===\n`);

    // Calculate total pending incomes (amounts this contact owes us)
    const pendingIncomesQuery = await client.query(
      `SELECT 
         "id",
         "amount",
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
      const amount = parseFloat(income.amount || 0);
      totalPendingIncomes += amount;
      console.log(`Income ID ${income.id}: ${amount} (Total: ${totalPendingIncomes})`);
    }
    console.log(`=== PENDING INCOMES TOTAL: ${totalPendingIncomes} ===\n`);

    // Calculate total payments made to this contact
    const paymentsQuery = await client.query(
      `SELECT 
         p."id",
         p."paymentNumber",
         p."paymentType",
         p."adjustmentType",
         p."adjustmentValue",
         pa."allocationType",
         pa."paidAmount",
         pa."balanceType",
         pa."purchaseId"
       FROM hisab."payments" p
       LEFT JOIN hisab."payment_allocations" pa ON p."id" = pa."paymentId"
       WHERE p."contactId" = $1 AND p."companyId" = $2 AND p."deletedAt" IS NULL
       ORDER BY p."id", pa."id"`,
      [contactId, companyId]
    );

    let totalCurrentBalancePayments = 0;
    let totalReceiptsFromContact = 0;
    let totalAdjustments = 0;

    console.log(`\n=== PAYMENTS DEBUG for Contact ${contactId} ===`);
    console.log(`Found ${paymentsQuery.rows.length} payment allocations:`);

    for (const payment of paymentsQuery.rows) {
      const paymentType = payment.paymentType;
      const adjustmentType = payment.adjustmentType;
      const adjustmentValue = parseFloat(payment.adjustmentValue || 0);
      const allocationType = payment.allocationType;
      const paidAmount = parseFloat(payment.paidAmount || 0);
      const balanceType = payment.balanceType;

      console.log(`Payment ID ${payment.id} (${payment.paymentNumber}) - Allocation:`, {
        paymentType,
        adjustmentType,
        adjustmentValue,
        allocationType,
        paidAmount,
        balanceType,
        purchaseId: payment.purchaseId
      });

      if (paymentType === 'payment') {
        // Only count current-balance payments, not purchase payments
        // Purchase payments are already reflected in reduced pending amounts
        if (allocationType === 'current-balance') {
          totalCurrentBalancePayments += paidAmount;
          console.log(`  -> Added ${paidAmount} to current balance payments (Total: ${totalCurrentBalancePayments})`);
        } else {
          console.log(`  -> Skipped purchase payment (already reflected in purchase remaining amount)`);
        }
        
        // Handle adjustments
        if (adjustmentType === 'discount') {
          totalAdjustments += adjustmentValue; // Discount reduces what we pay
          console.log(`  -> Added discount adjustment ${adjustmentValue} (Total adjustments: ${totalAdjustments})`);
        } else if (adjustmentType === 'surcharge') {
          totalAdjustments -= adjustmentValue; // Surcharge increases what we pay
          console.log(`  -> Added surcharge adjustment -${adjustmentValue} (Total adjustments: ${totalAdjustments})`);
        }
      } else if (paymentType === 'receipt') {
        // We received a payment from this contact (reduces what they owe us)
        totalReceiptsFromContact += paidAmount;
        console.log(`  -> Added ${paidAmount} to receipts from contact (Total: ${totalReceiptsFromContact})`);
        
        // Handle adjustments
        if (adjustmentType === 'extra_receipt') {
          totalAdjustments += adjustmentValue; // Extra receipt increases what we receive
          console.log(`  -> Added extra receipt adjustment ${adjustmentValue} (Total adjustments: ${totalAdjustments})`);
        }
      }
    }
    console.log(`=== PAYMENTS TOTAL: CurrentBalance=${totalCurrentBalancePayments}, Receipts=${totalReceiptsFromContact}, Adjustments=${totalAdjustments} ===\n`);

    // COMPREHENSIVE BALANCE CALCULATION INCLUDING SALES, EXPENSES AND INCOMES
    // Balance = Stored Current Balance + Opening Balance + Pending Purchases + Pending Expenses - Pending Sales - Pending Incomes - Payments Made to Contact + Receipts from Contact
    let calculatedBalance = 0;
    let calculatedBalanceType = 'payable';

    console.log(`\n=== COMPREHENSIVE BALANCE CALCULATION for Contact ${contactId} ===`);
    console.log(`Stored Current Balance: ${currentBalanceAmount} (${currentBalanceType})`);
    console.log(`Opening Balance: ${openingBalanceAmount} (${openingBalanceType})`);
    console.log(`Components:`);
    console.log(`  + Pending Purchases: ${totalPendingPurchases} (we owe them)`);
    console.log(`  + Pending Expenses: ${totalPendingExpenses} (we owe them)`);
    console.log(`  - Pending Sales: ${totalPendingSales} (they owe us)`);
    console.log(`  - Pending Incomes: ${totalPendingIncomes} (they owe us)`);
    console.log(`  - Current Balance Payments: ${totalCurrentBalancePayments} (we paid them)`);
    console.log(`  + Receipts from Contact: ${totalReceiptsFromContact} (they paid us)`);
    console.log(`  Adjustments (logged but not applied): ${totalAdjustments}`);

    // Start with stored current balance
    if (currentBalanceType === 'payable') {
      calculatedBalance = currentBalanceAmount; // We owe them
    } else {
      calculatedBalance = -currentBalanceAmount; // They owe us  
    }

    // Add opening balance impact
    if (openingBalanceType === 'payable') {
      calculatedBalance += openingBalanceAmount; // We owe them
    } else {
      calculatedBalance -= openingBalanceAmount; // They owe us  
    }

    // Add pending purchases (we owe them for these)
    calculatedBalance += totalPendingPurchases;

    // Add pending expenses (we owe them for these)
    calculatedBalance += totalPendingExpenses;

    // Subtract pending sales (they owe us for these, so reduces what we owe them)
    calculatedBalance -= totalPendingSales;

    // Subtract pending incomes (they owe us for these, so reduces what we owe them)
    calculatedBalance -= totalPendingIncomes;

    // Subtract payments we made to them (reduces what we owe)
    calculatedBalance -= totalCurrentBalancePayments;

    // Add receipts from them (they paid us, but in context of owing, this increases what we owe them)
    calculatedBalance += totalReceiptsFromContact;

    console.log(`Calculation: ${currentBalanceType === 'payable' ? currentBalanceAmount : -currentBalanceAmount} + ${openingBalanceType === 'payable' ? openingBalanceAmount : -openingBalanceAmount} + ${totalPendingPurchases} + ${totalPendingExpenses} - ${totalPendingSales} - ${totalPendingIncomes} - ${totalCurrentBalancePayments} + ${totalReceiptsFromContact} = ${calculatedBalance}`);

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
    console.log(`=== COMPREHENSIVE RESULT: ${calculatedBalance} ${calculatedBalanceType} ===\n`);

    // Debug logging
    console.log(`Balance calculation for contact ${contactId}:`, {
      storedCurrentBalance: currentBalanceAmount,
      storedCurrentBalanceType: currentBalanceType,
      openingBalance: openingBalanceAmount,
      openingBalanceType,
      totalPendingPurchases,
      totalPendingSales,
      totalPendingExpenses,
      totalPendingIncomes,
      totalPaidPurchases,
      totalPaidSales,
      totalCurrentBalancePayments,
      totalReceiptsFromContact,
      totalAdjustments,
      calculatedBalance,
      calculatedBalanceType
    });

    return {
      balance: calculatedBalance,
      balanceType: calculatedBalanceType,
      breakdown: {
        storedCurrentBalance: currentBalanceAmount,
        storedCurrentBalanceType: currentBalanceType,
        openingBalance: openingBalanceAmount,
        openingBalanceType,
        totalPendingPurchases,
        totalPendingSales,
        totalPendingExpenses,
        totalPendingIncomes,
        totalPaidPurchases,
        totalPaidSales,
        totalCurrentBalancePayments,
        totalReceiptsFromContact,
        totalAdjustments,
        calculatedBalance,
        calculatedBalanceType
      }
    };
  } catch (error) {
    console.error('Error calculating contact balance:', error);
    throw error;
  }
}

// Update contact balance after purchase operations
export async function updateContactBalanceAfterPurchase(client, contactId, companyId) {
  try {
    if (!contactId) return; // No contact involved (bank payment)

    const { balance, balanceType } = await calculateContactCurrentBalance(client, contactId, companyId);
    
    await client.query(
      `UPDATE hisab."contacts" 
       SET "currentBalance" = $1, "currentBalanceType" = $2, "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $3 AND "companyId" = $4`,
      [balance, balanceType, contactId, companyId]
    );
  } catch (error) {
    console.error('Error updating contact balance after purchase:', error);
    // Don't throw error to avoid rolling back the purchase transaction
  }
}

// Update contact balance after sale operations
export async function updateContactBalanceAfterSale(client, contactId, companyId, saleAmount, status) {
  try {
    if (!contactId) return; // No contact involved (bank sale)

    // For sales, we need to consider the impact on contact balance
    // If status is 'paid', the customer has already paid us
    // If status is 'pending', the customer owes us money
    
    const { balance, balanceType } = await calculateContactCurrentBalance(client, contactId, companyId);
    
    // For sales, the logic is opposite to purchases:
    // - If customer pays us (status = 'paid'), it reduces what they owe us or increases what we owe them
    // - If customer doesn't pay (status = 'pending'), it increases what they owe us
    
    let newBalance = balance;
    let newBalanceType = balanceType;

    if (status === 'pending') {
      // Customer owes us money for this sale
      if (balanceType === 'receivable') {
        // They already owe us, so add to what they owe
        newBalance = balance + saleAmount;
      } else {
        // We owe them, but now they owe us for this sale
        // If sale amount > what we owe them, they now owe us
        if (saleAmount > balance) {
          newBalance = saleAmount - balance;
          newBalanceType = 'receivable';
        } else {
          // We still owe them, but less
          newBalance = balance - saleAmount;
        }
      }
    } else if (status === 'paid') {
      // Customer has paid us for this sale
      if (balanceType === 'receivable') {
        // They owed us, now they've paid
        newBalance = Math.max(0, balance - saleAmount);
        if (newBalance === 0) {
          newBalanceType = 'payable'; // Default to payable when balanced
        }
      } else {
        // We owe them, but they've paid us for this sale
        // This increases what we owe them
        newBalance = balance + saleAmount;
      }
    }

    await client.query(
      `UPDATE hisab."contacts" 
       SET "currentBalance" = $1, "currentBalanceType" = $2, "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $3 AND "companyId" = $4`,
      [newBalance, newBalanceType, contactId, companyId]
    );
  } catch (error) {
    console.error('Error updating contact balance after sale:', error);
    // Don't throw error to avoid rolling back the sale transaction
  }
} 