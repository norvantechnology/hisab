import pool from "../config/dbConnection.js";
import { errorResponse, successResponse } from "../utils/index.js";

// Get user's copy preferences for all modules
export async function getCopyPreferences(req, res) {
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Authentication required", 401);
  }

  const client = await pool.connect();

  try {
    const query = `
      SELECT 
        "moduleType",
        "defaultCopies"
      FROM hisab."userCopyPreferences" 
      WHERE "userId" = $1 AND "companyId" = $2
    `;

    const result = await client.query(query, [userId, companyId]);
    
    // Create a map of preferences with defaults
    const preferences = {
      sales: 2,
      purchase: 2,
      payment: 2
    };

    // Override with user preferences
    result.rows.forEach(row => {
      preferences[row.moduleType] = row.defaultCopies;
    });

    return successResponse(res, {
      preferences,
      message: "Copy preferences retrieved successfully"
    });

  } catch (error) {
    console.error('Error fetching copy preferences:', error);
    return errorResponse(res, "Failed to fetch copy preferences", 500);
  } finally {
    client.release();
  }
}

// Set user's copy preference for a specific module
export async function setCopyPreference(req, res) {
  const { moduleType, defaultCopies } = req.body;
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!moduleType || !defaultCopies) {
    return errorResponse(res, "moduleType and defaultCopies are required", 400);
  }

  if (!['sales', 'purchase', 'payment'].includes(moduleType)) {
    return errorResponse(res, "Invalid moduleType. Must be sales, purchase, or payment", 400);
  }

  if (![1, 2, 4].includes(parseInt(defaultCopies))) {
    return errorResponse(res, "Invalid defaultCopies. Must be 1, 2, or 4", 400);
  }

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Upsert user copy preference
    const upsertQuery = `
      INSERT INTO hisab."userCopyPreferences" 
        ("userId", "companyId", "moduleType", "defaultCopies")
      VALUES ($1, $2, $3, $4)
      ON CONFLICT ("userId", "companyId", "moduleType")
      DO UPDATE SET 
        "defaultCopies" = $4,
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await client.query(upsertQuery, [
      userId,
      companyId,
      moduleType,
      parseInt(defaultCopies)
    ]);

    await client.query("COMMIT");

    return successResponse(res, {
      preference: result.rows[0],
      message: "Copy preference updated successfully"
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error('Error setting copy preference:', error);
    return errorResponse(res, "Failed to update copy preference", 500);
  } finally {
    client.release();
  }
}

// Get default copy count for a specific module
export async function getDefaultCopies(req, res) {
  const { moduleType } = req.query;
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!moduleType) {
    return errorResponse(res, "moduleType is required", 400);
  }

  if (!['sales', 'purchase', 'payment'].includes(moduleType)) {
    return errorResponse(res, "Invalid moduleType", 400);
  }

  if (!userId || !companyId) {
    return errorResponse(res, "Authentication required", 401);
  }

  const client = await pool.connect();

  try {
    const query = `
      SELECT "defaultCopies"
      FROM hisab."userCopyPreferences" 
      WHERE "userId" = $1 AND "companyId" = $2 AND "moduleType" = $3
    `;

    const result = await client.query(query, [userId, companyId, moduleType]);
    
    const defaultCopies = result.rows.length > 0 ? result.rows[0].defaultCopies : 2;

    return successResponse(res, {
      defaultCopies,
      moduleType,
      message: "Default copies retrieved successfully"
    });

  } catch (error) {
    console.error('Error fetching default copies:', error);
    return errorResponse(res, "Failed to fetch default copies", 500);
  } finally {
    client.release();
  }
} 