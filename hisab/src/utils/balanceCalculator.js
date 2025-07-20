// Calculate contact current balance based on all transactions
export async function calculateContactCurrentBalance(client, contactId, companyId) {
  try {
    // Get opening balance
    const openingBalanceQuery = await client.query(
      `SELECT "openingBalance", "openingBalanceType" 
       FROM hisab."contacts" 
       WHERE "id" = $1 AND "companyId" = $2`,
      [contactId, companyId]
    );

    if (openingBalanceQuery.rows.length === 0) {
      throw new Error("Contact not found");
    }

    const { openingBalance, openingBalanceType } = openingBalanceQuery.rows[0];
    let currentBalance = parseFloat(openingBalance || 0);
    let currentBalanceType = openingBalanceType || 'payable';

    // Calculate pending purchases (amounts owed to contacts)
    const pendingPurchasesQuery = await client.query(
      `SELECT 
         "netPayable",
         "paid_amount",
         "remaining_amount",
         "status"
       FROM hisab."purchases" 
       WHERE "contactId" = $1 AND "companyId" = $2 AND "deletedAt" IS NULL`,
      [contactId, companyId]
    );

    let totalPayable = 0;
    let totalPaid = 0;

    for (const purchase of pendingPurchasesQuery.rows) {
      const netPayable = parseFloat(purchase.netPayable || 0);
      const paidAmount = parseFloat(purchase.paid_amount || 0);
      const remainingAmount = parseFloat(purchase.remaining_amount || 0);
      const status = purchase.status;

      if (status === 'pending') {
        // For pending purchases, we owe the remaining amount
        totalPayable += remainingAmount > 0 ? remainingAmount : netPayable;
      } else if (status === 'paid') {
        // For paid purchases, we've already paid
        totalPaid += netPayable;
      }
    }

    // Calculate payments made/received using payment_allocations table
    const paymentsQuery = await client.query(
      `SELECT 
         p."amount",
         p."paymentType",
         p."adjustmentType",
         p."adjustmentValue",
         p."openingBalancePayment",
         pa."allocationType",
         pa."paidAmount",
         pa."balanceType"
       FROM hisab."payments" p
       LEFT JOIN hisab."payment_allocations" pa ON p."id" = pa."paymentId"
       WHERE p."contactId" = $1 AND p."companyId" = $2 AND p."deletedAt" IS NULL`,
      [contactId, companyId]
    );

    let totalPayments = 0;
    let totalReceipts = 0;

    for (const payment of paymentsQuery.rows) {
      const amount = parseFloat(payment.amount || 0);
      const paymentType = payment.paymentType;
      const adjustmentType = payment.adjustmentType;
      const adjustmentValue = parseFloat(payment.adjustmentValue || 0);
      const openingBalancePayment = parseFloat(payment.openingBalancePayment || 0);
      const allocationType = payment.allocationType;
      const paidAmount = parseFloat(payment.paidAmount || 0);
      const balanceType = payment.balanceType;

      if (paymentType === 'payment') {
        // We made a payment (reduces payable)
        if (allocationType === 'current-balance' || allocationType === 'opening-balance') {
          totalPayments += paidAmount;
        } else {
          totalPayments += paidAmount;
        }
        
        if (adjustmentType === 'discount') {
          totalPayments += adjustmentValue; // Discount reduces what we pay
        } else if (adjustmentType === 'surcharge') {
          totalPayments -= adjustmentValue; // Surcharge increases what we pay
        }
      } else if (paymentType === 'receipt') {
        // We received a payment (reduces receivable)
        if (allocationType === 'current-balance' || allocationType === 'opening-balance') {
          totalReceipts += paidAmount;
        } else {
          totalReceipts += paidAmount;
        }
        
        if (adjustmentType === 'extra_receipt') {
          totalReceipts += adjustmentValue; // Extra receipt increases what we receive
        }
      }

      // Handle opening balance payments
      if (openingBalancePayment > 0) {
        if (currentBalanceType === 'payable') {
          totalPayments += openingBalancePayment; // We paid our opening balance
        } else {
          totalReceipts += openingBalancePayment; // We received our opening balance
        }
      }
    }

    // Calculate net balance
    let netBalance = 0;

    // Start with opening balance
    if (openingBalanceType === 'payable') {
      netBalance = -currentBalance; // Negative because we owe
    } else {
      netBalance = currentBalance; // Positive because they owe us
    }

    // Add pending purchases (we owe more)
    netBalance -= totalPayable;

    // Add payments we made (reduces what we owe)
    netBalance += totalPayments;

    // Subtract receipts we received (reduces what they owe us)
    netBalance -= totalReceipts;

    // Determine final balance type and amount
    let finalBalance = Math.abs(netBalance);
    let finalBalanceType = netBalance >= 0 ? 'receivable' : 'payable';

    // If balance is 0, default to payable
    if (finalBalance === 0) {
      finalBalanceType = 'payable';
    }

    return {
      balance: finalBalance,
      balanceType: finalBalanceType,
      breakdown: {
        openingBalance: currentBalance,
        openingBalanceType,
        totalPayable,
        totalPaid,
        totalPayments,
        totalReceipts,
        netBalance
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