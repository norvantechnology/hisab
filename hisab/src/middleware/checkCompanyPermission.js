import pool from '../config/dbConnection.js';
import { errorResponse } from '../utils/index.js';

const checkCompanyModulePermission = (moduleName, requiredPermission) => {
  return async (req, res, next) => {
    const userId = req.currentUser?.id;
    const companyId = req.currentUser?.companyId;
    

    if (!userId || !companyId) {
      return errorResponse(res, "Unauthorized access", 401);
    }

    // // Validate required permission type
    // const validPermissions = ['VIEW', 'CREATE', 'EDIT', 'DELETE'];
    // if (!validPermissions.includes(requiredPermission)) {
    //   return errorResponse(res, "Invalid permission type", 400);
    // }

    const client = await pool.connect();

    try {
      // Single optimized query to check all permissions at once
      const permissionCheckQuery = `
        WITH user_access AS (
          -- Check if user is company owner
          SELECT 
            'owner' as access_type,
            true as has_access,
            null as role_id
          FROM hisab."companies" 
          WHERE id = $2 AND "userId" = $1
          
          UNION ALL
          
          -- Check user company access and role
          SELECT 
            'member' as access_type,
            true as has_access,
            "roleId" as role_id
          FROM hisab."userCompanyAccess"
          WHERE "grantedUserId" = $1 
            AND "companyId" = $2 
            AND "deletedAt" IS NULL
            AND "roleId" IS NOT NULL
        ),
        permission_check AS (
          SELECT 
            ua.access_type,
            ua.has_access,
            CASE 
              WHEN ua.access_type = 'owner' THEN true
              ELSE EXISTS (
                SELECT 1 
                FROM hisab."roleModulePermissions" rmp
                JOIN hisab."modules" m ON rmp."moduleId" = m.id
                WHERE rmp."roleId" = ua.role_id
                  AND m.name = $3
                  AND rmp."permissionType" = $4
                  AND m."deletedAt" IS NULL
              )
            END as has_module_permission
          FROM user_access ua
        )
        SELECT 
          access_type,
          has_access,
          has_module_permission
        FROM permission_check
        WHERE has_access = true
          AND has_module_permission = true
        LIMIT 1`;

      const result = await client.query(permissionCheckQuery, [
        userId,
        companyId,
        moduleName,
        requiredPermission
      ]);

      // Check if user has any valid access with required permission
      if (result.rows.length === 0) {
        // Determine specific error message with a follow-up query
        const accessCheckQuery = `
          SELECT 
            CASE 
              WHEN EXISTS (
                SELECT 1 FROM hisab."companies" 
                WHERE id = $2 AND "userId" = $1
              ) THEN 'owner_no_permission'
              WHEN EXISTS (
                SELECT 1 FROM hisab."userCompanyAccess"
                WHERE "grantedUserId" = $1 AND "companyId" = $2 AND "deletedAt" IS NULL
              ) THEN 'member_no_permission'
              ELSE 'no_access'
            END as error_type`;

        const errorCheck = await client.query(accessCheckQuery, [userId, companyId]);
        const errorType = errorCheck.rows[0]?.error_type;

        switch (errorType) {
          case 'no_access':
            return errorResponse(res, "No access to this company", 403);
          case 'member_no_permission':
            return errorResponse(
              res,
              `Required ${requiredPermission} permission for ${moduleName} module not granted`,
              403
            );
          default:
            return errorResponse(res, "Access denied", 403);
        }
      }

      // All checks passed
      next();
    } catch (error) {
      console.error("Permission check error:", error);
      return errorResponse(res, "Error verifying permissions", 500);
    } finally {
      client.release();
    }
  };
};

export default checkCompanyModulePermission;