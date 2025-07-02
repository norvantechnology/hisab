import pool from "../config/dbConnection.js";
import { errorResponse, successResponse } from "../utils/index.js";

export async function grantCompanyAccess(req, res) {
  const { email, roleId } = req.body;
  const adminUserId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!adminUserId || !companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  if (!email) {
    return errorResponse(res, "Email is required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verify admin has access to the company
    const companyCheck = await client.query(
      `SELECT id FROM hisab."companies" WHERE id = $1`,
      [companyId]
    );

    if (companyCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Company not found", 404);
    }

    // Get user to grant access to
    const userCheck = await client.query(
      `SELECT id FROM hisab."users" WHERE email = $1`,
      [email]
    );

    if (userCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "User with this email not found", 404);
    }

    const grantedUserId = userCheck.rows[0].id;

    // Check if access already exists
    const existingAccess = await client.query(
      `SELECT id FROM hisab."userCompanyAccess" 
       WHERE "grantedUserId" = $1 AND "companyId" = $2 AND "deletedAt" IS NULL`,
      [grantedUserId, companyId]
    );

    if (existingAccess.rows.length > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Access already granted to this user", 409);
    }

    if (roleId) {
      // Verify the role exists and belongs to this company
      const roleCheck = await client.query(
        `SELECT id FROM hisab."userRoles" 
         WHERE id = $1 AND "companyId" = $2 AND "deletedAt" IS NULL`,
        [roleId, companyId]
      );

      if (roleCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, "Role not found or invalid for this company", 404);
      }
    }

    // Grant access with role
    const insertQuery = `
      INSERT INTO hisab."userCompanyAccess"
      ("adminUserId", "grantedUserId", "companyId", "roleId")
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await client.query(insertQuery, [
      adminUserId,
      grantedUserId,
      companyId,
      roleId || null,
    ]);

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Access granted successfully",
      access: result.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error granting access", 500);
  } finally {
    client.release();
  }
}

export async function updateCompanyAccess(req, res) {
  const { accessId, roleId } = req.body;
  const adminUserId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!adminUserId || !companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  if (!accessId) {
    return errorResponse(res, "Access ID is required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verify the access record exists and belongs to admin's company
    const accessCheck = await client.query(
      `SELECT id FROM hisab."userCompanyAccess" 
       WHERE id = $1 AND "companyId" = $2 AND "deletedAt" IS NULL`,
      [accessId, companyId]
    );

    if (accessCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Access record not found or unauthorized", 404);
    }

    // If updating role
    if (roleId) {
      // Verify the new role exists and belongs to this company
      const roleCheck = await client.query(
        `SELECT id FROM hisab."userRoles" 
         WHERE id = $1 AND "companyId" = $2 AND "deletedAt" IS NULL`,
        [roleId, companyId]
      );

      if (roleCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, "Role not found or invalid for this company", 404);
      }
    }

    // Update the access record
    const updateQuery = `
      UPDATE hisab."userCompanyAccess"
      SET 
        "roleId" = COALESCE($1, "roleId"),
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;

    const result = await client.query(updateQuery, [
      roleId || null,
      accessId
    ]);

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Access updated successfully",
      access: result.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error updating access", 500);
  } finally {
    client.release();
  }
}

export async function revokeCompanyAccess(req, res) {
  const { accessId } = req.body;
  const adminUserId = req.currentUser?.id;

  if (!adminUserId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  if (!accessId) {
    return errorResponse(res, "Access ID is required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verify admin owns this access record
    const accessCheck = await client.query(
      `SELECT id FROM hisab."userCompanyAccess" 
       WHERE id = $1 AND "adminUserId" = $2`,
      [accessId, adminUserId]
    );

    if (accessCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Access record not found or unauthorized", 404);
    }

    // Delete access
    const deleteQuery = `
      DELETE FROM hisab."userCompanyAccess"
      WHERE id = $1
      RETURNING *
    `;

    const result = await client.query(deleteQuery, [accessId]);

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Access revoked successfully",
      access: result.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error revoking access", 500);
  } finally {
    client.release();
  }
}

export async function listCompanyAccess(req, res) {
  const companyId = req.currentUser?.companyId;
  const adminUserId = req.currentUser?.id;

  if (!adminUserId || !companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    // Get all access records for this company with user, role, and permission details
    const accessQuery = `
      SELECT 
        uca.id as "accessId",
        u.id as "userId",
        u.email,
        u.name as "userName",
        ur.id as "roleId",
        ur.name as "roleName",
        uca."createdAt",
        uca."updatedAt"
      FROM hisab."userCompanyAccess" uca
      JOIN hisab."users" u ON uca."grantedUserId" = u.id
      LEFT JOIN hisab."userRoles" ur ON uca."roleId" = ur.id
      WHERE uca."companyId" = $1 AND uca."deletedAt" IS NULL
      ORDER BY uca."createdAt" DESC
    `;

    const result = await client.query(accessQuery, [companyId]);

    return successResponse(res, {
      accesses: result.rows
    });

  } catch (error) {
    console.error(error);
    return errorResponse(res, "Error fetching access list", 500);
  } finally {
    client.release();
  }
}