import pool from "../config/dbConnection.js";
import { errorResponse, successResponse } from "../utils/index.js";

export async function createIncomeCategory(req, res) {
  const { name } = req.body;
  const companyId = req.currentUser?.companyId;
  const currentUserId = req.currentUser?.id;

  if (!companyId || !currentUserId) {
    return errorResponse(res, "Unauthorized access - company or user not identified", 401);
  }

  if (!name) {
    return errorResponse(res, "Category name is required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

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
      SELECT id FROM hisab."incomeCategories" 
      WHERE "userId" = $1 AND "name" = $2 
      LIMIT 1
    `;
    const existingCategory = await client.query(existingCategoryQuery, [ownerUserId, name]);

    if (existingCategory.rows.length > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Category with this name already exists for this company", 409);
    }

    const insertQuery = `
      INSERT INTO hisab."incomeCategories"
      ("userId", "name", "createdAt", "updatedAt")
      VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const newCategory = await client.query(insertQuery, [ownerUserId, name]);

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Income category created successfully",
      category: newCategory.rows[0],
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error creating income category", 500);
  } finally {
    client.release();
  }
}

export async function getIncomeCategories(req, res) {
  const companyId = req.currentUser?.companyId;

  if (!companyId) {
    return errorResponse(res, "Unauthorized access - company not identified", 401);
  }

  const client = await pool.connect();

  try {
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

    const query = `
      SELECT id, "name", "isActive", "createdAt", "updatedAt"
      FROM hisab."incomeCategories"
      WHERE "userId" = $1 AND "isActive" = $2
      ORDER BY "name" ASC
    `;

    const result = await client.query(query, [ownerUserId, true]);

    return successResponse(res, {
      categories: result.rows,
    });

  } catch (error) {
    console.error(error);
    return errorResponse(res, "Error fetching income categories", 500);
  } finally {
    client.release();
  }
}

export async function deleteIncomeCategory(req, res) {
  const { id } = req.query;
  const companyId = req.currentUser?.companyId;

  if (!companyId) {
    return errorResponse(res, "Unauthorized access - company not identified", 401);
  }

  if (!id) {
    return errorResponse(res, "Category ID is required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

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
    // First verify the category belongs to the company
    const verifyQuery = `
      SELECT id FROM hisab."incomeCategories"
      WHERE id = $1 AND "userId" = $2
      LIMIT 1
    `;
    const verifyResult = await client.query(verifyQuery, [id, ownerUserId]);

    if (verifyResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Category not found or unauthorized", 404);
    }

    const deleteQuery = `
      DELETE FROM hisab."incomeCategories"
      WHERE id = $1
      RETURNING *
    `;
    const deletedCategory = await client.query(deleteQuery, [id]);

    await client.query("COMMIT");

    if (deletedCategory.rows.length === 0) {
      return errorResponse(res, "Failed to delete category", 500);
    }

    return successResponse(res, {
      message: "Income category deleted successfully",
      category: deletedCategory.rows[0],
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error deleting income category", 500);
  } finally {
    client.release();
  }
}

export async function createIncome(req, res) {
  const {
    date,
    categoryId,
    bankAccountId,
    contactId,
    amount,
    notes,
    dueDate
  } = req.body;

  const companyId = req.currentUser?.companyId;
  const currentUserId = req.currentUser?.id;

  if (!companyId || !currentUserId) {
    return errorResponse(res, "Unauthorized access - company or user not identified", 401);
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

    // Verify category exists
    const categoryCheck = await client.query(
      `SELECT id FROM hisab."incomeCategories" WHERE id = $1`,
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
      INSERT INTO hisab."incomes" (
        "companyId", "date", "categoryId", 
        "bankAccountId", "contactId", "amount", "notes", 
        "status", "dueDate", "remaining_amount", "paid_amount", "createdBy",
        "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const result = await client.query(insertQuery, [
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
      currentUserId
    ]);

    // Update bank account balance if bankAccountId is provided
    // This covers both direct bank payments and contact payments that are paid
    if (bankAccountId) {
      await client.query(
        `UPDATE hisab."bankAccounts" 
         SET "currentBalance" = "currentBalance" + $1,
             "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [amount, bankAccountId]
      );
    }

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Income created successfully",
      income: result.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error creating income", 500);
  } finally {
    client.release();
  }
}

export async function deleteIncome(req, res) {
  const { id } = req.query;
  const companyId = req.currentUser?.companyId;

  if (!companyId) {
    return errorResponse(res, "Unauthorized access - company not identified", 401);
  }

  if (!id) {
    return errorResponse(res, "Income ID is required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // First verify the income belongs to the company and get details
    const verifyQuery = `
      SELECT "bankAccountId", "contactId", "amount", "status" FROM hisab."incomes"
      WHERE "id" = $1 AND "companyId" = $2
      LIMIT 1
    `;
    const verifyResult = await client.query(verifyQuery, [id, companyId]);

    if (verifyResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Income not found or unauthorized", 404);
    }

    const { bankAccountId, contactId, amount, status } = verifyResult.rows[0];

    // If income was linked to a bank account, revert the balance change
    if (bankAccountId) {
      await client.query(
        `UPDATE hisab."bankAccounts" 
         SET "currentBalance" = "currentBalance" - $1,
             "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = $2`,
        [amount, bankAccountId]
      );
    }

    const deleteQuery = `
      DELETE FROM hisab."incomes"
      WHERE "id" = $1
      RETURNING *
    `;
    const deletedIncome = await client.query(deleteQuery, [id]);

    await client.query("COMMIT");

    if (deletedIncome.rows.length === 0) {
      return errorResponse(res, "Failed to delete income", 500);
    }

    return successResponse(res, {
      message: "Income deleted successfully",
      income: deletedIncome.rows[0],
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error deleting income", 500);
  } finally {
    client.release();
  }
}

export async function updateIncome(req, res) {
  const {
    date,
    categoryId,
    amount,
    notes,
    dueDate,
    id,
    bankAccountId,
    contactId,
    status
  } = req.body;

  const companyId = req.currentUser?.companyId;

  if (!companyId) {
    return errorResponse(res, "Unauthorized access - company not identified", 401);
  }

  if (!id) {
    return errorResponse(res, "Income ID is required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // First get the existing income details
    const existingIncomeQuery = `
      SELECT "bankAccountId", "contactId", "amount", "categoryId", "date", "notes", "status", "dueDate", "remaining_amount", "paid_amount"
      FROM hisab."incomes"
      WHERE "id" = $1 AND "companyId" = $2
      LIMIT 1
    `;
    const existingIncome = await client.query(existingIncomeQuery, [id, companyId]);

    if (existingIncome.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Income not found or unauthorized", 404);
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
    } = existingIncome.rows[0];

    // Determine final values
    const finalDate = date !== undefined ? new Date(date).toISOString().split('T')[0] : oldDate;
    const finalCategoryId = categoryId !== undefined ? categoryId : oldCategoryId;
    const finalAmount = amount !== undefined ? amount : oldAmount;
    const finalNotes = notes !== undefined ? notes : oldNotes;
    const finalDueDate = dueDate !== undefined ? new Date(dueDate).toISOString().split('T')[0] : oldDueDate;
    
    // Allow updating payment method fields
    const finalBankAccountId = bankAccountId !== undefined ? bankAccountId : oldBankAccountId;
    const finalContactId = contactId !== undefined ? contactId : oldContactId;
    
    // Determine status based on payment method combination
    let finalStatus = oldStatus;
    if (status !== undefined) {
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

    // Calculate new payment amounts based on status
    let finalRemainingAmount = oldRemainingAmount;
    let finalPaidAmount = oldPaidAmount;

    if (finalStatus === 'paid') {
      finalRemainingAmount = 0;
      finalPaidAmount = parseFloat(finalAmount);
    } else if (finalStatus === 'pending') {
      finalRemainingAmount = parseFloat(finalAmount);
      finalPaidAmount = 0;
    }

    // Verify category if it's being updated
    if (categoryId !== undefined) {
      const categoryCheck = await client.query(
        `SELECT "id" FROM hisab."incomeCategories" WHERE "id" = $1`,
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

    // Handle bank account balance updates
    // First, reverse the old bank account balance if it existed and was paid
    if (oldBankAccountId && oldStatus === 'paid') {
      await client.query(
        `UPDATE hisab."bankAccounts" 
         SET "currentBalance" = "currentBalance" - $1,
             "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [oldAmount, oldBankAccountId]
      );
    }

    // Then, add to the new bank account balance if it's a paid transaction
    if (finalBankAccountId && finalStatus === 'paid') {
      await client.query(
        `UPDATE hisab."bankAccounts" 
         SET "currentBalance" = "currentBalance" + $1,
             "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [finalAmount, finalBankAccountId]
      );
    }

    const updateQuery = `
      UPDATE hisab."incomes"
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
      finalStatus,
      finalRemainingAmount,
      finalPaidAmount,
      id
    ]);

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Income updated successfully",
      income: result.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error updating income", 500);
  } finally {
    client.release();
  }
}

export async function getIncomes(req, res) {
  const companyId = req.currentUser?.companyId;
  const { page = 1, limit = 10, categoryId, startDate, endDate, status } = req.query;

  if (!companyId) {
    return errorResponse(res, "Unauthorized access - company not identified", 401);
  }

  const client = await pool.connect();

  try {
    // Base query
    let query = `
      SELECT 
        i."id", i."date", i."categoryId", i."bankAccountId", i."amount", i."notes", i."status", i."dueDate", i."createdAt", i."updatedAt",
        i."remaining_amount", i."paid_amount",
        ic."name" as "categoryName",
        ba."accountName" as "bankAccountName",
        ct.id as "contactId",
        ct."name" as "contactName",
        u."name" as "createdByName"
      FROM hisab."incomes" i
      LEFT JOIN hisab."incomeCategories" ic ON i."categoryId" = ic."id"
      LEFT JOIN hisab."bankAccounts" ba ON i."bankAccountId" = ba."id"
      LEFT JOIN hisab."contacts" ct ON i."contactId" = ct."id"
      LEFT JOIN hisab."users" u ON i."createdBy" = u."id"
      WHERE i."companyId" = $1
    `;

    // Parameters array
    const params = [companyId];
    let paramCount = 1;

    // Add filters
    if (categoryId) {
      paramCount++;
      query += ` AND i."categoryId" = $${paramCount}`;
      params.push(categoryId);
    }

    if (startDate) {
      paramCount++;
      query += ` AND i."date" >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND i."date" <= $${paramCount}`;
      params.push(endDate);
    }

    if (status) {
      paramCount++;
      query += ` AND i."status" = $${paramCount}`;
      params.push(status);
    }

    // Count total records for pagination
    const countQuery = `SELECT COUNT(*) FROM (${query}) as total`;
    const countResult = await client.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    // Add sorting and pagination
    query += `
      ORDER BY i."createdAt" DESC
      LIMIT $${paramCount + 1}
      OFFSET $${paramCount + 2}
    `;

    const offset = (page - 1) * limit;
    params.push(limit, offset);

    const result = await client.query(query, params);

    return successResponse(res, {
      incomes: result.rows,
      pagination: {
        total,
        totalPages,
        currentPage: parseInt(page),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error(error);
    return errorResponse(res, "Error fetching incomes", 500);
  } finally {
    client.release();
  }
}