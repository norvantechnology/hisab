import pool from "../config/dbConnection.js";
import { errorResponse, successResponse } from "../utils/index.js";

export async function getUnitOfMeasurements(req, res) {
    const client = await pool.connect();

    try {
        const result = await client.query(
            `SELECT id, name, symbol, "isActive", "createdAt", "updatedAt"
             FROM hisab."unitOfMeasurements"
             WHERE "isActive" = TRUE`
        );

        if (result.rows.length === 0) {
            return errorResponse(res, "No active units of measurement found", 404);
        }

        return successResponse(res, {
            data: result.rows,
        });

    } catch (error) {
        console.error("Error fetching unit of measurements:", error);
        return errorResponse(res, "Error fetching unit of measurements", 500);
    } finally {
        client.release();
    }
}
