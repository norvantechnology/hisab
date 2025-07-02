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
        variants,
        categories
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

        // Verify company exists
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

        // Verify tax category belongs to company if provided
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

        // Insert main product
        const productQuery = `
            INSERT INTO hisab."products" (
                "companyId", "userId", "name", "itemType", "itemCode", "hsnCode", 
                "description", "defaultInvoiceDescription", "isInventoryTracked", 
                "isSerialized", "unitOfMeasurementId", "stockCategoryId", "rate", 
                "isTaxInclusive", "discount", "taxCategoryId", "openingStockQty", 
                "openingStockCostPerQty"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
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
            stockCategoryId,
            rate || 0,
            isTaxInclusive || false,
            discount || 0,
            taxCategoryId || null, 
            openingStockQty || 0,
            openingStockCostPerQty || 0
        ];

        const productResult = await client.query(productQuery, productValues);
        const product = productResult.rows[0];

        // Handle variants if provided
        let insertedVariants = [];
        if (variants && variants.length > 0) {
            for (const variant of variants) {
                const variantQuery = `
          INSERT INTO hisab."productVariants" (
            "companyId", "productId", "variantName", "sku", "barcode", 
            "priceAdjustment", "currentStock"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `;

                const variantValues = [
                    companyId,
                    product.id,
                    variant.variantName,
                    variant.sku,
                    variant.barcode,
                    variant.priceAdjustment || 0,
                    openingStockQty || 0
                ];

                const variantResult = await client.query(variantQuery, variantValues);
                insertedVariants.push(variantResult.rows[0]);

                // If product is serialized and variants are provided
                if (isSerialized && variant.serialNumbers) {
                    for (const serial of variant.serialNumbers) {
                        await client.query(
                            `INSERT INTO hisab."serialNumbers" (
                "companyId", "productId", "variantId", "serialNumber", "status"
              ) VALUES ($1, $2, $3, $4, 'in_stock')`,
                            [companyId, product.id, variantResult.rows[0].id, serial]
                        );
                    }
                }
            }
        }

        // Handle categories if provided
        if (categories && categories.length > 0) {
            for (const categoryId of categories) {
                // Verify category belongs to company
                const categoryCheck = await client.query(
                    `SELECT id FROM hisab."productCategories" 
           WHERE id = $1 AND "companyId" = $2`,
                    [categoryId, companyId]
                );

                if (categoryCheck.rows.length > 0) {
                    await client.query(
                        `INSERT INTO hisab."productCategoryMappings" (
              "companyId", "productId", "categoryId"
            ) VALUES ($1, $2, $3)`,
                        [companyId, product.id, categoryId]
                    );
                }
            }
        }

        // Create inventory transaction for opening stock if applicable
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

        // Get full product details with relationships
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
    const { productId } = updateData;

    if (!userId || !companyId) {
        return errorResponse(res, "Unauthorized access", 401);
    }

    if (!productId) {
        return errorResponse(res, "Product ID is required", 400);
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Verify product exists and belongs to company
        const productCheck = await client.query(
            `SELECT id FROM hisab."products" 
             WHERE id = $1 AND "companyId" = $2`,
            [productId, companyId]
        );

        if (productCheck.rows.length === 0) {
            await client.query("ROLLBACK");
            return errorResponse(res, "Product not found or unauthorized", 404);
        }

        // Verify unit of measurement if being updated
        if (updateData.unitOfMeasurementId !== undefined) {
            const uomCheck = await client.query(
                `SELECT id FROM hisab."unitOfMeasurements" WHERE id = $1`,
                [updateData.unitOfMeasurementId]
            );
            if (uomCheck.rows.length === 0) {
                await client.query("ROLLBACK");
                return errorResponse(res, "Unit of measurement not found", 404);
            }
        }

        // Verify tax category if being updated
        if (updateData.taxCategoryId !== undefined) {
            const taxCheck = await client.query(
                `SELECT id FROM hisab."taxCategories" WHERE id = $1`,
                [updateData.taxCategoryId]
            );
            if (taxCheck.rows.length === 0) {
                await client.query("ROLLBACK");
                return errorResponse(res, "Tax category not found", 404);
            }
        }

        // Verify stock category if being updated
        if (updateData.stockCategoryId !== undefined) {
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

        // Build update query dynamically based on provided fields
        const updateFields = [];
        const updateValues = [];
        let paramCount = 1;

        const validFields = [
            "name", "itemType", "itemCode", "hsnCode", "description",
            "defaultInvoiceDescription", "isInventoryTracked", "isSerialized",
            "unitOfMeasurementId", "stockCategoryId", "rate", "isTaxInclusive",
            "discount", "taxCategoryId", "openingStockQty", "openingStockCostPerQty"
        ];

        for (const field of validFields) {
            if (updateData[field] !== undefined) {
                updateFields.push(`"${field}" = $${paramCount}`);
                updateValues.push(updateData[field]);
                paramCount++;
            }
        }

        // Add updatedAt and userId
        updateFields.push(`"updatedAt" = CURRENT_TIMESTAMP`);
        updateFields.push(`"userId" = $${paramCount}`);
        updateValues.push(userId);
        paramCount++;

        if (updateFields.length === 2) { // Only updatedAt and userId were added
            await client.query("ROLLBACK");
            return errorResponse(res, "No valid fields provided for update", 400);
        }

        const updateQuery = `
            UPDATE hisab."products"
            SET ${updateFields.join(", ")}
            WHERE id = $${paramCount} AND "companyId" = $${paramCount + 1}
            RETURNING *
        `;

        updateValues.push(productId, companyId);
        const result = await client.query(updateQuery, updateValues);
        const updatedProduct = result.rows[0];

        // Handle variants update if provided
        if (updateData.variants) {
            // First delete all existing variants (cascade will handle serial numbers)
            await client.query(
                `DELETE FROM hisab."productVariants" 
                 WHERE "productId" = $1 AND "companyId" = $2`,
                [productId, companyId]
            );

            // Insert new variants
            for (const variant of updateData.variants) {
                await client.query(
                    `INSERT INTO hisab."productVariants" (
                        "companyId", "productId", "variantName", "sku", "barcode", 
                        "priceAdjustment", "currentStock"
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        companyId,
                        productId,
                        variant.variantName,
                        variant.sku,
                        variant.barcode,
                        variant.priceAdjustment || 0,
                        variant.currentStock || 0
                    ]
                );
            }
        }

        // Handle categories update if provided
        if (updateData.categories) {
            // Delete existing category mappings
            await client.query(
                `DELETE FROM hisab."productCategoryMappings" 
                 WHERE "productId" = $1 AND "companyId" = $2`,
                [productId, companyId]
            );

            // Insert new category mappings
            for (const categoryId of updateData.categories) {
                const categoryCheck = await client.query(
                    `SELECT id FROM hisab."productCategories" 
                     WHERE id = $1 AND "companyId" = $2`,
                    [categoryId, companyId]
                );

                if (categoryCheck.rows.length > 0) {
                    await client.query(
                        `INSERT INTO hisab."productCategoryMappings" (
                            "companyId", "productId", "categoryId"
                        ) VALUES ($1, $2, $3)`,
                        [companyId, productId, categoryId]
                    );
                }
            }
        }

        await client.query("COMMIT");

        // Get full updated product details
        const fullProduct = await getProductDetails(client, companyId, productId);

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
    const { productId } = req.query;
    const userId = req.currentUser?.id;
    const companyId = req.currentUser?.companyId;

    if (!userId || !companyId) {
        return errorResponse(res, "Unauthorized access", 401);
    }

    if (!productId) {
        return errorResponse(res, "Product ID is required", 400);
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Verify product exists and belongs to company
        const productCheck = await client.query(
            `SELECT id FROM hisab."products" 
       WHERE id = $1 AND "companyId" = $2`,
            [productId, companyId]
        );

        if (productCheck.rows.length === 0) {
            await client.query("ROLLBACK");
            return errorResponse(res, "Product not found or unauthorized", 404);
        }

        // Soft delete the product
        const result = await client.query(
            `UPDATE hisab."products"
       SET "deletedAt" = CURRENT_TIMESTAMP
       WHERE id = $1 AND "companyId" = $2
       RETURNING *`,
            [productId, companyId]
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
    const { productId } = req.query;
    const companyId = req.currentUser?.companyId;

    if (!companyId) {
        return errorResponse(res, "Unauthorized access", 401);
    }

    if (!productId) {
        return errorResponse(res, "Product ID is required", 400);
    }

    const client = await pool.connect();

    try {
        const fullProduct = await getProductDetails(client, companyId, productId);

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
    const { search, categoryId, stockCategoryId, page = 1, limit = 20 } = req.query;

    if (!companyId) {
        return errorResponse(res, "Unauthorized access", 401);
    }

    const client = await pool.connect();

    try {
        let query = `
            SELECT 
                p.id, p.name, p."itemCode", p."hsnCode", p.rate, 
                p."isInventoryTracked", p."currentStock",
                p."createdAt", p."updatedAt",
                uom.name as "unitOfMeasurementName",
                sc.name as "stockCategoryName",
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

        // Add search filter if provided
        if (search) {
            query += ` AND (p.name ILIKE $${paramCount} OR p."itemCode" ILIKE $${paramCount})`;
            queryParams.push(`%${search}%`);
            paramCount++;
        }

        // Add category filter if provided
        if (categoryId) {
            query += `
                AND p.id IN (
                    SELECT "productId" FROM hisab."productCategoryMappings" 
                    WHERE "companyId" = $1 AND "categoryId" = $${paramCount}
                )
            `;
            queryParams.push(categoryId);
            paramCount++;
        }

        // Add stock category filter if provided
        if (stockCategoryId) {
            query += ` AND p."stockCategoryId" = $${paramCount}`;
            queryParams.push(stockCategoryId);
            paramCount++;
        }

        // Add pagination
        query += `
            ORDER BY p."createdAt" DESC
            LIMIT $${paramCount} OFFSET $${paramCount + 1}
        `;
        queryParams.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

        const result = await client.query(query, queryParams);

        // Get total count for pagination
        let countQuery = `
            SELECT COUNT(*) FROM hisab."products" p
            WHERE p."companyId" = $1 AND p."deletedAt" IS NULL
        `;
        const countParams = [companyId];
        paramCount = 2;

        if (search) {
            countQuery += ` AND (p.name ILIKE $${paramCount} OR p."itemCode" ILIKE $${paramCount})`;
            countParams.push(`%${search}%`);
            paramCount++;
        }

        if (categoryId) {
            countQuery += `
                AND p.id IN (
                    SELECT "productId" FROM hisab."productCategoryMappings" 
                    WHERE "companyId" = $1 AND "categoryId" = $${paramCount}
                )
            `;
            countParams.push(categoryId);
            paramCount++;
        }

        if (stockCategoryId) {
            countQuery += ` AND p."stockCategoryId" = $${paramCount}`;
            countParams.push(stockCategoryId);
            paramCount++;
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

// Helper function to get full product details with relationships
async function getProductDetails(client, companyId, productId) {
    // Get main product info with joined shared resources
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

    // Get variants (simplified without COUNT)
    const variantsQuery = `
        SELECT * FROM hisab."productVariants"
        WHERE "productId" = $1 AND "companyId" = $2
    `;
    
    const variantsResult = await client.query(variantsQuery, [productId, companyId]);
    product.variants = variantsResult.rows;

    // Get serial numbers if product is serialized
    if (product.isSerialized) {
        // First get count of serial numbers per variant
        const serialCountsQuery = `
            SELECT 
                "variantId",
                COUNT(*) as "serialCount"
            FROM hisab."serialNumbers"
            WHERE "productId" = $1 AND "companyId" = $2
            GROUP BY "variantId"
        `;
        const serialCountsResult = await client.query(serialCountsQuery, [productId, companyId]);
        
        // Then get detailed serial numbers for each variant
        for (const variant of product.variants) {
            const serialsQuery = `
                SELECT * FROM hisab."serialNumbers"
                WHERE "productId" = $1 AND "variantId" = $2 AND "companyId" = $3
                ORDER BY "serialNumber"
            `;
            const serialsResult = await client.query(serialsQuery, [
                productId, 
                variant.id, 
                companyId
            ]);
            variant.serialNumbers = serialsResult.rows;
            
            // Add serial count to variant
            const count = serialCountsResult.rows.find(row => row.variantId === variant.id);
            variant.serialCount = count ? parseInt(count.serialCount) : 0;
        }
    }

    // Get categories
    const categoriesQuery = `
        SELECT 
            pc.id, 
            pc.name,
            pc."parentCategoryId"
        FROM hisab."productCategories" pc
        JOIN hisab."productCategoryMappings" pcm ON 
            pc.id = pcm."categoryId" AND 
            pc."companyId" = pcm."companyId"
        WHERE pcm."productId" = $1 AND pcm."companyId" = $2
    `;
    
    const categoriesResult = await client.query(categoriesQuery, [productId, companyId]);
    product.categories = categoriesResult.rows;

    return product;
}