import pool from "../config/dbConnection.js";
import { errorResponse, successResponse } from "../utils/index.js";

export async function createBankAccount(req, res) {
  const { accountType, accountName, openingBalance, isActive = true } = req.body;
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access - user or company not identified", 401);
  }

  if (!accountType || !accountName) {
    return errorResponse(res, "Account type and account name are required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const companyCheck = await client.query(
      `SELECT id FROM hisab."companies" WHERE id = $1 AND "userId" = $2`,
      [companyId, userId]
    );

    if (companyCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Company not found or unauthorized", 404);
    }

    const insertQuery = `
      INSERT INTO hisab."bankAccounts" (
        "userId", "companyId", "accountType", "accountName", 
        "currentBalance", "openingBalance", "isActive",
        "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const result = await client.query(insertQuery, [
      userId,
      companyId,
      accountType,
      accountName,
      openingBalance || 0,
      openingBalance || 0,
      isActive
    ]);

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Bank account created successfully",
      account: result.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error creating bank account", 500);
  } finally {
    client.release();
  }
}


export async function getBankAccounts(req, res) {
  const { includeInactive } = req.query;
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access - user or company not identified", 401);
  }

  const client = await pool.connect();

  try {
    let query = `
      SELECT * FROM hisab."bankAccounts" 
      WHERE "companyId" = $1 AND "deletedAt" IS NULL
    `;
    const params = [companyId];

    if (includeInactive !== 'true') {
      query += ` AND "isActive" = true`;
    }

    query += ` ORDER BY "createdAt" ASC`;

    const result = await client.query(query, params);

    return successResponse(res, {
      accounts: result.rows
    });

  } catch (error) {
    console.error(error);
    return errorResponse(res, "Error fetching bank accounts", 500);
  } finally {
    client.release();
  }
}

export async function updateBankAccount(req, res) {
  const { accountType, accountName, currentBalance, id, isActive } = req.body;
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access - user or company not identified", 401);
  }

  if (!id) {
    return errorResponse(res, "Account ID is required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const accountCheck = await client.query(
      `SELECT id FROM hisab."bankAccounts" 
       WHERE id = $1 AND "companyId" = $2 AND "deletedAt" IS NULL`,
      [id, companyId]
    );

    if (accountCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Account not found or unauthorized", 404);
    }

    const updateQuery = `
      UPDATE hisab."bankAccounts"
      SET 
        "accountType" = COALESCE($3, "accountType"),
        "accountName" = COALESCE($4, "accountName"),
        "currentBalance" = COALESCE($5, "currentBalance"),
        "isActive" = COALESCE($6, "isActive"),
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1 AND "companyId" = $2
      RETURNING *
    `;

    const result = await client.query(updateQuery, [
      id,
      companyId,
      accountType,
      accountName,
      currentBalance,
      isActive
    ]);

    await client.query("COMMIT");
    if (result.rows.length === 0) {
      return errorResponse(res, "Failed to update bank account", 500);
    }

    return successResponse(res, {
      message: "Bank account updated successfully",
      account: result.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error updating bank account", 500);
  } finally {
    client.release();
  }
}


export async function deleteBankAccount(req, res) {
  const { id } = req.query;
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access - user or company not identified", 401);
  }

  if (!id) {
    return errorResponse(res, "Account ID is required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verify account belongs to user and company, and isn't already deleted
    const accountCheck = await client.query(
      `SELECT id FROM hisab."bankAccounts" 
       WHERE id = $1 AND "companyId" = $2 AND "deletedAt" IS NULL`,
      [id, companyId]
    );

    if (accountCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Account not found or unauthorized", 404);
    }

    const deleteQuery = `
      UPDATE hisab."bankAccounts"
      SET 
        "deletedAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await client.query(deleteQuery, [id]);

    await client.query("COMMIT");

    if (result.rows.length === 0) {
      return errorResponse(res, "Failed to delete bank account", 500);
    }

    return successResponse(res, {
      message: "Bank account deleted successfully",
      account: result.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error deleting bank account", 500);
  } finally {
    client.release();
  }
}

export async function deactivateBankAccount(req, res) {
  const { id } = req.query;
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access - user or company not identified", 401);
  }

  if (!id) {
    return errorResponse(res, "Account ID is required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verify account belongs to user and company, and isn't deleted
    const accountCheck = await client.query(
      `SELECT id FROM hisab."bankAccounts" 
       WHERE id = $1 AND "companyId" = $2 AND "deletedAt" IS NULL`,
      [id,  companyId]
    );

    if (accountCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Account not found or unauthorized", 404);
    }

    const updateQuery = `
      UPDATE hisab."bankAccounts"
      SET 
        "isActive" = false,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await client.query(updateQuery, [id]);

    await client.query("COMMIT");

    if (result.rows.length === 0) {
      return errorResponse(res, "Failed to deactivate bank account", 500);
    }

    return successResponse(res, {
      message: "Bank account deactivated successfully",
      account: result.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error deactivating bank account", 500);
  } finally {
    client.release();
  }
}

export async function activateBankAccount(req, res) {
  const { id } = req.query;
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access - user or company not identified", 401);
  }

  if (!id) {
    return errorResponse(res, "Account ID is required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verify account belongs to user and company, and isn't deleted
    const accountCheck = await client.query(
      `SELECT id FROM hisab."bankAccounts" 
       WHERE id = $1 AND "companyId" = $2 AND "deletedAt" IS NULL`,
      [id, companyId]
    );

    if (accountCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Account not found or unauthorized", 404);
    }

    const updateQuery = `
      UPDATE hisab."bankAccounts"
      SET 
        "isActive" = true,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await client.query(updateQuery, [id]);

    await client.query("COMMIT");

    if (result.rows.length === 0) {
      return errorResponse(res, "Failed to activate bank account", 500);
    }

    return successResponse(res, {
      message: "Bank account activated successfully",
      account: result.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return errorResponse(res, "Error activating bank account", 500);
  } finally {
    client.release();
  }
}