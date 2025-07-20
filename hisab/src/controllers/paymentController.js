import { compareSync } from "bcrypt";
import pool from "../config/dbConnection.js";
import { errorResponse, successResponse } from "../utils/index.js";
import { calculateContactCurrentBalance } from "../utils/balanceCalculator.js";

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
  if (!contactId || !bankAccountId || !date || !transactionAllocations?.length) {
    return errorResponse(res, "Required fields are missing", 400);
  }
  if (adjustmentType && !['discount', 'extra_receipt', 'surcharge', 'none'].includes(adjustmentType)) {
    return errorResponse(res, "Invalid adjustment type", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const contactQuery = await client.query(
      `SELECT "currentBalance", "currentBalanceType" FROM hisab."contacts" WHERE id = $1 AND "companyId" = $2 FOR UPDATE`,
      [contactId, companyId]
    );
    if (!contactQuery.rows.length) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Contact not found", 404);
    }

    const bankQuery = await client.query(
      `SELECT "currentBalance" FROM hisab."bankAccounts" WHERE id = $1 AND "companyId" = $2 FOR UPDATE`,
      [bankAccountId, companyId]
    );
    if (!bankQuery.rows.length) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Bank account not found", 404);
    }

    // Calculate net amounts based on balance types
    let receivableAmount = 0;
    let payableAmount = 0;
    let currentBalanceAmount = 0;
    let purchaseAmount = 0;

    transactionAllocations.forEach(allocation => {
      const paidAmount = parseFloat(allocation.paidAmount || 0);
      const balanceType = allocation.type || 'payable';

      if (allocation.transactionId === 'current-balance') {
        currentBalanceAmount += paidAmount;
        if (balanceType === 'receivable') {
          receivableAmount += paidAmount;
        } else {
          payableAmount += paidAmount;
        }
      } else {
        purchaseAmount += paidAmount;
        if (balanceType === 'receivable') {
          receivableAmount += paidAmount;
        } else {
          payableAmount += paidAmount;
        }
      }
    });

    // Calculate net amount for bank impact
    const netAmount = receivableAmount - payableAmount;

    // Determine payment type based on net amount
    const paymentType = netAmount > 0 ? 'receipt' : 'payment';
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

    // Generate payment number
    const year = new Date().getFullYear();
    const countResult = await client.query(
      `SELECT COUNT(*) FROM hisab."payments" WHERE "companyId" = $1 AND EXTRACT(YEAR FROM "createdAt") = $2`,
      [companyId, year]
    );
    const paymentNumber = `PY-${year}-${(parseInt(countResult.rows[0].count) + 1).toString().padStart(4, '0')}`;

    // Calculate bank impact - FIXED LOGIC
    let bankImpact = 0;
    if (adjustmentType === 'discount') {
      // For discount: bank impact is reduced by discount amount
      bankImpact = paymentType === 'payment' ? -adjustedAmount : adjustedAmount;
    } else if (adjustmentType === 'extra_receipt' || adjustmentType === 'surcharge') {
      // For extra_receipt/surcharge: bank impact includes the extra amount
      bankImpact = paymentType === 'payment' ? -originalAmount : originalAmount;
    } else {
      // For no adjustment: bank impact is the net amount
      bankImpact = paymentType === 'payment' ? -absoluteNetAmount : absoluteNetAmount;
    }

    // Calculate contact balance impact
    const { currentBalance, currentBalanceType } = contactQuery.rows[0];
    const currentBalanceValue = parseFloat(currentBalance || 0);
    let newCurrentBalance = currentBalanceValue;
    let newCurrentBalanceType = currentBalanceType;

    if (currentBalanceAmount > 0) {
      // Find the current balance allocation to determine its type
      const currentBalanceAllocation = transactionAllocations.find(
        allocation => allocation.transactionId === 'current-balance'
      );
      const currentBalanceType_allocation = currentBalanceAllocation?.type ||
        (paymentType === 'receipt' ? 'receivable' : 'payable');

      // Simplified logic: allocation type determines what we're settling
      if (currentBalanceType_allocation === 'receivable') {
        // Settling receivable balance
        if (currentBalanceType === 'receivable') {
          // Reduce receivable balance
          newCurrentBalance = Math.max(0, currentBalanceValue - currentBalanceAmount);
        } else if (currentBalanceType === 'payable') {
          // Cross-settlement: reduce payable balance
          newCurrentBalance = Math.max(0, currentBalanceValue - currentBalanceAmount);
        }
      } else if (currentBalanceType_allocation === 'payable') {
        // Settling payable balance
        if (currentBalanceType === 'payable') {
          // Reduce payable balance
          newCurrentBalance = Math.max(0, currentBalanceValue - currentBalanceAmount);
        } else if (currentBalanceType === 'receivable') {
          // Cross-settlement: reduce receivable balance
          newCurrentBalance = Math.max(0, currentBalanceValue - currentBalanceAmount);
        }
      }

      // Handle balance type transitions when balance goes negative
      if (newCurrentBalance < 0) {
        newCurrentBalance = Math.abs(newCurrentBalance);
        newCurrentBalanceType = currentBalanceType === 'receivable' ? 'payable' : 'receivable';
      }

      // Set default balance type when balance is 0
      if (newCurrentBalance === 0) {
        newCurrentBalanceType = 'payable'; // or keep existing type, depends on your business logic
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

    // Update contact balance if there was a current balance impact
    if (currentBalanceAmount > 0) {
      await client.query(
        `UPDATE hisab."contacts" SET "currentBalance" = $1, "currentBalanceType" = $2 WHERE id = $3`,
        [newCurrentBalance, newCurrentBalanceType, contactId]
      );
    }

    // Update bank balance only if there's an actual impact
    if (bankImpact !== 0) {
      await client.query(
        `UPDATE hisab."bankAccounts" SET "currentBalance" = "currentBalance" + $1 WHERE id = $2`,
        [bankImpact, bankAccountId]
      );
    }

    // Update contact balance based on all transactions
    try {
      const { balance, balanceType } = await calculateContactCurrentBalance(client, contactId, companyId);
      await client.query(
        `UPDATE hisab."contacts" 
         SET "currentBalance" = $1, "currentBalanceType" = $2, "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = $3 AND "companyId" = $4`,
        [balance, balanceType, contactId, companyId]
      );
    } catch (error) {
      console.error('Error updating contact balance after payment:', error);
      // Don't throw error to avoid rolling back the payment transaction
    }

    // Create payment allocations
    for (const allocation of transactionAllocations) {
      const balanceType = allocation.type || 'payable';

      if (allocation.transactionId === 'current-balance') {
        await client.query(
          `INSERT INTO hisab."payment_allocations" (
            "paymentId", "purchaseId", "allocationType", "amount", "paidAmount", "balanceType", "createdAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [
            paymentId,
            null,
            'current-balance',
            parseFloat(allocation.amount || 0),
            parseFloat(allocation.paidAmount || 0),
            balanceType
          ]
        );
      } else {
        const purchaseQuery = await client.query(
          `SELECT "netPayable", "remaining_amount" FROM hisab."purchases" WHERE id = $1 AND "companyId" = $2 FOR UPDATE`,
          [allocation.transactionId, companyId]
        );

        if (purchaseQuery.rows.length) {
          const purchase = purchaseQuery.rows[0];
          const paidAmount = parseFloat(allocation.paidAmount || 0);
          const newRemainingAmount = parseFloat(purchase.remaining_amount || purchase.netPayable) - paidAmount;
          const isFullyPaid = newRemainingAmount <= 0;

          await client.query(
            `UPDATE hisab."purchases" SET "status" = $1, "remaining_amount" = GREATEST(0, $2) WHERE id = $3`,
            [isFullyPaid ? 'paid' : 'pending', newRemainingAmount, allocation.transactionId]
          );

          await client.query(
            `INSERT INTO hisab."payment_allocations" (
              "paymentId", "purchaseId", "allocationType", "amount", "paidAmount", "balanceType", "createdAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [
              paymentId,
              allocation.transactionId,
              'purchase',
              parseFloat(allocation.amount || 0),
              paidAmount,
              balanceType
            ]
          );
        }
      }
    }

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Payment created successfully",
      payment: paymentResult.rows[0],
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
        previousBalance: currentBalanceValue,
        previousBalanceType: currentBalanceType,
        newBalance: newCurrentBalance,
        newBalanceType: newCurrentBalanceType,
        balanceTypeChanged: newCurrentBalanceType !== currentBalanceType,
        contactBalanceChange: newCurrentBalance - currentBalanceValue,
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

    const existingPaymentQuery = await client.query(
      `SELECT * FROM hisab."payments" WHERE id = $1 AND "companyId" = $2 FOR UPDATE`,
      [id, companyId]
    );
    if (!existingPaymentQuery.rows.length) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Payment not found", 404);
    }
    const existingPayment = existingPaymentQuery.rows[0];

    const existingAllocationsQuery = await client.query(
      `SELECT * FROM hisab."payment_allocations" WHERE "paymentId" = $1 ORDER BY "createdAt" ASC`,
      [id]
    );
    const existingAllocations = existingAllocationsQuery.rows;

    const contactQuery = await client.query(
      `SELECT "currentBalance", "currentBalanceType" FROM hisab."contacts" WHERE id = $1 AND "companyId" = $2 FOR UPDATE`,
      [contactId, companyId]
    );
    if (!contactQuery.rows.length) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Contact not found", 404);
    }

    const bankQuery = await client.query(
      `SELECT "currentBalance" FROM hisab."bankAccounts" WHERE id = $1 AND "companyId" = $2 FOR UPDATE`,
      [bankAccountId, companyId]
    );
    if (!bankQuery.rows.length) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Bank account not found", 404);
    }

    // Calculate old values
    let oldReceivableAmount = 0;
    let oldPayableAmount = 0;
    let oldCurrentBalanceAmount = 0;

    existingAllocations.forEach(allocation => {
      const paidAmount = parseFloat(allocation.paidAmount || 0);
      const balanceType = allocation.balanceType || 'payable';

      if (allocation.allocationType === 'current-balance') {
        oldCurrentBalanceAmount += paidAmount;
        if (balanceType === 'receivable') {
          oldReceivableAmount += paidAmount;
        } else {
          oldPayableAmount += paidAmount;
        }
      } else {
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

    transactionAllocations.forEach(allocation => {
      const paidAmount = parseFloat(allocation.paidAmount || 0);
      const balanceType = allocation.type || 'payable';

      if (allocation.transactionId === 'current-balance') {
        newCurrentBalanceAmount += paidAmount;
        if (balanceType === 'receivable') {
          newReceivableAmount += paidAmount;
        } else {
          newPayableAmount += paidAmount;
        }
      } else {
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
    let newCurrentBalance = currentBalanceValue;
    let newCurrentBalanceType = currentBalanceType;

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
    }

    // Reverse old purchase allocations
    for (const allocation of existingAllocations) {
      if (allocation.allocationType === 'purchase' && allocation.purchaseId) {
        const purchaseQuery = await client.query(
          `SELECT "netPayable", "remaining_amount" FROM hisab."purchases" WHERE id = $1 AND "companyId" = $2 FOR UPDATE`,
          [allocation.purchaseId, companyId]
        );

        if (purchaseQuery.rows.length) {
          const purchase = purchaseQuery.rows[0];
          const paidAmount = parseFloat(allocation.paidAmount || 0);
          const newRemainingAmount = parseFloat(purchase.remaining_amount || 0) + paidAmount;
          const isPending = newRemainingAmount > 0;

          await client.query(
            `UPDATE hisab."purchases" SET "status" = $1, "remaining_amount" = $2 WHERE id = $3`,
            [isPending ? 'pending' : 'paid', newRemainingAmount, allocation.purchaseId]
          );
        }
      }
    }

    // Delete old allocations
    await client.query(`DELETE FROM hisab."payment_allocations" WHERE "paymentId" = $1`, [id]);

    // Apply new contact balance impact
    if (newCurrentBalanceAmount > 0) {
      const newCurrentBalanceAllocation = transactionAllocations.find(
        allocation => allocation.transactionId === 'current-balance'
      );
      const newCurrentBalanceType_allocation = newCurrentBalanceAllocation?.type ||
        (newPaymentType === 'receipt' ? 'receivable' : 'payable');

      if (newCurrentBalanceType_allocation === 'receivable') {
        if (newCurrentBalanceType === 'receivable') {
          newCurrentBalance = Math.max(0, newCurrentBalance - newCurrentBalanceAmount);
        } else if (newCurrentBalanceType === 'payable') {
          newCurrentBalance = Math.max(0, newCurrentBalance - newCurrentBalanceAmount);
        }
      } else if (newCurrentBalanceType_allocation === 'payable') {
        if (newCurrentBalanceType === 'payable') {
          newCurrentBalance = Math.max(0, newCurrentBalance - newCurrentBalanceAmount);
        } else if (newCurrentBalanceType === 'receivable') {
          newCurrentBalance = Math.max(0, newCurrentBalance - newCurrentBalanceAmount);
        }
      }

      if (newCurrentBalance < 0) {
        newCurrentBalance = Math.abs(newCurrentBalance);
        newCurrentBalanceType = newCurrentBalanceType === 'receivable' ? 'payable' : 'receivable';
      }

      if (newCurrentBalance === 0) {
        newCurrentBalanceType = 'payable';
      }
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

    // Update contact balance
    await client.query(
      `UPDATE hisab."contacts" SET "currentBalance" = $1, "currentBalanceType" = $2 WHERE id = $3`,
      [newCurrentBalance, newCurrentBalanceType, contactId]
    );

    // Create new allocations
    for (const allocation of transactionAllocations) {
      const balanceType = allocation.type || 'payable';

      if (allocation.transactionId === 'current-balance') {
        await client.query(
          `INSERT INTO hisab."payment_allocations" (
            "paymentId", "purchaseId", "allocationType", "amount", "paidAmount", "balanceType", "createdAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [
            id,
            null,
            'current-balance',
            parseFloat(allocation.amount || 0),
            parseFloat(allocation.paidAmount || 0),
            balanceType
          ]
        );
      } else {
        const purchaseQuery = await client.query(
          `SELECT "netPayable", "remaining_amount" FROM hisab."purchases" WHERE id = $1 AND "companyId" = $2 FOR UPDATE`,
          [allocation.transactionId, companyId]
        );

        if (purchaseQuery.rows.length) {
          const purchase = purchaseQuery.rows[0];
          const paidAmount = parseFloat(allocation.paidAmount || 0);
          const currentRemaining = parseFloat(purchase.remaining_amount || purchase.netPayable);
          const newRemainingAmount = currentRemaining - paidAmount;
          const isFullyPaid = newRemainingAmount <= 0;

          await client.query(
            `UPDATE hisab."purchases" SET "status" = $1, "remaining_amount" = GREATEST(0, $2) WHERE id = $3`,
            [isFullyPaid ? 'paid' : 'pending', newRemainingAmount, allocation.transactionId]
          );

          await client.query(
            `INSERT INTO hisab."payment_allocations" (
              "paymentId", "purchaseId", "allocationType", "amount", "paidAmount", "balanceType", "createdAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [
              id,
              allocation.transactionId,
              'purchase',
              parseFloat(allocation.amount || 0),
              paidAmount,
              balanceType
            ]
          );
        }
      }
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

    return successResponse(res, {
      message: "Payment updated successfully",
      payment: updatedPaymentResult.rows[0],
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
        previousBalance: currentBalanceValue,
        previousBalanceType: currentBalanceType,
        newBalance: newCurrentBalance,
        newBalanceType: newCurrentBalanceType,
        balanceTypeChanged: newCurrentBalanceType !== currentBalanceType,
        contactBalanceChange: newCurrentBalance - currentBalanceValue,
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
        discounts: payment.discounts || [],
        notes: payment.notes,
        createdAt: payment.createdAt,
        createdBy: payment.createdByName
      },
      accountingImpact: {
        contactBalanceChange: isPayment ? -payment.amount : payment.amount,
        currentContactBalance: payment.contactOpeningBalance,
        currentContactBalanceType: payment.contactBalanceType,
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

    const allocationsQuery = await client.query(
      `SELECT * FROM hisab."payment_allocations" 
       WHERE "paymentId" = $1 ORDER BY "createdAt" ASC`,
      [id]
    );
    const allocations = allocationsQuery.rows;

    let receivableAmount = 0;
    let payableAmount = 0;
    let currentBalanceAmount = 0;
    let purchaseAmount = 0;

    allocations.forEach(allocation => {
      const paidAmount = parseFloat(allocation.paidAmount || 0);
      const balanceType = allocation.balanceType || 'payable';

      if (allocation.allocationType === 'current-balance') {
        currentBalanceAmount += paidAmount;
        if (balanceType === 'receivable') {
          receivableAmount += paidAmount;
        } else {
          payableAmount += paidAmount;
        }
      } else {
        purchaseAmount += paidAmount;
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

    for (const allocation of allocations) {
      if (allocation.allocationType === 'purchase' && allocation.purchaseId) {
        const purchaseQuery = await client.query(
          `SELECT "netPayable", "remaining_amount" FROM hisab."purchases" 
           WHERE id = $1 AND "companyId" = $2 FOR UPDATE`,
          [allocation.purchaseId, companyId]
        );

        if (purchaseQuery.rows.length) {
          const purchase = purchaseQuery.rows[0];
          const paidAmount = parseFloat(allocation.paidAmount || 0);
          const currentRemainingAmount = parseFloat(purchase.remaining_amount || 0);
          const newRemainingAmount = currentRemainingAmount + paidAmount;
          const isPending = newRemainingAmount > 0;

          await client.query(
            `UPDATE hisab."purchases" 
             SET "status" = $1, "remaining_amount" = $2
             WHERE id = $3`,
            [isPending ? 'pending' : 'paid', newRemainingAmount, allocation.purchaseId]
          );
        }
      }
    }

    await client.query(
      `DELETE FROM hisab."payment_allocations" WHERE "paymentId" = $1`,
      [id]
    );

    let newCurrentBalance = currentBalanceValue;
    let newCurrentBalanceType = currentBalanceType;

    if (currentBalanceAmount > 0) {
      const currentBalanceAllocation = allocations.find(
        allocation => allocation.allocationType === 'current-balance'
      );
      const currentBalanceType_allocation = currentBalanceAllocation?.balanceType || 'payable';

      if (currentBalanceType_allocation === 'receivable') {
        if (currentBalanceType === 'receivable') {
          newCurrentBalance = newCurrentBalance + currentBalanceAmount;
        } else if (currentBalanceType === 'payable') {
          newCurrentBalance = newCurrentBalance - currentBalanceAmount;
        }
      } else if (currentBalanceType_allocation === 'payable') {
        if (currentBalanceType === 'payable') {
          newCurrentBalance = newCurrentBalance + currentBalanceAmount;
        } else if (currentBalanceType === 'receivable') {
          newCurrentBalance = newCurrentBalance - currentBalanceAmount;
        }
      }

      if (newCurrentBalance < 0) {
        newCurrentBalance = Math.abs(newCurrentBalance);
        newCurrentBalanceType = currentBalanceType === 'payable' ? 'receivable' : 'payable';
      }

      if (newCurrentBalance === 0) {
        newCurrentBalanceType = 'payable';
      }

      await client.query(
        `UPDATE hisab."contacts" 
         SET "currentBalance" = $1, "currentBalanceType" = $2
         WHERE id = $3`,
        [newCurrentBalance, newCurrentBalanceType, payment.contactId]
      );
    }

    if (payment.bankId) {
      const bankQuery = await client.query(
        `SELECT "currentBalance" FROM hisab."bankAccounts" 
         WHERE id = $1 AND "companyId" = $2 FOR UPDATE`,
        [payment.bankId, companyId]
      );

      if (bankQuery.rows.length) {
        const bankBalanceChange = payment.paymentType === 'payment' ? adjustedAmount : -adjustedAmount;

        await client.query(
          `UPDATE hisab."bankAccounts" 
           SET "currentBalance" = "currentBalance" + $1
           WHERE id = $2`,
          [bankBalanceChange, payment.bankId]
        );
      }
    }

    const deleteResult = await client.query(
      `UPDATE hisab."payments" 
       SET "deletedAt" = NOW(), "deletedBy" = $1
       WHERE id = $2 AND "companyId" = $3 
       RETURNING *`,
      [currentUserId, id, companyId]
    );

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Payment deleted successfully",
      payment: deleteResult.rows[0],
      accountingImpact: {
        previousBalance: currentBalanceValue,
        previousBalanceType: currentBalanceType,
        newBalance: newCurrentBalance,
        newBalanceType: newCurrentBalanceType,
        balanceTypeChanged: newCurrentBalanceType !== currentBalanceType,
        currentBalanceAmount,
        purchaseAmount,
        contactBalanceChange: newCurrentBalance - currentBalanceValue,
        adjustmentReversed: payment.adjustmentType ? {
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

    // 3. Format transactions - include current balance as first transaction if pending amount > 0
    const transactions = [];

    // Add current balance only if it has pending amount
    if (Math.abs(currentBalance) > 0) {
      transactions.push({
        id: 'current-balance',
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
          description: `Purchase#${purchase.invoiceNumber}`,
          amount: parseFloat(purchase.amount),
          paidAmount: parseFloat(purchase.paidAmount) || 0,
          balanceType: 'payable',
          date: purchase.invoiceDate,
          pendingAmount: pendingAmount
        });
      }
    });

    // 4. Calculate total pending amount (including current balance)
    const totalPending = transactions.reduce(
      (sum, transaction) => sum + parseFloat(transaction.pendingAmount),
      0
    );

    return successResponse(res, {
      contact: {
        id: contactId,
        name: contact.name,
        currentBalance,
        balanceType: contact.currentBalanceType,
      },
      transactions,
      summary: {
        totalPending,
        payableStatus: contact.currentBalanceType, // "payable" or "receivable"
        suggestedPayment: isPayable ? Math.min(Math.abs(currentBalance), totalPending) : 0
      }
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

    // Get count for pagination (unchanged)
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

      // Rest of your allocation logic remains the same...
      if (payments.length > 0) {
        const paymentIdsWithAllocations = payments
          .filter(p => p.allocationCount > 0)
          .map(p => p.id);

        if (paymentIdsWithAllocations.length > 0) {
          const allocationsQuery = `
            SELECT 
              pa.id,
              pa."paymentId",
              pa."purchaseId",
              pa."allocationType",
              pa."balanceType",
              pa.amount,
              pa."paidAmount",
              pur."invoiceNumber" as "purchaseInvoiceNumber",
              pur."remaining_amount" as "pendingAmount",
              pur."status" as "purchaseStatus"
            FROM hisab."payment_allocations" pa
            LEFT JOIN hisab."purchases" pur ON pa."purchaseId" = pur."id"
            WHERE pa."paymentId" = ANY($1)
            ORDER BY pa."paymentId", pa."createdAt" ASC
          `;

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

            if (allocation.allocationType === 'current-balance' && contactBalances[allocation.paymentId]) {
              allocation.pendingAmount = contactBalances[allocation.paymentId].pendingAmount;
              allocation.balanceType = contactBalances[allocation.paymentId].balanceType;
            }

            allocationsByPayment[allocation.paymentId].push(allocation);
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