import pool from "../config/dbConnection.js";
import { errorResponse, successResponse } from "../utils/index.js";

export async function getTaxCategory(req, res) {
    const client = await pool.connect();

    try {
        const result = await client.query(
            `SELECT id, name, rate, description, "isActive", "createdAt", "updatedAt"
             FROM hisab."taxCategories"`,
        );

        if (result.rows.length === 0) {
            return errorResponse(res, "Tax category not found", 404);
        }

        return successResponse(res, {
            data: result.rows,
        });

    } catch (error) {
        console.error("Error fetching tax category:", error);
        return errorResponse(res, "Error fetching tax category", 500);
    } finally {
        client.release();
    }
}
