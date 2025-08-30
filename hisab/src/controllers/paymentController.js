import { compareSync } from "bcrypt";
import pool from "../config/dbConnection.js";
import { errorResponse, successResponse, uploadFileToS3, generatePaymentPDFFromHTML, generatePaymentPDFFileName, createPaymentInvoiceHTML } from "../utils/index.js";

// Helper function to check if new columns exist in payment_allocations table
async function checkNewColumnsExist(client) {
  try {
    const result = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'hisab' 
        AND table_name = 'payment_allocations' 
        AND column_name IN ('expenseId', 'incomeId')
    `);
    return result.rows.length === 2; // Both columns should exist
  } catch (error) {
    return false;
  }
}

export async function createPayment(req, res) {
  console.log('💳 createPayment received request body:', req.body);
  
  const {
    contactId,
    bankAccountId,
    date,
    description,
    adjustmentType,
    adjustmentValue,
    transactionAllocations
  } = req.body;

  console.log('📋 Extracted fields:', {
    contactId,
    bankAccountId,
    date,
    description,
    adjustmentType,
    adjustmentValue,
    transactionAllocationsLength: transactionAllocations?.length
  });

  const { companyId, id: currentUserId } = req.currentUser || {};

  if (!companyId || !currentUserId) return errorResponse(res, "Unauthorized access", 401);
  
  // Enhanced validation with specific field checking
  const missingFields = [];
  if (!contactId) missingFields.push('contactId');
  if (!bankAccountId) missingFields.push('bankAccountId');
  if (!date) missingFields.push('date');
  if (!transactionAllocations?.length) missingFields.push('transactionAllocations');
  
  if (missingFields.length > 0) {
    console.log('❌ Missing fields:', missingFields);
    return errorResponse(res, `Required fields are missing: ${missingFields.join(', ')}`, 400);
  }
  if (adjustmentType && !['discount', 'extra_receipt', 'surcharge', 'none'].includes(adjustmentType)) {
    return errorResponse(res, "Invalid adjustment type", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // OPTIMIZATION 1: Single query to get all required data with FOR UPDATE
    const [contactQuery, bankQuery] = await Promise.all([
      client.query(
        `SELECT "currentBalance", "currentBalanceType" FROM hisab."contacts" WHERE id = $1 AND "companyId" = $2 FOR UPDATE`,
        [contactId, companyId]
      ),
      client.query(
        `SELECT "currentBalance" FROM hisab."bankAccounts" WHERE id = $1 AND "companyId" = $2 FOR UPDATE`,
        [bankAccountId, companyId]
      )
    ]);

    if (!contactQuery.rows.length) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Contact not found", 404);
    }
    if (!bankQuery.rows.length) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Bank account not found", 404);
    }

    // OPTIMIZATION 2: Pre-fetch all transaction data in batch
    const transactionIds = transactionAllocations
      .filter(allocation => allocation.transactionId !== 'current-balance')
      .map(allocation => allocation.transactionId);

    let transactionsData = {};
    if (transactionIds.length > 0) {
      const [purchasesQuery, salesQuery, expensesQuery, incomesQuery] = await Promise.all([
        client.query(
          `SELECT id, "netPayable", "remaining_amount", "paid_amount" FROM hisab."purchases" WHERE id = ANY($1) AND "companyId" = $2 FOR UPDATE`,
          [transactionIds, companyId]
        ),
        client.query(
          `SELECT id, "netReceivable", "remaining_amount", "paid_amount" FROM hisab."sales" WHERE id = ANY($1) AND "companyId" = $2 FOR UPDATE`,
          [transactionIds, companyId]
        ),
        client.query(
          `SELECT id, "amount", "remaining_amount", "paid_amount", "status", "bankAccountId" FROM hisab."expenses" WHERE id = ANY($1) AND "companyId" = $2 FOR UPDATE`,
          [transactionIds, companyId]
        ),
        client.query(
          `SELECT id, "amount", "status", "bankAccountId", "remaining_amount", "paid_amount" FROM hisab."incomes" WHERE id = ANY($1) AND "companyId" = $2 FOR UPDATE`,
          [transactionIds, companyId]
        )
      ]);

      // Create lookup maps for faster access
      purchasesQuery.rows.forEach(row => transactionsData[`purchase_${row.id}`] = row);
      salesQuery.rows.forEach(row => transactionsData[`sale_${row.id}`] = row);
      expensesQuery.rows.forEach(row => transactionsData[`expense_${row.id}`] = row);
      incomesQuery.rows.forEach(row => transactionsData[`income_${row.id}`] = row);
    }

    // Calculate net amounts based on balance types
    let receivableAmount = 0;
    let payableAmount = 0;
    let currentBalanceAmount = 0;
    let purchaseAmount = 0;
    let saleAmount = 0;
    let expenseAmount = 0;
    let incomeAmount = 0;

    transactionAllocations.forEach(allocation => {
      const paidAmount = parseFloat(allocation.paidAmount || 0);
      const balanceType = allocation.type || 'payable';
      const transactionType = allocation.transactionType || 'purchase';

      if (allocation.transactionId === 'current-balance') {
        currentBalanceAmount += paidAmount;
        if (balanceType === 'receivable') {
          receivableAmount += paidAmount;
        } else {
          payableAmount += paidAmount;
        }
      } else if (transactionType === 'purchase') {
        purchaseAmount += paidAmount;
        if (balanceType === 'receivable') {
          receivableAmount += paidAmount;
        } else {
          payableAmount += paidAmount;
        }
      } else if (transactionType === 'sale') {
        saleAmount += paidAmount;
        if (balanceType === 'receivable') {
          receivableAmount += paidAmount;
        } else {
          payableAmount += paidAmount;
        }
      } else if (transactionType === 'expense') {
        expenseAmount += paidAmount;
        if (balanceType === 'receivable') {
          receivableAmount += paidAmount;
        } else {
          payableAmount += paidAmount;
        }
      } else if (transactionType === 'income') {
        incomeAmount += paidAmount;
        if (balanceType === 'receivable') {
          receivableAmount += paidAmount;
        } else {
          payableAmount += paidAmount;
        }
      }
    });

    // Calculate net amount for bank impact
    const netAmount = receivableAmount - payableAmount;
    
    // Fix: Correct payment type logic
    // If we have more payable (we owe them) -> we pay -> outflow -> 'payment'
    // If we have more receivable (they owe us) -> we receive -> inflow -> 'receipt'
    const paymentType = payableAmount > receivableAmount ? 'payment' : 'receipt';
    const absoluteNetAmount = Math.abs(netAmount);

    // Apply adjustments to the net amount
    const adjValue = parseFloat(adjustmentValue || 0);
    let originalAmount = absoluteNetAmount;
    let adjustedAmount = absoluteNetAmount;

    if (adjustmentType === 'discount') {
      adjustedAmount = Math.max(0, absoluteNetAmount - adjValue);
    } else if (adjustmentType === 'extra_receipt' || adjustmentType === 'surcharge') {
      originalAmount = absoluteNetAmount + adjValue;
      adjustedAmount = absoluteNetAmount;
    }

    // OPTIMIZATION 3: Use a more efficient payment number generation
    const year = new Date().getFullYear();
    const countResult = await client.query(
      `SELECT COUNT(*) FROM hisab."payments" WHERE "companyId" = $1 AND EXTRACT(YEAR FROM "createdAt") = $2`,
      [companyId, year]
    );
    const paymentNumber = `PY-${year}-${(parseInt(countResult.rows[0].count) + 1).toString().padStart(4, '0')}`;

    // Calculate bank impact
    let bankImpact = 0;
    if (adjustmentType === 'discount') {
      bankImpact = paymentType === 'payment' ? -adjustedAmount : adjustedAmount;
    } else if (adjustmentType === 'extra_receipt' || adjustmentType === 'surcharge') {
      bankImpact = paymentType === 'payment' ? -originalAmount : originalAmount;
    } else {
      // Fix: Correct bank impact calculation
      // payment = money goes out (negative impact on bank)
      // receipt = money comes in (positive impact on bank)
      bankImpact = paymentType === 'payment' ? -absoluteNetAmount : absoluteNetAmount;
    }

    // Calculate contact balance impact
    const { currentBalance, currentBalanceType } = contactQuery.rows[0];
    const currentBalanceValue = parseFloat(currentBalance || 0);
    let newCurrentBalance = currentBalanceValue;
    let newCurrentBalanceType = currentBalanceType;

    if (currentBalanceAmount > 0) {
      const currentBalanceAllocation = transactionAllocations.find(
        allocation => allocation.transactionId === 'current-balance'
      );
      const currentBalanceType_allocation = currentBalanceAllocation?.type ||
        (paymentType === 'receipt' ? 'receivable' : 'payable');

      if (currentBalanceType_allocation === 'receivable') {
        if (currentBalanceType === 'receivable') {
          newCurrentBalance = Math.max(0, currentBalanceValue - currentBalanceAmount);
        } else if (currentBalanceType === 'payable') {
          newCurrentBalance = Math.max(0, currentBalanceValue - currentBalanceAmount);
        }
      } else if (currentBalanceType_allocation === 'payable') {
        if (currentBalanceType === 'payable') {
          newCurrentBalance = Math.max(0, currentBalanceValue - currentBalanceAmount);
        } else if (currentBalanceType === 'receivable') {
          newCurrentBalance = Math.max(0, currentBalanceValue - currentBalanceAmount);
        }
      }

      if (newCurrentBalance < 0) {
        newCurrentBalance = Math.abs(newCurrentBalance);
        newCurrentBalanceType = currentBalanceType === 'receivable' ? 'payable' : 'receivable';
      }

      if (newCurrentBalance === 0) {
        newCurrentBalanceType = 'payable';
      }
    }

    // Create payment record
    const paymentResult = await client.query(
      `INSERT INTO hisab."payments" (
        "paymentNumber", "companyId", "contactId", "bankId", "date", 
        "amount", "paymentType", "description", 
        "adjustmentType", "adjustmentValue", "createdBy"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        paymentNumber,
        companyId,
        contactId,
        bankAccountId,
        date,
        originalAmount,
        paymentType,
        description,
        adjustmentType || null,
        adjustmentValue || null,
        currentUserId
      ]
    );

    const paymentId = paymentResult.rows[0].id;

    // OPTIMIZATION 4: Batch update bank balance
    if (bankImpact !== 0) {
      await client.query(
        `UPDATE hisab."bankAccounts" SET "currentBalance" = "currentBalance" + $1 WHERE id = $2`,
        [bankImpact, bankAccountId]
      );
    }

    // Update contact balance if current-balance payment is made
    if (currentBalanceAmount > 0) {
      await client.query(
        `UPDATE hisab."contacts" 
         SET "currentBalance" = $1, "currentBalanceType" = $2, "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = $3 AND "companyId" = $4`,
        [newCurrentBalance, newCurrentBalanceType, contactId, companyId]
      );
    }

    // OPTIMIZATION 5: Prepare batch operations for allocations and transaction updates
    const allocationQueries = [];
    const transactionUpdateQueries = [];

    for (const allocation of transactionAllocations) {
      const balanceType = allocation.type || 'payable';
      const transactionType = allocation.transactionType || 'purchase';
      const paidAmount = parseFloat(allocation.paidAmount || 0);

      if (allocation.transactionId === 'current-balance') {
        allocationQueries.push({
          query: `INSERT INTO hisab."payment_allocations" (
            "paymentId", "purchaseId", "saleId", "expenseId", "incomeId", "allocationType", "amount", "paidAmount", "balanceType", "createdAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
          params: [
            paymentId,
            null,
            null,
            null,
            null,
            'current-balance',
            parseFloat(allocation.amount || 0),
            paidAmount,
            balanceType
          ]
        });
      } else if (transactionType === 'purchase') {
        const transactionKey = `purchase_${allocation.transactionId}`;
        const purchase = transactionsData[transactionKey];
        
        if (purchase) {
          const currentPaidAmount = parseFloat(purchase.paid_amount || 0);
          const newPaidAmount = currentPaidAmount + paidAmount;
          const purchaseAmount = parseFloat(purchase.netPayable || 0);
          const newRemainingAmount = Math.max(0, purchaseAmount - newPaidAmount);
          const isFullyPaid = newRemainingAmount <= 0;

          transactionUpdateQueries.push({
            query: `UPDATE hisab."purchases" 
             SET "status" = $1, "remaining_amount" = $2, "paid_amount" = $3, "bankAccountId" = $4, "updatedAt" = CURRENT_TIMESTAMP
             WHERE id = $5`,
            params: [isFullyPaid ? 'paid' : 'pending', newRemainingAmount, newPaidAmount, isFullyPaid ? bankAccountId : null, allocation.transactionId]
          });

          allocationQueries.push({
            query: `INSERT INTO hisab."payment_allocations" (
              "paymentId", "purchaseId", "saleId", "expenseId", "incomeId", "allocationType", "amount", "paidAmount", "balanceType", "createdAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
            params: [
              paymentId,
              allocation.transactionId,
              null,
              null,
              null,
              'purchase',
              parseFloat(allocation.amount || 0),
              paidAmount,
              balanceType
            ]
          });
        }
      } else if (transactionType === 'sale') {
        const transactionKey = `sale_${allocation.transactionId}`;
        const sale = transactionsData[transactionKey];
        
        if (sale) {
          const currentPaidAmount = parseFloat(sale.paid_amount || 0);
          const newPaidAmount = currentPaidAmount + paidAmount;
          const saleAmount = parseFloat(sale.netReceivable || 0);
          const newRemainingAmount = Math.max(0, saleAmount - newPaidAmount);
          const isFullyPaid = newRemainingAmount <= 0;

          transactionUpdateQueries.push({
            query: `UPDATE hisab."sales" 
             SET "status" = $1, "remaining_amount" = $2, "paid_amount" = $3, "bankAccountId" = $4, "updatedAt" = CURRENT_TIMESTAMP
             WHERE id = $5`,
            params: [isFullyPaid ? 'paid' : 'pending', newRemainingAmount, newPaidAmount, isFullyPaid ? bankAccountId : null, allocation.transactionId]
          });

          allocationQueries.push({
            query: `INSERT INTO hisab."payment_allocations" (
              "paymentId", "purchaseId", "saleId", "expenseId", "incomeId", "allocationType", "amount", "paidAmount", "balanceType", "createdAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
            params: [
              paymentId,
              null,
              allocation.transactionId,
              null,
              null,
              'sale',
              parseFloat(allocation.amount || 0),
              paidAmount,
              balanceType
            ]
          });
        }
      } else if (transactionType === 'expense') {
        const transactionKey = `expense_${allocation.transactionId}`;
        const expense = transactionsData[transactionKey];
        
        if (expense) {
          const currentPaidAmount = parseFloat(expense.paid_amount || 0);
          const newPaidAmount = currentPaidAmount + paidAmount;
          const expenseAmount = parseFloat(expense.amount || 0);
          const newRemainingAmount = Math.max(0, expenseAmount - newPaidAmount);
          const isFullyPaid = newRemainingAmount <= 0;

          transactionUpdateQueries.push({
            query: `UPDATE hisab."expenses" 
             SET "status" = $1, "remaining_amount" = $2, "paid_amount" = $3, "bankAccountId" = $4, "updatedAt" = CURRENT_TIMESTAMP
             WHERE id = $5`,
            params: [isFullyPaid ? 'paid' : 'pending', Math.max(0, newRemainingAmount), newPaidAmount, isFullyPaid ? bankAccountId : null, allocation.transactionId]
          });

                  allocationQueries.push({
          query: `INSERT INTO hisab."payment_allocations" (
            "paymentId", "purchaseId", "saleId", "expenseId", "incomeId", "allocationType", "amount", "paidAmount", "balanceType", "createdAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
          params: [
            paymentId,
            null,
            null,
            allocation.transactionId,
            null,
            'expense',
            parseFloat(allocation.amount || 0),
            paidAmount,
            balanceType
          ]
        });
        }
      } else if (transactionType === 'income') {
        const transactionKey = `income_${allocation.transactionId}`;
        const income = transactionsData[transactionKey];
        
        if (income) {
          const currentPaidAmount = parseFloat(income.paid_amount || 0);
          const newPaidAmount = currentPaidAmount + paidAmount;
          const incomeAmount = parseFloat(income.amount || 0);
          const newRemainingAmount = Math.max(0, incomeAmount - newPaidAmount);
          const isFullyPaid = newRemainingAmount <= 0;

          transactionUpdateQueries.push({
            query: `UPDATE hisab."incomes" 
             SET "status" = $1, "bankAccountId" = $2, "remaining_amount" = $3, "paid_amount" = $4, "updatedAt" = CURRENT_TIMESTAMP
             WHERE id = $5`,
            params: [isFullyPaid ? 'paid' : 'pending', isFullyPaid ? bankAccountId : income.bankAccountId, newRemainingAmount, newPaidAmount, allocation.transactionId]
          });

                  allocationQueries.push({
          query: `INSERT INTO hisab."payment_allocations" (
            "paymentId", "purchaseId", "saleId", "expenseId", "incomeId", "allocationType", "amount", "paidAmount", "balanceType", "createdAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
          params: [
            paymentId,
            null,
            null,
            null,
            allocation.transactionId,
            'income',
            parseFloat(allocation.amount || 0),
            paidAmount,
            balanceType
          ]
        });
        }
      }
    }

    // OPTIMIZATION 6: Execute all queries in parallel
    await Promise.all([
      ...allocationQueries.map(q => client.query(q.query, q.params)),
      ...transactionUpdateQueries.map(q => client.query(q.query, q.params))
    ]);

    await client.query("COMMIT");

    const newPaymentId = paymentResult.rows[0].id;

    // OPTIMIZATION 7: Generate PDF asynchronously (don't wait for it)
    setImmediate(async () => {
      try {
        console.log(`🚀 Generating PDF for payment ${newPaymentId} asynchronously...`);
        const pdfUrl = await generatePaymentPDFInternal(newPaymentId, companyId);
        
        const pdfClient = await pool.connect();
        try {
          await pdfClient.query(
            `UPDATE hisab."payments" 
             SET "pdfUrl" = $1, "pdfGeneratedAt" = CURRENT_TIMESTAMP 
             WHERE "id" = $2 AND "companyId" = $3`,
            [pdfUrl, newPaymentId, companyId]
          );
          console.log(`✅ PDF generated and saved for payment ${newPaymentId}`);
        } finally {
          pdfClient.release();
        }
      } catch (pdfError) {
        console.error(`❌ PDF generation failed for payment ${newPaymentId}:`, pdfError);
      }
    });

    return successResponse(res, {
      message: "Payment created successfully",
      payment: paymentResult.rows[0],
      pdfGeneration: { status: 'queued', message: 'PDF will be generated in background' },
      calculatedValues: {
        receivableAmount,
        payableAmount,
        netAmount,
        autoDetectedPaymentType: paymentType,
        bankImpact,
        originalAmount,
        adjustedAmount
      },
      accountingImpact: {
        currentContactBalance: currentBalanceValue,
        currentContactBalanceType: currentBalanceType,
        bankBalanceChange: bankImpact,
        adjustmentApplied: adjustmentType && adjustmentType !== 'none' ? {
          type: adjustmentType,
          value: adjValue,
          originalAmount: originalAmount,
          adjustedAmount: adjustedAmount
        } : null
      }
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Payment creation error:", error);
    return errorResponse(res, "Failed to create payment", 500);
  } finally {
    client.release();
  }
}

export async function updatePayment(req, res) {
  const {
    id,
    contactId,
    bankAccountId,
    date,
    description,
    adjustmentType,
    adjustmentValue,
    transactionAllocations
  } = req.body;

  const { companyId, id: currentUserId } = req.currentUser || {};

  if (!companyId || !currentUserId) return errorResponse(res, "Unauthorized access", 401);
  if (!id) return errorResponse(res, "Payment ID is required", 400);
  if (!contactId || !bankAccountId || !date || !transactionAllocations?.length) {
    return errorResponse(res, "Required fields are missing", 400);
  }
  if (adjustmentType && !['discount', 'extra_receipt', 'surcharge', 'none'].includes(adjustmentType)) {
    return errorResponse(res, "Invalid adjustment type", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // OPTIMIZATION 1: Fetch all required data in parallel
    const [existingPaymentQuery, existingAllocationsQuery, contactQuery, bankQuery] = await Promise.all([
      client.query(
        `SELECT * FROM hisab."payments" WHERE id = $1 AND "companyId" = $2 FOR UPDATE`,
        [id, companyId]
      ),
      client.query(
        `SELECT * FROM hisab."payment_allocations" WHERE "paymentId" = $1 ORDER BY "createdAt" ASC`,
        [id]
      ),
      client.query(
        `SELECT "currentBalance", "currentBalanceType" FROM hisab."contacts" WHERE id = $1 AND "companyId" = $2 FOR UPDATE`,
        [contactId, companyId]
      ),
      client.query(
        `SELECT "currentBalance" FROM hisab."bankAccounts" WHERE id = $1 AND "companyId" = $2 FOR UPDATE`,
        [bankAccountId, companyId]
      )
    ]);

    if (!existingPaymentQuery.rows.length) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Payment not found", 404);
    }
    if (!contactQuery.rows.length) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Contact not found", 404);
    }
    if (!bankQuery.rows.length) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Bank account not found", 404);
    }

    const existingPayment = existingPaymentQuery.rows[0];
    const existingAllocations = existingAllocationsQuery.rows;

    // Calculate old values
    let oldReceivableAmount = 0;
    let oldPayableAmount = 0;
    let oldCurrentBalanceAmount = 0;
    let oldPurchaseAmount = 0;
    let oldSaleAmount = 0;
    let oldExpenseAmount = 0;
    let oldIncomeAmount = 0;

    existingAllocations.forEach(allocation => {
      const paidAmount = parseFloat(allocation.paidAmount || 0);
      const balanceType = allocation.balanceType || 'payable';
      const transactionType = allocation.allocationType || 'purchase'; // Default to purchase for backward compatibility

      if (allocation.allocationType === 'current-balance') {
        oldCurrentBalanceAmount += paidAmount;
        if (balanceType === 'receivable') {
          oldReceivableAmount += paidAmount;
        } else {
          oldPayableAmount += paidAmount;
        }
      } else if (transactionType === 'purchase') {
        oldPurchaseAmount += paidAmount;
        if (balanceType === 'receivable') {
          oldReceivableAmount += paidAmount;
        } else {
          oldPayableAmount += paidAmount;
        }
      } else if (transactionType === 'sale') {
        oldSaleAmount += paidAmount;
        if (balanceType === 'receivable') {
          oldReceivableAmount += paidAmount;
        } else {
          oldPayableAmount += paidAmount;
        }
      } else if (transactionType === 'expense') {
        oldExpenseAmount += paidAmount;
        if (balanceType === 'receivable') {
          oldReceivableAmount += paidAmount;
        } else {
          oldPayableAmount += paidAmount;
        }
      } else if (transactionType === 'income') {
        oldIncomeAmount += paidAmount;
        if (balanceType === 'receivable') {
          oldReceivableAmount += paidAmount;
        } else {
          oldPayableAmount += paidAmount;
        }
      }
    });

    const oldNetAmount = oldReceivableAmount - oldPayableAmount;
    const oldPaymentType = existingPayment.paymentType;
    const oldAbsoluteNetAmount = Math.abs(oldNetAmount);
    const oldAdjValue = parseFloat(existingPayment.adjustmentValue || 0);
    let oldOriginalAmount = oldAbsoluteNetAmount;
    let oldAdjustedAmount = oldAbsoluteNetAmount;

    if (existingPayment.adjustmentType === 'discount') {
      oldAdjustedAmount = Math.max(0, oldAbsoluteNetAmount - oldAdjValue);
    } else if (existingPayment.adjustmentType === 'extra_receipt' || existingPayment.adjustmentType === 'surcharge') {
      oldOriginalAmount = oldAbsoluteNetAmount + oldAdjValue;
      oldAdjustedAmount = oldAbsoluteNetAmount;
    }

    // Calculate new values
    let newReceivableAmount = 0;
    let newPayableAmount = 0;
    let newCurrentBalanceAmount = 0;
    let newPurchaseAmount = 0;
    let newSaleAmount = 0;
    let newExpenseAmount = 0;
    let newIncomeAmount = 0;

    transactionAllocations.forEach(allocation => {
      const paidAmount = parseFloat(allocation.paidAmount || 0);
      const balanceType = allocation.type || 'payable';
      const transactionType = allocation.transactionType || 'purchase'; // Default to purchase for backward compatibility

      if (allocation.transactionId === 'current-balance') {
        newCurrentBalanceAmount += paidAmount;
        if (balanceType === 'receivable') {
          newReceivableAmount += paidAmount;
        } else {
          newPayableAmount += paidAmount;
        }
      } else if (transactionType === 'purchase') {
        newPurchaseAmount += paidAmount;
        if (balanceType === 'receivable') {
          newReceivableAmount += paidAmount;
        } else {
          newPayableAmount += paidAmount;
        }
      } else if (transactionType === 'sale') {
        newSaleAmount += paidAmount;
        if (balanceType === 'receivable') {
          newReceivableAmount += paidAmount;
        } else {
          newPayableAmount += paidAmount;
        }
      } else if (transactionType === 'expense') {
        newExpenseAmount += paidAmount;
        if (balanceType === 'receivable') {
          newReceivableAmount += paidAmount;
        } else {
          newPayableAmount += paidAmount;
        }
      } else if (transactionType === 'income') {
        newIncomeAmount += paidAmount;
        if (balanceType === 'receivable') {
          newReceivableAmount += paidAmount;
        } else {
          newPayableAmount += paidAmount;
        }
      }
    });

    const newNetAmount = newReceivableAmount - newPayableAmount;
    const newPaymentType = newNetAmount > 0 ? 'receipt' : 'payment';
    const newAbsoluteNetAmount = Math.abs(newNetAmount);
    const newAdjValue = parseFloat(adjustmentValue || 0);
    let newOriginalAmount = newAbsoluteNetAmount;
    let newAdjustedAmount = newAbsoluteNetAmount;

    if (adjustmentType === 'discount') {
      newAdjustedAmount = Math.max(0, newAbsoluteNetAmount - newAdjValue);
    } else if (adjustmentType === 'extra_receipt' || adjustmentType === 'surcharge') {
      newOriginalAmount = newAbsoluteNetAmount + newAdjValue;
      newAdjustedAmount = newAbsoluteNetAmount;
    }

    const { currentBalance, currentBalanceType } = contactQuery.rows[0];
    const currentBalanceValue = parseFloat(currentBalance || 0);

    // Calculate old bank impact - FIXED LOGIC
    let oldBankImpact = 0;
    if (existingPayment.adjustmentType === 'discount') {
      oldBankImpact = oldPaymentType === 'payment' ? -oldAdjustedAmount : oldAdjustedAmount;
    } else if (existingPayment.adjustmentType === 'extra_receipt' || existingPayment.adjustmentType === 'surcharge') {
      oldBankImpact = oldPaymentType === 'payment' ? -oldOriginalAmount : oldOriginalAmount;
    } else {
      oldBankImpact = oldPaymentType === 'payment' ? -oldAbsoluteNetAmount : oldAbsoluteNetAmount;
    }

    // Reverse old bank impact
    if (oldBankImpact !== 0) {
      await client.query(
        `UPDATE hisab."bankAccounts" SET "currentBalance" = "currentBalance" - $1 WHERE id = $2`,
        [oldBankImpact, existingPayment.bankId]
      );
    }

    // Reverse old contact balance impact
    if (oldCurrentBalanceAmount > 0) {
      let newCurrentBalance = currentBalanceValue;
      let newCurrentBalanceType = currentBalanceType;
      
      const oldCurrentBalanceAllocation = existingAllocations.find(
        allocation => allocation.allocationType === 'current-balance'
      );
      const oldCurrentBalanceType_allocation = oldCurrentBalanceAllocation?.balanceType || 'payable';

      if (oldCurrentBalanceType_allocation === 'receivable') {
        if (currentBalanceType === 'receivable') {
          newCurrentBalance = newCurrentBalance + oldCurrentBalanceAmount;
        } else if (currentBalanceType === 'payable') {
          newCurrentBalance = newCurrentBalance - oldCurrentBalanceAmount;
        }
      } else if (oldCurrentBalanceType_allocation === 'payable') {
        if (currentBalanceType === 'payable') {
          newCurrentBalance = newCurrentBalance + oldCurrentBalanceAmount;
        } else if (currentBalanceType === 'receivable') {
          newCurrentBalance = newCurrentBalance - oldCurrentBalanceAmount;
        }
      }

      if (newCurrentBalance < 0) {
        newCurrentBalance = Math.abs(newCurrentBalance);
        newCurrentBalanceType = currentBalanceType === 'receivable' ? 'payable' : 'receivable';
      }

      if (newCurrentBalance === 0) {
        newCurrentBalanceType = 'payable';
      }

      // Update contact balance with the reversed values
      await client.query(
        `UPDATE hisab."contacts" 
         SET "currentBalance" = $1, "currentBalanceType" = $2, "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = $3 AND "companyId" = $4`,
        [newCurrentBalance, newCurrentBalanceType, contactId, companyId]
      );
    }

    // Reverse transaction impacts using the centralized function
    const reversalQueries = await reverseTransactionAllocations(client, existingAllocations, companyId, existingPayment);

    // Execute all reversal queries
    for (const query of reversalQueries) {
      await client.query(query.query, query.params);
    }

    // Delete old allocations
    await client.query(`DELETE FROM hisab."payment_allocations" WHERE "paymentId" = $1`, [id]);

    // Apply new contact balance impact
    if (newCurrentBalanceAmount > 0) {
      let newCurrentBalance = currentBalanceValue;
      let newCurrentBalanceType = currentBalanceType;

      // Calculate new contact balance based on current-balance allocation
      const currentBalanceAllocation = transactionAllocations.find(
        allocation => allocation.transactionId === 'current-balance'
      );
      const currentBalanceType_allocation = currentBalanceAllocation?.type || 'payable';

      if (currentBalanceType_allocation === 'receivable') {
        if (currentBalanceType === 'receivable') {
          newCurrentBalance = Math.max(0, currentBalanceValue - newCurrentBalanceAmount);
        } else if (currentBalanceType === 'payable') {
          newCurrentBalance = Math.max(0, currentBalanceValue - newCurrentBalanceAmount);
        }
      } else if (currentBalanceType_allocation === 'payable') {
        if (currentBalanceType === 'payable') {
          newCurrentBalance = Math.max(0, currentBalanceValue - newCurrentBalanceAmount);
        } else if (currentBalanceType === 'receivable') {
          newCurrentBalance = Math.max(0, currentBalanceValue - newCurrentBalanceAmount);
        }
      }

      if (newCurrentBalance < 0) {
        newCurrentBalance = Math.abs(newCurrentBalance);
        newCurrentBalanceType = currentBalanceType === 'receivable' ? 'payable' : 'receivable';
      }

      if (newCurrentBalance === 0) {
        newCurrentBalanceType = 'payable';
      }

      await client.query(
        `UPDATE hisab."contacts" 
         SET "currentBalance" = $1, "currentBalanceType" = $2, "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = $3 AND "companyId" = $4`,
        [newCurrentBalance, newCurrentBalanceType, contactId, companyId]
      );
    }

    // Calculate new bank impact - FIXED LOGIC
    let newBankImpact = 0;
    if (adjustmentType === 'discount') {
      newBankImpact = newPaymentType === 'payment' ? -newAdjustedAmount : newAdjustedAmount;
    } else if (adjustmentType === 'extra_receipt' || adjustmentType === 'surcharge') {
      newBankImpact = newPaymentType === 'payment' ? -newOriginalAmount : newOriginalAmount;
    } else {
      newBankImpact = newPaymentType === 'payment' ? -newAbsoluteNetAmount : newAbsoluteNetAmount;
    }

    // Apply new bank impact
    if (newBankImpact !== 0) {
      await client.query(
        `UPDATE hisab."bankAccounts" SET "currentBalance" = "currentBalance" + $1 WHERE id = $2`,
        [newBankImpact, bankAccountId]
      );
    }

    // Process new transaction allocations using the centralized function
    const { allocationQueries, transactionUpdateQueries } = await processNewTransactionAllocations(client, transactionAllocations, id, companyId, bankAccountId);

    // Execute all transaction update queries
    for (const query of transactionUpdateQueries) {
      await client.query(query.query, query.params);
    }

    // Execute all allocation queries
    for (const query of allocationQueries) {
      await client.query(query.query, query.params);
    }

    // Update payment record
    const updatedPaymentResult = await client.query(
      `UPDATE hisab."payments" 
       SET "contactId" = $1, "bankId" = $2, "date" = $3, "amount" = $4,
           "paymentType" = $5, "description" = $6, "adjustmentType" = $7, "adjustmentValue" = $8, "updatedAt" = NOW()
       WHERE id = $9 RETURNING *`,
      [
        contactId,
        bankAccountId,
        date,
        newOriginalAmount,
        newPaymentType,
        description,
        adjustmentType || null,
        adjustmentValue || null,
        id
      ]
    );

    await client.query("COMMIT");

    // Wait for PDF regeneration to complete before returning response
    console.log(`🚀 Regenerating PDF for payment ${id} before returning response...`);
    let pdfRegenerationResult = null;
    
    try {
      const pdfUrl = await generatePaymentPDFInternal(id, companyId);
      console.log(`📄 PDF regenerated successfully: ${pdfUrl}`);
      
      // Update payment record with PDF URL using a new connection
      const pdfClient = await pool.connect();
      try {
        await pdfClient.query(
          `UPDATE hisab."payments" 
           SET "pdfUrl" = $1, "pdfGeneratedAt" = CURRENT_TIMESTAMP 
           WHERE "id" = $2 AND "companyId" = $3`,
          [pdfUrl, id, companyId]
        );
        console.log(`✅ PDF URL updated in database for payment ${id}. API response ready.`);
        pdfRegenerationResult = { success: true, pdfUrl };
      } finally {
        pdfClient.release();
      }
    } catch (pdfError) {
      console.error(`❌ PDF regeneration failed for payment ${id}:`, pdfError);
      // Don't fail the payment update, but include error in response
      pdfRegenerationResult = { success: false, error: pdfError.message };
    }

    return successResponse(res, {
      message: "Payment updated successfully with PDF",
      payment: updatedPaymentResult.rows[0],
      pdfRegeneration: pdfRegenerationResult,
      calculatedValues: {
        old: {
          receivableAmount: oldReceivableAmount,
          payableAmount: oldPayableAmount,
          netAmount: oldNetAmount,
          paymentType: oldPaymentType,
          bankImpact: oldBankImpact,
          adjustedAmount: oldAdjustedAmount,
          originalAmount: oldOriginalAmount
        },
        new: {
          receivableAmount: newReceivableAmount,
          payableAmount: newPayableAmount,
          netAmount: newNetAmount,
          autoDetectedPaymentType: newPaymentType,
          bankImpact: newBankImpact,
          adjustedAmount: newAdjustedAmount,
          originalAmount: newOriginalAmount
        }
      },
      accountingImpact: {
        currentContactBalance: currentBalanceValue,
        currentContactBalanceType: currentBalanceType,
        bankBalanceChange: newBankImpact,
        oldBankBalanceChange: -oldBankImpact,
        netBankBalanceChange: newBankImpact - oldBankImpact
      }
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Payment update error:", error);
    return errorResponse(res, "Failed to update payment", 500);
  } finally {
    client.release();
  }
}

export async function getPaymentDetails(req, res) {
  const { companyId } = req.currentUser || {};
  const { id } = req.query;

  if (!companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    const paymentQuery = `
      SELECT 
        p.*,
        c."name" as "contactName",
        c."balanceType" as "contactBalanceType",
        c."openingBalance" as "contactOpeningBalance",
        c."currentBalance" as "contactCurrentBalance",
        c."currentBalanceType" as "contactCurrentBalanceType",
        c."billingAddress1" as "contactBillingAddress1",
        c."billingAddress2" as "contactBillingAddress2",
        c."billingCity" as "contactBillingCity",
        c."billingState" as "contactBillingState",
        c."billingPincode" as "contactBillingPincode",
        c."billingCountry" as "contactBillingCountry",
        b."accountName" as "bankAccountName",
        b."currentBalance" as "bankCurrentBalance",
        u."name" as "createdByName"
      FROM hisab."payments" p
      LEFT JOIN hisab."contacts" c ON p."contactId" = c."id"
      LEFT JOIN hisab."bankAccounts" b ON p."bankId" = b."id"
      LEFT JOIN hisab."users" u ON p."createdBy" = u."id"
      WHERE p."id" = $1 AND p."companyId" = $2 AND p."deletedAt" IS NULL
    `;

    const paymentResult = await client.query(paymentQuery, [id, companyId]);

    if (paymentResult.rows.length === 0) {
      return errorResponse(res, "Payment not found", 404);
    }

    const payment = paymentResult.rows[0];

    // Fetch payment allocations with complete transaction data
    const allocationsQuery = `
      SELECT 
        pa.id,
        pa."paymentId",
        pa."purchaseId",
        pa."saleId",
        pa."expenseId",
        pa."incomeId",
        pa."allocationType",
        pa."balanceType",
        pa.amount,
        pa."paidAmount",
        -- Purchase data
        pur."invoiceNumber" as "purchaseInvoiceNumber",
        pur."remaining_amount" as "purchasePendingAmount",
        pur."status" as "purchaseStatus",
        pur_contact."name" as "purchaseSupplierName",
        -- Sale data
        s."invoiceNumber" as "saleInvoiceNumber",
        s."remaining_amount" as "salePendingAmount",
        s."status" as "saleStatus",
        s_contact."name" as "saleCustomerName",
        -- Expense data
        exp."amount" as "expenseAmount",
        exp."notes" as "expenseNotes",
        exp."date" as "expenseDate",
        exp."status" as "expenseStatus",
        exp_cat."name" as "expenseCategoryName",
        exp_contact."name" as "expenseContactName",
        -- Income data
        inc."amount" as "incomeAmount", 
        inc."notes" as "incomeNotes",
        inc."date" as "incomeDate",
        inc."status" as "incomeStatus",
        inc_cat."name" as "incomeCategoryName",
        inc_contact."name" as "incomeContactName"
      FROM hisab."payment_allocations" pa
      LEFT JOIN hisab."purchases" pur ON pa."purchaseId" = pur."id" AND pa."allocationType" = 'purchase'
      LEFT JOIN hisab."contacts" pur_contact ON pur."contactId" = pur_contact."id"
      LEFT JOIN hisab."sales" s ON pa."saleId" = s."id" AND pa."allocationType" = 'sale'
      LEFT JOIN hisab."contacts" s_contact ON s."contactId" = s_contact."id"
      LEFT JOIN hisab."expenses" exp ON pa."expenseId" = exp."id" AND pa."allocationType" = 'expense'
      LEFT JOIN hisab."expenseCategories" exp_cat ON exp."categoryId" = exp_cat."id"
      LEFT JOIN hisab."contacts" exp_contact ON exp."contactId" = exp_contact."id"
      LEFT JOIN hisab."incomes" inc ON pa."incomeId" = inc."id" AND pa."allocationType" = 'income'
      LEFT JOIN hisab."incomeCategories" inc_cat ON inc."categoryId" = inc_cat."id"
      LEFT JOIN hisab."contacts" inc_contact ON inc."contactId" = inc_contact."id"
      WHERE pa."paymentId" = $1
      ORDER BY pa."createdAt" ASC
    `;

    const allocationsResult = await client.query(allocationsQuery, [id]);
    const allocations = allocationsResult.rows;

    // Transform allocations data
    const transformedAllocations = allocations.map(allocation => {
      let transformedAllocation = { ...allocation };
      
      switch (allocation.allocationType) {
        case 'current-balance':
          transformedAllocation.description = 'Current Balance Settlement';
          transformedAllocation.reference = 'Current Balance';
          transformedAllocation.transactionId = 'current-balance';
          transformedAllocation.pendingAmount = payment.contactCurrentBalance;
          transformedAllocation.balanceType = payment.contactCurrentBalanceType;
          break;
          
        case 'purchase':
          transformedAllocation.description = allocation.purchaseSupplierName ? 
            `Purchase from ${allocation.purchaseSupplierName}` : 
            'Purchase Payment';
          transformedAllocation.reference = allocation.purchaseInvoiceNumber ? 
            `Invoice #${allocation.purchaseInvoiceNumber}` : 
            `Purchase #${allocation.purchaseId}`;
          transformedAllocation.pendingAmount = allocation.purchasePendingAmount;
          transformedAllocation.status = allocation.purchaseStatus;
          transformedAllocation.transactionId = allocation.purchaseId;
          break;
          
        case 'sale':
          transformedAllocation.description = allocation.saleCustomerName ? 
            `Sale to ${allocation.saleCustomerName}` : 
            'Sale Payment';
          transformedAllocation.reference = allocation.saleInvoiceNumber ? 
            `Invoice #${allocation.saleInvoiceNumber}` : 
            `Sale #${allocation.saleId}`;
          transformedAllocation.pendingAmount = allocation.salePendingAmount;
          transformedAllocation.status = allocation.saleStatus;
          transformedAllocation.transactionId = allocation.saleId;
          break;
          
        case 'expense':
          transformedAllocation.description = 'Expense Payment';
          transformedAllocation.reference = `Expense #${allocation.expenseId}`;
          transformedAllocation.pendingAmount = allocation.expenseAmount;
          transformedAllocation.status = allocation.expenseStatus;
          transformedAllocation.transactionId = allocation.expenseId;
          break;
          
        case 'income':
          transformedAllocation.description = 'Income Receipt';
          transformedAllocation.reference = `Income #${allocation.incomeId}`;
          transformedAllocation.pendingAmount = allocation.incomeAmount;
          transformedAllocation.status = allocation.incomeStatus;
          transformedAllocation.transactionId = allocation.incomeId;
          break;
          
        default:
          transformedAllocation.description = 'Payment allocation';
          transformedAllocation.reference = 'Unknown';
          transformedAllocation.transactionId = null;
      }
      
      return transformedAllocation;
    });

    const isPayment = payment.paymentType === 'payment';

    return successResponse(res, {
      payment: {
        id: payment.id,
        paymentNumber: payment.paymentNumber,
        companyId: payment.companyId,
        contactId: payment.contactId,
        contactName: payment.contactName,
        bankId: payment.bankId,
        bankAccountName: payment.bankAccountName,
        date: payment.date,
        amount: payment.amount,
        paymentType: payment.paymentType,
        description: payment.description,
        adjustmentType: payment.adjustmentType,
        adjustmentValue: payment.adjustmentValue,
        allocations: transformedAllocations,
        createdAt: payment.createdAt,
        createdBy: payment.createdByName
      },
      accountingImpact: {
        contactBalanceChange: isPayment ? -payment.amount : payment.amount,
        currentContactBalance: payment.contactCurrentBalance,
        currentContactBalanceType: payment.contactCurrentBalanceType,
        ...(payment.bankId && {
          bankBalanceChange: isPayment ? -payment.amount : payment.amount,
          currentBankBalance: payment.bankCurrentBalance
        })
      }
    });

  } catch (error) {
    console.error("Payment details error:", error);
    return errorResponse(res, "Error fetching payment details", 500);
  } finally {
    client.release();
  }
}

export async function deletePayment(req, res) {
  const { id } = req.query;
  const { companyId, id: currentUserId } = req.currentUser || {};

  if (!companyId || !currentUserId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  if (!id) {
    return errorResponse(res, "Payment ID is required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check if new columns exist for backwards compatibility
    let hasNewColumns = false;
    try {
      const columnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'hisab' 
          AND table_name = 'payment_allocations' 
          AND column_name IN ('expenseId', 'incomeId', 'saleId')
      `);
      hasNewColumns = columnCheck.rows.length === 3;
    } catch (error) {
      hasNewColumns = false;
    }

    const paymentQuery = await client.query(
      `SELECT p.*, c."currentBalance", c."currentBalanceType"
       FROM hisab."payments" p
       JOIN hisab."contacts" c ON p."contactId" = c."id"
       WHERE p."id" = $1 AND p."companyId" = $2 AND p."deletedAt" IS NULL FOR UPDATE`,
      [id, companyId]
    );

    if (paymentQuery.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Payment not found", 404);
    }

    const payment = paymentQuery.rows[0];
    const { currentBalance, currentBalanceType } = payment;
    const currentBalanceValue = parseFloat(currentBalance) || 0;

    // Get allocations with proper columns based on schema version
    let allocationsQuery;
    if (hasNewColumns) {
      allocationsQuery = `
        SELECT *, "expenseId", "incomeId", "saleId" 
        FROM hisab."payment_allocations" 
        WHERE "paymentId" = $1 ORDER BY "createdAt" ASC
      `;
    } else {
      allocationsQuery = `
        SELECT * 
        FROM hisab."payment_allocations" 
        WHERE "paymentId" = $1 ORDER BY "createdAt" ASC
      `;
    }

    const allocationsResult = await client.query(allocationsQuery, [id]);
    const allocations = allocationsResult.rows;

    let receivableAmount = 0;
    let payableAmount = 0;
    let currentBalanceAmount = 0;
    let purchaseAmount = 0;
    let expenseAmount = 0;
    let incomeAmount = 0;

    allocations.forEach(allocation => {
      const paidAmount = parseFloat(allocation.paidAmount || 0);
      const balanceType = allocation.balanceType || 'payable';
      const transactionType = allocation.allocationType || 'purchase';

      if (allocation.allocationType === 'current-balance') {
        currentBalanceAmount += paidAmount;
        if (balanceType === 'receivable') {
          receivableAmount += paidAmount;
        } else {
          payableAmount += paidAmount;
        }
      } else if (transactionType === 'purchase') {
        if (balanceType === 'receivable') {
          receivableAmount += paidAmount;
        } else {
          payableAmount += paidAmount;
        }
      } else if (transactionType === 'sale') {
        if (balanceType === 'receivable') {
          receivableAmount += paidAmount;
        } else {
          payableAmount += paidAmount;
        }
      } else if (transactionType === 'expense') {
        if (balanceType === 'receivable') {
          receivableAmount += paidAmount;
        } else {
          payableAmount += paidAmount;
        }
      } else if (transactionType === 'income') {
        if (balanceType === 'receivable') {
          receivableAmount += paidAmount;
        } else {
          payableAmount += paidAmount;
        }
      }
    });

    const netAmount = receivableAmount - payableAmount;
    const absoluteNetAmount = Math.abs(netAmount);
    const adjValue = parseFloat(payment.adjustmentValue || 0);
    let originalAmount = absoluteNetAmount;
    let adjustedAmount = absoluteNetAmount;

    if (payment.adjustmentType === 'discount') {
      adjustedAmount = Math.max(0, absoluteNetAmount - adjValue);
    } else if (payment.adjustmentType === 'extra_receipt' || payment.adjustmentType === 'surcharge') {
      originalAmount = absoluteNetAmount + adjValue;
      adjustedAmount = absoluteNetAmount;
    }

    // Reverse transaction impacts using the centralized function
    const reversalQueries = await reverseTransactionAllocations(client, allocations, companyId, payment);

    // Execute all reversal queries
    for (const query of reversalQueries) {
      await client.query(query.query, query.params);
    }

    // Delete payment allocations
    await client.query(
      `DELETE FROM hisab."payment_allocations" WHERE "paymentId" = $1`,
      [id]
    );

    // Reverse bank balance impact
    if (payment.bankId) {
      const bankQuery = await client.query(
        `SELECT "currentBalance" FROM hisab."bankAccounts" 
         WHERE id = $1 AND "companyId" = $2 FOR UPDATE`,
        [payment.bankId, companyId]
      );

      if (bankQuery.rows.length) {
        // Calculate bank impact to reverse
        let bankImpact = 0;
        if (payment.adjustmentType === 'discount') {
          bankImpact = payment.paymentType === 'payment' ? -adjustedAmount : adjustedAmount;
        } else if (payment.adjustmentType === 'extra_receipt' || payment.adjustmentType === 'surcharge') {
          bankImpact = payment.paymentType === 'payment' ? -originalAmount : originalAmount;
        } else {
          bankImpact = payment.paymentType === 'payment' ? -absoluteNetAmount : absoluteNetAmount;
        }

        // Reverse the bank impact
        await client.query(
          `UPDATE hisab."bankAccounts" 
           SET "currentBalance" = "currentBalance" - $1, "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [bankImpact, payment.bankId]
        );
      }
    }

    // Reverse contact balance impact if current-balance payment was made
    if (currentBalanceAmount > 0) {
      const currentBalanceAllocation = allocations.find(
        allocation => allocation.allocationType === 'current-balance'
      );
      const currentBalanceType_allocation = currentBalanceAllocation?.balanceType || 'payable';

      // Get current contact balance
      const contactQuery = await client.query(
        `SELECT "currentBalance", "currentBalanceType" FROM hisab."contacts" 
         WHERE "id" = $1 AND "companyId" = $2 FOR UPDATE`,
        [payment.contactId, companyId]
      );

      if (contactQuery.rows.length > 0) {
        const { currentBalance, currentBalanceType } = contactQuery.rows[0];
        const currentBalanceValue = parseFloat(currentBalance || 0);
        let newCurrentBalance = currentBalanceValue;
        let newCurrentBalanceType = currentBalanceType;

        // Reverse the current balance impact
        if (currentBalanceType_allocation === 'receivable') {
          if (currentBalanceType === 'receivable') {
            newCurrentBalance = currentBalanceValue + currentBalanceAmount;
          } else if (currentBalanceType === 'payable') {
            newCurrentBalance = currentBalanceValue + currentBalanceAmount;
          }
        } else if (currentBalanceType_allocation === 'payable') {
          if (currentBalanceType === 'payable') {
            newCurrentBalance = currentBalanceValue + currentBalanceAmount;
          } else if (currentBalanceType === 'receivable') {
            newCurrentBalance = currentBalanceValue + currentBalanceAmount;
          }
        }

        if (newCurrentBalance < 0) {
          newCurrentBalance = Math.abs(newCurrentBalance);
          newCurrentBalanceType = currentBalanceType === 'receivable' ? 'payable' : 'receivable';
        }

        if (newCurrentBalance === 0) {
          newCurrentBalanceType = 'payable';
        }

        // Update contact balance with the reversed values
        await client.query(
          `UPDATE hisab."contacts" 
           SET "currentBalance" = $1, "currentBalanceType" = $2, "updatedAt" = CURRENT_TIMESTAMP
           WHERE "id" = $3 AND "companyId" = $4`,
          [newCurrentBalance, newCurrentBalanceType, payment.contactId, companyId]
        );
      }
    }

    // Mark payment as deleted
    const deleteResult = await client.query(
      `UPDATE hisab."payments" 
       SET "deletedAt" = CURRENT_TIMESTAMP, "deletedBy" = $1, "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $2 AND "companyId" = $3 
       RETURNING *`,
      [currentUserId, id, companyId]
    );

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Payment deleted successfully",
      payment: deleteResult.rows[0],
      accountingImpact: {
        currentContactBalance: currentBalanceValue,
        currentContactBalanceType: currentBalanceType,
        currentBalanceAmount,
        purchaseAmount,
        expenseAmount,
        incomeAmount,
        adjustmentReversed: payment.adjustmentType && payment.adjustmentType !== 'none' ? {
          type: payment.adjustmentType,
          value: adjValue,
          originalAmount: originalAmount,
          adjustedAmount: adjustedAmount
        } : null,
        ...(payment.bankId && {
          bankBalanceChange: payment.paymentType === 'payment' ? adjustedAmount : -adjustedAmount,
          bankId: payment.bankId
        })
      }
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Payment deletion error:", error);
    return errorResponse(res, "Error deleting payment", 500);
  } finally {
    client.release();
  }
}

export async function getPendingTransactions(req, res) {
  const { companyId } = req.currentUser || {};
  const { contactId } = req.query;

  if (!companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }
  if (!contactId) {
    return errorResponse(res, "Contact ID is required", 400);
  }

  const client = await pool.connect();

  try {
    // 1. Get contact details to verify existence and get current balance
    const contactQuery = await client.query(
      `SELECT "name", "currentBalance", "currentBalanceType" 
       FROM hisab."contacts" 
       WHERE id = $1 AND "companyId" = $2`,
      [contactId, companyId]
    );

    if (!contactQuery.rows.length) {
      return errorResponse(res, "Contact not found", 404);
    }

    const contact = contactQuery.rows[0];
    const currentBalance = parseFloat(contact.currentBalance) || 0;
    const isPayable = contact.currentBalanceType === 'payable';

    // 2. Get all pending purchases for this contact including remaining amounts
    const pendingPurchases = await client.query(
      `SELECT 
         "id", 
         "invoiceNumber", 
         "invoiceDate", 
         "netPayable" as "amount",
         "remaining_amount" as "remainingAmount",
         "paid_amount" as "paidAmount",
         "status",
         "createdAt"
       FROM hisab."purchases"
       WHERE "contactId" = $1 
         AND "companyId" = $2 
         AND "status" = 'pending'
         AND "deletedAt" IS NULL
       ORDER BY "invoiceDate" ASC`,
      [contactId, companyId]
    );

    // 3. Get all pending sales for this contact including remaining amounts
    const pendingSales = await client.query(
      `SELECT 
         "id", 
         "invoiceNumber", 
         "invoiceDate", 
         "netReceivable" as "amount",
         "remaining_amount" as "remainingAmount",
         "paid_amount" as "paidAmount",
         "status",
         "createdAt"
       FROM hisab."sales"
       WHERE "contactId" = $1 
         AND "companyId" = $2 
         AND "status" = 'pending'
         AND "deletedAt" IS NULL
       ORDER BY "invoiceDate" ASC`,
      [contactId, companyId]
    );

    // 4. Get all pending expenses for this contact (amounts we owe them)
    const pendingExpenses = await client.query(
      `SELECT 
         e."id", 
         e."date", 
         e."amount",
         e."notes",
         e."dueDate",
         e."createdAt",
         ec."name" as "categoryName"
       FROM hisab."expenses" e
       LEFT JOIN hisab."expenseCategories" ec ON e."categoryId" = ec."id"
       WHERE e."contactId" = $1 
         AND e."companyId" = $2 
         AND e."status" = 'pending'
       ORDER BY e."dueDate" ASC, e."createdAt" ASC`,
      [contactId, companyId]
    );

    // 5. Get all pending incomes for this contact (amounts they owe us)
    const pendingIncomes = await client.query(
      `SELECT 
         i."id", 
         i."date", 
         i."amount",
         i."remaining_amount",
         i."paid_amount",
         i."notes",
         i."dueDate",
         i."createdAt",
         ic."name" as "categoryName"
       FROM hisab."incomes" i
       LEFT JOIN hisab."incomeCategories" ic ON i."categoryId" = ic."id"
       WHERE i."contactId" = $1 
         AND i."companyId" = $2 
         AND i."status" = 'pending'
         AND i."remaining_amount" > 0
       ORDER BY i."dueDate" ASC, i."createdAt" ASC`,
      [contactId, companyId]
    );

    // 6. Format transactions - include current balance as first transaction if pending amount > 0
    const transactions = [];

    // Add current balance only if it has pending amount
    if (Math.abs(currentBalance) > 0) {
      transactions.push({
        id: 'current-balance',
        type: 'current-balance',
        description: 'Current Balance',
        amount: Math.abs(currentBalance),
        paidAmount: 0,
        balanceType: contact.currentBalanceType,
        date: null,
        isCurrentBalance: true,
        pendingAmount: Math.abs(currentBalance)
      });
    }

    // Add purchases with pending amount > 0
    pendingPurchases.rows.forEach(purchase => {
      const pendingAmount = parseFloat(purchase.remainingAmount) || parseFloat(purchase.amount);
      if (pendingAmount > 0) {
        transactions.push({
          id: purchase.id,
          type: 'purchase',
          description: `Purchase#${purchase.invoiceNumber}`,
          amount: parseFloat(purchase.amount),
          paidAmount: parseFloat(purchase.paidAmount) || 0,
          balanceType: 'payable', // We owe them for purchases
          date: purchase.invoiceDate,
          pendingAmount: pendingAmount,
          invoiceNumber: purchase.invoiceNumber
        });
      }
    });

    // Add sales with pending amount > 0
    pendingSales.rows.forEach(sale => {
      const pendingAmount = parseFloat(sale.remainingAmount) || parseFloat(sale.amount);
      if (pendingAmount > 0) {
        transactions.push({
          id: sale.id,
          type: 'sale',
          description: `Sale#${sale.invoiceNumber}`,
          amount: parseFloat(sale.amount),
          paidAmount: parseFloat(sale.paidAmount) || 0,
          balanceType: 'receivable', // They owe us for sales
          date: sale.invoiceDate,
          pendingAmount: pendingAmount,
          invoiceNumber: sale.invoiceNumber
        });
      }
    });

    // Add pending expenses (amounts we owe them)
    pendingExpenses.rows.forEach(expense => {
      const amount = parseFloat(expense.amount);
      if (amount > 0) {
        transactions.push({
          id: expense.id,
          type: 'expense',
          description: `Expense: ${expense.categoryName || 'Uncategorized'}`,
          amount: amount,
          paidAmount: 0,
          balanceType: 'payable', // We owe them for expenses
          date: expense.date,
          dueDate: expense.dueDate,
          pendingAmount: amount,
          notes: expense.notes,
          categoryName: expense.categoryName
        });
      }
    });

    // Add pending incomes (amounts they owe us)
    pendingIncomes.rows.forEach(income => {
      const totalAmount = parseFloat(income.amount);
      const paidAmount = parseFloat(income.paid_amount || 0);
      const pendingAmount = parseFloat(income.remaining_amount || totalAmount);
      
      if (pendingAmount > 0) {
        transactions.push({
          id: income.id,
          type: 'income',
          description: `Income: ${income.categoryName || 'Uncategorized'}`,
          amount: totalAmount,
          paidAmount: paidAmount,
          balanceType: 'receivable', // They owe us for incomes
          date: income.date,
          dueDate: income.dueDate,
          pendingAmount: pendingAmount,
          notes: income.notes,
          categoryName: income.categoryName
        });
      }
    });

    // 7. Calculate total pending amounts by type
    const totalPendingPayable = transactions
      .filter(t => t.balanceType === 'payable')
      .reduce((sum, transaction) => sum + parseFloat(transaction.pendingAmount), 0);

    const totalPendingReceivable = transactions
      .filter(t => t.balanceType === 'receivable')
      .reduce((sum, transaction) => sum + parseFloat(transaction.pendingAmount), 0);

    const netPendingAmount = totalPendingPayable - totalPendingReceivable;
    const netBalanceType = netPendingAmount >= 0 ? 'payable' : 'receivable';

    // Debug logging
    console.log('=== Pending Transactions Debug ===');
    console.log('Current Balance:', currentBalance, 'Type:', contact.currentBalanceType);
    console.log('Total Pending Payable:', totalPendingPayable);
    console.log('Total Pending Receivable:', totalPendingReceivable);
    console.log('Net Pending Amount:', netPendingAmount);
    console.log('Net Balance Type:', netBalanceType);
    console.log('Transactions count:', transactions.length);
    transactions.forEach((t, i) => {
      console.log(`Transaction ${i + 1}:`, t.description, 'Amount:', t.pendingAmount, 'Type:', t.balanceType);
    });

    // 8. Calculate summary by transaction type
    const summary = {
      totalPending: Math.abs(netPendingAmount), // This now includes current balance since it's in transactions
      netBalanceType: netBalanceType,
      totalPendingPayable: totalPendingPayable,
      totalPendingReceivable: totalPendingReceivable,
      payableStatus: netBalanceType, // Use calculated net balance type instead of stored current balance type
      suggestedPayment: netBalanceType === 'payable' ? Math.abs(netPendingAmount) : 0,
      breakdown: {
        currentBalance: Math.abs(currentBalance),
        pendingPurchases: pendingPurchases.rows.length,
        pendingSales: pendingSales.rows.length,
        pendingExpenses: pendingExpenses.rows.length,
        pendingIncomes: pendingIncomes.rows.length,
        totalTransactions: transactions.length
      }
    };

    return successResponse(res, {
      contact: {
        id: contactId,
        name: contact.name,
        currentBalance,
        balanceType: contact.currentBalanceType,
      },
      transactions,
      summary
    });

  } catch (error) {
    console.error("Pending transactions error:", error);
    return errorResponse(res, "Error fetching pending transactions", 500);
  } finally {
    client.release();
  }
}

export async function listPayments(req, res) {
  const {
    page = 1,
    limit = 10,
    contactId,
    bankId,
    type,
    startDate,
    endDate,
    search
  } = req.query;

  const { companyId } = req.currentUser || {};

  // Validate required fields
  if (!companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  try {
    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Build the base query - using to_char to format the date as YYYY-MM-DD
    let query = `
      SELECT 
        p.id,
        p."paymentNumber",
        to_char(p."date", 'YYYY-MM-DD') as "date",
        p."contactId",
        p."bankId",
        p."amount",
        p."paymentType",
        p."description",
        p."adjustmentType",
        p."adjustmentValue",
        p."companyId",
        p."createdBy",
        p."createdAt",
        p."updatedAt",
        c."name" as "contactName",
        c."billingAddress1" as "contactBillingAddress1",
        c."billingAddress2" as "contactBillingAddress2",
        c."billingCity" as "contactBillingCity",
        c."billingState" as "contactBillingState",
        c."billingPincode" as "contactBillingPincode",
        c."billingCountry" as "contactBillingCountry",
        b."accountName" as "bankName",
        b."accountType" as "bankAccountType",
        u."name" as "createdByName",
        COUNT(pa.id) as "allocationCount"
      FROM hisab."payments" p
      LEFT JOIN hisab."contacts" c ON p."contactId" = c."id"
      LEFT JOIN hisab."bankAccounts" b ON p."bankId" = b."id"
      LEFT JOIN hisab."users" u ON p."createdBy" = u."id"
      LEFT JOIN hisab."payment_allocations" pa ON p."id" = pa."paymentId"
      WHERE p."companyId" = $1 AND p."deletedAt" IS NULL
    `;

    const queryParams = [companyId];
    let paramIndex = 2;

    // Add filters
    if (contactId) {
      query += ` AND p."contactId" = $${paramIndex}`;
      queryParams.push(contactId);
      paramIndex++;
    }

    if (bankId) {
      query += ` AND p."bankId" = $${paramIndex}`;
      queryParams.push(bankId);
      paramIndex++;
    }

    if (type) {
      query += ` AND p."paymentType" = $${paramIndex}`;
      queryParams.push(type);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND p."date" >= $${paramIndex}`;
      queryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND p."date" <= $${paramIndex}`;
      queryParams.push(endDate);
      paramIndex++;
    }

    if (search) {
      query += ` AND (
        c."name" ILIKE $${paramIndex} OR 
        p."paymentNumber" ILIKE $${paramIndex} OR
        p."description" ILIKE $${paramIndex}
      )`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Group by payment fields
    query += `
      GROUP BY 
        p.id, 
        c.id, 
        b.id, 
        u.id
      ORDER BY p."date" DESC, p."createdAt" DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    queryParams.push(parseInt(limit), offset);

    // Get count for pagination
    let countQuery = `
      SELECT COUNT(*) FROM hisab."payments" p
      LEFT JOIN hisab."contacts" c ON p."contactId" = c."id"
      WHERE p."companyId" = $1 AND p."deletedAt" IS NULL
    `;
    const countParams = [companyId];
    paramIndex = 2;

    // Add same filters to count query
    if (contactId) {
      countQuery += ` AND p."contactId" = $${paramIndex}`;
      countParams.push(contactId);
      paramIndex++;
    }

    if (bankId) {
      countQuery += ` AND p."bankId" = $${paramIndex}`;
      countParams.push(bankId);
      paramIndex++;
    }

    if (type) {
      countQuery += ` AND p."paymentType" = $${paramIndex}`;
      countParams.push(type);
      paramIndex++;
    }

    if (startDate) {
      countQuery += ` AND p."date" >= $${paramIndex}`;
      countParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      countQuery += ` AND p."date" <= $${paramIndex}`;
      countParams.push(endDate);
      paramIndex++;
    }

    if (search) {
      countQuery += ` AND (
        c."name" ILIKE $${paramIndex} OR 
        p."paymentNumber" ILIKE $${paramIndex} OR
        p."description" ILIKE $${paramIndex}
      )`;
      countParams.push(`%${search}%`);
      paramIndex++;
    }

    const client = await pool.connect();

    try {
      // Execute both queries in parallel
      const [paymentsResult, countResult] = await Promise.all([
        client.query(query, queryParams),
        client.query(countQuery, countParams)
      ]);

      const payments = paymentsResult.rows;
      const total = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(total / limit);

      // Check if new columns exist before trying to use them
      let hasNewColumns = false;
      try {
        const columnCheck = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'hisab' 
            AND table_name = 'payment_allocations' 
            AND column_name IN ('expenseId', 'incomeId')
        `);
        hasNewColumns = columnCheck.rows.length === 2;
      } catch (error) {
        hasNewColumns = false;
      }

      // Get allocations for payments that have them
      if (payments.length > 0) {
        const paymentIdsWithAllocations = payments
          .filter(p => p.allocationCount > 0)
          .map(p => p.id);

        if (paymentIdsWithAllocations.length > 0) {
          let allocationsQuery;
          
          if (hasNewColumns) {
            // Use new schema with separate ID columns
            allocationsQuery = `
              SELECT 
                pa.id,
                pa."paymentId",
                pa."purchaseId",
                pa."saleId",
                pa."expenseId",
                pa."incomeId",
                pa."allocationType",
                pa."balanceType",
                pa.amount,
                pa."paidAmount",
                -- Purchase data
                pur."invoiceNumber" as "purchaseInvoiceNumber",
                pur."remaining_amount" as "purchasePendingAmount",
                pur."status" as "purchaseStatus",
                pur_contact."name" as "purchaseSupplierName",
                -- Sale data
                s."invoiceNumber" as "saleInvoiceNumber",
                s."remaining_amount" as "salePendingAmount",
                s."status" as "saleStatus",
                s_contact."name" as "saleCustomerName",
                -- Expense data
                exp."amount" as "expenseAmount",
                exp."notes" as "expenseNotes",
                exp."date" as "expenseDate",
                exp."status" as "expenseStatus",
                exp_cat."name" as "expenseCategoryName",
                exp_contact."name" as "expenseContactName",
                -- Income data
                inc."amount" as "incomeAmount", 
                inc."notes" as "incomeNotes",
                inc."date" as "incomeDate",
                inc."status" as "incomeStatus",
                inc_cat."name" as "incomeCategoryName",
                inc_contact."name" as "incomeContactName"
              FROM hisab."payment_allocations" pa
              LEFT JOIN hisab."purchases" pur ON pa."purchaseId" = pur."id" AND pa."allocationType" = 'purchase'
              LEFT JOIN hisab."contacts" pur_contact ON pur."contactId" = pur_contact."id"
              LEFT JOIN hisab."sales" s ON pa."saleId" = s."id" AND pa."allocationType" = 'sale'
              LEFT JOIN hisab."contacts" s_contact ON s."contactId" = s_contact."id"
              LEFT JOIN hisab."expenses" exp ON pa."expenseId" = exp."id" AND pa."allocationType" = 'expense'
              LEFT JOIN hisab."expenseCategories" exp_cat ON exp."categoryId" = exp_cat."id"
              LEFT JOIN hisab."contacts" exp_contact ON exp."contactId" = exp_contact."id"
              LEFT JOIN hisab."incomes" inc ON pa."incomeId" = inc."id" AND pa."allocationType" = 'income'
              LEFT JOIN hisab."incomeCategories" inc_cat ON inc."categoryId" = inc_cat."id"
              LEFT JOIN hisab."contacts" inc_contact ON inc."contactId" = inc_contact."id"
              WHERE pa."paymentId" = ANY($1)
              ORDER BY pa."paymentId", pa."createdAt" ASC
            `;
          } else {
            // Use old schema with purchaseId for all types (backwards compatibility)
            allocationsQuery = `
              SELECT 
                pa.id,
                pa."paymentId",
                pa."purchaseId",
                pa."allocationType",
                pa."balanceType",
                pa.amount,
                pa."paidAmount",
                -- Purchase data
                pur."invoiceNumber" as "purchaseInvoiceNumber",
                pur."remaining_amount" as "purchasePendingAmount",
                pur."status" as "purchaseStatus",
                pur_contact."name" as "purchaseSupplierName"
              FROM hisab."payment_allocations" pa
              LEFT JOIN hisab."purchases" pur ON pa."purchaseId" = pur."id" AND pa."allocationType" = 'purchase'
              LEFT JOIN hisab."contacts" pur_contact ON pur."contactId" = pur_contact."id"
              WHERE pa."paymentId" = ANY($1)
              ORDER BY pa."paymentId", pa."createdAt" ASC
            `;
          }

          const allocationsResult = await client.query(allocationsQuery, [paymentIdsWithAllocations]);
          const allocations = allocationsResult.rows;

          const paymentIdsWithCurrentBalance = allocations
            .filter(a => a.allocationType === 'current-balance')
            .map(a => a.paymentId);

          let contactBalances = {};
          if (paymentIdsWithCurrentBalance.length > 0) {
            const paymentsWithContactsQuery = `
              SELECT 
                p.id as "paymentId",
                p."contactId",
                c."currentBalance",
                c."currentBalanceType"
              FROM hisab."payments" p
              JOIN hisab."contacts" c ON p."contactId" = c."id"
              WHERE p.id = ANY($1)
            `;
            const paymentsWithContactsResult = await client.query(paymentsWithContactsQuery, [paymentIdsWithCurrentBalance]);
            paymentsWithContactsResult.rows.forEach(row => {
              contactBalances[row.paymentId] = {
                pendingAmount: row.currentBalance,
                balanceType: row.currentBalanceType
              };
            });
          }

          const allocationsByPayment = {};
          allocations.forEach(allocation => {
            if (!allocationsByPayment[allocation.paymentId]) {
              allocationsByPayment[allocation.paymentId] = [];
            }

            // Transform allocation data based on transaction type
            let transformedAllocation = { ...allocation };
            
            switch (allocation.allocationType) {
              case 'current-balance':
                transformedAllocation.description = 'Current Balance Settlement';
                transformedAllocation.reference = 'Current Balance';
                transformedAllocation.transactionId = 'current-balance';
                if (contactBalances[allocation.paymentId]) {
                  transformedAllocation.pendingAmount = contactBalances[allocation.paymentId].pendingAmount;
                  transformedAllocation.balanceType = contactBalances[allocation.paymentId].balanceType;
                }
                break;
                
              case 'purchase':
                transformedAllocation.description = allocation.purchaseSupplierName ? 
                  `Purchase from ${allocation.purchaseSupplierName}` : 
                  'Purchase Payment';
                transformedAllocation.reference = allocation.purchaseInvoiceNumber ? 
                  `Invoice #${allocation.purchaseInvoiceNumber}` : 
                  `Purchase #${allocation.purchaseId}`;
                transformedAllocation.pendingAmount = allocation.purchasePendingAmount;
                transformedAllocation.status = allocation.purchaseStatus;
                transformedAllocation.transactionId = allocation.purchaseId;
                break;
                
              case 'sale':
                transformedAllocation.description = allocation.saleCustomerName ? 
                  `Sale to ${allocation.saleCustomerName}` : 
                  'Sale Payment';
                transformedAllocation.reference = allocation.saleInvoiceNumber ? 
                  `Invoice #${allocation.saleInvoiceNumber}` : 
                  `Sale #${allocation.saleId}`;
                transformedAllocation.pendingAmount = allocation.salePendingAmount;
                transformedAllocation.status = allocation.saleStatus;
                transformedAllocation.transactionId = allocation.saleId;
                break;
                
              case 'expense':
                transformedAllocation.description = 'Expense Payment';
                transformedAllocation.reference = `Expense #${allocation.expenseId}`;
                transformedAllocation.pendingAmount = allocation.expenseAmount;
                transformedAllocation.status = allocation.expenseStatus;
                transformedAllocation.transactionId = allocation.expenseId;
                break;
                
              case 'income':
                transformedAllocation.description = 'Income Receipt';
                transformedAllocation.reference = `Income #${allocation.incomeId}`;
                transformedAllocation.pendingAmount = allocation.incomeAmount;
                transformedAllocation.status = allocation.incomeStatus;
                transformedAllocation.transactionId = allocation.incomeId;
                break;
                
              default:
                transformedAllocation.description = 'Payment allocation';
                transformedAllocation.reference = 'Unknown';
                transformedAllocation.transactionId = null;
            }

            allocationsByPayment[allocation.paymentId].push(transformedAllocation);
          });

          payments.forEach(payment => {
            payment.allocations = allocationsByPayment[payment.id] || [];
          });
        } else {
          payments.forEach(payment => {
            payment.allocations = [];
          });
        }
      }

      return successResponse(res, {
        payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          currentPage: parseInt(page)
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error listing payments:", error);
    return errorResponse(res, "Failed to fetch payments", 500);
  }
}


// Internal function to generate PDF (without HTTP response handling)
async function generatePaymentPDFInternal(paymentId, companyId) {
  const client = await pool.connect();

  try {
    // Fetch payment details with all related data
    const paymentQuery = `
      SELECT 
        p.*,
        c."name" as "contactName",
        c."email" as "contactEmail", 
        c."mobile" as "contactMobile",
        c."gstin" as "contactGstin",
        c."billingAddress1" as "contactBillingAddress1",
        c."billingAddress2" as "contactBillingAddress2",
        c."billingCity" as "contactBillingCity",
        c."billingState" as "contactBillingState",
        c."billingPincode" as "contactBillingPincode",
        c."billingCountry" as "contactBillingCountry",
        ba."accountName", 
        ba."accountType",
        u."name" as "createdByName",
        comp."name" as "companyName",
        comp."logoUrl",
        comp."address1",
        comp."address2", 
        comp."city",
        comp."state",
        comp."pincode",
        comp."country",
        comp."gstin" as "companyGstin"
      FROM hisab."payments" p
      LEFT JOIN hisab."contacts" c ON p."contactId" = c.id
      LEFT JOIN hisab."bankAccounts" ba ON p."bankId" = ba.id
      LEFT JOIN hisab."users" u ON p."createdBy" = u.id
      LEFT JOIN hisab."companies" comp ON p."companyId" = comp.id
      WHERE p."id" = $1 AND p."companyId" = $2 AND p."deletedAt" IS NULL
    `;

    const paymentResult = await client.query(paymentQuery, [paymentId, companyId]);

    if (paymentResult.rows.length === 0) {
      throw new Error("Payment not found");
    }

    const payment = paymentResult.rows[0];

    // Fetch payment allocations with complete transaction data
    const allocationsQuery = `
      SELECT 
        pa.id,
        pa."paymentId",
        pa."purchaseId",
        pa."saleId",
        pa."expenseId",
        pa."incomeId",
        pa."allocationType",
        pa."balanceType",
        pa.amount,
        pa."paidAmount",
        -- Purchase data
        pur."invoiceNumber" as "purchaseInvoiceNumber",
        pur."remaining_amount" as "purchasePendingAmount",
        pur."status" as "purchaseStatus",
        pur_contact."name" as "purchaseSupplierName",
        -- Sale data
        s."invoiceNumber" as "saleInvoiceNumber",
        s."remaining_amount" as "salePendingAmount",
        s."status" as "saleStatus",
        s_contact."name" as "saleCustomerName",
        -- Expense data
        exp."amount" as "expenseAmount",
        exp."notes" as "expenseNotes",
        exp."date" as "expenseDate",
        exp."status" as "expenseStatus",
        exp_cat."name" as "expenseCategoryName",
        exp_contact."name" as "expenseContactName",
        -- Income data
        inc."amount" as "incomeAmount", 
        inc."notes" as "incomeNotes",
        inc."date" as "incomeDate",
        inc."status" as "incomeStatus",
        inc_cat."name" as "incomeCategoryName",
        inc_contact."name" as "incomeContactName"
      FROM hisab."payment_allocations" pa
      LEFT JOIN hisab."purchases" pur ON pa."purchaseId" = pur."id" AND pa."allocationType" = 'purchase'
      LEFT JOIN hisab."contacts" pur_contact ON pur."contactId" = pur_contact."id"
      LEFT JOIN hisab."sales" s ON pa."saleId" = s."id" AND pa."allocationType" = 'sale'
      LEFT JOIN hisab."contacts" s_contact ON s."contactId" = s_contact."id"
      LEFT JOIN hisab."expenses" exp ON pa."expenseId" = exp."id" AND pa."allocationType" = 'expense'
      LEFT JOIN hisab."expenseCategories" exp_cat ON exp."categoryId" = exp_cat."id"
      LEFT JOIN hisab."contacts" exp_contact ON exp."contactId" = exp_contact."id"
      LEFT JOIN hisab."incomes" inc ON pa."incomeId" = inc."id" AND pa."allocationType" = 'income'
      LEFT JOIN hisab."incomeCategories" inc_cat ON inc."categoryId" = inc_cat."id"
      LEFT JOIN hisab."contacts" inc_contact ON inc."contactId" = inc_contact."id"
      WHERE pa."paymentId" = $1
      ORDER BY pa."createdAt" ASC
    `;

    const allocationsResult = await client.query(allocationsQuery, [paymentId]);

    // Transform allocations data for PDF generation
    const transformedAllocations = allocationsResult.rows.map(allocation => {
      let description = 'Payment allocation';
      let reference = 'N/A';
      
      switch (allocation.allocationType) {
        case 'current-balance':
          description = 'Current Balance Settlement';
          reference = 'Current Balance';
          break;
          
        case 'purchase':
          description = allocation.purchaseSupplierName ? 
            `Purchase from ${allocation.purchaseSupplierName}` : 
            'Purchase Payment';
          reference = allocation.purchaseInvoiceNumber ? 
            `Invoice #${allocation.purchaseInvoiceNumber}` : 
            `Purchase #${allocation.purchaseId}`;
          break;
          
        case 'sale':
          description = allocation.saleCustomerName ? 
            `Sale to ${allocation.saleCustomerName}` : 
            'Sale Payment';
          reference = allocation.saleInvoiceNumber ? 
            `Invoice #${allocation.saleInvoiceNumber}` : 
            `Sale #${allocation.saleId}`;
          break;
          
        case 'expense':
          description = allocation.expenseCategoryName ? 
            `Expense: ${allocation.expenseCategoryName}` : 
            'Expense Payment';
          if (allocation.expenseContactName) {
            description += ` (${allocation.expenseContactName})`;
          }
          reference = `Expense #${allocation.expenseId}`;
          if (allocation.expenseDate) {
            reference += ` - ${new Date(allocation.expenseDate).toLocaleDateString()}`;
          }
          break;
          
        case 'income':
          description = allocation.incomeCategoryName ? 
            `Income: ${allocation.incomeCategoryName}` : 
            'Income Receipt';
          if (allocation.incomeContactName) {
            description += ` (${allocation.incomeContactName})`;
          }
          reference = `Income #${allocation.incomeId}`;
          if (allocation.incomeDate) {
            reference += ` - ${new Date(allocation.incomeDate).toLocaleDateString()}`;
          }
          break;
          
        default:
          description = 'Payment allocation';
          reference = allocation.purchaseId || allocation.expenseId || allocation.incomeId || 'N/A';
      }
      
      return {
        ...allocation,
        description,
        reference,
        transactionId: allocation.allocationType === 'current-balance' ? 'current-balance' : 
                      allocation.purchaseId || allocation.saleId || allocation.expenseId || allocation.incomeId
      };
    });

    // Prepare data for PDF generation
    const pdfData = {
      payment: payment,
      company: {
        name: payment.companyName,
        logoUrl: payment.logoUrl,
        address1: payment.address1,
        address2: payment.address2,
        city: payment.city,
        state: payment.state,
        pincode: payment.pincode,
        country: payment.country,
        gstin: payment.companyGstin
      },
      contact: {
        name: payment.contactName,
        email: payment.contactEmail,
        mobile: payment.contactMobile,
        gstin: payment.contactGstin,
        billingAddress1: payment.contactBillingAddress1,
        billingAddress2: payment.contactBillingAddress2,
        billingCity: payment.contactBillingCity,
        billingState: payment.contactBillingState,
        billingPincode: payment.contactBillingPincode,
        billingCountry: payment.contactBillingCountry
      },
      bankAccount: {
        accountName: payment.accountName,
        accountType: payment.accountType
      },
      allocations: transformedAllocations
    };

    // Generate HTML content
    const htmlContent = createPaymentInvoiceHTML(pdfData);

    // Generate PDF
    const pdfBuffer = await generatePaymentPDFFromHTML(htmlContent);

    // Generate unique filename
    const pdfFileName = generatePaymentPDFFileName(payment.paymentNumber, payment.companyName);

    // Upload to S3
    const pdfUrl = await uploadFileToS3(pdfBuffer, pdfFileName);

    return pdfUrl;

  } finally {
    client.release();
  }
}

export async function generatePaymentInvoicePDF(req, res) {
  const { id: paymentId, forceRegenerate = false } = req.query;
  const companyId = req.currentUser?.companyId;
  const userId = req.currentUser?.id;

  if (!paymentId || !companyId || !userId) {
    return errorResponse(res, "Invalid request parameters", 400);
  }

  if (isNaN(parseInt(paymentId))) {
    return errorResponse(res, "Invalid payment ID", 400);
  }

  const client = await pool.connect();

  try {
    // Get PDF URL from payment record
    const pdfQuery = `
      SELECT "pdfUrl", "pdfGeneratedAt", "paymentNumber" 
      FROM hisab."payments" 
      WHERE "id" = $1 AND "companyId" = $2 AND "deletedAt" IS NULL
    `;

    const pdfResult = await client.query(pdfQuery, [paymentId, companyId]);

    if (pdfResult.rows.length === 0) {
      return errorResponse(res, "Payment not found", 404);
    }

    const { pdfUrl, pdfGeneratedAt, paymentNumber } = pdfResult.rows[0];

    // If PDF doesn't exist or force regenerate is requested, generate new PDF
    if (!pdfUrl || forceRegenerate) {
      console.log(`Generating ${forceRegenerate ? 'new' : 'missing'} PDF for payment ${paymentId}`);
      
      const newPdfUrl = await generatePaymentPDFInternal(paymentId, companyId);
      
      // Update payment record with new PDF URL
      await client.query(
        `UPDATE hisab."payments" 
         SET "pdfUrl" = $1, "pdfGeneratedAt" = CURRENT_TIMESTAMP
         WHERE "id" = $2 AND "companyId" = $3`,
        [newPdfUrl, paymentId, companyId]
      );

      return successResponse(res, {
        message: "Payment invoice PDF generated successfully",
        pdfUrl: newPdfUrl,
        fileName: newPdfUrl.split('/').pop(),
        paymentId: paymentId,
        cached: false,
        generatedAt: new Date().toISOString()
      });
    }

    // Return existing PDF
    return successResponse(res, {
      message: "Payment invoice PDF retrieved successfully",
      pdfUrl: pdfUrl,
      fileName: pdfUrl.split('/').pop(),
      paymentId: paymentId,
      cached: true,
      generatedAt: pdfGeneratedAt
    });

  } catch (error) {
    console.error('Payment PDF generation error:', error);
    return errorResponse(res, `Failed to get payment PDF: ${error.message}`, 500);
  } finally {
    client.release();
  }
}

// Helper function to optimize transaction reversals
async function reverseTransactionAllocations(client, existingAllocations, companyId, existingPayment) {
  const reversalQueries = [];
  const transactionIds = existingAllocations
    .filter(allocation => allocation.allocationType !== 'current-balance')
    .map(allocation => {
      if (allocation.purchaseId) return { type: 'purchase', id: allocation.purchaseId };
      if (allocation.saleId) return { type: 'sale', id: allocation.saleId };
      if (allocation.expenseId) return { type: 'expense', id: allocation.expenseId };
      if (allocation.incomeId) return { type: 'income', id: allocation.incomeId };
      return null;
    })
    .filter(Boolean);

  // Batch fetch all transaction data
  const [purchasesQuery, salesQuery, expensesQuery, incomesQuery] = await Promise.all([
    client.query(
      `SELECT id, "netPayable", "remaining_amount", "paid_amount" FROM hisab."purchases" WHERE id = ANY($1) AND "companyId" = $2 FOR UPDATE`,
      [transactionIds.filter(t => t.type === 'purchase').map(t => t.id), companyId]
    ),
    client.query(
      `SELECT id, "netReceivable", "remaining_amount", "paid_amount" FROM hisab."sales" WHERE id = ANY($1) AND "companyId" = $2 FOR UPDATE`,
      [transactionIds.filter(t => t.type === 'sale').map(t => t.id), companyId]
    ),
    client.query(
      `SELECT id, "amount", "remaining_amount", "paid_amount" FROM hisab."expenses" WHERE id = ANY($1) AND "companyId" = $2 FOR UPDATE`,
      [transactionIds.filter(t => t.type === 'expense').map(t => t.id), companyId]
    ),
    client.query(
      `SELECT id, "amount", "remaining_amount", "paid_amount", "contactId" FROM hisab."incomes" WHERE id = ANY($1) AND "companyId" = $2 FOR UPDATE`,
      [transactionIds.filter(t => t.type === 'income').map(t => t.id), companyId]
    )
  ]);

  // Create lookup maps
  const purchasesMap = new Map(purchasesQuery.rows.map(row => [row.id, row]));
  const salesMap = new Map(salesQuery.rows.map(row => [row.id, row]));
  const expensesMap = new Map(expensesQuery.rows.map(row => [row.id, row]));
  const incomesMap = new Map(incomesQuery.rows.map(row => [row.id, row]));

  // Process each allocation
  for (const allocation of existingAllocations) {
    const transactionType = allocation.allocationType || 'purchase';
    const paidAmount = parseFloat(allocation.paidAmount || 0);

    if (transactionType === 'purchase' && allocation.purchaseId) {
      const purchase = purchasesMap.get(allocation.purchaseId);
      if (purchase) {
        const currentPaidAmount = parseFloat(purchase.paid_amount || 0);
        const newPaidAmount = Math.max(0, currentPaidAmount - paidAmount);
        const newRemainingAmount = parseFloat(purchase.netPayable) - newPaidAmount;
        const isPending = newRemainingAmount > 0;

        reversalQueries.push({
          query: `UPDATE hisab."purchases" 
           SET "status" = $1, "remaining_amount" = $2, "paid_amount" = $3, "bankAccountId" = $4, "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $5`,
          params: [isPending ? 'pending' : 'paid', Math.max(0, newRemainingAmount), newPaidAmount, isPending ? null : existingPayment.bankId, allocation.purchaseId]
        });
      }
    } else if (transactionType === 'sale' && allocation.saleId) {
      const sale = salesMap.get(allocation.saleId);
      if (sale) {
        const currentPaidAmount = parseFloat(sale.paid_amount || 0);
        const newPaidAmount = Math.max(0, currentPaidAmount - paidAmount);
        const newRemainingAmount = parseFloat(sale.netReceivable) - newPaidAmount;
        const isPending = newRemainingAmount > 0;

        reversalQueries.push({
          query: `UPDATE hisab."sales" 
           SET "status" = $1, "remaining_amount" = $2, "paid_amount" = $3, "bankAccountId" = $4, "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $5`,
          params: [isPending ? 'pending' : 'paid', Math.max(0, newRemainingAmount), newPaidAmount, isPending ? null : existingPayment.bankId, allocation.saleId]
        });
      }
    } else if (transactionType === 'expense' && allocation.expenseId) {
      const expense = expensesMap.get(allocation.expenseId);
      if (expense) {
        const currentPaidAmount = parseFloat(expense.paid_amount || 0);
        const newPaidAmount = Math.max(0, currentPaidAmount - paidAmount);
        const expenseAmount = parseFloat(expense.amount || 0);
        const newRemainingAmount = expenseAmount - newPaidAmount;
        const isPending = newRemainingAmount > 0;

        reversalQueries.push({
          query: `UPDATE hisab."expenses" 
           SET "status" = $1, "remaining_amount" = $2, "paid_amount" = $3, "bankAccountId" = $4, "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $5`,
          params: [isPending ? 'pending' : 'paid', Math.max(0, newRemainingAmount), newPaidAmount, isPending ? null : existingPayment.bankId, allocation.expenseId]
        });
      }
    } else if (transactionType === 'income' && allocation.incomeId) {
      const income = incomesMap.get(allocation.incomeId);
      if (income) {
        const currentPaidAmount = parseFloat(income.paid_amount || 0);
        const newPaidAmount = Math.max(0, currentPaidAmount - paidAmount);
        const incomeAmount = parseFloat(income.amount || 0);
        const newRemainingAmount = incomeAmount - newPaidAmount;
        const isPending = newRemainingAmount > 0;

        const hasContactId = income.contactId;
        let bankAccountIdToSet;
        if (hasContactId) {
          bankAccountIdToSet = isPending ? null : existingPayment.bankId;
        } else {
          bankAccountIdToSet = existingPayment.bankId;
        }

        reversalQueries.push({
          query: `UPDATE hisab."incomes" 
           SET "status" = $1, "remaining_amount" = $2, "paid_amount" = $3, "bankAccountId" = $4, "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $5`,
          params: [isPending ? 'pending' : 'paid', Math.max(0, newRemainingAmount), newPaidAmount, bankAccountIdToSet, allocation.incomeId]
        });
      }
    }
  }

  return reversalQueries;
}

// Helper function to optimize new transaction allocations
async function processNewTransactionAllocations(client, transactionAllocations, paymentId, companyId, bankAccountId) {
  const transactionIds = transactionAllocations
    .filter(allocation => allocation.transactionId !== 'current-balance')
    .map(allocation => allocation.transactionId);

  let transactionsData = {};
  if (transactionIds.length > 0) {
    const [purchasesQuery, salesQuery, expensesQuery, incomesQuery] = await Promise.all([
      client.query(
        `SELECT id, "netPayable", "remaining_amount", "paid_amount" FROM hisab."purchases" WHERE id = ANY($1) AND "companyId" = $2 FOR UPDATE`,
        [transactionIds, companyId]
      ),
      client.query(
        `SELECT id, "netReceivable", "remaining_amount", "paid_amount" FROM hisab."sales" WHERE id = ANY($1) AND "companyId" = $2 FOR UPDATE`,
        [transactionIds, companyId]
      ),
      client.query(
        `SELECT id, "amount", "remaining_amount", "paid_amount", "status", "bankAccountId" FROM hisab."expenses" WHERE id = ANY($1) AND "companyId" = $2 FOR UPDATE`,
        [transactionIds, companyId]
      ),
      client.query(
        `SELECT id, "amount", "status", "bankAccountId", "remaining_amount", "paid_amount" FROM hisab."incomes" WHERE id = ANY($1) AND "companyId" = $2 FOR UPDATE`,
        [transactionIds, companyId]
      )
    ]);

    purchasesQuery.rows.forEach(row => transactionsData[`purchase_${row.id}`] = row);
    salesQuery.rows.forEach(row => transactionsData[`sale_${row.id}`] = row);
    expensesQuery.rows.forEach(row => transactionsData[`expense_${row.id}`] = row);
    incomesQuery.rows.forEach(row => transactionsData[`income_${row.id}`] = row);
  }

  const allocationQueries = [];
  const transactionUpdateQueries = [];

  for (const allocation of transactionAllocations) {
    const balanceType = allocation.type || 'payable';
    const transactionType = allocation.transactionType || 'purchase';
    const paidAmount = parseFloat(allocation.paidAmount || 0);

    if (allocation.transactionId === 'current-balance') {
      allocationQueries.push({
        query: `INSERT INTO hisab."payment_allocations" (
          "paymentId", "purchaseId", "saleId", "expenseId", "incomeId", "allocationType", "amount", "paidAmount", "balanceType", "createdAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        params: [
          paymentId,
          null,
          null,
          null,
          null,
          'current-balance',
          parseFloat(allocation.amount || 0),
          paidAmount,
          balanceType
        ]
      });
    } else if (transactionType === 'purchase') {
      const transactionKey = `purchase_${allocation.transactionId}`;
      const purchase = transactionsData[transactionKey];
      
      if (purchase) {
        const currentPaidAmount = parseFloat(purchase.paid_amount || 0);
        const newPaidAmount = currentPaidAmount + paidAmount;
        const purchaseAmount = parseFloat(purchase.netPayable || 0);
        const newRemainingAmount = Math.max(0, purchaseAmount - newPaidAmount);
        const isFullyPaid = newRemainingAmount <= 0;

        transactionUpdateQueries.push({
          query: `UPDATE hisab."purchases" 
           SET "status" = $1, "remaining_amount" = $2, "paid_amount" = $3, "bankAccountId" = $4, "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $5`,
          params: [isFullyPaid ? 'paid' : 'pending', newRemainingAmount, newPaidAmount, isFullyPaid ? bankAccountId : null, allocation.transactionId]
        });

        allocationQueries.push({
          query: `INSERT INTO hisab."payment_allocations" (
            "paymentId", "purchaseId", "saleId", "expenseId", "incomeId", "allocationType", "amount", "paidAmount", "balanceType", "createdAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
          params: [
            paymentId,
            allocation.transactionId,
            null,
            null,
            null,
            'purchase',
            parseFloat(allocation.amount || 0),
            paidAmount,
            balanceType
          ]
        });
      }
    } else if (transactionType === 'sale') {
      const transactionKey = `sale_${allocation.transactionId}`;
      const sale = transactionsData[transactionKey];
      
      if (sale) {
        const currentPaidAmount = parseFloat(sale.paid_amount || 0);
        const newPaidAmount = currentPaidAmount + paidAmount;
        const saleAmount = parseFloat(sale.netReceivable || 0);
        const newRemainingAmount = Math.max(0, saleAmount - newPaidAmount);
        const isFullyPaid = newRemainingAmount <= 0;

        transactionUpdateQueries.push({
          query: `UPDATE hisab."sales" 
           SET "status" = $1, "remaining_amount" = $2, "paid_amount" = $3, "bankAccountId" = $4, "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $5`,
          params: [isFullyPaid ? 'paid' : 'pending', newRemainingAmount, newPaidAmount, isFullyPaid ? bankAccountId : null, allocation.transactionId]
        });

        allocationQueries.push({
          query: `INSERT INTO hisab."payment_allocations" (
            "paymentId", "purchaseId", "saleId", "expenseId", "incomeId", "allocationType", "amount", "paidAmount", "balanceType", "createdAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
          params: [
            paymentId,
            null,
            allocation.transactionId,
            null,
            null,
            'sale',
            parseFloat(allocation.amount || 0),
            paidAmount,
            balanceType
          ]
        });
      }
    } else if (transactionType === 'expense') {
      const transactionKey = `expense_${allocation.transactionId}`;
      const expense = transactionsData[transactionKey];
      
      if (expense) {
        const currentPaidAmount = parseFloat(expense.paid_amount || 0);
        const newPaidAmount = currentPaidAmount + paidAmount;
        const expenseAmount = parseFloat(expense.amount || 0);
        const newRemainingAmount = Math.max(0, expenseAmount - newPaidAmount);
        const isFullyPaid = newRemainingAmount <= 0;

        transactionUpdateQueries.push({
          query: `UPDATE hisab."expenses" 
           SET "status" = $1, "remaining_amount" = $2, "paid_amount" = $3, "bankAccountId" = $4, "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $5`,
          params: [isFullyPaid ? 'paid' : 'pending', Math.max(0, newRemainingAmount), newPaidAmount, isFullyPaid ? bankAccountId : null, allocation.transactionId]
        });

        allocationQueries.push({
          query: `INSERT INTO hisab."payment_allocations" (
            "paymentId", "purchaseId", "saleId", "expenseId", "incomeId", "allocationType", "amount", "paidAmount", "balanceType", "createdAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
          params: [
            paymentId,
            null,
            allocation.transactionId,
            null,
            'expense',
            parseFloat(allocation.amount || 0),
            paidAmount,
            balanceType
          ]
        });
      }
    } else if (transactionType === 'income') {
      const transactionKey = `income_${allocation.transactionId}`;
      const income = transactionsData[transactionKey];
      
      if (income) {
        const currentPaidAmount = parseFloat(income.paid_amount || 0);
        const newPaidAmount = currentPaidAmount + paidAmount;
        const incomeAmount = parseFloat(income.amount || 0);
        const newRemainingAmount = Math.max(0, incomeAmount - newPaidAmount);
        const isFullyPaid = newRemainingAmount <= 0;

        transactionUpdateQueries.push({
          query: `UPDATE hisab."incomes" 
           SET "status" = $1, "bankAccountId" = $2, "remaining_amount" = $3, "paid_amount" = $4, "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $5`,
          params: [isFullyPaid ? 'paid' : 'pending', isFullyPaid ? bankAccountId : income.bankAccountId, newRemainingAmount, newPaidAmount, allocation.transactionId]
        });

                  allocationQueries.push({
            query: `INSERT INTO hisab."payment_allocations" (
              "paymentId", "purchaseId", "saleId", "expenseId", "incomeId", "allocationType", "amount", "paidAmount", "balanceType", "createdAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
            params: [
              paymentId,
              null,
              null,
              null,
              allocation.transactionId,
              'income',
              parseFloat(allocation.amount || 0),
              paidAmount,
              balanceType
            ]
          });
      }
    }
  }

  return { allocationQueries, transactionUpdateQueries };
}