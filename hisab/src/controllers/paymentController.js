import { compareSync } from "bcrypt";
import pool from "../config/dbConnection.js";
import { errorResponse, successResponse, uploadFileToS3 } from "../utils/index.js";
import { createPaymentReceiptTemplateData, generatePDFFromTemplate, generatePaymentPDFFileName } from "../utils/templatePDFGenerator.js";
import { calculateContactCurrentBalance } from "../utils/balanceCalculator.js";

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
  
  const {
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
  
  // Enhanced validation with specific field checking
  const missingFields = [];
  if (!contactId) missingFields.push('contactId');
  if (!bankAccountId) missingFields.push('bankAccountId');
  if (!date) missingFields.push('date');
  if (!transactionAllocations?.length) missingFields.push('transactionAllocations');
  
  if (missingFields.length > 0) {
    return errorResponse(res, `Required fields are missing: ${missingFields.join(', ')}`, 400);
  }
  if (adjustmentType && !['discount', 'extra_receipt', 'surcharge', 'none'].includes(adjustmentType)) {
    return errorResponse(res, "Invalid adjustment type", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // OPTIMIZATION 1: Single query to get all required data with FOR UPDATE
    // UPDATED: Only query bank balance since we no longer store contact balance
    const bankQuery = await client.query(
      `SELECT "currentBalance" FROM hisab."bankAccounts" WHERE id = $1 AND "companyId" = $2 FOR UPDATE`,
      [bankAccountId, companyId]
    );

    // UPDATED: Contact existence should be validated elsewhere, focusing on bank validation
    if (!bankQuery.rows.length) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Bank account not found", 404);
    }

    // OPTIMIZATION 2: Pre-fetch all transaction data in batch
    const transactionIds = transactionAllocations
      .filter(allocation => allocation.transactionId !== 'current-balance' && allocation.transactionId !== 'opening-balance')
      .map(allocation => allocation.transactionId);

    console.log('🔍 processNewTransactionAllocations - Transaction IDs for database queries:', {
      allAllocations: transactionAllocations.map(a => ({ id: a.transactionId, type: a.transactionType })),
      filteredTransactionIds: transactionIds,
      shouldBeEmpty: transactionIds.length === 0 ? 'YES' : 'NO - This might cause the error'
    });

    let transactionsData = {};
    if (transactionIds.length > 0) {
      console.log('🔍 About to execute database queries with transactionIds:', transactionIds);
      
      console.log('🔍 Executing purchases query...');
      const purchasesQuery = await client.query(
          `SELECT id, "netPayable", "remaining_amount", "paid_amount" FROM hisab."purchases" WHERE id = ANY($1) AND "companyId" = $2 FOR UPDATE`,
          [transactionIds, companyId]
      );
      
      console.log('🔍 Executing sales query...');
      const salesQuery = await client.query(
          `SELECT id, "netReceivable", "remaining_amount", "paid_amount" FROM hisab."sales" WHERE id = ANY($1) AND "companyId" = $2 FOR UPDATE`,
          [transactionIds, companyId]
      );
      
      console.log('🔍 Executing expenses query...');
      const expensesQuery = await client.query(
          `SELECT id, "amount", "remaining_amount", "paid_amount", "status", "bankAccountId" FROM hisab."expenses" WHERE id = ANY($1) AND "companyId" = $2 FOR UPDATE`,
          [transactionIds, companyId]
      );
      
      console.log('🔍 Executing incomes query...');
      const incomesQuery = await client.query(
          `SELECT id, "amount", "status", "bankAccountId", "remaining_amount", "paid_amount" FROM hisab."incomes" WHERE id = ANY($1) AND "companyId" = $2 FOR UPDATE`,
          [transactionIds, companyId]
      );

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
      } else if (allocation.transactionId === 'opening-balance') {
        // ADDED: Handle opening-balance allocations
        // Opening balance payments only affect bank balance, not receivable/payable calculation
        currentBalanceAmount += paidAmount;
        // Do NOT add to receivableAmount or payableAmount
        // Opening balance is handled separately and should not affect payment type calculation
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

    // Calculate net amount for bank impact excluding opening balance (which is handled separately)
    const netAmount = receivableAmount - payableAmount;
    
    // For opening balance only payments, determine type based on opening balance type
    let paymentType, absoluteNetAmount;
    
    if (receivableAmount === 0 && payableAmount === 0 && currentBalanceAmount > 0) {
      // This is an opening balance only payment
      // Get the opening balance type from the contact to determine payment direction
      const openingBalanceAllocation = transactionAllocations.find(a => a.transactionId === 'opening-balance');
      const balanceType = openingBalanceAllocation?.type || 'receivable';
      
      paymentType = balanceType === 'receivable' ? 'receipt' : 'payment';
      absoluteNetAmount = currentBalanceAmount;
    } else {
      // Regular payment calculation
    // If we have more payable (we owe them) -> we pay -> outflow -> 'payment'
    // If we have more receivable (they owe us) -> we receive -> inflow -> 'receipt'
      paymentType = payableAmount > receivableAmount ? 'payment' : 'receipt';
      absoluteNetAmount = Math.abs(netAmount) + currentBalanceAmount; // Add opening balance amount
    }

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
    // UPDATED: Removed stored contact balance logic since we no longer store balance
    // Contact balance is now always calculated real-time using calculateContactCurrentBalance()

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

    // UPDATED: No longer need to update stored contact balance since it's calculated real-time
    // Contact balance is now always calculated using calculateContactCurrentBalance()

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
      } else if (allocation.transactionId === 'opening-balance') {
        // ADDED: Handle opening-balance allocations
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
            'opening-balance',
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
              paidAmount, // Store the actual paid amount, not the full transaction amount
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
              paidAmount, // Store the actual paid amount, not the full transaction amount
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
            paidAmount, // Store the actual paid amount, not the full transaction amount
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
            paidAmount, // Store the actual paid amount, not the full transaction amount
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

    // ADDED: Handle opening balance updates when payments are made against opening balance
    await handleOpeningBalanceUpdates(client, transactionAllocations, contactId, companyId);

    await client.query("COMMIT");

    const newPaymentId = paymentResult.rows[0].id;

    // OPTIMIZATION 7: Generate PDF asynchronously (don't wait for it)
    setImmediate(async () => {
      try {
        const pdfUrl = await generatePaymentPDFInternal(newPaymentId, companyId);
        
        const pdfClient = await pool.connect();
        try {
          await pdfClient.query(
            `UPDATE hisab."payments" 
             SET "pdfUrl" = $1, "pdfGeneratedAt" = CURRENT_TIMESTAMP 
             WHERE "id" = $2 AND "companyId" = $3`,
            [pdfUrl, newPaymentId, companyId]
          );
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
        // UPDATED: Removed stored contact balance since it's calculated real-time
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
  const startTime = Date.now();
  
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
        `SELECT "id", "name" FROM hisab."contacts" WHERE id = $1 AND "companyId" = $2`,
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
      } else if (allocation.allocationType === 'opening-balance') {
        // ADDED: Handle opening-balance allocations
        // Opening balance payments only affect bank balance, not receivable/payable calculation
        oldCurrentBalanceAmount += paidAmount;
        // Do NOT add to oldReceivableAmount or oldPayableAmount
        // Opening balance is handled separately and should not affect payment type calculation
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

    // Calculate old net amount excluding opening balance (which is handled separately)
    const oldNetAmount = oldReceivableAmount - oldPayableAmount;
    const oldPaymentType = existingPayment.paymentType;
    
    // For opening balance only payments, use the current balance amount
    let oldAbsoluteNetAmount;
    if (oldReceivableAmount === 0 && oldPayableAmount === 0 && oldCurrentBalanceAmount > 0) {
      // This was an opening balance only payment
      oldAbsoluteNetAmount = oldCurrentBalanceAmount;
    } else {
      // Regular payment calculation
      oldAbsoluteNetAmount = Math.abs(oldNetAmount) + oldCurrentBalanceAmount; // Add opening balance amount
    }
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
      } else if (allocation.transactionId === 'opening-balance') {
        // ADDED: Handle opening-balance allocations
        // Opening balance payments only affect bank balance, not receivable/payable calculation
        newCurrentBalanceAmount += paidAmount;
        // Do NOT add to newReceivableAmount or newPayableAmount
        // Opening balance is handled separately and should not affect payment type calculation
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

    // Calculate net amount excluding opening balance (which is handled separately)
    const newNetAmount = newReceivableAmount - newPayableAmount;
    
    // For opening balance only payments, determine type based on opening balance type
    let newPaymentType, newAbsoluteNetAmount;
    
    if (newReceivableAmount === 0 && newPayableAmount === 0 && newCurrentBalanceAmount > 0) {
      // This is an opening balance only payment
      // Get the opening balance type from the contact to determine payment direction
      const openingBalanceAllocation = transactionAllocations.find(a => a.transactionId === 'opening-balance');
      const balanceType = openingBalanceAllocation?.type || 'receivable';
      
      newPaymentType = balanceType === 'receivable' ? 'receipt' : 'payment';
      newAbsoluteNetAmount = newCurrentBalanceAmount;
    } else {
      // Regular payment calculation
      newPaymentType = newNetAmount > 0 ? 'receipt' : 'payment';
      newAbsoluteNetAmount = Math.abs(newNetAmount) + newCurrentBalanceAmount; // Add opening balance amount
    }
    
    const newAdjValue = parseFloat(adjustmentValue || 0);
    let newOriginalAmount = newAbsoluteNetAmount;
    let newAdjustedAmount = newAbsoluteNetAmount;

    if (adjustmentType === 'discount') {
      newAdjustedAmount = Math.max(0, newAbsoluteNetAmount - newAdjValue);
    } else if (adjustmentType === 'extra_receipt' || adjustmentType === 'surcharge') {
      newOriginalAmount = newAbsoluteNetAmount + newAdjValue;
      newAdjustedAmount = newAbsoluteNetAmount;
    }

    // STEP 2: First reverse old bank impact before applying new one
    // FIXED: Opening balance transactions now properly handled:
    // - Opening balance amounts don't affect receivable/payable calculation
    // - Bank balance impact is calculated correctly for opening balance only payments
    // - Payment type is determined by opening balance type for pure opening balance payments
    // Calculate old bank impact - FIXED LOGIC
    let oldBankImpact = 0;
    if (existingPayment.adjustmentType === 'discount') {
      oldBankImpact = oldPaymentType === 'payment' ? -oldAdjustedAmount : oldAdjustedAmount;
    } else if (existingPayment.adjustmentType === 'extra_receipt' || existingPayment.adjustmentType === 'surcharge') {
      oldBankImpact = oldPaymentType === 'payment' ? -oldOriginalAmount : oldOriginalAmount;
    } else {
      oldBankImpact = oldPaymentType === 'payment' ? -oldAbsoluteNetAmount : oldAbsoluteNetAmount;
    }

    console.log('🏦 Bank balance update debug:', {
      oldPaymentType,
      newPaymentType,
      oldAbsoluteNetAmount,
      newAbsoluteNetAmount,
      oldAdjustedAmount,
      newAdjustedAmount,
      oldBankImpact,
      existingBankId: existingPayment.bankId,
      newBankId: bankAccountId,
      oldCurrentBalanceAmount,
      newCurrentBalanceAmount,
      oldReceivableAmount,
      oldPayableAmount,
      newReceivableAmount,
      newPayableAmount
    });

    // Reverse old bank impact first
    if (oldBankImpact !== 0) {
      console.log(`🔄 Reversing old bank impact: ${oldBankImpact} from bank ${existingPayment.bankId}`);
      await client.query(
        `UPDATE hisab."bankAccounts" SET "currentBalance" = "currentBalance" - $1 WHERE id = $2`,
        [oldBankImpact, existingPayment.bankId]
      );
    }

    // Calculate new bank impact
    let newBankImpact = 0;
    if (adjustmentType === 'discount') {
      newBankImpact = newPaymentType === 'payment' ? -newAdjustedAmount : newAdjustedAmount;
    } else if (adjustmentType === 'extra_receipt' || adjustmentType === 'surcharge') {
      newBankImpact = newPaymentType === 'payment' ? -newOriginalAmount : newOriginalAmount;
    } else {
      newBankImpact = newPaymentType === 'payment' ? -newAbsoluteNetAmount : newAbsoluteNetAmount;
    }

    console.log(`💰 Calculated new bank impact: ${newBankImpact} for bank ${bankAccountId}`);

    // Apply new bank impact
    if (newBankImpact !== 0) {
      console.log(`✅ Applying new bank impact: ${newBankImpact} to bank ${bankAccountId}`);
      await client.query(
        `UPDATE hisab."bankAccounts" SET "currentBalance" = "currentBalance" + $1 WHERE id = $2`,
        [newBankImpact, bankAccountId]
      );
    }

    // Reverse old contact balance impact
    // UPDATED: Removed all contact balance update logic since we no longer store balance
    // Contact balance is now always calculated real-time using calculateContactCurrentBalance()

    // Reverse transaction impacts using the centralized function
    const reversalQueries = await reverseTransactionAllocations(client, existingAllocations, companyId, existingPayment);

    // Execute all reversal queries
    for (const query of reversalQueries) {
      await client.query(query.query, query.params);
    }

    // Delete old allocations
    await client.query(`DELETE FROM hisab."payment_allocations" WHERE "paymentId" = $1`, [id]);

    // STEP 3: Handle opening balance updates for edit scenario
    await handleOpeningBalanceUpdateForEdit(client, existingAllocations, transactionAllocations, existingPayment.contactId, companyId);

    // STEP 4: Process new transaction allocations using the centralized function
    const { allocationQueries, transactionUpdateQueries } = await processNewTransactionAllocations(client, transactionAllocations, id, companyId, bankAccountId);

    // Execute all queries in batches for better performance
    const allQueries = [...transactionUpdateQueries, ...allocationQueries];
    const batchSize = 10;
    
    for (let i = 0; i < allQueries.length; i += batchSize) {
      const batch = allQueries.slice(i, i + batchSize);
      await Promise.all(batch.map(query => client.query(query.query, query.params)));
    }

    // Update payment record with new values
    const updatedPaymentResult = await client.query(
      `UPDATE hisab."payments" 
       SET "contactId" = $1, "bankId" = $2, "date" = $3, "amount" = $4,
           "paymentType" = $5, "description" = $6, "adjustmentType" = $7, "adjustmentValue" = $8, "updatedAt" = NOW()
       WHERE id = $9 AND "companyId" = $10 RETURNING *`,
      [
        contactId,
        bankAccountId,
        date,
        newOriginalAmount,
        newPaymentType,
        description || null,
        adjustmentType || null,
        adjustmentValue || null,
        id,
        companyId
      ]
    );

    await client.query("COMMIT");

    // Generate PDF asynchronously (don't block the response)
    setImmediate(async () => {
      try {
        const pdfUrl = await generatePaymentPDFInternal(id, companyId);
        
        // Update payment record with PDF URL using a new connection
        const pdfClient = await pool.connect();
        try {
          await pdfClient.query(
            `UPDATE hisab."payments" 
             SET "pdfUrl" = $1, "pdfGeneratedAt" = CURRENT_TIMESTAMP 
             WHERE "id" = $2 AND "companyId" = $3`,
            [pdfUrl, id, companyId]
          );
        } finally {
          pdfClient.release();
        }
      } catch (pdfError) {
        console.error(`❌ PDF regeneration failed for payment ${id}:`, pdfError);
      }
    });

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    return successResponse(res, {
      message: "Payment updated successfully",
      payment: updatedPaymentResult.rows[0],
      executionTime: `${executionTime}ms`,
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
        // UPDATED: Removed stored contact balance references
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
        c."openingBalanceType" as "contactOpeningBalanceType",
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
        pur."invoiceDate" as "purchaseDate",
        pur."remaining_amount" as "purchasePendingAmount",
        pur."status" as "purchaseStatus",
        pur_contact."name" as "purchaseSupplierName",
        -- Sale data
        s."invoiceNumber" as "saleInvoiceNumber",
        s."remaining_amount" as "salePendingAmount",
        s."invoiceDate" as "saleDate",
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
          transformedAllocation.date = payment.date; // Use payment date for current balance
          transformedAllocation.pendingAmount = payment.contactCurrentBalance;
          transformedAllocation.balanceType = payment.contactCurrentBalanceType;
          break;
          
        case 'opening-balance':
          transformedAllocation.description = 'Opening Balance Settlement';
          transformedAllocation.reference = 'Opening Balance';
          transformedAllocation.transactionId = 'opening-balance';
          transformedAllocation.date = payment.date; // Use payment date for opening balance
          // Get the current opening balance to calculate pending amount
          const currentOpeningBalance = parseFloat(payment.contactOpeningBalance || 0);
          const paidAmount = parseFloat(allocation.paidAmount || 0);
          
          // Calculate the original opening balance (current + what was paid)
          const originalOpeningBalance = currentOpeningBalance + paidAmount;
          
          // Set the correct amounts for opening balance
          transformedAllocation.amount = originalOpeningBalance; // Original opening balance
          transformedAllocation.pendingAmount = currentOpeningBalance; // Current remaining balance
          transformedAllocation.paidAmount = paidAmount; // What was paid in this payment
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
          transformedAllocation.date = allocation.purchaseDate;
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
          transformedAllocation.date = allocation.saleDate;
          break;
          
        case 'expense':
          transformedAllocation.description = 'Expense Payment';
          transformedAllocation.reference = `Expense #${allocation.expenseId}`;
          transformedAllocation.pendingAmount = allocation.expenseAmount;
          transformedAllocation.status = allocation.expenseStatus;
          transformedAllocation.transactionId = allocation.expenseId;
          transformedAllocation.date = allocation.expenseDate;
          break;
          
        case 'income':
          transformedAllocation.description = 'Income Receipt';
          transformedAllocation.reference = `Income #${allocation.incomeId}`;
          transformedAllocation.pendingAmount = allocation.incomeAmount;
          transformedAllocation.status = allocation.incomeStatus;
          transformedAllocation.transactionId = allocation.incomeId;
          transformedAllocation.date = allocation.incomeDate;
          transformedAllocation.date = allocation.incomeDate;
          break;
          
        default:
          transformedAllocation.description = 'Payment allocation';
          transformedAllocation.reference = 'Unknown';
          transformedAllocation.transactionId = null;
      }
      
      return transformedAllocation;
    });

    const isPayment = payment.paymentType === 'payment';

    // Return flat structure like listPayments API for PaymentViewModal compatibility
    return successResponse(res, {
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      date: payment.date?.toISOString?.()?.split('T')[0] || payment.date, // Format date like listPayments
      contactId: payment.contactId,
      bankId: payment.bankId,
      amount: payment.amount,
      paymentType: payment.paymentType,
      description: payment.description,
      adjustmentType: payment.adjustmentType || 'none',
      adjustmentValue: payment.adjustmentValue,
      companyId: payment.companyId,
      createdBy: payment.createdBy,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      contactName: payment.contactName,
      contactBillingAddress1: payment.contactBillingAddress1,
      contactBillingAddress2: payment.contactBillingAddress2,
      contactBillingCity: payment.contactBillingCity,
      contactBillingState: payment.contactBillingState,
      contactBillingPincode: payment.contactBillingPincode,
      contactBillingCountry: payment.contactBillingCountry,
      bankName: payment.bankAccountName,
      bankAccountType: payment.bankAccountType || 'bank',
      createdByName: payment.createdByName,
      allocationCount: transformedAllocations.length.toString(),
      transactions: transformedAllocations
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
      `SELECT p.*, c."openingBalance", c."openingBalanceType"
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
    // UPDATED: No longer use stored balance, calculate real-time if needed
    // const { currentBalance, currentBalanceType } = payment; // These columns no longer exist

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
      } else if (allocation.allocationType === 'opening-balance') {
        // Handle opening balance allocation - this will be reversed later
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

    // ADDED: Handle opening balance reversal when payment is deleted
    await handleOpeningBalanceReversal(client, allocations, payment.contactId, companyId);

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

    // UPDATED: Removed all contact balance update logic since we no longer store balance
    // Contact balance is now always calculated real-time using calculateContactCurrentBalance()

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
        // UPDATED: Removed stored contact balance references
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
    console.error("Error in deletePayment:", error);
    console.error("Error details:", {
      code: error.code,
      message: error.message,
      detail: error.detail,
      hint: error.hint,
      position: error.position
    });
    return errorResponse(res, `Error deleting payment: ${error.message}`, 500);
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
    // 1. Get contact details to verify existence and calculate current balance
    const contactQuery = await client.query(
      `SELECT "name", "openingBalance", "openingBalanceType" 
       FROM hisab."contacts" 
       WHERE id = $1 AND "companyId" = $2`,
      [contactId, companyId]
    );

    if (!contactQuery.rows.length) {
      return errorResponse(res, "Contact not found", 404);
    }

    const contact = contactQuery.rows[0];
    
    // Calculate current balance using the balance calculator
    const { balance: currentBalance, balanceType: currentBalanceType } = await calculateContactCurrentBalance(client, contactId, companyId);
    const isPayable = currentBalanceType === 'payable';

    // DEBUG: Log the calculated balance to see if opening balance is included

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

    // 6. Format transactions - Include opening balance if amount > 0, then actual pending transactions
    const transactions = [];

    // Add opening balance as a transaction only if there's a remaining unpaid amount
    const openingBalanceAmount = parseFloat(contact.openingBalance || 0);
    if (openingBalanceAmount !== 0) {
      // Check how much of the opening balance has been paid
      const openingBalancePaymentsQuery = await client.query(
        `SELECT COALESCE(SUM(pa."paidAmount"), 0) as totalPaid
         FROM hisab."payment_allocations" pa
         JOIN hisab."payments" p ON pa."paymentId" = p."id"
         WHERE pa."allocationType" = 'opening-balance' 
           AND p."contactId" = $1 
           AND p."companyId" = $2 
           AND p."deletedAt" IS NULL`,
        [contactId, companyId]
      );
      
      const totalPaidAgainstOpeningBalance = parseFloat(openingBalancePaymentsQuery.rows[0]?.totalPaid || 0);
      
      // Calculate the original opening balance before any payments
      const originalOpeningBalance = openingBalanceAmount + totalPaidAgainstOpeningBalance;
      const remainingOpeningBalance = openingBalanceAmount; // This is already the remaining amount
      
      // Only show opening balance if there was an original opening balance
      if (originalOpeningBalance > 0.01) {
        transactions.push({
          id: 'opening-balance',
          type: 'opening-balance',
          description: 'Opening Balance',
          amount: originalOpeningBalance, // Show original amount, not remaining
          paidAmount: totalPaidAgainstOpeningBalance,
          balanceType: contact.openingBalanceType || 'payable',
          date: null,
          isOpeningBalance: true,
          pendingAmount: Math.abs(remainingOpeningBalance)
        });
      }
    }

    // Add purchases with pending amount > 0
    pendingPurchases.rows.forEach(purchase => {
      const pendingAmount = parseFloat(purchase.remainingAmount) || parseFloat(purchase.amount);
      if (pendingAmount > 0) {
        transactions.push({
          id: purchase.id, // Use numeric ID directly for payment processing
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
          id: sale.id, // Use numeric ID directly for payment processing
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
      const pendingAmount = parseFloat(expense.remainingAmount) || parseFloat(expense.amount);
      if (pendingAmount > 0) {
        transactions.push({
          id: expense.id, // Use numeric ID directly for payment processing
          type: 'expense',
          description: `Expense#${expense.id}`,
          amount: parseFloat(expense.amount),
          paidAmount: parseFloat(expense.paidAmount) || 0,
          balanceType: 'payable', // We owe them for expenses
          date: expense.date,
          pendingAmount: pendingAmount
        });
      }
    });

    // Add pending incomes (amounts they owe us)
    pendingIncomes.rows.forEach(income => {
      const pendingAmount = parseFloat(income.remainingAmount) || parseFloat(income.amount);
      if (pendingAmount > 0) {
        transactions.push({
          id: income.id, // Use numeric ID directly for payment processing
          type: 'income',
          description: `Income#${income.id}`,
          amount: parseFloat(income.amount),
          paidAmount: parseFloat(income.paidAmount) || 0,
          balanceType: 'receivable', // They owe us for incomes
          date: income.date,
          pendingAmount: pendingAmount
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

    // 8. Calculate summary by transaction type with opening balance consideration
    const summary = {
      // Current balance from calculation (includes opening balance + all pending transactions)
      currentBalance: Math.abs(currentBalance),
      currentBalanceType: currentBalanceType,
      
      // Breakdown by transaction type
      pendingAmounts: {
        purchases: totalPendingPayable > 0 ? pendingPurchases.rows.reduce((sum, p) => sum + parseFloat(p.remainingAmount || 0), 0) : 0,
        sales: totalPendingReceivable > 0 ? pendingSales.rows.reduce((sum, s) => sum + parseFloat(s.remainingAmount || 0), 0) : 0,
        expenses: pendingExpenses.rows.reduce((sum, e) => sum + parseFloat(e.remainingAmount || 0), 0),
        incomes: pendingIncomes.rows.reduce((sum, i) => sum + parseFloat(i.remainingAmount || 0), 0)
      },
      
      // Totals by balance type (including opening balance)
      totalPendingPayable: pendingPurchases.rows.reduce((sum, p) => sum + parseFloat(p.remainingAmount || 0), 0) + 
                          pendingExpenses.rows.reduce((sum, e) => sum + parseFloat(e.remainingAmount || 0), 0) +
                          (contact.openingBalanceType === 'payable' ? parseFloat(contact.openingBalance || 0) : 0),
      totalPendingReceivable: pendingSales.rows.reduce((sum, s) => sum + parseFloat(s.remainingAmount || 0), 0) + 
                             pendingIncomes.rows.reduce((sum, i) => sum + parseFloat(i.remainingAmount || 0), 0) +
                             (contact.openingBalanceType === 'receivable' ? parseFloat(contact.openingBalance || 0) : 0),
      
      // Opening balance information
      openingBalance: {
        amount: parseFloat(contact.openingBalance || 0),
        type: contact.openingBalanceType || 'payable'
      },
      
      // Transaction counts
      transactionCounts: {
        pendingPurchases: pendingPurchases.rows.length,
        pendingSales: pendingSales.rows.length,
        pendingExpenses: pendingExpenses.rows.length,
        pendingIncomes: pendingIncomes.rows.length,
        totalPendingTransactions: transactions.length
      },
      
      // Net calculation
      netPendingAmount: (pendingPurchases.rows.reduce((sum, p) => sum + parseFloat(p.remainingAmount || 0), 0) + 
                       pendingExpenses.rows.reduce((sum, e) => sum + parseFloat(e.remainingAmount || 0), 0)) -
                      (pendingSales.rows.reduce((sum, s) => sum + parseFloat(s.remainingAmount || 0), 0) + 
                       pendingIncomes.rows.reduce((sum, i) => sum + parseFloat(i.remainingAmount || 0), 0)),
      
      suggestedPayment: currentBalanceType === 'payable' ? Math.abs(currentBalance) : 0,
      
      // FIXED: Add totalPending for frontend compatibility
      totalPending: Math.abs(currentBalance), // This should show the current balance (including opening balance)
      payableStatus: currentBalanceType // This should match the current balance type
    };

    // DEBUG: Log the summary calculation to see what values are being set
    transactions.forEach((t, i) => {
    });
    
    // MANUAL VERIFICATION: Calculate expected balance manually
    const contactOpeningBalanceAmount = parseFloat(contact.openingBalance || 0);
    const contactOpeningBalanceType = contact.openingBalanceType || 'payable';
    
    // FIXED: Don't add opening balance separately since it's already in the transactions list
    // Just sum up all the transactions from the list
    let expectedBalance = 0;
    
    // Add all receivable transactions (they owe us)
    expectedBalance += totalPendingReceivable;
    
    // Subtract all payable transactions (we owe them)
    expectedBalance -= totalPendingPayable;
    
    const expectedBalanceType = expectedBalance >= 0 ? 'receivable' : 'payable';
    const expectedBalanceAmount = Math.abs(expectedBalance);
    
    
    // DEBUG: Keep logging but remove the override since the core calculation should now be correct
    if (expectedBalanceAmount.toFixed(2) !== summary.currentBalance.toFixed(2) || expectedBalanceType !== summary.currentBalanceType) {
    } else {
    }
    

    return successResponse(res, {
      contact: {
        id: contactId,
        name: contact.name,
        currentBalance,
        balanceType: currentBalanceType,
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
  const listStartTime = Date.now();
  
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
    const queryBuildTime = Date.now();

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
      const mainQueriesTime = Date.now();
      
      // Execute both queries in parallel
      const [paymentsResult, countResult] = await Promise.all([
        client.query(query, queryParams),
        client.query(countQuery, countParams)
      ]);
      
      const afterMainQueriesTime = Date.now();

      const payments = paymentsResult.rows;
      const total = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(total / limit);

      // Skip column check for better performance
      const hasNewColumns = true;

      // Get allocations for payments that have them
      if (payments.length > 0) {
        const allocationsStartTime = Date.now();
        
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
                pur."invoiceDate" as "purchaseDate",
                pur."netPayable" as "purchaseOriginalAmount",
                pur_contact."name" as "purchaseSupplierName",
                -- Sale data
                s."invoiceNumber" as "saleInvoiceNumber",
                s."remaining_amount" as "salePendingAmount",
                s."status" as "saleStatus",
                s."invoiceDate" as "saleDate",
                s."netReceivable" as "saleOriginalAmount",
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
                pur."invoiceDate" as "purchaseDate",
                pur."netPayable" as "purchaseOriginalAmount",
                pur_contact."name" as "purchaseSupplierName"
              FROM hisab."payment_allocations" pa
              LEFT JOIN hisab."purchases" pur ON pa."purchaseId" = pur."id" AND pa."allocationType" = 'purchase'
              LEFT JOIN hisab."contacts" pur_contact ON pur."contactId" = pur_contact."id"
              WHERE pa."paymentId" = ANY($1)
              ORDER BY pa."paymentId", pa."createdAt" ASC
            `;
          }

          const allocationsStartTime = Date.now();
          
          // Use simplified allocations query for better performance
          const simplifiedAllocationsQuery = `
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
              pa."paidAmount"
            FROM hisab."payment_allocations" pa
            WHERE pa."paymentId" = ANY($1)
            ORDER BY pa."paymentId", pa."createdAt" ASC
          `;
          
          const allocationsResult = await client.query(simplifiedAllocationsQuery, [paymentIdsWithAllocations]);
          const allocations = allocationsResult.rows;
          
          const allocationsQueryTime = Date.now();

          const paymentIdsWithCurrentBalance = allocations
            .filter(a => a.allocationType === 'current-balance')
            .map(a => a.paymentId);

          let contactBalances = {};
          if (paymentIdsWithCurrentBalance.length > 0) {
            // UPDATED: No longer query stored contact balance since we don't store it
            // For payments with current-balance allocations, we'll calculate balance real-time if needed
            // For now, we'll mark them as needing balance calculation
            paymentIdsWithCurrentBalance.forEach(paymentId => {
              contactBalances[paymentId] = {
                pendingAmount: 0, // Will be calculated real-time if needed
                balanceType: 'payable', // Default value
                needsCalculation: true // Flag to indicate real-time calculation needed
              };
            });
          }

          const allocationsByPayment = {};
          allocations.forEach(allocation => {
            if (!allocationsByPayment[allocation.paymentId]) {
              allocationsByPayment[allocation.paymentId] = [];
            }

            // Transform allocation data based on transaction type (simplified for performance)
            let transformedAllocation = { 
              ...allocation,
              originalAmount: allocation.amount,
              type: allocation.allocationType,
              transactionId: allocation.purchaseId || allocation.saleId || allocation.expenseId || allocation.incomeId || 'current-balance',
              description: `${allocation.allocationType.charAt(0).toUpperCase() + allocation.allocationType.slice(1)} Transaction`,
              reference: `${allocation.allocationType.toUpperCase()}-${allocation.purchaseId || allocation.saleId || allocation.expenseId || allocation.incomeId || 'BAL'}`,
              date: new Date().toISOString() // Use current date for simplicity
            };
            
            if (allocation.allocationType === 'current-balance') {
              transformedAllocation.description = 'Current Balance Settlement';
              transformedAllocation.reference = 'Current Balance';
              transformedAllocation.transactionId = 'current-balance';
          transformedAllocation.date = payment.date; // Use payment date for current balance
              if (contactBalances[allocation.paymentId]) {
                transformedAllocation.pendingAmount = contactBalances[allocation.paymentId].pendingAmount;
                transformedAllocation.balanceType = contactBalances[allocation.paymentId].balanceType;
                transformedAllocation.originalAmount = contactBalances[allocation.paymentId].pendingAmount || allocation.amount;
              }
            } else if (allocation.allocationType === 'opening-balance') {
              transformedAllocation.description = 'Opening Balance Settlement';
              transformedAllocation.reference = 'Opening Balance';
              transformedAllocation.transactionId = 'opening-balance';
          transformedAllocation.date = payment.date; // Use payment date for opening balance
              // Note: In list view, we don't need detailed amount calculations for performance
              // The allocation already contains the basic amount and paidAmount data
            }
            // Simplified transformation for better performance (no complex transaction details needed for list view)

            allocationsByPayment[allocation.paymentId].push(transformedAllocation);
          });

          payments.forEach(payment => {
            payment.transactions = allocationsByPayment[payment.id] || [];
          });
        } else {
          payments.forEach(payment => {
            payment.transactions = [];
          });
        }
      }

      const finalTime = Date.now();
      const totalExecutionTime = finalTime - listStartTime;

      return successResponse(res, {
        payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          currentPage: parseInt(page)
        },
        executionTime: `${totalExecutionTime}ms`
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
async function generatePaymentPDFInternal(paymentId, companyId, userId, copies = 2) {
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

    // Fetch allocations for payment

    // Transform allocations data for PDF generation
    const transformedAllocations = allocationsResult.rows.map(allocation => {
      let description = 'Payment allocation';
      let reference = 'N/A';
      
      switch (allocation.allocationType) {
        case 'current-balance':
          description = 'Current Balance Settlement';
          reference = 'Current Balance';
          break;
          
        case 'opening-balance':
          description = 'Opening Balance Settlement';
          reference = 'Opening Balance';
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
      
      const transformed = {
        ...allocation,
        description,
        reference,
        transactionId: allocation.allocationType === 'current-balance' ? 'current-balance' : 
                      allocation.purchaseId || allocation.saleId || allocation.expenseId || allocation.incomeId
      };
      
      // Allocation transformed successfully
      
      return transformed;
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

    // Create template data
    const templateData = createPaymentReceiptTemplateData(pdfData);

    // Generate PDF using user's default template
    const { pdfBuffer, template } = await generatePDFFromTemplate(templateData, {
      userId,
      companyId,
      moduleType: 'payment',
      templateId: null, // Use user's default template
      copies: copies // Use the provided copies parameter
    });

    return { pdfBuffer, template };

  } finally {
    client.release();
  }
}

export async function generatePaymentInvoicePDF(req, res) {
  const { id: paymentId, copies } = req.query;
  const companyId = req.currentUser?.companyId;
  const userId = req.currentUser?.id;

  if (!paymentId) {
    return errorResponse(res, "Payment ID is required", 400);
  }
  
  if (!userId || !companyId) {
    return errorResponse(res, "Authentication required", 401);
  }

  // Get user's default copy preference if copies not specified
  let numCopies = 2; // fallback default
  if (copies) {
    numCopies = parseInt(copies);
  } else {
    // Fetch user's default copy preference
    const client = await pool.connect();
    try {
      const copyQuery = `
        SELECT "defaultCopies"
        FROM hisab."userCopyPreferences" 
        WHERE "userId" = $1 AND "companyId" = $2 AND "moduleType" = 'payment'
      `;
      const copyResult = await client.query(copyQuery, [userId, companyId]);
      if (copyResult.rows.length > 0) {
        numCopies = copyResult.rows[0].defaultCopies;
      }
    } catch (error) {
      console.error('Error fetching copy preference:', error);
      // Continue with default of 2
    } finally {
      client.release();
    }
  }

  // Validate copies parameter
  if (![1, 2, 4].includes(numCopies)) {
    return errorResponse(res, "Copies must be 1, 2, or 4", 400);
  }

  try {
    // Always generate fresh PDF (same as sales/purchase)
    const { pdfBuffer, template } = await generatePaymentPDFInternal(paymentId, companyId, userId, numCopies);
    
    // Generate filename
    const pdfFileName = generatePaymentPDFFileName(paymentId, `Payment_${paymentId}`);

    // Upload to S3
    const pdfUrl = await uploadFileToS3(pdfBuffer, pdfFileName);

    return successResponse(res, {
      message: "Payment receipt PDF generated successfully",
      pdfUrl: pdfUrl,
      fileName: pdfFileName,
      template: template ? {
        id: template.id,
        name: template.name
      } : null,
      actionType: 'generated'
    });

  } catch (error) {
    console.error("Error generating payment invoice PDF:", error);
    
    // Handle specific error types
    if (error.message?.includes('not found')) {
      return errorResponse(res, "Payment or related data not found", 404);
    } else if (error.message?.includes('PDF generation failed')) {
      return errorResponse(res, "Failed to generate PDF document", 500);
    } else if (error.message?.includes('upload failed')) {
      return errorResponse(res, "Failed to upload PDF to cloud storage", 500);
    } else {
      return errorResponse(res, "Failed to generate payment receipt PDF", 500);
    }
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
    .filter(allocation => allocation.transactionId !== 'current-balance' && allocation.transactionId !== 'opening-balance')
    .map(allocation => allocation.transactionId);

  console.log('🔍 processNewTransactionAllocations - DEBUG:', {
    allAllocations: transactionAllocations.map(a => ({ id: a.transactionId, type: a.transactionType })),
    filteredTransactionIds: transactionIds,
    willQueryDatabase: transactionIds.length > 0
  });

  let transactionsData = {};
  if (transactionIds.length > 0) {
    console.log('🔍 About to execute database queries with transactionIds:', transactionIds);
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
    } else if (allocation.transactionId === 'opening-balance') {
      // ADDED: Handle opening-balance allocations
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
          'opening-balance',
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
        
        // Determine proper status - only paid or pending
        let newStatus = 'pending';
        if (newPaidAmount >= purchaseAmount) {
          newStatus = 'paid';
        }

        transactionUpdateQueries.push({
          query: `UPDATE hisab."purchases" 
           SET "status" = $1, "remaining_amount" = $2, "paid_amount" = $3, "bankAccountId" = $4, "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $5`,
          params: [newStatus, newRemainingAmount, newPaidAmount, newStatus === 'paid' ? bankAccountId : null, allocation.transactionId]
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
            purchaseAmount, // Use the actual purchase amount from database, not frontend payload
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
        
        // Determine proper status - only paid or pending
        let newStatus = 'pending';
        if (newPaidAmount >= saleAmount) {
          newStatus = 'paid';
        }

        transactionUpdateQueries.push({
          query: `UPDATE hisab."sales" 
           SET "status" = $1, "remaining_amount" = $2, "paid_amount" = $3, "bankAccountId" = $4, "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $5`,
          params: [newStatus, newRemainingAmount, newPaidAmount, newStatus === 'paid' ? bankAccountId : null, allocation.transactionId]
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
            paidAmount, // Store the actual paid amount, not the full transaction amount
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
            paidAmount, // Store the actual paid amount, not the full transaction amount
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
              paidAmount, // Store the actual paid amount, not the full transaction amount
              paidAmount,
              balanceType
            ]
          });
      }
    }
  }

  return { allocationQueries, transactionUpdateQueries };
}

// Helper function to revert old transaction allocations when updating payment
async function revertOldTransactionAllocations(client, existingAllocations, companyId) {
  // Group allocations by transaction type and ID
  const transactionIds = existingAllocations
    .filter(allocation => allocation.allocationType !== 'current-balance')
    .map(allocation => {
      if (allocation.purchaseId) return allocation.purchaseId;
      if (allocation.saleId) return allocation.saleId;
      if (allocation.expenseId) return allocation.expenseId;
      if (allocation.incomeId) return allocation.incomeId;
      return null;
    })
    .filter(id => id !== null);

  let transactionsData = {};
  if (transactionIds.length > 0) {
    // Fetch current transaction data
    const [purchasesQuery, salesQuery, expensesQuery, incomesQuery] = await Promise.all([
      client.query(
        `SELECT id, "netPayable", "remaining_amount", "paid_amount", "status" FROM hisab."purchases" WHERE id = ANY($1) AND "companyId" = $2 FOR UPDATE`,
        [transactionIds, companyId]
      ),
      client.query(
        `SELECT id, "netReceivable", "remaining_amount", "paid_amount", "status" FROM hisab."sales" WHERE id = ANY($1) AND "companyId" = $2 FOR UPDATE`,
        [transactionIds, companyId]
      ),
      client.query(
        `SELECT id, "amount", "remaining_amount", "paid_amount", "status" FROM hisab."expenses" WHERE id = ANY($1) AND "companyId" = $2 FOR UPDATE`,
        [transactionIds, companyId]
      ),
      client.query(
        `SELECT id, "amount", "remaining_amount", "paid_amount", "status" FROM hisab."incomes" WHERE id = ANY($1) AND "companyId" = $2 FOR UPDATE`,
        [transactionIds, companyId]
      )
    ]);

    purchasesQuery.rows.forEach(row => transactionsData[`purchase_${row.id}`] = row);
    salesQuery.rows.forEach(row => transactionsData[`sale_${row.id}`] = row);
    expensesQuery.rows.forEach(row => transactionsData[`expense_${row.id}`] = row);
    incomesQuery.rows.forEach(row => transactionsData[`income_${row.id}`] = row);
  }

  // Batch process all old allocations to revert their effects
  const revertQueries = [];
  
  for (const allocation of existingAllocations) {
    const paidAmount = parseFloat(allocation.paidAmount || 0);
    
    if (allocation.allocationType === 'current-balance') {
      // Skip current balance reversals - handled separately
      continue;
    } else if (allocation.purchaseId) {
      // Revert purchase payment
      const purchase = transactionsData[`purchase_${allocation.purchaseId}`];
      if (purchase) {
        const currentPaidAmount = parseFloat(purchase.paid_amount || 0);
        const newPaidAmount = Math.max(0, currentPaidAmount - paidAmount);
        const purchaseAmount = parseFloat(purchase.netPayable || 0);
        const newRemainingAmount = purchaseAmount - newPaidAmount;
        
        // Determine new status
        let newStatus = 'pending';
        if (newPaidAmount >= purchaseAmount) {
          newStatus = 'paid';
        }

        revertQueries.push({
          query: `UPDATE hisab."purchases" 
           SET "status" = $1, "remaining_amount" = $2, "paid_amount" = $3, "bankAccountId" = CASE WHEN $1 = 'paid' THEN "bankAccountId" ELSE NULL END, "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $4`,
          params: [newStatus, newRemainingAmount, newPaidAmount, allocation.purchaseId]
        });
        
        // Update local data for next iteration
        transactionsData[`purchase_${allocation.purchaseId}`].paid_amount = newPaidAmount;
        transactionsData[`purchase_${allocation.purchaseId}`].remaining_amount = newRemainingAmount;
      }
    } else if (allocation.saleId) {
      // Revert sale payment
      const sale = transactionsData[`sale_${allocation.saleId}`];
      if (sale) {
        const currentPaidAmount = parseFloat(sale.paid_amount || 0);
        const newPaidAmount = Math.max(0, currentPaidAmount - paidAmount);
        const saleAmount = parseFloat(sale.netReceivable || 0);
        const newRemainingAmount = saleAmount - newPaidAmount;
        
        // Determine new status
        let newStatus = 'pending';
        if (newPaidAmount >= saleAmount) {
          newStatus = 'paid';
        }

        revertQueries.push({
          query: `UPDATE hisab."sales" 
           SET "status" = $1, "remaining_amount" = $2, "paid_amount" = $3, "bankAccountId" = CASE WHEN $1 = 'paid' THEN "bankAccountId" ELSE NULL END, "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $4`,
          params: [newStatus, newRemainingAmount, newPaidAmount, allocation.saleId]
        });
        
        // Update local data for next iteration
        transactionsData[`sale_${allocation.saleId}`].paid_amount = newPaidAmount;
        transactionsData[`sale_${allocation.saleId}`].remaining_amount = newRemainingAmount;
      }
    } else if (allocation.expenseId) {
      // Revert expense payment
      const expense = transactionsData[`expense_${allocation.expenseId}`];
      if (expense) {
        const currentPaidAmount = parseFloat(expense.paid_amount || 0);
        const newPaidAmount = Math.max(0, currentPaidAmount - paidAmount);
        const expenseAmount = parseFloat(expense.amount || 0);
        const newRemainingAmount = expenseAmount - newPaidAmount;
        
        // Determine new status - only paid or pending
        let newStatus = 'pending';
        if (newPaidAmount >= expenseAmount) {
          newStatus = 'paid';
        }

        revertQueries.push({
          query: `UPDATE hisab."expenses" 
           SET "status" = $1, "remaining_amount" = $2, "paid_amount" = $3, "bankAccountId" = CASE WHEN $1 = 'paid' THEN "bankAccountId" ELSE NULL END, "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $4`,
          params: [newStatus, newRemainingAmount, newPaidAmount, allocation.expenseId]
        });
        
        // Update local data for next iteration
        transactionsData[`expense_${allocation.expenseId}`].paid_amount = newPaidAmount;
        transactionsData[`expense_${allocation.expenseId}`].remaining_amount = newRemainingAmount;
      }
    } else if (allocation.incomeId) {
      // Revert income payment
      const income = transactionsData[`income_${allocation.incomeId}`];
      if (income) {
        const currentPaidAmount = parseFloat(income.paid_amount || 0);
        const newPaidAmount = Math.max(0, currentPaidAmount - paidAmount);
        const incomeAmount = parseFloat(income.amount || 0);
        const newRemainingAmount = incomeAmount - newPaidAmount;
        
        // Determine new status - only paid or pending
        let newStatus = 'pending';
        if (newPaidAmount >= incomeAmount) {
          newStatus = 'paid';
        }

        revertQueries.push({
          query: `UPDATE hisab."incomes" 
           SET "status" = $1, "remaining_amount" = $2, "paid_amount" = $3, "bankAccountId" = CASE WHEN $1 = 'paid' THEN "bankAccountId" ELSE NULL END, "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $4`,
          params: [newStatus, newRemainingAmount, newPaidAmount, allocation.incomeId]
        });
        
        // Update local data for next iteration
        transactionsData[`income_${allocation.incomeId}`].paid_amount = newPaidAmount;
        transactionsData[`income_${allocation.incomeId}`].remaining_amount = newRemainingAmount;
      }
    }
  }
  
  // Execute all revert queries in batches
  if (revertQueries.length > 0) {
    const batchSize = 10;
    for (let i = 0; i < revertQueries.length; i += batchSize) {
      const batch = revertQueries.slice(i, i + batchSize);
      await Promise.all(batch.map(query => client.query(query.query, query.params)));
    }
  }
}

// Get complete payment data for printing/preview (same structure as sales/purchase)
export async function getPaymentForPrint(req, res) {
  const { id } = req.params;
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!id) {
    return errorResponse(res, "Payment ID is required", 400);
  }
  
  if (!userId || !companyId) {
    return errorResponse(res, "Authentication required", 401);
  }

  const client = await pool.connect();

  try {
    // Fetch payment details with all related data (EXACT SAME as PDF generation)
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

    const paymentResult = await client.query(paymentQuery, [id, companyId]);

    if (paymentResult.rows.length === 0) {
      return errorResponse(res, "Payment not found", 404);
    }

    const payment = paymentResult.rows[0];

    // Fetch payment allocations (EXACT SAME query as PDF generation)
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

    // Transform allocations data (EXACT SAME logic as PDF generation)
    const transformedAllocations = allocationsResult.rows.map(allocation => {
      let description = 'Payment allocation';
      let reference = 'N/A';
      
      switch (allocation.allocationType) {
        case 'current-balance':
          description = 'Current Balance Settlement';
          reference = 'Current Balance';
          break;
          
        case 'opening-balance':
          description = 'Opening Balance Settlement';
          reference = 'Opening Balance';
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
          reference = allocation.purchaseId || allocation.saleId || allocation.expenseId || allocation.incomeId || 'N/A';
      }
      
      return {
        ...allocation,
        description,
        reference,
        transactionId: allocation.allocationType === 'current-balance' ? 'current-balance' : 
                      allocation.purchaseId || allocation.saleId || allocation.expenseId || allocation.incomeId
      };
    });

    // Prepare data for template generation (EXACT SAME as PDF generation)
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

    // Create template data using same function as PDF generation
    const paymentData = createPaymentReceiptTemplateData(pdfData);

    return successResponse(res, {
      message: "Payment data retrieved successfully for printing",
      paymentData: paymentData
    });

  } catch (error) {
    console.error("Error getting payment for print:", error);
    return errorResponse(res, "Failed to get payment data for printing", 500);
  } finally {
    client.release();
  }
}

// Helper function to handle opening balance updates when payments are made
async function handleOpeningBalanceUpdates(client, transactionAllocations, contactId, companyId) {
  try {
    // Check if there are any opening balance allocations
    const openingBalanceAllocations = transactionAllocations.filter(
      allocation => allocation.transactionId === 'opening-balance'
    );

    if (openingBalanceAllocations.length === 0) {
      return; // No opening balance allocations
    }

    // Calculate total payment against opening balance
    const totalOpeningBalancePayment = openingBalanceAllocations.reduce(
      (sum, allocation) => sum + parseFloat(allocation.paidAmount || 0), 
      0
    );

    if (totalOpeningBalancePayment <= 0) {
      return; // No actual payment amount
    }

    // Get current opening balance
    const contactResult = await client.query(
      `SELECT "openingBalance", "openingBalanceType" 
       FROM hisab."contacts" 
       WHERE "id" = $1 AND "companyId" = $2`,
      [contactId, companyId]
    );

    if (contactResult.rows.length === 0) {
      console.error(`Contact ${contactId} not found for opening balance update`);
      return;
    }

    const contact = contactResult.rows[0];
    const currentOpeningBalance = parseFloat(contact.openingBalance || 0);
    const openingBalanceType = contact.openingBalanceType;

    if (currentOpeningBalance <= 0) {
      return;
    }

    // Calculate new opening balance after payment
    const newOpeningBalance = Math.max(0, currentOpeningBalance - totalOpeningBalancePayment);

    // Update the opening balance in contacts table
    await client.query(
      `UPDATE hisab."contacts" 
       SET "openingBalance" = $1, "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $2 AND "companyId" = $3`,
      [newOpeningBalance, contactId, companyId]
    );


    // Note: We don't change the openingBalanceType even when balance becomes 0
    // because the database constraint only allows 'payable' or 'receivable'
    // The balance amount of 0 is sufficient to indicate no remaining balance
    if (newOpeningBalance === 0) {
    }

  } catch (error) {
    console.error('Error updating opening balance:', error);
    throw error; // Re-throw to trigger transaction rollback
  }
}

// Helper function to handle opening balance updates in edit scenarios
async function handleOpeningBalanceUpdateForEdit(client, oldAllocations, newAllocations, contactId, companyId) {
  try {
    // Calculate old opening balance payment amount
    const oldOpeningBalanceAllocations = oldAllocations.filter(
      allocation => allocation.allocationType === 'opening-balance'
    );
    const oldOpeningBalancePayment = oldOpeningBalanceAllocations.reduce(
      (sum, allocation) => sum + parseFloat(allocation.paidAmount || 0), 
      0
    );

    // Calculate new opening balance payment amount
    const newOpeningBalanceAllocations = newAllocations.filter(
      allocation => allocation.transactionId === 'opening-balance'
    );
    const newOpeningBalancePayment = newOpeningBalanceAllocations.reduce(
      (sum, allocation) => sum + parseFloat(allocation.paidAmount || 0), 
      0
    );

    // Calculate the difference
    const paymentDifference = newOpeningBalancePayment - oldOpeningBalancePayment;

    // If no change in opening balance payments, return
    if (paymentDifference === 0) {
      return;
    }

    // Get current opening balance
    const contactResult = await client.query(
      `SELECT "openingBalance", "openingBalanceType" 
       FROM hisab."contacts" 
       WHERE "id" = $1 AND "companyId" = $2`,
      [contactId, companyId]
    );

    if (contactResult.rows.length === 0) {
      console.error(`Contact ${contactId} not found for opening balance update`);
      return;
    }

    const contact = contactResult.rows[0];
    const currentOpeningBalance = parseFloat(contact.openingBalance || 0);

    // Apply the difference to the opening balance
    // If paymentDifference is positive, more payment is being made (reduce balance)
    // If paymentDifference is negative, less payment is being made (increase balance)
    const newOpeningBalance = Math.max(0, currentOpeningBalance - paymentDifference);

    // Update the opening balance in contacts table
    await client.query(
      `UPDATE hisab."contacts" 
       SET "openingBalance" = $1, "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $2 AND "companyId" = $3`,
      [newOpeningBalance, contactId, companyId]
    );

    console.log(`🔄 Opening balance updated for contact ${contactId}:`, {
      oldBalance: currentOpeningBalance,
      newBalance: newOpeningBalance,
      paymentDifference,
      oldPayment: oldOpeningBalancePayment,
      newPayment: newOpeningBalancePayment
    });

  } catch (error) {
    console.error('Error updating opening balance for edit:', error);
    throw error; // Re-throw to trigger transaction rollback
  }
}

// Helper function to handle opening balance reversals when payments are deleted
async function handleOpeningBalanceReversal(client, allocations, contactId, companyId) {
  try {
    // Check if there are any opening balance allocations to reverse
    const openingBalanceAllocations = allocations.filter(
      allocation => allocation.allocationType === 'opening-balance'
    );

    if (openingBalanceAllocations.length === 0) {
      return; // No opening balance allocations to reverse
    }

    // Calculate total payment that was made against opening balance
    const totalOpeningBalancePayment = openingBalanceAllocations.reduce(
      (sum, allocation) => sum + parseFloat(allocation.paidAmount || 0), 
      0
    );

    if (totalOpeningBalancePayment <= 0) {
      return; // No actual payment amount to reverse
    }

    // Get current opening balance
    const contactResult = await client.query(
      `SELECT "openingBalance", "openingBalanceType" 
       FROM hisab."contacts" 
       WHERE "id" = $1 AND "companyId" = $2`,
      [contactId, companyId]
    );

    if (contactResult.rows.length === 0) {
      console.error(`Contact ${contactId} not found for opening balance reversal`);
      return;
    }

    const contact = contactResult.rows[0];
    const currentOpeningBalance = parseFloat(contact.openingBalance || 0);
    const openingBalanceType = contact.openingBalanceType;

    // Calculate new opening balance after reversal (add back the payment amount)
    const newOpeningBalance = currentOpeningBalance + totalOpeningBalancePayment;

    // Update the opening balance in contacts table
    await client.query(
      `UPDATE hisab."contacts" 
       SET "openingBalance" = $1, "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $2 AND "companyId" = $3`,
      [newOpeningBalance, contactId, companyId]
    );

    // If the opening balance was previously set to 'none' or had no type, restore it
    if (!openingBalanceType || openingBalanceType === 'none') {
      // We need to determine the correct balance type based on the allocation
      const allocationBalanceType = openingBalanceAllocations[0].balanceType || 'receivable';
      await client.query(
        `UPDATE hisab."contacts" 
         SET "openingBalanceType" = $1, "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = $2 AND "companyId" = $3`,
        [allocationBalanceType, contactId, companyId]
      );
    }

  } catch (error) {
    console.error('Error reversing opening balance:', error);
    throw error; // Re-throw to trigger transaction rollback
  }
}

export async function getPaymentsForTransaction(req, res) {
  const { transactionType, transactionId } = req.params;
  const { companyId } = req.currentUser || {};

  if (!companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  if (!transactionType || !transactionId) {
    return errorResponse(res, "Transaction type and ID are required", 400);
  }

  // Map transaction types to their respective columns
  const transactionColumnMap = {
    purchase: 'purchaseId',
    sale: 'saleId',
    expense: 'expenseId',
    income: 'incomeId'
  };

  const column = transactionColumnMap[transactionType];
  if (!column) {
    return errorResponse(res, "Invalid transaction type", 400);
  }

  const client = await pool.connect();

  try {
    // Get payments and allocations for this transaction
    const paymentsQuery = `
      SELECT 
        p.id,
        p."paymentNumber",
        p.date,
        p.amount,
        p."paymentType",
        p.description,
        p."adjustmentType",
        p."adjustmentValue",
        pa."paidAmount",
        pa."balanceType",
        c.name as "contactName"
      FROM hisab."payment_allocations" pa
      JOIN hisab."payments" p ON pa."paymentId" = p.id
      LEFT JOIN hisab."contacts" c ON p."contactId" = c.id
      WHERE pa."${column}" = $1 
        AND p."companyId" = $2 
        AND p."deletedAt" IS NULL
      ORDER BY p.date DESC, p."createdAt" DESC
    `;

    const result = await client.query(paymentsQuery, [transactionId, companyId]);

    return successResponse(res, {
      payments: result.rows,
      transactionType,
      transactionId
    });

  } catch (error) {
    console.error("Error getting payments for transaction:", error);
    return errorResponse(res, "Failed to get payments for transaction", 500);
  } finally {
    client.release();
  }
}