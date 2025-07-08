import pool from "../config/dbConnection.js";
import { errorResponse, successResponse } from "../utils/index.js";

export async function createProduct(req, res) {
    const {
        name,
        itemType,
        itemCode,
        hsnCode,
        description,
        defaultInvoiceDescription,
        isInventoryTracked,
        isSerialized,
        unitOfMeasurementId,
        stockCategoryId,
        rate,
        isTaxInclusive,
        discount,
        taxCategoryId,
        openingStockQty,
        openingStockCostPerQty,
        serialNumbers
    } = req.body;

    const userId = req.currentUser?.id;
    const companyId = req.currentUser?.companyId;

    if (!userId || !companyId) {
        return errorResponse(res, "Unauthorized access", 401);
    }

    if (!name) {
        return errorResponse(res, "Product name is required", 400);
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const companyCheck = await client.query(
            `SELECT id FROM hisab."companies" WHERE id = $1`,
            [companyId]
        );

        if (companyCheck.rows.length === 0) {
            await client.query("ROLLBACK");
            return errorResponse(res, "Company not found", 404);
        }

        if (unitOfMeasurementId) {
            const uomCheck = await client.query(
                `SELECT id FROM hisab."unitOfMeasurements" WHERE id = $1`,
                [unitOfMeasurementId]
            );
            if (uomCheck.rows.length === 0) {
                await client.query("ROLLBACK");
                return errorResponse(res, "Unit of measurement not found", 404);
            }
        }

        if (taxCategoryId) {
            const taxCheck = await client.query(
                `SELECT id FROM hisab."taxCategories" WHERE id = $1`,
                [taxCategoryId]
            );
            if (taxCheck.rows.length === 0) {
                await client.query("ROLLBACK");
                return errorResponse(res, "Tax category not found", 404);
            }
        }

        if (stockCategoryId) {
            const stockCatCheck = await client.query(
                `SELECT id FROM hisab."stockCategories" 
                 WHERE id = $1 AND "companyId" = $2`,
                [stockCategoryId, companyId]
            );

            if (stockCatCheck.rows.length === 0) {
                await client.query("ROLLBACK");
                return errorResponse(res, "Stock category not found or invalid for this company", 404);
            }
        }

        const productQuery = `
            INSERT INTO hisab."products" (
                "companyId", "userId", "name", "itemType", "itemCode", "hsnCode", 
                "description", "defaultInvoiceDescription", "isInventoryTracked", 
                "isSerialized", "unitOfMeasurementId", "stockCategoryId",
                "rate", "isTaxInclusive", "discount", "taxCategoryId", "openingStockQty", 
                "currentStock", "openingStockCostPerQty"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            RETURNING *
        `;

        const productValues = [
            companyId,
            userId,
            name,
            itemType || 'product',
            itemCode,
            hsnCode,
            description,
            defaultInvoiceDescription,
            isInventoryTracked || false,
            isSerialized || false,
            unitOfMeasurementId || null,
            stockCategoryId || null,
            rate || 0,
            isTaxInclusive || false,
            discount || 0,
            taxCategoryId || null,
            openingStockQty || 0,
            openingStockQty || 0, // Set currentStock same as openingStockQty
            openingStockCostPerQty || 0
        ];

        const productResult = await client.query(productQuery, productValues);
        const product = productResult.rows[0];

        if (isSerialized && serialNumbers && serialNumbers.length > 0) {
            for (const serial of serialNumbers) {
                await client.query(
                    `INSERT INTO hisab."serialNumbers" (
                        "companyId", "productId", "serialNumber", "status"
                    ) VALUES ($1, $2, $3, 'in_stock')`,
                    [companyId, product.id, serial]
                );
            }
        }

        if (isInventoryTracked && openingStockQty > 0) {
            await client.query(
                `INSERT INTO hisab."inventoryTransactions" (
                    "companyId", "productId", "transactionType", "quantity", 
                    "unitCost", "totalValue", "referenceType"
                ) VALUES ($1, $2, 'opening_stock', $3, $4, $5, 'product')`,
                [
                    companyId,
                    product.id,
                    openingStockQty,
                    openingStockCostPerQty,
                    openingStockQty * (openingStockCostPerQty || 0)
                ]
            );
        }

        await client.query("COMMIT");

        const fullProduct = await getProductDetails(client, companyId, product.id);

        return successResponse(res, {
            message: "Product created successfully",
            product: fullProduct
        });

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error creating product:", error);
        return errorResponse(res, "Error creating product", 500);
    } finally {
        client.release();
    }
}

export async function updateProduct(req, res) {
    const updateData = req.body;
    const userId = req.currentUser?.id;
    const companyId = req.currentUser?.companyId;
    const { id } = updateData;

    if (!userId || !companyId) {
        return errorResponse(res, "Unauthorized access", 401);
    }

    if (!id) {
        return errorResponse(res, "Product ID is required", 400);
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const productCheck = await client.query(
            `SELECT id FROM hisab."products" 
             WHERE id = $1 AND "companyId" = $2`,
            [id, companyId]
        );

        if (productCheck.rows.length === 0) {
            await client.query("ROLLBACK");
            return errorResponse(res, "Product not found or unauthorized", 404);
        }

        if (updateData.unitOfMeasurementId) {
            const uomCheck = await client.query(
                `SELECT id FROM hisab."unitOfMeasurements" WHERE id = $1`,
                [updateData.unitOfMeasurementId]
            );
            if (uomCheck.rows.length === 0) {
                await client.query("ROLLBACK");
                return errorResponse(res, "Unit of measurement not found", 404);
            }
        }

        if (updateData.taxCategoryId) {
            const taxCheck = await client.query(
                `SELECT id FROM hisab."taxCategories" WHERE id = $1`,
                [updateData.taxCategoryId]
            );
            if (taxCheck.rows.length === 0) {
                await client.query("ROLLBACK");
                return errorResponse(res, "Tax category not found", 404);
            }
        }

        if (updateData.stockCategoryId) {
            const stockCatCheck = await client.query(
                `SELECT id FROM hisab."stockCategories" 
                 WHERE id = $1 AND "companyId" = $2`,
                [updateData.stockCategoryId, companyId]
            );
            if (stockCatCheck.rows.length === 0) {
                await client.query("ROLLBACK");
                return errorResponse(res, "Stock category not found or invalid for this company", 404);
            }
        }

        const updateFields = [];
        const updateValues = [];
        let paramCount = 1;

        const validFields = [
            "name", "itemType", "itemCode", "hsnCode", "description",
            "defaultInvoiceDescription", "isInventoryTracked", "isSerialized",
            "unitOfMeasurementId", "stockCategoryId", "rate",
            "isTaxInclusive", "discount", "taxCategoryId", "openingStockQty",
            "currentStock", "openingStockCostPerQty"
        ];

        for (const field of validFields) {
            if (updateData[field] !== undefined) {
                updateFields.push(`"${field}" = $${paramCount}`);
                // Convert empty string to NULL for integer fields
                updateValues.push(
                    (field === 'taxCategoryId' || field === 'unitOfMeasurementId' || field === 'stockCategoryId') &&
                        updateData[field] === "" ? null : updateData[field]
                );
                paramCount++;
            }
        }

        // Special handling for currentStock when openingStockQty is updated
        if (updateData.openingStockQty !== undefined && updateData.currentStock === undefined) {
            updateFields.push(`"currentStock" = $${paramCount}`);
            updateValues.push(updateData.openingStockQty);
            paramCount++;
        }

        updateFields.push(`"updatedAt" = CURRENT_TIMESTAMP`);
        updateFields.push(`"userId" = $${paramCount}`);
        updateValues.push(userId);
        paramCount++;

        if (updateFields.length === 2) {
            await client.query("ROLLBACK");
            return errorResponse(res, "No valid fields provided for update", 400);
        }

        const updateQuery = `
            UPDATE hisab."products"
            SET ${updateFields.join(", ")}
            WHERE id = $${paramCount} AND "companyId" = $${paramCount + 1}
            RETURNING *
        `;

        updateValues.push(id, companyId);
        const result = await client.query(updateQuery, updateValues);
        const updatedProduct = result.rows[0];

        if (updateData.isSerialized && updateData.serialNumbers) {
            await client.query(
                `DELETE FROM hisab."serialNumbers" 
                 WHERE "productId" = $1 AND "companyId" = $2`,
                [id, companyId]
            );

            for (const serial of updateData.serialNumbers) {
                await client.query(
                    `INSERT INTO hisab."serialNumbers" (
                        "companyId", "productId", "serialNumber", "status"
                    ) VALUES ($1, $2, $3, 'in_stock')`,
                    [companyId, id, serial]
                );
            }
        }

        await client.query("COMMIT");

        const fullProduct = await getProductDetails(client, companyId, id);

        return successResponse(res, {
            message: "Product updated successfully",
            product: fullProduct
        });

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error updating product:", error);
        return errorResponse(res, "Error updating product", 500);
    } finally {
        client.release();
    }
}

export async function deleteProduct(req, res) {
    const { id } = req.query;
    const userId = req.currentUser?.id;
    const companyId = req.currentUser?.companyId;

    if (!userId || !companyId) {
        return errorResponse(res, "Unauthorized access", 401);
    }

    if (!id) {
        return errorResponse(res, "Product ID is required", 400);
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const productCheck = await client.query(
            `SELECT id FROM hisab."products" 
             WHERE id = $1 AND "companyId" = $2`,
            [id, companyId]
        );

        if (productCheck.rows.length === 0) {
            await client.query("ROLLBACK");
            return errorResponse(res, "Product not found or unauthorized", 404);
        }

        const result = await client.query(
            `UPDATE hisab."products"
             SET "deletedAt" = CURRENT_TIMESTAMP
             WHERE id = $1 AND "companyId" = $2
             RETURNING *`,
            [id, companyId]
        );

        await client.query("COMMIT");

        return successResponse(res, {
            message: "Product deleted successfully",
            product: result.rows[0]
        });

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error deleting product:", error);
        return errorResponse(res, "Error deleting product", 500);
    } finally {
        client.release();
    }
}

export async function getProduct(req, res) {
    const { id } = req.query;
    const companyId = req.currentUser?.companyId;

    if (!companyId) {
        return errorResponse(res, "Unauthorized access", 401);
    }

    if (!id) {
        return errorResponse(res, "Product ID is required", 400);
    }

    const client = await pool.connect();

    try {
        const fullProduct = await getProductDetails(client, companyId, id);

        if (!fullProduct) {
            return errorResponse(res, "Product not found or unauthorized", 404);
        }

        return successResponse(res, {
            product: fullProduct
        });

    } catch (error) {
        console.error("Error fetching product:", error);
        return errorResponse(res, "Error fetching product", 500);
    } finally {
        client.release();
    }
}

export async function listProducts(req, res) {
    const companyId = req.currentUser?.companyId;
    const {
        search,
        stockCategoryId,
        itemType,
        taxCategoryId,
        unitOfMeasurementId,
        itemCode,
        hsnCode,
        page = 1,
        limit = 20
    } = req.query;

    if (!companyId) {
        return errorResponse(res, "Unauthorized access", 401);
    }

    const client = await pool.connect();

    try {
        let query = `
            SELECT 
                p.id, p.name, p."itemCode", p."hsnCode", p.rate, 
                p."isInventoryTracked", p."currentStock", p."isSerialized",
                p."createdAt", p."updatedAt", p."itemType",
                uom.id as "unitOfMeasurementId", uom.name as "unitOfMeasurementName",
                sc.id as "stockCategoryId", sc.name as "stockCategoryName",
                tc.id as "taxCategoryId", tc.name as "taxCategoryName", tc.rate as "taxRate"
            FROM hisab."products" p
            LEFT JOIN hisab."unitOfMeasurements" uom ON p."unitOfMeasurementId" = uom.id
            LEFT JOIN hisab."stockCategories" sc ON 
                p."stockCategoryId" = sc.id AND 
                p."companyId" = sc."companyId"
            LEFT JOIN hisab."taxCategories" tc ON p."taxCategoryId" = tc.id
            WHERE p."companyId" = $1 AND p."deletedAt" IS NULL
        `;

        const queryParams = [companyId];
        let paramCount = 2;

        if (search) {
            query += ` AND (p.name ILIKE $${paramCount} OR p."itemCode" ILIKE $${paramCount} OR p."hsnCode" ILIKE $${paramCount})`;
            queryParams.push(`%${search}%`);
            paramCount++;
        }

        if (stockCategoryId) {
            if (Array.isArray(stockCategoryId)) {
                query += ` AND p."stockCategoryId" = ANY($${paramCount})`;
                queryParams.push(stockCategoryId);
                paramCount++;
            } else {
                query += ` AND p."stockCategoryId" = $${paramCount}`;
                queryParams.push(stockCategoryId);
                paramCount++;
            }
        }

        if (itemType) {
            if (Array.isArray(itemType)) {
                query += ` AND p."itemType" = ANY($${paramCount})`;
                queryParams.push(itemType);
                paramCount++;
            } else {
                query += ` AND p."itemType" = $${paramCount}`;
                queryParams.push(itemType);
                paramCount++;
            }
        }

        if (taxCategoryId) {
            if (Array.isArray(taxCategoryId)) {
                query += ` AND p."taxCategoryId" = ANY($${paramCount})`;
                queryParams.push(taxCategoryId);
                paramCount++;
            } else {
                query += ` AND p."taxCategoryId" = $${paramCount}`;
                queryParams.push(taxCategoryId);
                paramCount++;
            }
        }

        if (unitOfMeasurementId) {
            if (Array.isArray(unitOfMeasurementId)) {
                query += ` AND p."unitOfMeasurementId" = ANY($${paramCount})`;
                queryParams.push(unitOfMeasurementId);
                paramCount++;
            } else {
                query += ` AND p."unitOfMeasurementId" = $${paramCount}`;
                queryParams.push(unitOfMeasurementId);
                paramCount++;
            }
        }

        if (itemCode) {
            if (Array.isArray(itemCode)) {
                query += ` AND p."itemCode" = ANY($${paramCount})`;
                queryParams.push(itemCode);
                paramCount++;
            } else {
                query += ` AND p."itemCode" = $${paramCount}`;
                queryParams.push(itemCode);
                paramCount++;
            }
        }

        if (hsnCode) {
            if (Array.isArray(hsnCode)) {
                query += ` AND p."hsnCode" = ANY($${paramCount})`;
                queryParams.push(hsnCode);
                paramCount++;
            } else {
                query += ` AND p."hsnCode" = $${paramCount}`;
                queryParams.push(hsnCode);
                paramCount++;
            }
        }

        query += `
            ORDER BY p."createdAt" DESC
            LIMIT $${paramCount} OFFSET $${paramCount + 1}
        `;
        queryParams.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

        const result = await client.query(query, queryParams);

        let countQuery = `
            SELECT COUNT(*) FROM hisab."products" p
            LEFT JOIN hisab."unitOfMeasurements" uom ON p."unitOfMeasurementId" = uom.id
            LEFT JOIN hisab."stockCategories" sc ON 
                p."stockCategoryId" = sc.id AND 
                p."companyId" = sc."companyId"
            LEFT JOIN hisab."taxCategories" tc ON p."taxCategoryId" = tc.id
            WHERE p."companyId" = $1 AND p."deletedAt" IS NULL
        `;
        const countParams = [companyId];
        paramCount = 2;

        if (search) {
            countQuery += ` AND (p.name ILIKE $${paramCount} OR p."itemCode" ILIKE $${paramCount} OR p."hsnCode" ILIKE $${paramCount})`;
            countParams.push(`%${search}%`);
            paramCount++;
        }

        if (stockCategoryId) {
            if (Array.isArray(stockCategoryId)) {
                countQuery += ` AND p."stockCategoryId" = ANY($${paramCount})`;
                countParams.push(stockCategoryId);
                paramCount++;
            } else {
                countQuery += ` AND p."stockCategoryId" = $${paramCount}`;
                countParams.push(stockCategoryId);
                paramCount++;
            }
        }

        if (itemType) {
            if (Array.isArray(itemType)) {
                countQuery += ` AND p."itemType" = ANY($${paramCount})`;
                countParams.push(itemType);
                paramCount++;
            } else {
                countQuery += ` AND p."itemType" = $${paramCount}`;
                countParams.push(itemType);
                paramCount++;
            }
        }

        if (taxCategoryId) {
            if (Array.isArray(taxCategoryId)) {
                countQuery += ` AND p."taxCategoryId" = ANY($${paramCount})`;
                countParams.push(taxCategoryId);
                paramCount++;
            } else {
                countQuery += ` AND p."taxCategoryId" = $${paramCount}`;
                countParams.push(taxCategoryId);
                paramCount++;
            }
        }

        if (unitOfMeasurementId) {
            if (Array.isArray(unitOfMeasurementId)) {
                countQuery += ` AND p."unitOfMeasurementId" = ANY($${paramCount})`;
                countParams.push(unitOfMeasurementId);
                paramCount++;
            } else {
                countQuery += ` AND p."unitOfMeasurementId" = $${paramCount}`;
                countParams.push(unitOfMeasurementId);
                paramCount++;
            }
        }

        if (itemCode) {
            if (Array.isArray(itemCode)) {
                countQuery += ` AND p."itemCode" = ANY($${paramCount})`;
                countParams.push(itemCode);
                paramCount++;
            } else {
                countQuery += ` AND p."itemCode" = $${paramCount}`;
                countParams.push(itemCode);
                paramCount++;
            }
        }

        if (hsnCode) {
            if (Array.isArray(hsnCode)) {
                countQuery += ` AND p."hsnCode" = ANY($${paramCount})`;
                countParams.push(hsnCode);
                paramCount++;
            } else {
                countQuery += ` AND p."hsnCode" = $${paramCount}`;
                countParams.push(hsnCode);
                paramCount++;
            }
        }

        const countResult = await client.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        return successResponse(res, {
            products: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error("Error listing products:", error);
        return errorResponse(res, "Error listing products", 500);
    } finally {
        client.release();
    }
}

async function getProductDetails(client, companyId, productId) {
    const productQuery = `
        SELECT 
            p.*,
            uom.name as "unitOfMeasurementName",
            uom.symbol as "unitOfMeasurementSymbol",
            sc.name as "stockCategoryName",
            sc.description as "stockCategoryDescription",
            tc.name as "taxCategoryName", 
            tc.rate as "taxRate"
        FROM hisab."products" p
        LEFT JOIN hisab."unitOfMeasurements" uom ON p."unitOfMeasurementId" = uom.id
        LEFT JOIN hisab."stockCategories" sc ON 
            p."stockCategoryId" = sc.id AND 
            p."companyId" = sc."companyId"
        LEFT JOIN hisab."taxCategories" tc ON p."taxCategoryId" = tc.id
        WHERE p.id = $1 AND p."companyId" = $2 AND p."deletedAt" IS NULL
    `;

    const productResult = await client.query(productQuery, [productId, companyId]);

    if (productResult.rows.length === 0) {
        return null;
    }

    const product = productResult.rows[0];

    if (product.isSerialized) {
        const serialsQuery = `
            SELECT * FROM hisab."serialNumbers"
            WHERE "productId" = $1 AND "companyId" = $2
            ORDER BY "serialNumber"
        `;
        const serialsResult = await client.query(serialsQuery, [productId, companyId]);
        product.serialNumbers = serialsResult.rows;
        product.serialCount = serialsResult.rows.length;
    }

    return product;
}