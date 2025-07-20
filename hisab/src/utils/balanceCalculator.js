// Calculate contact current balance based on all transactions
export async function calculateContactCurrentBalance(client, contactId, companyId) {
  try {
    // Get contact details
    const contactQuery = await client.query(
      `SELECT "openingBalance", "openingBalanceType", "currentBalance", "currentBalanceType"
       FROM hisab."contacts" 
       WHERE "id" = $1 AND "companyId" = $2`,
      [contactId, companyId]
    );

    if (contactQuery.rows.length === 0) {
      throw new Error("Contact not found");
    }

    const { openingBalance, openingBalanceType, currentBalance, currentBalanceType } = contactQuery.rows[0];
    const openingBalanceAmount = parseFloat(openingBalance || 0);
    const currentBalanceAmount = parseFloat(currentBalance || 0);

    // Calculate total pending purchases (amounts we owe to this contact)
    const pendingPurchasesQuery = await client.query(
      `SELECT 
         "id",
         "netPayable",
         "paid_amount",
         "remaining_amount",
         "status"
       FROM hisab."purchases" 
       WHERE "contactId" = $1 AND "companyId" = $2 AND "deletedAt" IS NULL`,
      [contactId, companyId]
    );

    let totalPendingPurchases = 0;
    let totalPaidPurchases = 0;

    for (const purchase of pendingPurchasesQuery.rows) {
      const netPayable = parseFloat(purchase.netPayable || 0);
      const paidAmount = parseFloat(purchase.paid_amount || 0);
      const remainingAmount = parseFloat(purchase.remaining_amount || 0);
      const status = purchase.status;

      if (status === 'pending') {
        // For pending purchases, we owe the remaining amount
        const pendingAmount = remainingAmount > 0 ? remainingAmount : (netPayable - paidAmount);
        totalPendingPurchases += Math.max(0, pendingAmount);
      } else if (status === 'paid') {
        // For paid purchases, we've already paid the full amount
        totalPaidPurchases += netPayable;
      }
    }

    // Calculate total payments made to this contact
    const paymentsQuery = await client.query(
      `SELECT 
         p."id",
         p."paymentType",
         p."adjustmentType",
         p."adjustmentValue",
         pa."allocationType",
         pa."paidAmount",
         pa."balanceType"
       FROM hisab."payments" p
       LEFT JOIN hisab."payment_allocations" pa ON p."id" = pa."paymentId"
       WHERE p."contactId" = $1 AND p."companyId" = $2 AND p."deletedAt" IS NULL`,
      [contactId, companyId]
    );

    let totalPaymentsToContact = 0;
    let totalReceiptsFromContact = 0;
    let totalAdjustments = 0;

    for (const payment of paymentsQuery.rows) {
      const paymentType = payment.paymentType;
      const adjustmentType = payment.adjustmentType;
      const adjustmentValue = parseFloat(payment.adjustmentValue || 0);
      const allocationType = payment.allocationType;
      const paidAmount = parseFloat(payment.paidAmount || 0);
      const balanceType = payment.balanceType;

      if (paymentType === 'payment') {
        // We made a payment to this contact (reduces what we owe)
        totalPaymentsToContact += paidAmount;
        
        // Handle adjustments
        if (adjustmentType === 'discount') {
          totalAdjustments += adjustmentValue; // Discount reduces what we pay
        } else if (adjustmentType === 'surcharge') {
          totalAdjustments -= adjustmentValue; // Surcharge increases what we pay
        }
      } else if (paymentType === 'receipt') {
        // We received a payment from this contact (reduces what they owe us)
        totalReceiptsFromContact += paidAmount;
        
        // Handle adjustments
        if (adjustmentType === 'extra_receipt') {
          totalAdjustments += adjustmentValue; // Extra receipt increases what we receive
        }
      }
    }

    // Calculate the actual current balance
    // Formula: Opening Balance + Pending Purchases - Payments Made + Receipts Received + Adjustments
    let calculatedBalance = 0;
    let calculatedBalanceType = 'payable';

    if (openingBalanceType === 'payable') {
      // We started owing them money
      calculatedBalance = openingBalanceAmount + totalPendingPurchases - totalPaymentsToContact + totalReceiptsFromContact + totalAdjustments;
    } else {
      // They started owing us money
      calculatedBalance = -openingBalanceAmount + totalPendingPurchases - totalPaymentsToContact + totalReceiptsFromContact + totalAdjustments;
    }

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

    // Debug logging
    console.log(`Balance calculation for contact ${contactId}:`, {
      openingBalance: openingBalanceAmount,
      openingBalanceType,
      currentBalance: currentBalanceAmount,
      currentBalanceType,
      totalPendingPurchases,
      totalPaidPurchases,
      totalPaymentsToContact,
      totalReceiptsFromContact,
      totalAdjustments,
      calculatedBalance,
      calculatedBalanceType
    });

    return {
      balance: calculatedBalance,
      balanceType: calculatedBalanceType,
      breakdown: {
        openingBalance: openingBalanceAmount,
        openingBalanceType,
        currentBalance: currentBalanceAmount,
        currentBalanceType,
        totalPendingPurchases,
        totalPaidPurchases,
        totalPaymentsToContact,
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