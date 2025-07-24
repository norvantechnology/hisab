import pool from "../config/dbConnection.js";
import { errorResponse, successResponse } from "../utils/index.js";

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
    status,
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

  // For direct bank payments: bankAccountId set, contactId null
  // For contact payments: contactId set, and if paid then bankAccountId also set
  if (bankAccountId && contactId) {
    // Both can be set only for contact payments that are paid
    if (!status || status !== 'paid') {
      return errorResponse(res, "Both bank account and contact can only be specified for paid contact expenses", 400);
    }
  }

  // Validate contact-specific fields
  if (contactId) {
    if (!status) {
      return errorResponse(res, "Status is required when contact is specified", 400);
    }
    if (!['pending', 'paid'].includes(status)) {
      return errorResponse(res, "Status must be either 'pending' or 'paid'", 400);
    }
    if (status === 'pending') {
      if (!dueDate) {
        return errorResponse(res, "Due date is required when status is pending", 400);
      }
      if (bankAccountId) {
        return errorResponse(res, "Bank account should not be specified for pending contact expenses", 400);
      }
    }
    if (status === 'paid' && !bankAccountId) {
      return errorResponse(res, "Bank account is required when contact status is paid", 400);
    }
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
      INSERT INTO hisab."expenses" (
        "userId", "companyId", "date", "categoryId", 
        "bankAccountId", "contactId", "amount", "notes", 
        "status", "dueDate", "createdBy",
        "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
      status || 'paid', // Default to 'paid' for bank account payments
      dueDate || null,
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
    bankAccountId,
    contactId,
    amount,
    notes,
    status,
    dueDate,
    id
  } = req.body;

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

    // First get the existing expense details
    const existingExpenseQuery = `
      SELECT "bankAccountId", "contactId", "amount", "categoryId", "date", "notes", "status", "dueDate"
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
      dueDate: oldDueDate
    } = existingExpense.rows[0];

    // Determine which fields to update based on what's provided in the request
    const finalDate = date !== undefined ? date : oldDate;
    const finalCategoryId = categoryId !== undefined ? categoryId : oldCategoryId;
    let finalBankAccountId = bankAccountId !== undefined ? bankAccountId : oldBankAccountId;
    let finalContactId = contactId !== undefined ? contactId : oldContactId;
    const finalAmount = amount !== undefined ? amount : oldAmount;
    const finalNotes = notes !== undefined ? notes : oldNotes;
    let finalStatus = status !== undefined ? status : oldStatus;
    let finalDueDate = dueDate !== undefined ? dueDate : oldDueDate;

    // Smart payment method detection and field clearing
    // If switching to direct bank payment (bankAccountId provided without contactId)
    if (bankAccountId !== undefined && contactId === undefined && finalBankAccountId && oldContactId) {
      // Clear contact-related fields when switching to direct bank payment
      finalContactId = null;
      finalStatus = 'paid';
      finalDueDate = null;
    }
    
    // If switching to contact payment (contactId provided without bankAccountId for pending)
    if (contactId !== undefined && bankAccountId === undefined && finalContactId && !oldContactId) {
      // This would be a new contact payment, should have status
      if (!status) {
        await client.query("ROLLBACK");
        return errorResponse(res, "Status is required when switching to contact payment", 400);
      }
    }

    // Validate the final payment method configuration
    if (finalBankAccountId && finalContactId) {
      // Both can be set only for contact payments that are paid
      if (!finalStatus || finalStatus !== 'paid') {
        await client.query("ROLLBACK");
        return errorResponse(res, "Both bank account and contact can only be specified for paid contact expenses", 400);
      }
    } else if (!finalBankAccountId && !finalContactId) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Either bank account or contact must be specified", 400);
    }

    // Validate contact-specific fields
    if (finalContactId) {
      if (!finalStatus) {
        await client.query("ROLLBACK");
        return errorResponse(res, "Status is required when contact is specified", 400);
      }
      if (!['pending', 'paid'].includes(finalStatus)) {
        await client.query("ROLLBACK");
        return errorResponse(res, "Status must be either 'pending' or 'paid'", 400);
      }
      if (finalStatus === 'pending') {
        if (!finalDueDate) {
          await client.query("ROLLBACK");
          return errorResponse(res, "Due date is required when status is pending", 400);
        }
        if (finalBankAccountId) {
          await client.query("ROLLBACK");
          return errorResponse(res, "Bank account should not be specified for pending contact expenses", 400);
        }
      }
      if (finalStatus === 'paid' && !finalBankAccountId) {
        await client.query("ROLLBACK");
        return errorResponse(res, "Bank account is required when contact status is paid", 400);
      }
    }

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

    // Verify bank account if it's being updated or changed
    if (bankAccountId !== undefined && finalBankAccountId) {
      const bankAccountCheck = await client.query(
        `SELECT "id" FROM hisab."bankAccounts" 
         WHERE "id" = $1 AND "companyId" = $2 AND "isActive" = TRUE AND "deletedAt" IS NULL`,
        [finalBankAccountId, companyId]
      );

      if (bankAccountCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, "Bank account not found, inactive, or unauthorized", 404);
      }
    }

    // Verify contact if it's being updated or changed
    if (contactId !== undefined && finalContactId) {
      const contactCheck = await client.query(
        `SELECT "id" FROM hisab."contacts" 
         WHERE "id" = $1 AND "companyId" = $2 AND "deletedAt" IS NULL`,
        [finalContactId, companyId]
      );

      if (contactCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, "Contact not found or unauthorized", 404);
      }
    }

    // Handle bank balance changes
    
    // Revert old balance if there was a bank account involved
    if (oldBankAccountId) {
      await client.query(
        `UPDATE hisab."bankAccounts" 
         SET "currentBalance" = "currentBalance" + $1,
             "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = $2`,
        [oldAmount, oldBankAccountId]
      );
    }

    // Apply new balance if there's a bank account involved
    if (finalBankAccountId) {
      await client.query(
        `UPDATE hisab."bankAccounts" 
         SET "currentBalance" = "currentBalance" - $1,
             "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = $2`,
        [finalAmount, finalBankAccountId]
      );
    }

    const updateQuery = `
      UPDATE hisab."expenses"
      SET 
        "date" = $1,
        "categoryId" = $2,
        "bankAccountId" = $3,
        "contactId" = $4,
        "amount" = $5,
        "notes" = $6,
        "status" = $7,
        "dueDate" = $8,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $9
      RETURNING *
    `;

    const result = await client.query(updateQuery, [
      finalDate,
      finalCategoryId,
      finalBankAccountId,
      finalContactId,
      finalAmount,
      finalNotes,
      finalStatus,
      finalDueDate,
      id
    ]);

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Expense updated successfully",
      expense: result.rows[0]
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

    return successResponse(res, {
      expenses: result.rows,
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