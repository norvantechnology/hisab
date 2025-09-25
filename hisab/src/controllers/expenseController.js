import pool from "../config/dbConnection.js";
import { errorResponse, successResponse } from "../utils/index.js";
import { 
  handlePaymentAllocationsOnTransactionDelete, 
  checkPaymentAllocationConflict,
  updatePaymentAllocations,
  calculateAmountsAfterAdjustment 
} from "../utils/paymentAllocationUtils.js";

export async function createExpenseCategory(req, res) {
  const { name } = req.body;
  const companyId = req.currentUser?.companyId;
  const currentUserId = req.currentUser?.id;

  if (!currentUserId || !companyId) {
    return errorResponse(res, "Unauthorized access - user or company not identified", 401);
  }

  if (!name) {
    return errorResponse(res, "Category name is required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Get company owner's userId from companies table
    const companyQuery = `
      SELECT "userId" FROM hisab."companies" 
      WHERE id = $1
    `;
    const companyResult = await client.query(companyQuery, [companyId]);

    if (companyResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Company not found", 404);
    }

    const ownerUserId = companyResult.rows[0].userId;

    // Check if category with same name already exists for this company
    const existingCategoryQuery = `
      SELECT id FROM hisab."expenseCategories" 
      WHERE "userId" = $1 AND "name" = $2 
      LIMIT 1
    `;
    const existingCategory = await client.query(existingCategoryQuery, [ownerUserId, name]);

    if (existingCategory.rows.length > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Category with this name already exists for this company", 409);
    }

    const insertQuery = `
      INSERT INTO hisab."expenseCategories"
      ("userId", "name", "createdAt", "updatedAt")
      VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const newCategory = await client.query(insertQuery, [ownerUserId, name]);

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Expense category created successfully",
      category: newCategory.rows[0],
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error creating expense category", 500);
  } finally {
    client.release();
  }
}

export async function getExpenseCategories(req, res) {
  const companyId = req.currentUser?.companyId;
  const currentUserId = req.currentUser?.id;

  if (!currentUserId || !companyId) {
    return errorResponse(res, "Unauthorized access - user or company not identified", 401);
  }

  const client = await pool.connect();

  try {
    // Get company owner's userId from companies table
    const companyQuery = `
      SELECT "userId" FROM hisab."companies" 
      WHERE id = $1
    `;
    const companyResult = await client.query(companyQuery, [companyId]);

    if (companyResult.rows.length === 0) {
      return errorResponse(res, "Company not found", 404);
    }

    const ownerUserId = companyResult.rows[0].userId;

    const query = `
      SELECT id, "name", "isActive", "createdAt", "updatedAt"
      FROM hisab."expenseCategories"
      WHERE "userId" = $1 AND "isActive" = $2
      ORDER BY "name" ASC
    `;

    const result = await client.query(query, [ownerUserId, true]);

    return successResponse(res, {
      categories: result.rows,
    });

  } catch (error) {
    console.error(error);
    return errorResponse(res, "Error fetching expense categories", 500);
  } finally {
    client.release();
  }
}

export async function deleteExpenseCategory(req, res) {
  const { id } = req.query;
  const companyId = req.currentUser?.companyId;
  const currentUserId = req.currentUser?.id;

  if (!currentUserId || !companyId) {
    return errorResponse(res, "Unauthorized access - user or company not identified", 401);
  }

  if (!id) {
    return errorResponse(res, "Category ID is required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Get company owner's userId from companies table
    const companyQuery = `
      SELECT "userId" FROM hisab."companies" 
      WHERE id = $1
    `;
    const companyResult = await client.query(companyQuery, [companyId]);

    if (companyResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Company not found", 404);
    }

    const ownerUserId = companyResult.rows[0].userId;

    // Verify current user has access to this company and the category belongs to the company owner
    const verifyQuery = `
      SELECT ec.id 
      FROM hisab."expenseCategories" ec
      JOIN hisab."companies" c ON c."userId" = ec."userId"
      WHERE ec.id = $1 
        AND ec."userId" = $2
        AND c.id = $3
      LIMIT 1
    `;
    const verifyResult = await client.query(verifyQuery, [id, ownerUserId, companyId]);

    if (verifyResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Category not found or unauthorized", 404);
    }

    // Soft delete by setting isActive to false
    const deleteQuery = `
      UPDATE hisab."expenseCategories"
      SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const deletedCategory = await client.query(deleteQuery, [id]);

    await client.query("COMMIT");

    if (deletedCategory.rows.length === 0) {
      return errorResponse(res, "Failed to delete category", 500);
    }

    return successResponse(res, {
      message: "Expense category deleted successfully",
      category: deletedCategory.rows[0],
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error deleting expense category", 500);
  } finally {
    client.release();
  }
}

export async function createExpense(req, res) {
  const {
    date,
    categoryId,
    bankAccountId,
    contactId,
    amount,
    notes,
    dueDate
  } = req.body;

  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access - user or company not identified", 401);
  }

  // Validate required fields
  if (!date || !categoryId || !amount) {
    return errorResponse(res, "Date, category, and amount are required", 400);
  }

  // Validate payment method
  if (!bankAccountId && !contactId) {
    return errorResponse(res, "Either bank account or contact must be specified", 400);
  }

  // Determine status based on payment method
  let status = 'paid';
  let remainingAmount = 0;
  let paidAmount = parseFloat(amount);

  // For contact payments without bank account, set as pending
  if (contactId && !bankAccountId) {
    status = 'pending';
    remainingAmount = parseFloat(amount);
    paidAmount = 0;
  }

  // For direct bank payments, always set as paid
  if (bankAccountId && !contactId) {
    status = 'paid';
    remainingAmount = 0;
    paidAmount = parseFloat(amount);
  }

  // For contact payments with bank account (paid through contact)
  if (contactId && bankAccountId) {
    status = 'paid';
    remainingAmount = 0;
    paidAmount = parseFloat(amount);
  }

  // Validate contact-specific fields
  if (contactId && status === 'pending' && !dueDate) {
    return errorResponse(res, "Due date is required when contact status is pending", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verify company belongs to user
    const companyCheck = await client.query(
      `SELECT id FROM hisab."companies" WHERE id = $1`,
      [companyId]
    );

    if (companyCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Company not found or unauthorized", 404);
    }

    // Verify category exists
    const categoryCheck = await client.query(
      `SELECT id FROM hisab."expenseCategories" WHERE id = $1`,
      [categoryId]
    );

    if (categoryCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Category not found or unauthorized", 404);
    }

    // Verify bank account if provided
    if (bankAccountId) {
      const bankAccountCheck = await client.query(
        `SELECT id FROM hisab."bankAccounts" 
         WHERE id = $1 AND "companyId" = $2 AND "isActive" = TRUE AND "deletedAt" IS NULL`,
        [bankAccountId, companyId]
      );

      if (bankAccountCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, "Bank account not found, inactive, or unauthorized", 404);
      }
    }

    // Verify contact if provided
    if (contactId) {
      const contactCheck = await client.query(
        `SELECT id FROM hisab."contacts" 
         WHERE id = $1 AND "companyId" = $2 AND "deletedAt" IS NULL`,
        [contactId, companyId]
      );

      if (contactCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, "Contact not found or unauthorized", 404);
      }
    }

    const insertQuery = `
      INSERT INTO hisab."expenses"
      (
        "userId", "companyId", "date", "categoryId", 
        "bankAccountId", "contactId", "amount", "notes", 
        "status", "dueDate", "remaining_amount", "paid_amount", "createdBy",
        "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const result = await client.query(insertQuery, [
      userId,
      companyId,
      date,
      categoryId,
      bankAccountId || null,
      contactId || null,
      amount,
      notes,
      status,
      dueDate || null,
      remainingAmount,
      paidAmount,
      userId  // createdBy
    ]);

    // Update bank account balance if bankAccountId is provided
    // This covers both direct bank payments and contact payments that are paid
    if (bankAccountId) {
      await client.query(
        `UPDATE hisab."bankAccounts" 
         SET "currentBalance" = "currentBalance" - $1,
             "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [amount, bankAccountId]
      );
    }

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Expense created successfully",
      expense: result.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error creating expense", 500);
  } finally {
    client.release();
  }
}

export async function deleteExpense(req, res) {
  const { id } = req.query;
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access - user or company not identified", 401);
  }

  if (!id) {
    return errorResponse(res, "Expense ID is required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // First verify the expense belongs to the user and get details
    const verifyQuery = `
      SELECT "bankAccountId", "contactId", "amount", "status" FROM hisab."expenses"
      WHERE "id" = $1 AND "userId" = $2 AND "companyId" = $3
      LIMIT 1
    `;
    const verifyResult = await client.query(verifyQuery, [id, userId, companyId]);

    if (verifyResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Expense not found or unauthorized", 404);
    }

    const { bankAccountId, contactId, amount, status } = verifyResult.rows[0];

    // Handle payment allocations if they exist, otherwise handle direct bank adjustment
    // First check if there are any payment allocations
    const checkAllocationsQuery = await client.query(
      `SELECT COUNT(*) as count FROM hisab."payment_allocations" pa
       JOIN hisab."payments" p ON pa."paymentId" = p.id
       WHERE pa."expenseId" = $1 AND p."companyId" = $2 AND p."deletedAt" IS NULL`,
      [id, companyId]
    );
    
    const hasPaymentAllocations = parseInt(checkAllocationsQuery.rows[0].count) > 0;
    
    if (hasPaymentAllocations) {
      // Expense has payment allocations - use centralized function
      await handlePaymentAllocationsOnTransactionDelete(client, 'expense', id, companyId, userId);
    } else {
      // Direct bank expense (no payment allocations) - manually reverse bank balance
      
      if (bankAccountId && status === 'paid') {
        // First, fetch current bank balance
        const currentBankBalanceResult = await client.query(
          `SELECT id, "currentBalance", "accountName" FROM hisab."bankAccounts"
           WHERE "id" = $1 AND "companyId" = $2`,
          [bankAccountId, companyId]
        );
        
        if (currentBankBalanceResult.rows.length === 0) {
          await client.query("ROLLBACK");
          return errorResponse(res, "Bank account not found", 404);
        }
        
        const currentBankBalance = parseFloat(currentBankBalanceResult.rows[0].currentBalance);
        const adjustmentAmount = parseFloat(amount);
        const newBankBalance = currentBankBalance + adjustmentAmount; // Add for expense deletion
        

        
        // Then, update bank balance
        const bankUpdateResult = await client.query(
          `UPDATE hisab."bankAccounts"
           SET "currentBalance" = $1,
               "updatedAt" = CURRENT_TIMESTAMP
           WHERE "id" = $2 AND "companyId" = $3
           RETURNING id, "currentBalance", "accountName"`,
          [newBankBalance, bankAccountId, companyId]
        );
        

      }
    }

    const deleteQuery = `
      DELETE FROM hisab."expenses"
      WHERE "id" = $1
      RETURNING *
    `;
    const deletedExpense = await client.query(deleteQuery, [id]);



    await client.query("COMMIT");

    if (deletedExpense.rows.length === 0) {
      return errorResponse(res, "Failed to delete expense", 500);
    }

    return successResponse(res, {
      message: "Expense deleted successfully",
      expense: deletedExpense.rows[0],
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error deleting expense", 500);
  } finally {
    client.release();
  }
}

export async function updateExpense(req, res) {
  const {
    date,
    categoryId,
    amount,
    notes,
    dueDate,
    id,
    bankAccountId,
    contactId,
    status,
    paymentAdjustmentChoice // New parameter to handle payment adjustments
  } = req.body;

  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  // Clean up empty string values to null for database compatibility
  const cleanBankAccountId = bankAccountId === '' ? null : bankAccountId;
  const cleanContactId = contactId === '' ? null : contactId;
  const cleanCategoryId = categoryId === '' ? null : categoryId;

  // Validate status if provided - reject 'partial' status completely
  if (status && !['paid', 'pending'].includes(status)) {
    return errorResponse(res, `Invalid status '${status}'. Only 'paid' and 'pending' are allowed.`, 400);
  }

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access - user or company not identified", 401);
  }

  if (!id) {
    return errorResponse(res, "Expense ID is required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // First get the existing expense details
    const existingExpenseQuery = `
      SELECT "bankAccountId", "contactId", "amount", "categoryId", "date", "notes", "status", "dueDate", "remaining_amount", "paid_amount"
      FROM hisab."expenses"
      WHERE "id" = $1 AND "companyId" = $2
      LIMIT 1
    `;
    const existingExpense = await client.query(existingExpenseQuery, [id, companyId]);

    if (existingExpense.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Expense not found or unauthorized", 404);
    }

    const {
      bankAccountId: oldBankAccountId,
      contactId: oldContactId,
      amount: oldAmount,
      categoryId: oldCategoryId,
      date: oldDate,
      notes: oldNotes,
      status: oldStatus,
      dueDate: oldDueDate,
      remaining_amount: oldRemainingAmount,
      paid_amount: oldPaidAmount
    } = existingExpense.rows[0];

    // Determine final values
    const finalDate = date !== undefined ? new Date(date).toISOString().split('T')[0] : oldDate;
    const finalCategoryId = categoryId !== undefined ? categoryId : oldCategoryId;
    const finalAmount = amount !== undefined ? amount : oldAmount;
    const finalNotes = notes !== undefined ? notes : oldNotes;
    const finalDueDate = dueDate !== undefined ? new Date(dueDate).toISOString().split('T')[0] : oldDueDate;
    
    // Check for payment allocation conflicts using utility function
    const conflictResult = await checkPaymentAllocationConflict(
      client, 
      'expense', 
      id, 
      companyId, 
      oldAmount, 
      finalAmount, 
      paymentAdjustmentChoice
    );

    // If payment adjustment is needed but no choice provided, return conflict info
    if (conflictResult.requiresPaymentAdjustment) {
      await client.query("ROLLBACK");
      
      return res.status(409).json({
        success: false,
        message: "Payment adjustment required",
        requiresPaymentAdjustment: true,
        paymentInfo: conflictResult.paymentInfo
      });
    }

    const { hasPaymentAllocations, paymentAdjustmentMade, allocations } = conflictResult;
    
    // Allow updating payment method fields (use cleaned values)
    const finalBankAccountId = cleanBankAccountId !== undefined ? cleanBankAccountId : oldBankAccountId;
    const finalContactId = cleanContactId !== undefined ? cleanContactId : oldContactId;
    
    // Determine status based on payment method combination
    let finalStatus = oldStatus;
    if (status !== undefined) {
      // Only allow valid statuses ('paid' and 'pending' only)
      if (!['paid', 'pending'].includes(status)) {
        return errorResponse(res, "Status must be either 'paid' or 'pending'", 400);
      }
      finalStatus = status;
    } else {
      // Auto-determine status based on payment method
      if (finalBankAccountId && !finalContactId) {
        // Direct bank payment
        finalStatus = 'paid';
      } else if (finalContactId && !finalBankAccountId) {
        // Contact payment without bank account
        finalStatus = 'pending';
      } else if (finalContactId && finalBankAccountId) {
        // Contact payment with bank account (paid through contact)
        finalStatus = 'paid';
      }
    }

    // Calculate amounts using utility function
    const amountResult = calculateAmountsAfterAdjustment(
      finalAmount,
      oldPaidAmount,
      paymentAdjustmentChoice,
      paymentAdjustmentMade
    );

    let { remainingAmount: finalRemainingAmount, paidAmount: finalPaidAmount } = amountResult;
    
    // Always use the calculated status from utility function
    let finalStatusToUse = amountResult.status;

    console.log('📊 Expense status calculation debug:', {
      paymentAdjustmentMade,
      amountResultStatus: amountResult.status,
      originalFinalStatus: finalStatus,
      finalStatusToUse,
      finalRemainingAmount,
      finalPaidAmount,
      finalAmount,
      oldPaidAmount,
      shouldBePending: finalRemainingAmount > 0
    });
        
    // Payment allocation updates will be handled separately if needed

    // Verify category if it's being updated
    if (categoryId !== undefined) {
      const categoryCheck = await client.query(
        `SELECT "id" FROM hisab."expenseCategories" WHERE "id" = $1`,
        [finalCategoryId]
      );

      if (categoryCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, "Category not found or unauthorized", 404);
      }
    }

    // Verify bank account if provided
    if (finalBankAccountId) {
      const bankAccountCheck = await client.query(
        `SELECT id FROM hisab."bankAccounts" 
         WHERE id = $1 AND "companyId" = $2 AND "isActive" = TRUE AND "deletedAt" IS NULL`,
        [finalBankAccountId, companyId]
      );

      if (bankAccountCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, "Bank account not found, inactive, or unauthorized", 404);
      }
    }

    // Verify contact if provided
    if (finalContactId) {
      const contactCheck = await client.query(
        `SELECT id FROM hisab."contacts" 
         WHERE id = $1 AND "companyId" = $2 AND "deletedAt" IS NULL`,
        [finalContactId, companyId]
      );

      if (contactCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, "Contact not found or unauthorized", 404);
      }
    }

    // Handle bank account balance updates (only if no payment adjustment was made)
    if (!paymentAdjustmentMade) {
      // Check if this expense has payment allocations (payment module transaction)
      const hasPaymentAllocations = await client.query(
        `SELECT COUNT(*) as count FROM hisab."payment_allocations" pa
         JOIN hisab."payments" p ON pa."paymentId" = p.id
         WHERE pa."expenseId" = $1 AND p."companyId" = $2 AND p."deletedAt" IS NULL`,
        [id, companyId]
      );
      
      const isPaymentModuleTransaction = parseInt(hasPaymentAllocations.rows[0].count) > 0;
      
      // First, reverse the old bank account balance if it was a direct bank expense (not payment module)
      if (oldBankAccountId && oldStatus === 'paid' && !isPaymentModuleTransaction) {
        await client.query(
          `UPDATE hisab."bankAccounts" 
           SET "currentBalance" = "currentBalance" + $1,
               "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [oldAmount, oldBankAccountId]
        );
      }

      // Then, subtract from the new bank account balance if it's a paid transaction
      if (finalBankAccountId && finalStatus === 'paid') {
        await client.query(
          `UPDATE hisab."bankAccounts" 
           SET "currentBalance" = "currentBalance" - $1,
               "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [finalAmount, finalBankAccountId]
        );
      }
    }

    const updateQuery = `
      UPDATE hisab."expenses"
      SET 
        "date" = $1,
        "categoryId" = $2,
        "amount" = $3,
        "notes" = $4,
        "dueDate" = $5,
        "bankAccountId" = $6,
        "contactId" = $7,
        "status" = $8,
        "remaining_amount" = $9,
        "paid_amount" = $10,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $11
      RETURNING *
    `;

    const result = await client.query(updateQuery, [
      finalDate,
      finalCategoryId,
      finalAmount,
      finalNotes,
      finalDueDate,
      finalBankAccountId,
      finalContactId,
      finalStatusToUse,
      finalRemainingAmount,
      finalPaidAmount,
      id
    ]);

    // Handle payment allocation updates if needed
    if (paymentAdjustmentMade) {
      await updatePaymentAllocations(
        client,
        'expense',
        allocations,
        finalAmount,
        paymentAdjustmentChoice
      );
    }

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Expense updated successfully",
      expense: result.rows[0],
      status: finalStatusToUse,
      paymentAdjustmentMade: paymentAdjustmentMade || false
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error updating expense", 500);
  } finally {
    client.release();
  }
}

export async function getExpenses(req, res) {
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;
  const { page = 1, limit = 10, categoryId, status, startDate, endDate } = req.query;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access - user or company not identified", 401);
  }

  const client = await pool.connect();

  try {
    // Base query
    let query = `
      SELECT 
        e."id", e."date", e."amount", e."notes", e."status", e."dueDate", e."createdAt", e."updatedAt",
        e."remaining_amount", e."paid_amount",
        ec."name" as "categoryName",ec.id as "categoryId",
        c."name" as "companyName",
        ba.id as "bankAccountId",
        ba."accountName" as "bankAccountName",
        ct.id as "contactId",
        ct."name" as "contactName"
      FROM hisab."expenses" e
      LEFT JOIN hisab."expenseCategories" ec ON e."categoryId" = ec."id"
      LEFT JOIN hisab."companies" c ON e."companyId" = c."id"
      LEFT JOIN hisab."bankAccounts" ba ON e."bankAccountId" = ba."id"
      LEFT JOIN hisab."contacts" ct ON e."contactId" = ct."id"
      WHERE e."userId" = $1 AND e."companyId" = $2
    `;

    // Parameters array
    const params = [userId, companyId];
    let paramCount = 2;

    // Add filters
    if (categoryId) {
      paramCount++;
      query += ` AND e."categoryId" = $${paramCount}`;
      params.push(categoryId);
    }

    if (status) {
      paramCount++;
      query += ` AND e."status" = $${paramCount}`;
      params.push(status);
    }

    if (startDate) {
      paramCount++;
      query += ` AND e."date" >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND e."date" <= $${paramCount}`;
      params.push(endDate);
    }

    // Count total records for pagination
    const countQuery = `SELECT COUNT(*) FROM (${query}) as total`;
    const countResult = await client.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    // Add sorting and pagination
    query += `
      ORDER BY e."createdAt" DESC
      LIMIT $${paramCount + 1}
      OFFSET $${paramCount + 2}
    `;

    const offset = (page - 1) * limit;
    params.push(limit, offset);

    const result = await client.query(query, params);

    // Fix any inconsistent status values
    const correctedExpenses = result.rows.map(expense => {
      const remainingAmount = parseFloat(expense.remaining_amount || 0);
      const paidAmount = parseFloat(expense.paid_amount || 0);
      
      // Determine correct status based on amounts (only 'paid' and 'pending' allowed)
      let correctStatus = expense.status;
      if (remainingAmount === 0 && paidAmount > 0) {
        correctStatus = 'paid';
      } else if (remainingAmount > 0) {
        // Any remaining amount means it's still pending (no 'partial' status)
        correctStatus = 'pending';
      }
      
      return {
        ...expense,
        status: correctStatus
      };
    });

    return successResponse(res, {
      expenses: correctedExpenses,
      pagination: {
        total,
        totalPages,
        currentPage: parseInt(page),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error(error);
    return errorResponse(res, "Error fetching expenses", 500);
  } finally {
    client.release();
  }
}

// Bulk delete expenses
export async function bulkDeleteExpenses(req, res) {
  const { ids } = req.body;
  const companyId = req.currentUser?.companyId;
  const userId = req.currentUser?.id;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return errorResponse(res, "Expense IDs array is required", 400);
  }

  if (!companyId || !userId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Process each expense deletion
    for (const id of ids) {
      try {
        // First verify the expense belongs to the user and get details
        const verifyQuery = `
          SELECT "bankAccountId", "contactId", "amount", "status" FROM hisab."expenses"
          WHERE "id" = $1 AND "userId" = $2 AND "companyId" = $3
          LIMIT 1
        `;
        const verifyResult = await client.query(verifyQuery, [id, userId, companyId]);

        if (verifyResult.rows.length === 0) {
          errors.push(`Expense ID ${id} not found or unauthorized`);
          errorCount++;
          continue;
        }

        const { bankAccountId, contactId, amount, status } = verifyResult.rows[0];

        // Revert bank account balance if bankAccountId is present
        // This covers both direct bank payments and contact payments that were paid
        if (bankAccountId) {
          await client.query(
            `UPDATE hisab."bankAccounts" 
             SET "currentBalance" = "currentBalance" + $1,
                 "updatedAt" = CURRENT_TIMESTAMP
             WHERE "id" = $2`,
            [amount, bankAccountId]
          );
        }

        // Handle payment allocations before deleting
        await handlePaymentAllocationsOnTransactionDelete(client, 'expense', id, companyId, userId);

        // Delete the expense
        const deleteQuery = `
          DELETE FROM hisab."expenses"
          WHERE "id" = $1
          RETURNING *
        `;
        const deletedExpense = await client.query(deleteQuery, [id]);

        if (deletedExpense.rows.length === 0) {
          errors.push(`Failed to delete expense ID ${id}`);
          errorCount++;
          continue;
        }

        successCount++;
      } catch (error) {
        console.error(`Error deleting expense ${id}:`, error);
        errors.push(`Expense ID ${id}: ${error.message}`);
        errorCount++;
      }
    }

    await client.query("COMMIT");

    return successResponse(res, {
      message: `Bulk delete completed. ${successCount} expenses deleted successfully.`,
      successCount,
      errorCount,
      errors: errors.length > 0 ? errors : null,
      totalProcessed: ids.length
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Bulk delete expenses error:", error);
    return errorResponse(res, "Failed to bulk delete expenses", 500);
  } finally {
    client.release();
  }
}

