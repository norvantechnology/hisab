// Utility functions for bank balance adjustments

/**
 * Calculate bank balance adjustment for transaction updates
 * @param {string} transactionType - 'income', 'expense', 'sale', 'purchase'
 * @param {number} oldAmount - Previous transaction amount
 * @param {number} newAmount - New transaction amount
 * @param {string} oldStatus - Previous transaction status
 * @param {string} newStatus - New transaction status
 * @param {number} oldBankAccountId - Previous bank account ID
 * @param {number} newBankAccountId - New bank account ID
 * @returns {object} Bank adjustment details
 */
export function calculateBankBalanceAdjustment(
  transactionType,
  oldAmount,
  newAmount,
  oldStatus,
  newStatus,
  oldBankAccountId,
  newBankAccountId
) {
  const adjustments = [];
  
  // Reverse old bank account balance if it was paid
  if (oldBankAccountId && oldStatus === 'paid') {
    const reverseAmount = transactionType === 'income' || transactionType === 'sale' 
      ? -oldAmount  // Remove income/sales from bank (subtract)
      : oldAmount;  // Add back expense/purchase to bank (add)
      
    adjustments.push({
      bankAccountId: oldBankAccountId,
      adjustment: reverseAmount,
      reason: `Reverse old ${transactionType} amount`,
      amount: oldAmount
    });
  }
  
  // Apply new bank account balance if it's paid
  if (newBankAccountId && newStatus === 'paid') {
    const applyAmount = transactionType === 'income' || transactionType === 'sale'
      ? newAmount   // Add income/sales to bank (add)
      : -newAmount; // Remove expense/purchase from bank (subtract)
      
    adjustments.push({
      bankAccountId: newBankAccountId,
      adjustment: applyAmount,
      reason: `Apply new ${transactionType} amount`,
      amount: newAmount
    });
  }
  
  return adjustments;
}

/**
 * Apply bank balance adjustments
 * @param {object} client - Database client
 * @param {array} adjustments - Array of adjustment objects from calculateBankBalanceAdjustment
 */
export async function applyBankBalanceAdjustments(client, adjustments) {
  for (const adjustment of adjustments) {
    await client.query(
      `UPDATE hisab."bankAccounts" 
       SET "currentBalance" = "currentBalance" + $1,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [adjustment.adjustment, adjustment.bankAccountId]
    );
  }
}

/**
 * Calculate payment adjustment bank balance impact
 * @param {string} transactionType - 'income', 'expense', 'sale', 'purchase'
 * @param {number} paymentAdjustment - Change in payment amount (positive = increase, negative = decrease)
 * @returns {number} Bank balance adjustment amount
 */
export function calculatePaymentAdjustmentBankImpact(transactionType, paymentAdjustment) {
  // Correct logic for bank balance adjustments:
  // 
  // For INCOME/SALES (money coming into bank):
  // - When payment increases → more money received → bank balance increases
  // - When payment decreases → less money received → bank balance decreases
  // 
  // For EXPENSE/PURCHASE (money going out of bank):
  // - When payment increases → more money spent → bank balance decreases  
  // - When payment decreases → less money spent → bank balance increases
  
  if (transactionType === 'income' || transactionType === 'sale') {
    // For income/sales: payment adjustment directly affects bank balance
    // If payment increases (+100), bank balance increases (+100)
    // If payment decreases (-100), bank balance decreases (-100)
    return paymentAdjustment;
  } else {
    // For expense/purchase: payment adjustment inversely affects bank balance
    // If payment increases (+100), bank balance decreases (-100)
    // If payment decreases (-100), bank balance increases (+100)
    return -paymentAdjustment;
  }
} 