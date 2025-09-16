// Utility functions for handling payment allocations when transactions are deleted

// Helper function to handle payment allocations when a transaction is deleted
export async function handlePaymentAllocationsOnTransactionDelete(client, transactionType, transactionId, companyId, userId) {
  const typeColumnMap = {
    purchase: 'purchaseId',
    sale: 'saleId', 
    expense: 'expenseId',
    income: 'incomeId'
  };

  const columnName = typeColumnMap[transactionType];
  if (!columnName) {
    console.error(`Unknown transaction type: ${transactionType}`);
    return;
  }

  // Find all payment allocations for this transaction
  const paymentAllocationsQuery = await client.query(
    `SELECT pa.*, p.id as payment_id, p."paymentNumber", p.amount as payment_amount, p."paymentType", p."bankId", p."contactId"
     FROM hisab."payment_allocations" pa
     JOIN hisab."payments" p ON pa."paymentId" = p.id
     WHERE pa."${columnName}" = $1 AND p."companyId" = $2 AND p."deletedAt" IS NULL`,
    [transactionId, companyId]
  );

  const allocations = paymentAllocationsQuery.rows;

  if (allocations.length > 0) {
    console.log(`🔍 Found ${allocations.length} payment allocation(s) for ${transactionType} ${transactionId}`);
    
    // Handle each payment allocation
    for (const allocation of allocations) {
      const paymentId = allocation.payment_id;
      const allocatedAmount = parseFloat(allocation.paidAmount || 0);

      // Get all allocations for this payment
      const allPaymentAllocations = await client.query(
        `SELECT * FROM hisab."payment_allocations" WHERE "paymentId" = $1`,
        [paymentId]
      );

      // If this payment only has this one allocation, delete the entire payment
      if (allPaymentAllocations.rows.length === 1) {
        console.log(`🗑️ Deleting payment ${allocation.paymentNumber} as it only allocated to this ${transactionType}`);
        
        // Reverse bank balance impact
        if (allocation.bankId) {
          const bankImpact = allocation.paymentType === 'payment' ? -allocation.payment_amount : allocation.payment_amount;
          await client.query(
            `UPDATE hisab."bankAccounts" 
             SET "currentBalance" = "currentBalance" - $1 
             WHERE id = $2`,
            [bankImpact, allocation.bankId]
          );
        }

        // Reverse contact balance impact
        const contactBalanceImpact = allocation.paymentType === 'payment' ? allocation.payment_amount : -allocation.payment_amount;
        await client.query(
          `UPDATE hisab."contacts" 
           SET "currentBalance" = "currentBalance" - $1 
           WHERE id = $2`,
          [contactBalanceImpact, allocation.contactId]
        );

        // Delete the payment
        await client.query(
          `UPDATE hisab."payments" 
           SET "deletedAt" = CURRENT_TIMESTAMP, "deletedBy" = $1 
           WHERE id = $2`,
          [userId, paymentId]
        );
      } else {
        // Payment has multiple allocations - remove only this allocation and adjust payment
        console.log(`🔄 Adjusting payment ${allocation.paymentNumber} - removing allocation for this ${transactionType}`);
        
        // Calculate new payment amount
        const currentPaymentAmount = parseFloat(allocation.payment_amount || 0);
        const newPaymentAmount = Math.max(0, currentPaymentAmount - allocatedAmount);

        // Update payment amount
        await client.query(
          `UPDATE hisab."payments" 
           SET amount = $1, "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [newPaymentAmount, paymentId]
        );

        // Adjust bank balance
        if (allocation.bankId) {
          const bankAdjustment = allocation.paymentType === 'payment' ? allocatedAmount : -allocatedAmount;
          await client.query(
            `UPDATE hisab."bankAccounts" 
             SET "currentBalance" = "currentBalance" + $1 
             WHERE id = $2`,
            [bankAdjustment, allocation.bankId]
          );
        }

        // Adjust contact balance
        const contactAdjustment = allocation.paymentType === 'payment' ? -allocatedAmount : allocatedAmount;
        await client.query(
          `UPDATE hisab."contacts" 
           SET "currentBalance" = "currentBalance" + $1 
           WHERE id = $2`,
          [contactAdjustment, allocation.contactId]
        );
      }

      // Remove the allocation record
      await client.query(
        `DELETE FROM hisab."payment_allocations" WHERE id = $1`,
        [allocation.id]
      );
    }
  }
} 