import pool from "../config/dbConnection.js";
import { errorResponse, successResponse } from "../utils/index.js";

export async function createStockCategory(req, res) {
  const userId = req.currentUser?.id;
  const companyId = req.headers['companyid'];
  const { name, description } = req.body;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  if (!name) {
    return errorResponse(res, "Stock category name is required", 400);
  }

  const client = await pool.connect();

  try {
    const result = await client.query(
      `INSERT INTO hisab."stockCategories" 
       ("companyId", "name", "description")
       VALUES ($1, $2, $3)
       RETURNING *`,
      [companyId, name, description || null]
    );

    return successResponse(res, {
      message: "Stock category created successfully",
      category: result.rows[0]
    });

  } catch (error) {
    console.error("Error creating stock category:", error);
    return errorResponse(res, "Error creating stock category", 500);
  } finally {
    client.release();
  }
}

export async function listStockCategories(req, res) {
  const companyId = req.headers['companyid'];

  if (!companyId) {
    return errorResponse(res, "Company ID is missing", 400);
  }

  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT * FROM hisab."stockCategories"
       WHERE "companyId" = $1 AND "isActive" = TRUE
       ORDER BY "createdAt" DESC`,
      [companyId]
    );

    return successResponse(res, {
      categories: result.rows
    });

  } catch (error) {
    console.error("Error listing stock categories:", error);
    return errorResponse(res, "Error listing stock categories", 500);
  } finally {
    client.release();
  }
}

export async function updateStockCategory(req, res) {
  const userId = req.currentUser?.id;
  const companyId = req.headers['companyid'];
  const categoryId = req.params.id;
  const { name, description } = req.body;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  if (!name) {
    return errorResponse(res, "Category name is required", 400);
  }

  const client = await pool.connect();

  try {
    const result = await client.query(
      `UPDATE hisab."stockCategories"
       SET "name" = $1,
           "description" = $2,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $3 AND "companyId" = $4
       RETURNING *`,
      [name, description || null, categoryId, companyId]
    );

    if (result.rowCount === 0) {
      return errorResponse(res, "Category not found", 404);
    }

    return successResponse(res, {
      message: "Category updated successfully",
      category: result.rows[0]
    });

  } catch (error) {
    console.error("Error updating stock category:", error);
    return errorResponse(res, "Error updating stock category", 500);
  } finally {
    client.release();
  }
}

export async function deleteStockCategory(req, res) {
  const userId = req.currentUser?.id;
  const companyId = req.headers['companyid'];
  const categoryId = req.params.id;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    const result = await client.query(
      `UPDATE hisab."stockCategories"
       SET "isActive" = FALSE,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $1 AND "companyId" = $2
       RETURNING *`,
      [categoryId, companyId]
    );

    if (result.rowCount === 0) {
      return errorResponse(res, "Category not found", 404);
    }

    return successResponse(res, {
      message: "Category deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting stock category:", error);
    return errorResponse(res, "Error deleting stock category", 500);
  } finally {
    client.release();
  }
}
