import pool from "../config/dbConnection.js";
import { errorResponse, successResponse } from "../utils/index.js";

export async function createUserRole(req, res) {
  const { name } = req.body;
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  if (!name) {
    return errorResponse(res, "Role name is required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check if role with same name already exists for this company
    const existingRole = await client.query(
      `SELECT id FROM hisab."userRoles" 
       WHERE name = $1 AND "companyId" = $2 AND "deletedAt" IS NULL`,
      [name, companyId]
    );

    if (existingRole.rows.length > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Role with this name already exists", 409);
    }

    // Create new role
    const result = await client.query(
      `INSERT INTO hisab."userRoles" 
       (name, "createdBy", "companyId") 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [name, userId, companyId]
    );

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Role created successfully",
      role: result.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating role:", error);
    return errorResponse(res, "Error creating role", 500);
  } finally {
    client.release();
  }
}

export async function deleteUserRole(req, res) {
  const { roleId } = req.query;
  const companyId = req.currentUser?.companyId;

  if (!companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  if (!roleId) {
    return errorResponse(res, "Role ID is required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verify role belongs to the user's company
    const roleCheck = await client.query(
      `SELECT id FROM hisab."userRoles" 
       WHERE id = $1 AND "companyId" = $2 AND "deletedAt" IS NULL`,
      [roleId, companyId]
    );

    if (roleCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Role not found or unauthorized", 404);
    }

    // Soft delete the role
    const result = await client.query(
      `UPDATE hisab."userRoles" 
       SET "deletedAt" = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING *`,
      [roleId]
    );

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Role deleted successfully",
      role: result.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting role:", error);
    return errorResponse(res, "Error deleting role", 500);
  } finally {
    client.release();
  }
}

export async function getUserRolesByCompany(req, res) {
  const companyId = req.currentUser?.companyId;

  if (!companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    // Get all active roles for the company
    const result = await client.query(
      `SELECT 
        ur.id, ur.name, ur."createdAt", ur."updatedAt",
        u.id as "createdBy", u.email, u.name as "userName"
       FROM hisab."userRoles" ur
       JOIN hisab."users" u ON ur."createdBy" = u.id
       WHERE ur."companyId" = $1 AND ur."deletedAt" IS NULL
       ORDER BY ur."createdAt" DESC`,
      [companyId]
    );

    return successResponse(res, {
      roles: result.rows
    });

  } catch (error) {
    console.error("Error fetching roles:", error);
    return errorResponse(res, "Error fetching roles", 500);
  } finally {
    client.release();
  }
}