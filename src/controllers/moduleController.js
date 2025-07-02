import pool from "../config/dbConnection.js";
import { errorResponse, successResponse } from "../utils/index.js";

export async function createModule(req, res) {
  const { name } = req.body;
  const userId = req.currentUser?.id;

  if (!userId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  if (!name) {
    return errorResponse(res, "Module name is required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check if module with same name already exists
    const existingModule = await client.query(
      `SELECT id FROM hisab."modules" 
       WHERE name = $1 AND "deletedAt" IS NULL`,
      [name]
    );

    if (existingModule.rows.length > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Module with this name already exists", 409);
    }

    // Create new module
    const result = await client.query(
      `INSERT INTO hisab."modules" 
       (name) 
       VALUES ($1) 
       RETURNING *`,
      [name]
    );

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Module created successfully",
      module: result.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating module:", error);
    return errorResponse(res, "Error creating module", 500);
  } finally {
    client.release();
  }
}

export async function getAllModules(req, res) {
  const userId = req.currentUser?.id;
  const { includeDeleted } = req.query;

  if (!userId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    // Get all modules (active only by default)
    let query = `
      SELECT 
        id, 
        name, 
        "createdAt", 
        "updatedAt"
      FROM hisab."modules"
      WHERE "deletedAt" IS NULL
      ORDER BY name ASC
    `;

    if (includeDeleted === 'true') {
      query = `
        SELECT 
          id, 
          name, 
          "createdAt", 
          "updatedAt",
          "deletedAt"
        FROM hisab."modules"
        ORDER BY name ASC
      `;
    }

    const result = await client.query(query);

    return successResponse(res, {
      modules: result.rows
    });

  } catch (error) {
    console.error("Error fetching modules:", error);
    return errorResponse(res, "Error fetching modules", 500);
  } finally {
    client.release();
  }
}