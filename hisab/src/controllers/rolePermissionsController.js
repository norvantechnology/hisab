import pool from "../config/dbConnection.js";
import { errorResponse, successResponse } from "../utils/index.js";

export async function updateRolePermissions(req, res) {
  const { roleId, permissions } = req.body;
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  if (!roleId || !permissions || !Array.isArray(permissions)) {
    return errorResponse(res, "Role ID and permissions array are required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verify role exists and belongs to user's company
    const roleCheck = await client.query(
      `SELECT id FROM hisab."userRoles" 
       WHERE id = $1 AND "companyId" = $2 AND "deletedAt" IS NULL`,
      [roleId, companyId]
    );

    if (roleCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Role not found or unauthorized", 404);
    }

    // Delete existing permissions for this role
    await client.query(
      `DELETE FROM hisab."roleModulePermissions" WHERE "roleId" = $1`,
      [roleId]
    );

    // Insert new permissions
    for (const perm of permissions) {
      const { moduleId, permissionType } = perm;

      // Verify module exists
      const moduleCheck = await client.query(
        `SELECT id FROM hisab."modules" WHERE id = $1 AND "deletedAt" IS NULL`,
        [moduleId]
      );

      if (moduleCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, `Module with ID ${moduleId} not found`, 404);
      }

      // Verify permission type is valid (handled by ENUM in DB, but we can pre-check)
      if (!['VIEW', 'CREATE', 'EDIT', 'DELETE'].includes(permissionType)) {
        await client.query("ROLLBACK");
        return errorResponse(res, `Invalid permission type: ${permissionType}`, 400);
      }

      await client.query(
        `INSERT INTO hisab."roleModulePermissions"
         ("roleId", "moduleId", "permissionType")
         VALUES ($1, $2, $3)`,
        [roleId, moduleId, permissionType]
      );
    }

    await client.query("COMMIT");

    // Get the updated permissions to return
    const updatedPermissions = await getRolePermissionsHelper(roleId, client);

    return successResponse(res, {
      message: "Role permissions updated successfully",
      permissions: updatedPermissions
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating role permissions:", error);
    return errorResponse(res, "Error updating role permissions", 500);
  } finally {
    client.release();
  }
}

// Helper function to get role permissions
async function getRolePermissionsHelper(roleId, client) {
  const result = await client.query(
    `SELECT 
      rmp.id,
      rmp."roleId",
      rmp."moduleId",
      m.name as "moduleName",
      rmp."permissionType"
     FROM hisab."roleModulePermissions" rmp
     JOIN hisab."modules" m ON rmp."moduleId" = m.id
     WHERE rmp."roleId" = $1 AND m."deletedAt" IS NULL
     ORDER BY m.name, rmp."permissionType"`,
    [roleId]
  );

  return result.rows;
}


export async function getRolePermissions(req, res) {
  const { roleId } = req.query;
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  if (!roleId) {
    return errorResponse(res, "Role ID is required", 400);
  }

  const client = await pool.connect();

  try {
    // Verify role exists and belongs to user's company
    const roleCheck = await client.query(
      `SELECT id FROM hisab."userRoles" 
       WHERE id = $1 AND "companyId" = $2 AND "deletedAt" IS NULL`,
      [roleId, companyId]
    );

    if (roleCheck.rows.length === 0) {
      return errorResponse(res, "Role not found or unauthorized", 404);
    }

    // Get all permissions for this role
    const permissions = await getRolePermissionsHelper(roleId, client);

    // Also get all available modules for the UI
    const modules = await client.query(
      `SELECT id, name FROM hisab."modules" WHERE "deletedAt" IS NULL ORDER BY name`
    );

    return successResponse(res, {
      permissions,
      availableModules: modules.rows,
      availablePermissionTypes: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
    });

  } catch (error) {
    console.error("Error fetching role permissions:", error);
    return errorResponse(res, "Error fetching role permissions", 500);
  } finally {
    client.release();
  }
}