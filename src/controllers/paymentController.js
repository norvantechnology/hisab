import pool from "../config/dbConnection.js";
import { errorResponse, successResponse } from "../utils/index.js";

export async function createPayment(req, res) {
  const { contactId, bankId, date, paymentType, transactions, discounts, notes } = req.body;
  const { companyId, id: currentUserId } = req.currentUser || {};

  // Validate required fields
  if (!companyId || !currentUserId) return errorResponse(res, "Unauthorized access", 401);
  if (!contactId || !date || !paymentType || !transactions?.length) {
    return errorResponse(res, "Required fields are missing", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Get and lock contact record
    const contactQuery = await client.query(
      `SELECT "balanceType", "openingBalance" FROM hisab."contacts" 
       WHERE id = $1 AND "companyId" = $2 FOR UPDATE`,
      [contactId, companyId]
    );
    if (!contactQuery.rows.length) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Contact not found", 404);
    }

    const { balanceType, openingBalance } = contactQuery.rows[0];
    const currentBalance = parseFloat(openingBalance);

    // 2. Calculate amounts
    const totalPaidAmount = transactions.reduce((sum, { paidAmount = 0 }) => sum + parseFloat(paidAmount), 0);
    const totalDiscount = (discounts || []).reduce(
      (sum, { amount = 0, isDiscount = true }) => sum + (isDiscount ? amount : -amount), 0
    );
    const netAmount = totalPaidAmount + totalDiscount;

    // 3. Generate payment number
    const year = new Date().getFullYear();
    const countResult = await client.query(
      `SELECT COUNT(*) FROM hisab."payments" 
       WHERE "companyId" = $1 AND EXTRACT(YEAR FROM "createdAt") = $2`,
      [companyId, year]
    );
    const paymentNumber = `PY-${year}-${(parseInt(countResult.rows[0].count) + 1).toString().padStart(4, '0')}`;

    // 4. Create payment record
    const paymentResult = await client.query(
      `INSERT INTO hisab."payments" (
        "paymentNumber", "companyId", "contactId", "bankId", "date", 
        "amount", "paymentType", "transactions", "discounts", "notes", "createdBy"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        paymentNumber, companyId, contactId, bankId, date,
        netAmount, paymentType,
        JSON.stringify(transactions),
        discounts?.length ? JSON.stringify(discounts) : null,
        notes, currentUserId
      ]
    );

    // 5. Calculate new balance and type
    const isPayment = paymentType === 'payment';
    const balanceChange = isPayment ? -netAmount : netAmount;
    let newBalance = currentBalance + balanceChange;
    let newBalanceType = balanceType;

    if (newBalance < 0) {
      newBalance = Math.abs(newBalance);
      newBalanceType = isPayment ? 'receivable' : 'payable';
    }

    // 6. Update contact balance
    await client.query(
      `UPDATE hisab."contacts" 
       SET "openingBalance" = $1, "balanceType" = $2
       WHERE id = $3`,
      [newBalance, newBalanceType, contactId]
    );

    // 7. Update bank balance if applicable
    if (bankId) {
      const bankChange = isPayment ? -totalPaidAmount : totalPaidAmount;
      await client.query(
        `UPDATE hisab."bankAccounts" 
         SET "currentBalance" = "currentBalance" + $1
         WHERE id = $2`,
        [bankChange, bankId]
      );
    }

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Payment created successfully",
      payment: paymentResult.rows[0],
      accountingImpact: {
        previousBalance: currentBalance,
        previousBalanceType: balanceType,
        newBalance,
        newBalanceType,
        balanceTypeChanged: newBalanceType !== balanceType,
        contactBalanceChange: balanceChange,
        ...(bankId && { bankBalanceChange: isPayment ? -totalPaidAmount : totalPaidAmount })
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
        transactions: payment.transactions || [],
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

export async function updatePayment(req, res) {
  const { id, contactId, bankId, date, paymentType, transactions, discounts, notes } = req.body;
  const { companyId, id: currentUserId } = req.currentUser || {};

  if (!companyId || !currentUserId) return errorResponse(res, "Unauthorized access", 401);
  if (!transactions?.length) return errorResponse(res, "Transactions are required", 400);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Get and lock existing payment with contact
    const paymentQuery = await client.query(
      `SELECT p.*, c."balanceType", c."openingBalance" 
       FROM hisab."payments" p
       JOIN hisab."contacts" c ON p."contactId" = c."id"
       WHERE p."id" = $1 AND p."companyId" = $2 AND p."deletedAt" IS NULL FOR UPDATE`,
      [id, companyId]
    );

    if (!paymentQuery.rows.length) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Payment not found", 404);
    }

    const oldPayment = paymentQuery.rows[0];
    const oldContactId = oldPayment.contactId;
    const oldBankId = oldPayment.bankId;
    const oldPaymentType = oldPayment.paymentType;
    const oldAmount = parseFloat(oldPayment.amount);
    const { balanceType: oldBalanceType, openingBalance: oldOpeningBalance } = paymentQuery.rows[0];

    // 2. Calculate new payment amounts
    const totalPaidAmount = transactions.reduce((sum, { paidAmount = 0 }) => sum + parseFloat(paidAmount), 0);
    const totalDiscount = (discounts || []).reduce(
      (sum, { amount = 0, isDiscount = true }) => sum + (isDiscount ? amount : -amount), 0
    );
    const netAmount = totalPaidAmount + totalDiscount;

    // 3. Revert old balances first
    const oldIsPayment = oldPaymentType === 'payment';
    const oldBalanceChange = oldIsPayment ? -oldAmount : oldAmount;

    // Revert contact balance
    await client.query(
      `UPDATE hisab."contacts" 
       SET "openingBalance" = "openingBalance" + $1
       WHERE id = $2`,
      [-oldBalanceChange, oldContactId]
    );

    // Revert bank balance if applicable
    if (oldBankId) {
      const oldBankChange = oldIsPayment ? oldAmount : -oldAmount;
      await client.query(
        `UPDATE hisab."bankAccounts" 
         SET "currentBalance" = "currentBalance" + $1
         WHERE id = $2`,
        [oldBankChange, oldBankId]
      );
    }

    // 4. Apply new balances
    const newPaymentType = paymentType || oldPaymentType;
    const newContactId = contactId || oldContactId;
    const newBankId = bankId !== undefined ? bankId : oldBankId;
    const newIsPayment = newPaymentType === 'payment';
    const newBalanceChange = newIsPayment ? -netAmount : netAmount;

    // Update contact balance
    await client.query(
      `UPDATE hisab."contacts" 
       SET "openingBalance" = "openingBalance" + $1
       WHERE id = $2`,
      [newBalanceChange, newContactId]
    );

    // Update bank balance if applicable
    if (newBankId) {
      const bankChange = newIsPayment ? -netAmount : netAmount;
      await client.query(
        `UPDATE hisab."bankAccounts" 
         SET "currentBalance" = "currentBalance" + $1
         WHERE id = $2`,
        [bankChange, newBankId]
      );
    }

    // 5. Update payment record
    const updateResult = await client.query(
      `UPDATE hisab."payments" SET
        "contactId" = $1,
        "bankId" = $2,
        "date" = $3,
        "paymentType" = $4,
        "amount" = $5,
        "transactions" = $6,
        "discounts" = $7,
        "notes" = $8,
        "updatedAt" = NOW()
       WHERE id = $10 RETURNING *`,
      [
        newContactId,
        newBankId,
        date || oldPayment.date,
        newPaymentType,
        netAmount,
        JSON.stringify(transactions),
        discounts?.length ? JSON.stringify(discounts) : null,
        notes || oldPayment.notes,
        id
      ]
    );

    await client.query("COMMIT");

    // Get updated contact balance for response
    const contactResult = await client.query(
      `SELECT "openingBalance", "balanceType" FROM hisab."contacts" WHERE id = $1`,
      [newContactId]
    );

    return successResponse(res, {
      message: "Payment updated successfully",
      payment: updateResult.rows[0],
      accountingImpact: {
        contactBalanceChange: newBalanceChange,
        currentContactBalance: contactResult.rows[0].openingBalance,
        currentContactBalanceType: contactResult.rows[0].balanceType,
        ...(newBankId && { bankBalanceChange: bankChange })
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

export async function deletePayment(req, res) {
  const { id } = req.query;
  const { companyId, id: currentUserId } = req.currentUser || {};

  if (!companyId || !currentUserId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Get and lock payment with contact
    const paymentQuery = await client.query(
      `SELECT p.*, c."balanceType", c."openingBalance" 
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
    const isPayment = payment.paymentType === 'payment';
    const { balanceType, openingBalance } = payment;
 const currentBalance = parseFloat(openingBalance);
    const paymentAmount = parseFloat(payment.amount);
    

    // Calculate the balance change (reverse of original transaction)
    // If it was a payment (we gave money to contact), we need to add back to our payable
    // If it was a receipt (we received money from contact), we need to subtract from our receivable
    const balanceChange = isPayment ? -paymentAmount : paymentAmount;
    console.log("balanceChange", balanceChange)
    console.log("currentBalance", currentBalance)


    let newBalance = currentBalance + balanceChange;
    let newBalanceType = balanceType;
    console.log("newBalance", newBalance)
    // Check if balance crossed zero and needs type change
    if (newBalance < 0) {
      newBalance = Math.abs(newBalance);
      newBalanceType = balanceType === 'payable' ? 'receivable' : 'payable';
    }

    // Update contact balance with possible type change
    await client.query(
      `UPDATE hisab."contacts" 
       SET "openingBalance" = $1, "balanceType" = $2
       WHERE id = $3`,
      [newBalance, newBalanceType, payment.contactId]
    );

    // Revert bank balance if payment was linked to bank
    if (payment.bankId) {
      // Reverse the original bank transaction:
      // If it was a payment (money went out), we need to add back to bank
      // If it was a receipt (money came in), we need to subtract from bank
      var bankBalanceChange = isPayment ? payment.amount : -payment.amount;
      await client.query(
        `UPDATE hisab."bankAccounts" 
         SET "currentBalance" = "currentBalance" + $1
         WHERE id = $2`,
        [bankBalanceChange, payment.bankId]
      );
    }

    // Soft delete payment
    const deleteResult = await client.query(
      `UPDATE hisab."payments" 
       SET "deletedAt" = NOW()
       WHERE id = $1 AND "companyId" = $2 
       RETURNING *`,
      [id, companyId]
    );

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Payment deleted successfully",
      payment: deleteResult.rows[0],
      accountingImpact: {
        previousBalance: currentBalance,
        previousBalanceType: balanceType,
        newBalance,
        newBalanceType,
        balanceTypeChanged: newBalanceType !== balanceType,
        contactBalanceChange: balanceChange,
        ...(payment.bankId && { bankBalanceChange })
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

export async function getContactPayments(req, res) {
  const { companyId } = req.currentUser || {};
  const { page = 1, limit = 10, startDate, endDate, contactId } = req.query;

  if (!companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    // Get contact details with balance
    const contactQuery = await client.query(
      `SELECT "balanceType", "openingBalance" FROM hisab."contacts" 
       WHERE id = $1 AND "companyId" = $2`,
      [contactId, companyId]
    );

    if (!contactQuery.rows.length) {
      return errorResponse(res, "Contact not found", 404);
    }

    const { balanceType, openingBalance } = contactQuery.rows[0];
    let runningBalance = parseFloat(openingBalance);

    // Build query with filters
    let query = `
      SELECT 
        p.id, p."paymentNumber", p."contactId", p."bankId", p.date, 
        p.amount, p."paymentType", p.transactions, p.discounts, p.notes,
        p."createdAt", b."accountName" as "bankName",
        u."name" as "createdByName"
      FROM hisab."payments" p
      LEFT JOIN hisab."bankAccounts" b ON p."bankId" = b."id"
      LEFT JOIN hisab."users" u ON p."createdBy" = u."id"
      WHERE p."contactId" = $1 AND p."companyId" = $2
      AND p."deletedAt" IS NULL
    `;

    const params = [contactId, companyId];
    let paramIndex = 3;

    if (startDate && endDate) {
      query += ` AND p."date" BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      params.push(startDate, endDate);
      paramIndex += 2;
    }

    // Get total count
    const countQuery = query.replace(/SELECT p\..*FROM/, 'SELECT COUNT(*) FROM');
    const countResult = await client.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    // Add pagination
    query += `
      ORDER BY p."date" DESC, p."createdAt" DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, (page - 1) * limit);

    const paymentsResult = await client.query(query, params);

    // Process payments with running balance
    const payments = paymentsResult.rows.map(payment => {
      const isPayment = payment.paymentType === 'payment';
      const amount = parseFloat(payment.amount);
      const balanceChange = isPayment ? -amount : amount;

      runningBalance += balanceChange;

      return {
        id: payment.id,
        paymentNumber: payment.paymentNumber,
        contactId: payment.contactId,
        bankId: payment.bankId,
        bankName: payment.bankName,
        date: payment.date,
        amount: payment.amount,
        paymentType: payment.paymentType,
        transactions: payment.transactions || [],
        discounts: payment.discounts || [],
        notes: payment.notes,
        createdAt: payment.createdAt,
        createdBy: payment.createdByName,
        balanceChange,
        runningBalance
      };
    });

    return successResponse(res, {
      payments,
      contactBalanceType: balanceType,
      initialBalance: openingBalance,
      finalBalance: runningBalance,
      pagination: {
        total,
        totalPages,
        currentPage: parseInt(page),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error("Get contact payments error:", error);
    return errorResponse(res, "Failed to get contact payments", 500);
  } finally {
    client.release();
  }
}