// Utility functions for handling payment allocations across all transaction types

/**
 * Check if a transaction has payment allocations and return conflict info if needed
 * @param {Object} client - Database client
 * @param {string} transactionType - Type of transaction (purchase, sale, expense, income)
 * @param {number} transactionId - ID of the transaction
 * @param {number} companyId - Company ID
 * @param {number} oldAmount - Original transaction amount
 * @param {number} newAmount - New transaction amount
 * @param {string} paymentAdjustmentChoice - User's choice for payment adjustment
 * @returns {Object} - Result object with conflict info or success
 */
export async function checkPaymentAllocationConflict(
  client, 
  transactionType, 
  transactionId, 
  companyId, 
  oldAmount, 
  newAmount, 
  paymentAdjustmentChoice
) {
  // Map transaction types to their respective columns
  const transactionColumnMap = {
    purchase: 'purchaseId',
    sale: 'saleId', 
    expense: 'expenseId',
    income: 'incomeId'
  };

  const column = transactionColumnMap[transactionType];
  if (!column) {
    throw new Error(`Invalid transaction type: ${transactionType}`);
  }

  // Check if this transaction has payment allocations
  const paymentAllocationsQuery = await client.query(
    `SELECT pa.*, p.id as paymentId, p.amount as paymentAmount, p.date as paymentDate, p."bankId", p."paymentType", 
            p."adjustmentType", p."adjustmentValue"
     FROM hisab."payment_allocations" pa
     JOIN hisab."payments" p ON pa."paymentId" = p.id
     WHERE pa."${column}" = $1 AND p."companyId" = $2 AND p."deletedAt" IS NULL`,
    [transactionId, companyId]
  );

  const hasPaymentAllocations = paymentAllocationsQuery.rows.length > 0;
  const oldAmountNum = parseFloat(oldAmount || 0);
  const newAmountNum = parseFloat(newAmount || 0);

  // Calculate total actual payment amounts including adjustments
  const totalActualPaymentAmount = paymentAllocationsQuery.rows.reduce((sum, allocation) => {
    const baseAmount = parseFloat(allocation.paidAmount || 0);
    const adjustmentValue = parseFloat(allocation.adjustmentValue || 0);
    const adjustmentType = allocation.adjustmentType;
    
    // Calculate actual payment amount including adjustments
    let actualPaymentAmount = baseAmount;
    if (adjustmentType === 'extra_receipt' || adjustmentType === 'surcharge') {
      actualPaymentAmount = baseAmount + adjustmentValue;
    } else if (adjustmentType === 'discount') {
      actualPaymentAmount = baseAmount - adjustmentValue;
    }
    
    console.log(`💰 Payment ${allocation.paymentId} calculation:`, {
      baseAmount,
      adjustmentType,
      adjustmentValue,
      actualPaymentAmount
    });
    
    return sum + actualPaymentAmount;
  }, 0);
  
  // For backward compatibility, also calculate simple allocation sum
  const totalAllocatedAmount = paymentAllocationsQuery.rows.reduce(
    (sum, allocation) => sum + parseFloat(allocation.paidAmount || 0), 0
  );

  // Determine if payment adjustment is actually needed
  // Only need adjustment if:
  // 1. There are payment allocations
  // 2. The amount changed 
  // 3. The new amount doesn't match the total paid amount (this is the key fix)
  const amountChanged = newAmountNum !== oldAmountNum;
  const paymentMatchesNewAmount = totalAllocatedAmount === newAmountNum;
  const paymentAdjustmentMade = hasPaymentAllocations && amountChanged && !paymentMatchesNewAmount;

  console.log('🔍 Payment allocation conflict check:', {
    transactionType,
    transactionId,
    hasPaymentAllocations,
    oldAmountNum,
    newAmountNum,
    totalAllocatedAmount,
    totalActualPaymentAmount,
    amountChanged,
    paymentMatchesNewAmount,
    paymentAdjustmentMade,
    paymentAdjustmentChoice
  });

  // If payment adjustment is needed but no choice provided, return conflict info
  if (paymentAdjustmentMade && !paymentAdjustmentChoice) {
    return {
      requiresPaymentAdjustment: true,
      paymentInfo: {
        totalAllocatedAmount: totalActualPaymentAmount, // Use actual payment amount including adjustments
        currentAmount: oldAmountNum,
        newAmount: newAmountNum,
        allocations: paymentAllocationsQuery.rows
      }
    };
  }

  return {
    requiresPaymentAdjustment: false,
    hasPaymentAllocations,
    paymentAdjustmentMade,
    allocations: paymentAllocationsQuery.rows
  };
}

/**
 * Update payment allocations when transaction amount changes
 * @param {Object} client - Database client
 * @param {string} transactionType - Type of transaction
 * @param {Array} allocations - Payment allocations to update
 * @param {number} newAmount - New transaction amount
 * @param {string} paymentAdjustmentChoice - User's choice
 */
export async function updatePaymentAllocations(
  client,
  transactionType,
  allocations,
  newAmount,
  paymentAdjustmentChoice
) {
  console.log('🔄 updatePaymentAllocations called:', {
    transactionType,
    allocationsCount: allocations.length,
    newAmount,
    paymentAdjustmentChoice,
    timestamp: new Date().toISOString()
  });

  // Prevent redundant processing
  if (!allocations || allocations.length === 0) {
    console.warn('⚠️ No allocations to update');
    return;
  }

  // Optimization: Group allocations by payment ID to avoid duplicate payment updates
  const paymentGroups = new Map();
  allocations.forEach(allocation => {
    const paymentId = allocation.paymentId;
    if (!paymentGroups.has(paymentId)) {
      paymentGroups.set(paymentId, []);
    }
    paymentGroups.get(paymentId).push(allocation);
  });

  console.log(`🔄 Grouped ${allocations.length} allocations into ${paymentGroups.size} payments for efficient processing`);

    if (paymentAdjustmentChoice === 'adjust_payment') {
    // Calculate total current paid amount across all allocations
    const totalCurrentPaid = allocations.reduce((sum, allocation) => 
      sum + parseFloat(allocation.paidAmount || 0), 0
    );
    
    console.log('🔄 Proportional payment adjustment:', {
      totalCurrentPaid,
      newAmount: parseFloat(newAmount),
      allocationsCount: allocations.length,
      willDistributeProportionally: totalCurrentPaid > 0,
      totalAdjustmentNeeded: parseFloat(newAmount) - totalCurrentPaid
    });

    if (totalCurrentPaid === 0) {
      console.warn('⚠️ No existing payments to adjust proportionally');
      return;
    }

    // Track bank balance changes by bank account
    const bankBalanceChanges = new Map();

    // Update payment allocations proportionally
    for (const allocation of allocations) {
      const paymentId = allocation.paymentId;
      const oldPaidAmount = parseFloat(allocation.paidAmount || 0);
      
      // Calculate proportional amount based on original payment ratio
      const paymentRatio = oldPaidAmount / totalCurrentPaid;
      const newPaidAmount = parseFloat(newAmount) * paymentRatio;
      const paidAmountDifference = newPaidAmount - oldPaidAmount;

      console.log(`💰 Proportional allocation update ${allocation.id}:`, {
        paymentId,
        oldPaidAmount,
        paymentRatio: (paymentRatio * 100).toFixed(2) + '%',
        newPaidAmount: newPaidAmount.toFixed(2),
        difference: paidAmountDifference.toFixed(2),
        paymentType: allocation.paymentType,
        bankId: allocation.bankId
      });

      // Update the payment allocation
      await client.query(
        `UPDATE hisab."payment_allocations" 
         SET "paidAmount" = $1, "amount" = $2
         WHERE "id" = $3`,
        [newPaidAmount, newPaidAmount, allocation.id]
      );

      // Update the payment record to reflect the new amount
      await client.query(
        `UPDATE hisab."payments" 
         SET "amount" = "amount" + $1, "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = $2`,
        [paidAmountDifference, paymentId]
      );

      // Accumulate bank balance changes by bank account
      if (paidAmountDifference !== 0) {
        const bankId = allocation.bankId;
        const bankImpact = allocation.paymentType === 'payment' ? -paidAmountDifference : paidAmountDifference;
        
        console.log(`🏦 Bank impact calculation for allocation ${allocation.id}:`, {
          paymentType: allocation.paymentType,
          paidAmountDifference,
          bankImpact,
          explanation: allocation.paymentType === 'payment' ? 
            (paidAmountDifference > 0 ? 'Outflow increase (negative bank impact)' : 'Outflow reduction (positive bank impact)') :
            (paidAmountDifference > 0 ? 'Inflow increase (positive bank impact)' : 'Inflow reduction (negative bank impact)')
        });
        
        if (bankBalanceChanges.has(bankId)) {
          bankBalanceChanges.set(bankId, bankBalanceChanges.get(bankId) + bankImpact);
        } else {
          bankBalanceChanges.set(bankId, bankImpact);
        }
      }
    }

    // Apply bank balance changes once per bank account
      const totalNetBankImpact = Array.from(bankBalanceChanges.values()).reduce((sum, impact) => sum + impact, 0);
      
      console.log('🏦 Bank balance adjustment summary:', {
        bankAccountsAffected: bankBalanceChanges.size,
        individualBankImpacts: Object.fromEntries(bankBalanceChanges),
        totalNetImpact: totalNetBankImpact,
        expectedImpact: `Should be ${totalCurrentPaid - parseFloat(newAmount)} for payment type adjustments`,
        calculationBreakdown: {
          oldTotalPaid: totalCurrentPaid,
          newTotalPaid: parseFloat(newAmount),
          netChange: parseFloat(newAmount) - totalCurrentPaid,
          bankImpactForPayments: totalCurrentPaid - parseFloat(newAmount) // For payments: reduction = positive bank impact
        }
      });
      
      for (const [bankId, totalBankImpact] of bankBalanceChanges) {
        if (totalBankImpact !== 0) {
          // Get current balance before update
          const beforeQuery = await client.query(
            `SELECT "currentBalance" FROM hisab."bankAccounts" WHERE "id" = $1`,
            [bankId]
          );
          const balanceBefore = parseFloat(beforeQuery.rows[0]?.currentBalance || 0);
          
          console.log(`🏦 Applying total bank balance change to bank ${bankId}: ${totalBankImpact}`);
          console.log(`💰 Bank balance before update: ${balanceBefore}`);
          
          await client.query(
            `UPDATE hisab."bankAccounts" 
             SET "currentBalance" = "currentBalance" + $1
             WHERE "id" = $2`,
            [totalBankImpact, bankId]
          );
          
          // Verify the update worked
          const afterQuery = await client.query(
            `SELECT "currentBalance" FROM hisab."bankAccounts" WHERE "id" = $1`,
            [bankId]
          );
          const balanceAfter = parseFloat(afterQuery.rows[0]?.currentBalance || 0);
          
          console.log(`💰 Bank balance after update: ${balanceAfter}`);
          console.log(`✅ Bank balance change verification: ${balanceBefore} + ${totalBankImpact} = ${balanceAfter} (Expected: ${balanceBefore + totalBankImpact})`);
          
          if (Math.abs((balanceBefore + totalBankImpact) - balanceAfter) > 0.01) {
            console.error(`❌ Bank balance update mismatch detected!`);
          }
        }
      }
  } else if (paymentAdjustmentChoice === 'keep_payment') {
    // Handle overpayment scenario when keeping existing payment
    for (const allocation of allocations) {
      const paymentId = allocation.paymentId;
      const oldPaidAmount = parseFloat(allocation.paidAmount || 0);
      const newTransactionAmount = parseFloat(newAmount);
      
      if (oldPaidAmount > newTransactionAmount) {
        // Overpayment scenario - need to add adjustment
        const overpaymentAmount = oldPaidAmount - newTransactionAmount;
        
        console.log(`💰 Overpayment detected for payment ${paymentId}:`, {
          oldPaidAmount,
          newTransactionAmount,
          overpaymentAmount
        });
        
        // Update the allocation to match the new transaction amount
        await client.query(
          `UPDATE hisab."payment_allocations" 
           SET "paidAmount" = $1, "amount" = $2
           WHERE "id" = $3`,
          [newTransactionAmount, newTransactionAmount, allocation.id]
        );
        
        // Update the payment record to add adjustment
        // Keep the original payment amount (1000) and add adjustment
        await client.query(
          `UPDATE hisab."payments" 
           SET "adjustmentType" = 'extra_receipt', 
               "adjustmentValue" = $1,
               "updatedAt" = CURRENT_TIMESTAMP
           WHERE "id" = $2`,
          [overpaymentAmount, paymentId]
        );
        
        console.log(`✅ Added extra receipt adjustment of ${overpaymentAmount} to payment ${paymentId}`);
             } else {
         // Normal case (payment <= transaction amount) - just update allocation amount
         await client.query(
           `UPDATE hisab."payment_allocations" 
            SET "paidAmount" = $1, "amount" = $2
            WHERE "id" = $3`,
           [oldPaidAmount, oldPaidAmount, allocation.id]
         );
         
         // Keep payment amount as is, clear any existing adjustments
          await client.query(
           `UPDATE hisab."payments" 
            SET "adjustmentType" = 'none', 
                "adjustmentValue" = 0, 
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = $1`,
           [paymentId]
         );
         
         console.log(`✅ Updated payment ${paymentId} - no overpayment, cleared adjustments`);
       }
    }
  }
}

/**
 * Calculate remaining and paid amounts based on payment adjustment choice
 * @param {number} newAmount - New transaction amount
 * @param {number} currentPaidAmount - Currently paid amount
 * @param {string} paymentAdjustmentChoice - User's choice
 * @param {boolean} paymentAdjustmentMade - Whether adjustment was made
 * @returns {Object} - Object with remainingAmount, paidAmount, and status
 */
export function calculateAmountsAfterAdjustment(
  newAmount,
  currentPaidAmount,
  paymentAdjustmentChoice,
  paymentAdjustmentMade
) {
  const newAmountNum = parseFloat(newAmount || 0);
  const currentPaidAmountNum = parseFloat(currentPaidAmount || 0);

  console.log('🧮 calculateAmountsAfterAdjustment called:', {
    newAmount: newAmountNum,
    currentPaidAmount: currentPaidAmountNum,
    paymentAdjustmentChoice,
    paymentAdjustmentMade
  });

  // Handle payment adjustment scenarios
  if (paymentAdjustmentChoice === 'adjust_payment') {
    console.log('📝 Taking adjust_payment path');
    // Adjust payment to match new amount
    return {
      remainingAmount: 0,
      paidAmount: newAmountNum,
      status: 'paid'
    };
  } else if (paymentAdjustmentChoice === 'keep_payment') {
    console.log('📝 Taking keep_payment path');
    // Keep existing payment, adjust remaining amount
    const remainingAmount = Math.max(0, newAmountNum - currentPaidAmountNum);
    const calculatedStatus = remainingAmount === 0 ? 'paid' : 'pending';
    
    console.log('💡 Keep payment calculation:', {
      newAmountNum,
      currentPaidAmountNum,
      remainingAmount,
      calculatedStatus,
      shouldBePending: remainingAmount > 0
    });
    
    return {
      remainingAmount,
      paidAmount: currentPaidAmountNum,
      status: calculatedStatus
    };
  }

  // No adjustment made, calculate normally
  if (currentPaidAmountNum > 0) {
    console.log('📝 Taking existing payments path');
    const remainingAmount = Math.max(0, newAmountNum - currentPaidAmountNum);
    const calculatedStatus = remainingAmount === 0 ? 'paid' : 'pending';
    
    console.log('💡 Existing payments calculation:', {
      newAmountNum,
      currentPaidAmountNum,
      remainingAmount,
      calculatedStatus
    });
    
    return {
      remainingAmount,
      paidAmount: currentPaidAmountNum,
      status: calculatedStatus
    };
  }

  // No existing payments
  console.log('📝 Taking no existing payments path');
  return {
    remainingAmount: newAmountNum,
    paidAmount: 0,
    status: 'pending'
  };
}

/**
 * Handle payment allocations on transaction delete
 * This function reverses payment allocations and updates bank balances
 */
export async function handlePaymentAllocationsOnTransactionDelete(client, transactionType, transactionId, companyId, userId) {
  const transactionColumnMap = {
    purchase: 'purchaseId',
    sale: 'saleId', 
    expense: 'expenseId',
    income: 'incomeId'
  };

  const column = transactionColumnMap[transactionType];
  if (!column) {
    throw new Error(`Invalid transaction type: ${transactionType}`);
  }

  // Get all payment allocations for this transaction
  const allocationsQuery = await client.query(
    `SELECT pa.*, p."bankId", p."paymentType", p."amount" as paymentAmount
     FROM hisab."payment_allocations" pa
     JOIN hisab."payments" p ON pa."paymentId" = p.id
     WHERE pa."${column}" = $1 AND p."companyId" = $2 AND p."deletedAt" IS NULL`,
    [transactionId, companyId]
  );

  const allocations = allocationsQuery.rows;

  // Process each allocation
  for (const allocation of allocations) {
    const paidAmount = parseFloat(allocation.paidAmount || 0);
    const paymentId = allocation.paymentId;

         // Update the payment record to reduce the amount
     await client.query(
       `UPDATE hisab."payments" 
        SET "amount" = "amount" - $1, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $2`,
       [paidAmount, paymentId]
     );

    // Reverse bank balance impact
    const bankImpact = allocation.paymentType === 'payment' ? paidAmount : -paidAmount;
    
        await client.query(
      `UPDATE hisab."bankAccounts" 
           SET "currentBalance" = "currentBalance" + $1 
       WHERE "id" = $2`,
      [bankImpact, allocation.bankId]
        );

    // Delete the allocation
          await client.query(
      `DELETE FROM hisab."payment_allocations" WHERE "id" = $1`,
        [allocation.id]
      );
    }

  return allocations.length;
} 