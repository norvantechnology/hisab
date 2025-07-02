import pool from "../config/dbConnection.js";
import { errorResponse } from "../utils/index.js";

const companyOwnerCache = new Map();

const companyAdminCheck = async (req, res, next) => {
    const companyId = req.currentUser?.companyId;
    const currentUserId = req.currentUser?.id;

    if (!companyId || !currentUserId) {
        return errorResponse(res, "Unauthorized access", 401);
    }

    // Check cache first
    if (companyOwnerCache.has(companyId)) {
        if (companyOwnerCache.get(companyId) !== currentUserId) {
            return errorResponse(res, "Admin privileges required", 403);
        }
        return next();
    }

    const client = await pool.connect();

    try {
        const query = `SELECT "userId" FROM hisab."companies" WHERE "id" = $1 LIMIT 1`;
        const result = await client.query(query, [companyId]);

        if (result.rows.length === 0) {
            return errorResponse(res, "Company not found", 404);
        }

        const companyOwnerId = result.rows[0].userId;
        companyOwnerCache.set(companyId, companyOwnerId);

        if (companyOwnerId !== currentUserId) {
            return errorResponse(res, "Admin privileges required", 403);
        }

        next();
    } catch (error) {
        console.error(error);
        return errorResponse(res, "Error verifying admin status", 500);
    } finally {
        client.release();
    }
};

export default companyAdminCheck