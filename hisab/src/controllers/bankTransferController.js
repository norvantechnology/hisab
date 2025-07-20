import pool from "../config/dbConnection.js";
import { errorResponse, successResponse } from "../utils/index.js";

export async function createBankTransfer(req, res) {
  const { fromBankId, toBankId, date, amount, description, referenceNumber } = req.body;
  const { companyId, id: currentUserId } = req.currentUser || {};

  // Validate required fields
  if (!companyId || !currentUserId) return errorResponse(res, "Unauthorized access", 401);
  if (!fromBankId || !toBankId || !date || !amount) {
    return errorResponse(res, "Required fields are missing", 400);
  }
  if (fromBankId === toBankId) {
    return errorResponse(res, "Cannot transfer to the same account", 400);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Lock both bank accounts
    const banksQuery = await client.query(
      `SELECT id, "currentBalance" FROM hisab."bankAccounts" 
       WHERE id IN ($1, $2) AND "companyId" = $3 AND "isActive" = TRUE
       ORDER BY id = $1 DESC FOR UPDATE`,
      [fromBankId, toBankId, companyId]
    );

    if (banksQuery.rows.length !== 2) {
      await client.query("ROLLBACK");
      return errorResponse(res, "One or both bank accounts not found", 404);
    }
    console.log("banksQuery", banksQuery.rows)
    const fromBank = banksQuery.rows.find(b => b.id === fromBankId);
    const toBank = banksQuery.rows.find(b => b.id === toBankId);
    console.log("fromBank", fromBank)

    const fromBankBalance = parseFloat(fromBank.currentBalance);
    const transferAmount = parseFloat(amount);

    // 2. Check sufficient balance
    if (fromBankBalance < transferAmount) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Insufficient balance in source account", 400);
    }

    // 3. Generate transfer number
    const year = new Date().getFullYear();
    const countResult = await client.query(
      `SELECT COUNT(*) FROM hisab."bankTransfers" 
       WHERE "companyId" = $1 AND EXTRACT(YEAR FROM "createdAt") = $2`,
      [companyId, year]
    );
    const transferNumber = `BT-${year}-${(parseInt(countResult.rows[0].count) + 1).toString().padStart(4, '0')}`;

    // 4. Create transfer record
    const transferResult = await client.query(
      `INSERT INTO hisab."bankTransfers" (
        "transferNumber", "companyId", "fromBankId", "toBankId", "date",
        "amount", "description", "referenceNumber", "createdBy"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        transferNumber, companyId, fromBankId, toBankId, date,
        transferAmount, description, referenceNumber, currentUserId
      ]
    );

    // 5. Update bank balances
    await client.query(
      `UPDATE hisab."bankAccounts" 
       SET "currentBalance" = "currentBalance" - $1
       WHERE id = $2`,
      [transferAmount, fromBankId]
    );

    await client.query(
      `UPDATE hisab."bankAccounts" 
       SET "currentBalance" = "currentBalance" + $1
       WHERE id = $2`,
      [transferAmount, toBankId]
    );

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Bank transfer created successfully",
      transfer: transferResult.rows[0],
      balanceChanges: {
        fromBank: {
          previousBalance: fromBankBalance,
          newBalance: fromBankBalance - transferAmount
        },
        toBank: {
          previousBalance: parseFloat(toBank.currentBalance),
          newBalance: parseFloat(toBank.currentBalance) + transferAmount
        }
      }
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Bank transfer creation error:", error);
    return errorResponse(res, "Failed to create bank transfer", 500);
  } finally {
    client.release();
  }
}

export async function getBankTransferDetails(req, res) {
  const { companyId } = req.currentUser || {};
  const { id } = req.query;

  if (!companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();
  try {
    const query = `
      SELECT 
        bt.*,
        fb."accountName" as "fromBankName",
        fb."accountType" as "fromBankType",
        tb."accountName" as "toBankName",
        tb."accountType" as "toBankType",
        u."name" as "createdByName"
      FROM hisab."bankTransfers" bt
      JOIN hisab."bankAccounts" fb ON bt."fromBankId" = fb."id"
      JOIN hisab."bankAccounts" tb ON bt."toBankId" = tb."id"
      LEFT JOIN hisab."users" u ON bt."createdBy" = u."id"
      WHERE bt."id" = $1 AND bt."companyId" = $2 AND bt."deletedAt" IS NULL
    `;

    const result = await client.query(query, [id, companyId]);

    if (result.rows.length === 0) {
      return errorResponse(res, "Transfer not found", 404);
    }

    return successResponse(res, {
      transfer: result.rows[0]
    });

  } catch (error) {
    console.error("Get bank transfer error:", error);
    return errorResponse(res, "Error fetching transfer details", 500);
  } finally {
    client.release();
  }
}

export async function updateBankTransfer(req, res) {
  const { id, date, amount, description, referenceNumber, fromBankId, toBankId } = req.body;
  const { companyId, id: currentUserId } = req.currentUser || {};

  if (!companyId || !currentUserId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  // Validate if trying to change bank accounts
  if (fromBankId && toBankId && fromBankId === toBankId) {
    return errorResponse(res, "Cannot transfer to the same account", 400);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Get and lock existing transfer with bank accounts
    const transferQuery = await client.query(
      `SELECT bt.*, fb."currentBalance" as "fromBankBalance", tb."currentBalance" as "toBankBalance"
       FROM hisab."bankTransfers" bt
       JOIN hisab."bankAccounts" fb ON bt."fromBankId" = fb."id"
       JOIN hisab."bankAccounts" tb ON bt."toBankId" = tb."id"
       WHERE bt."id" = $1 AND bt."companyId" = $2 AND bt."deletedAt" IS NULL
       FOR UPDATE`,
      [id, companyId]
    );

    if (transferQuery.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Transfer not found", 404);
    }

    const oldTransfer = transferQuery.rows[0];
    const oldAmount = parseFloat(oldTransfer.amount);
    const newAmount = amount ? parseFloat(amount) : oldAmount;
    const newFromBankId = fromBankId || oldTransfer.fromBankId;
    const newToBankId = toBankId || oldTransfer.toBankId;

    // 2. Check if bank accounts are being changed
    const changingBanks = (fromBankId && fromBankId !== oldTransfer.fromBankId) || 
                         (toBankId && toBankId !== oldTransfer.toBankId);

    if (changingBanks) {
      // Verify new bank accounts exist and are active
      var banksQuery = await client.query(
        `SELECT id, "currentBalance" FROM hisab."bankAccounts" 
         WHERE id IN ($1, $2) AND "companyId" = $3 AND "isActive" = TRUE
         FOR UPDATE`,
        [newFromBankId, newToBankId, companyId]
      );

      if (banksQuery.rows.length !== 2) {
        await client.query("ROLLBACK");
        return errorResponse(res, "One or both new bank accounts not found", 404);
      }
    }

    // 3. Handle amount changes and/or bank account changes
    if (amount || changingBanks) {
      const difference = newAmount - oldAmount;

      // If changing banks, we need to fully reverse the old transfer and apply the new one
      if (changingBanks) {
        // Reverse the old transfer first
        // Add back to original from account
        await client.query(
          `UPDATE hisab."bankAccounts" 
           SET "currentBalance" = "currentBalance" + $1
           WHERE id = $2`,
          [oldAmount, oldTransfer.fromBankId]
        );

        // Subtract from original to account
        await client.query(
          `UPDATE hisab."bankAccounts" 
           SET "currentBalance" = "currentBalance" - $1
           WHERE id = $2`,
          [oldAmount, oldTransfer.toBankId]
        );

        // Then apply the new transfer
        // Check if enough balance in new from account
        const newFromBank = (changingBanks && fromBankId) 
          ? banksQuery.rows.find(b => b.id === newFromBankId)
          : { currentBalance: oldTransfer.fromBankBalance };
          
        const newFromBankBalance = parseFloat(newFromBank.currentBalance);
        if (newFromBankBalance < newAmount) {
          await client.query("ROLLBACK");
          return errorResponse(res, "Insufficient balance in new source account", 400);
        }

        // Deduct from new from account
        await client.query(
          `UPDATE hisab."bankAccounts" 
           SET "currentBalance" = "currentBalance" - $1
           WHERE id = $2`,
          [newAmount, newFromBankId]
        );

        // Add to new to account
        await client.query(
          `UPDATE hisab."bankAccounts" 
           SET "currentBalance" = "currentBalance" + $1
           WHERE id = $2`,
          [newAmount, newToBankId]
        );
      } else if (amount) {
        // Only amount is changing, adjust the difference
        // Check if enough balance in from account
        const fromBankBalance = parseFloat(oldTransfer.fromBankBalance);
        if (fromBankBalance < difference) {
          await client.query("ROLLBACK");
          return errorResponse(res, "Insufficient balance in source account", 400);
        }

        // Update from bank balance
        await client.query(
          `UPDATE hisab."bankAccounts" 
           SET "currentBalance" = "currentBalance" - $1
           WHERE id = $2`,
          [difference, oldTransfer.fromBankId]
        );

        // Update to bank balance
        await client.query(
          `UPDATE hisab."bankAccounts" 
           SET "currentBalance" = "currentBalance" + $1
           WHERE id = $2`,
          [difference, oldTransfer.toBankId]
        );
      }
    }

    // 4. Update transfer record
    const updateResult = await client.query(
      `UPDATE hisab."bankTransfers" SET
        "fromBankId" = $1,
        "toBankId" = $2,
        "date" = $3,
        "amount" = $4,
        "description" = $5,
        "referenceNumber" = $6,
        "updatedAt" = NOW()
       WHERE id = $7 AND "companyId" = $8
       RETURNING *`,
      [
        newFromBankId,
        newToBankId,
        date || oldTransfer.date,
        newAmount,
        description || oldTransfer.description,
        referenceNumber || oldTransfer.referenceNumber,
        id,
        companyId
      ]
    );

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Bank transfer updated successfully",
      transfer: updateResult.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Bank transfer update error:", error);
    return errorResponse(res, "Failed to update bank transfer", 500);
  } finally {
    client.release();
  }
}

export async function deleteBankTransfer(req, res) {
  const { id } = req.query;
  const { companyId, id: currentUserId } = req.currentUser || {};

  if (!companyId || !currentUserId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Get and lock transfer with bank accounts
    const transferQuery = await client.query(
      `SELECT bt.*, fb."currentBalance" as "fromBankBalance", tb."currentBalance" as "toBankBalance"
       FROM hisab."bankTransfers" bt
       JOIN hisab."bankAccounts" fb ON bt."fromBankId" = fb."id"
       JOIN hisab."bankAccounts" tb ON bt."toBankId" = tb."id"
       WHERE bt."id" = $1 AND bt."companyId" = $2 AND bt."deletedAt" IS NULL
       FOR UPDATE`,
      [id, companyId]
    );

    if (transferQuery.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Transfer not found", 404);
    }

    const transfer = transferQuery.rows[0];
    const transferAmount = parseFloat(transfer.amount);

    // 2. Reverse the transfer amounts
    // Add back to from account
    await client.query(
      `UPDATE hisab."bankAccounts" 
       SET "currentBalance" = "currentBalance" + $1
       WHERE id = $2`,
      [transferAmount, transfer.fromBankId]
    );

    // Subtract from to account
    await client.query(
      `UPDATE hisab."bankAccounts" 
       SET "currentBalance" = "currentBalance" - $1
       WHERE id = $2`,
      [transferAmount, transfer.toBankId]
    );

    // 3. Soft delete transfer
    const deleteResult = await client.query(
      `UPDATE hisab."bankTransfers" 
       SET "deletedAt" = NOW()
       WHERE id = $1 AND "companyId" = $2 
       RETURNING *`,
      [id, companyId]
    );

    await client.query("COMMIT");

    return successResponse(res, {
      message: "Bank transfer deleted successfully",
      transfer: deleteResult.rows[0],
      balanceChanges: {
        fromBank: {
          amountAdded: transferAmount
        },
        toBank: {
          amountSubtracted: transferAmount
        }
      }
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Bank transfer deletion error:", error);
    return errorResponse(res, "Error deleting bank transfer", 500);
  } finally {
    client.release();
  }
}

export async function listBankTransfers(req, res) {
  const { companyId } = req.currentUser || {};
  const {
    page = 1,
    limit = 10,
    startDate,
    endDate,
    fromBankAccountId,
    toBankAccountId
  } = req.query;

  if (!companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();
  try {
    // Build base query
    let query = `
      SELECT 
        bt.id, bt."transferNumber", bt."fromBankId", bt."toBankId",
        bt.date, bt.amount, bt.description, bt."referenceNumber",
        bt."createdAt", fb."accountName" as "fromBankName",
        tb."accountName" as "toBankName", u."name" as "createdByName"
      FROM hisab."bankTransfers" bt
      JOIN hisab."bankAccounts" fb ON bt."fromBankId" = fb."id"
      JOIN hisab."bankAccounts" tb ON bt."toBankId" = tb."id"
      LEFT JOIN hisab."users" u ON bt."createdBy" = u."id"
      WHERE bt."companyId" = $1 AND bt."deletedAt" IS NULL
    `;

    const params = [companyId];
    let paramIndex = 2;

    // Add date filter if provided
    if (startDate && endDate) {
      query += ` AND bt.date BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      params.push(startDate, endDate);
      paramIndex += 2;
    }

    // Add from bank account filter if provided
    if (fromBankAccountId) {
      query += ` AND bt."fromBankId" = $${paramIndex}`;
      params.push(fromBankAccountId);
      paramIndex++;
    }

    // Add to bank account filter if provided
    if (toBankAccountId) {
      query += ` AND bt."toBankId" = $${paramIndex}`;
      params.push(toBankAccountId);
      paramIndex++;
    }

    // Build count query separately
    let countQuery = `
      SELECT COUNT(*) 
      FROM hisab."bankTransfers" bt
      JOIN hisab."bankAccounts" fb ON bt."fromBankId" = fb."id"
      JOIN hisab."bankAccounts" tb ON bt."toBankId" = tb."id"
      WHERE bt."companyId" = $1 AND bt."deletedAt" IS NULL
    `;
    
    const countParams = [companyId];
    let countParamIndex = 2;
    
    if (startDate && endDate) {
      countQuery += ` AND bt.date BETWEEN $${countParamIndex} AND $${countParamIndex + 1}`;
      countParams.push(startDate, endDate);
      countParamIndex += 2;
    }
    
    if (fromBankAccountId) {
      countQuery += ` AND bt."fromBankId" = $${countParamIndex}`;
      countParams.push(fromBankAccountId);
      countParamIndex++;
    }
    
    if (toBankAccountId) {
      countQuery += ` AND bt."toBankId" = $${countParamIndex}`;
      countParams.push(toBankAccountId);
      countParamIndex++;
    }

    const countResult = await client.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    // Add pagination to main query
    query += `
      ORDER BY bt.date DESC, bt."createdAt" DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, (page - 1) * limit);

    const result = await client.query(query, params);

    return successResponse(res, {
      transfers: result.rows,
      pagination: {
        total,
        totalPages,
        currentPage: parseInt(page),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error("List bank transfers error:", error);
    return errorResponse(res, "Failed to list bank transfers", 500);
  } finally {
    client.release();
  }
}