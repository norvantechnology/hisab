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
    amount,
    notes
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

    const insertQuery = `
      INSERT INTO hisab."expenses" (
        "userId", "companyId", "date", "categoryId", 
        "bankAccountId", "amount", "notes", "createdBy",
        "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const result = await client.query(insertQuery, [
      userId,
      companyId,
      date,
      categoryId,
      bankAccountId,
      amount,
      notes,
      userId  // createdBy
    ]);

    // Update bank account balance if expense is linked to one
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

    // First verify the expense belongs to the user and get details (including bankAccountId and amount)
    const verifyQuery = `
      SELECT "bankAccountId", "amount" FROM hisab."expenses"
      WHERE "id" = $1 AND "userId" = $2 AND "companyId" = $3
      LIMIT 1
    `;
    const verifyResult = await client.query(verifyQuery, [id, userId, companyId]);

    if (verifyResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Expense not found or unauthorized", 404);
    }

    const { bankAccountId, amount } = verifyResult.rows[0];

    // If expense was linked to a bank account, revert the balance change
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
    amount,
    notes,
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
      SELECT "bankAccountId", "amount", "categoryId", "date", "notes"
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
      amount: oldAmount,
      categoryId: oldCategoryId,
      date: oldDate,
      notes: oldNotes
    } = existingExpense.rows[0];

    // Determine which fields to update based on what's provided in the request
    const finalDate = date !== undefined ? date : oldDate;
    const finalCategoryId = categoryId !== undefined ? categoryId : oldCategoryId;
    const finalBankAccountId = bankAccountId !== undefined ? bankAccountId : oldBankAccountId;
    const finalAmount = amount !== undefined ? amount : oldAmount;
    const finalNotes = notes !== undefined ? notes : oldNotes;

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
    if (bankAccountId !== undefined) {
      if (finalBankAccountId) {
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
    }

    // If bank account was linked before or is being updated, handle balance changes
    if (oldBankAccountId || (bankAccountId !== undefined && finalBankAccountId)) {
      // Revert old balance if there was an old bank account
      if (oldBankAccountId) {
        await client.query(
          `UPDATE hisab."bankAccounts" 
           SET "currentBalance" = "currentBalance" + $1,
               "updatedAt" = CURRENT_TIMESTAMP
           WHERE "id" = $2`,
          [oldAmount, oldBankAccountId]
        );
      }

      // Apply new balance if there's a new bank account
      if (finalBankAccountId) {
        await client.query(
          `UPDATE hisab."bankAccounts" 
           SET "currentBalance" = "currentBalance" - $1,
               "updatedAt" = CURRENT_TIMESTAMP
           WHERE "id" = $2`,
          [finalAmount, finalBankAccountId]
        );
      }
    }

    const updateQuery = `
      UPDATE hisab."expenses"
      SET 
        "date" = $1,
        "categoryId" = $2,
        "bankAccountId" = $3,
        "amount" = $4,
        "notes" = $5,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $6
      RETURNING *
    `;

    const result = await client.query(updateQuery, [
      finalDate,
      finalCategoryId,
      finalBankAccountId,
      finalAmount,
      finalNotes,
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
  const { page = 1, limit = 10, categoryId, startDate, endDate } = req.query;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access - user or company not identified", 401);
  }

  const client = await pool.connect();

  try {
    // Base query
    let query = `
      SELECT 
        e."id", e."date", e."amount", e."notes", e."createdAt", e."updatedAt",
        ec."name" as "categoryName",ec.id as "categoryId",
        c."name" as "companyName",
        ba.id as "bankAccountId",
        ba."accountName" as "bankAccountName"
      FROM hisab."expenses" e
      LEFT JOIN hisab."expenseCategories" ec ON e."categoryId" = ec."id"
      LEFT JOIN hisab."companies" c ON e."companyId" = c."id"
      LEFT JOIN hisab."bankAccounts" ba ON e."bankAccountId" = ba."id"
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