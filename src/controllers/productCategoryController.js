import pool from "../config/dbConnection.js";
import { errorResponse, successResponse } from "../utils/index.js";

export async function createCategory(req, res) {
    const { name, description, parentCategoryId } = req.body;
    const userId = req.currentUser?.id;
    const companyId = req.currentUser?.companyId;

    if (!userId || !companyId) {
        return errorResponse(res, "Unauthorized access", 401);
    }

    if (!name) {
        return errorResponse(res, "Category name is required", 400);
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

        // Verify parent category belongs to same company if provided
        if (parentCategoryId) {
            const parentCheck = await client.query(
                `SELECT id FROM hisab."productCategories" 
                 WHERE id = $1 AND "companyId" = $2`,
                [parentCategoryId, companyId]
            );

            if (parentCheck.rows.length === 0) {
                await client.query("ROLLBACK");
                return errorResponse(res, "Parent category not found or invalid for this company", 404);
            }
        }

        // Check if category with same name already exists for this company
        const existingCheck = await client.query(
            `SELECT id FROM hisab."productCategories" 
             WHERE "companyId" = $1 AND name = $2`,
            [companyId, name]
        );

        if (existingCheck.rows.length > 0) {
            await client.query("ROLLBACK");
            return errorResponse(res, "Category with this name already exists", 409);
        }

        // Insert new category
        const insertQuery = `
            INSERT INTO hisab."productCategories" (
                "companyId", "name", "description", "parentCategoryId"
            ) VALUES ($1, $2, $3, $4)
            RETURNING *
        `;

        const result = await client.query(insertQuery, [
            companyId,
            name,
            description,
            parentCategoryId || null
        ]);

        await client.query("COMMIT");

        return successResponse(res, {
            message: "Category created successfully",
            category: result.rows[0]
        });

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error creating category:", error);
        return errorResponse(res, "Error creating category", 500);
    } finally {
        client.release();
    }
}

export async function getCategory(req, res) {
    const categoryId = req.params.id;
    const companyId = req.currentUser?.companyId;

    if (!companyId) {
        return errorResponse(res, "Unauthorized access", 401);
    }

    if (!categoryId) {
        return errorResponse(res, "Category ID is required", 400);
    }

    const client = await pool.connect();

    try {
        const query = `
            SELECT 
                c.*,
                p.name as "parentCategoryName"
            FROM hisab."productCategories" c
            LEFT JOIN hisab."productCategories" p ON c."parentCategoryId" = p.id AND p."companyId" = c."companyId"
            WHERE c.id = $1 AND c."companyId" = $2
        `;

        const result = await client.query(query, [categoryId, companyId]);

        if (result.rows.length === 0) {
            return errorResponse(res, "Category not found or unauthorized", 404);
        }

        return successResponse(res, {
            category: result.rows[0]
        });

    } catch (error) {
        console.error("Error fetching category:", error);
        return errorResponse(res, "Error fetching category", 500);
    } finally {
        client.release();
    }
}

export async function listCategories(req, res) {
    const companyId = req.currentUser?.companyId;
    const { parentCategoryId, includeProducts = false } = req.query;

    if (!companyId) {
        return errorResponse(res, "Unauthorized access", 401);
    }

    const client = await pool.connect();

    try {
        let query = `
            SELECT 
                c.*,
                p.name as "parentCategoryName",
                COUNT(pcm."productId") as "productCount"
            FROM hisab."productCategories" c
            LEFT JOIN hisab."productCategories" p ON c."parentCategoryId" = p.id AND p."companyId" = c."companyId"
            LEFT JOIN hisab."productCategoryMappings" pcm ON c.id = pcm."categoryId" AND c."companyId" = pcm."companyId"
            WHERE c."companyId" = $1
        `;

        const queryParams = [companyId];
        let paramCount = 2;

        if (parentCategoryId) {
            query += ` AND c."parentCategoryId" = $${paramCount}`;
            queryParams.push(parentCategoryId);
            paramCount++;
        } else {
            query += ` AND c."parentCategoryId" IS NULL`;
        }

        query += `
            GROUP BY c.id, p.name
            ORDER BY c.name
        `;

        const result = await client.query(query, queryParams);

        const categories = result.rows;

        // Include product details if requested
        if (includeProducts === 'true') {
            for (const category of categories) {
                const productsQuery = `
                    SELECT 
                        p.id, p.name, p."itemCode", p.rate
                    FROM hisab."products" p
                    JOIN hisab."productCategoryMappings" pcm ON p.id = pcm."productId" AND p."companyId" = pcm."companyId"
                    WHERE pcm."categoryId" = $1 AND pcm."companyId" = $2
                    ORDER BY p.name
                `;
                const productsResult = await client.query(productsQuery, [category.id, companyId]);
                category.products = productsResult.rows;
            }
        }

        return successResponse(res, {
            categories
        });

    } catch (error) {
        console.error("Error listing categories:", error);
        return errorResponse(res, "Error listing categories", 500);
    } finally {
        client.release();
    }
}

export async function updateCategory(req, res) {
    const categoryId = req.params.id;
    const { name, description, parentCategoryId } = req.body;
    const companyId = req.currentUser?.companyId;

    if (!companyId) {
        return errorResponse(res, "Unauthorized access", 401);
    }

    if (!categoryId) {
        return errorResponse(res, "Category ID is required", 400);
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Verify category exists and belongs to company
        const categoryCheck = await client.query(
            `SELECT id FROM hisab."productCategories" 
             WHERE id = $1 AND "companyId" = $2`,
            [categoryId, companyId]
        );

        if (categoryCheck.rows.length === 0) {
            await client.query("ROLLBACK");
            return errorResponse(res, "Category not found or unauthorized", 404);
        }

        // Verify parent category belongs to same company if provided
        if (parentCategoryId) {
            const parentCheck = await client.query(
                `SELECT id FROM hisab."productCategories" 
                 WHERE id = $1 AND "companyId" = $2`,
                [parentCategoryId, companyId]
            );

            if (parentCheck.rows.length === 0) {
                await client.query("ROLLBACK");
                return errorResponse(res, "Parent category not found or invalid for this company", 404);
            }
        }

        // Check for circular references
        if (parentCategoryId) {
            const circularCheck = await client.query(
                `WITH RECURSIVE category_tree AS (
                    SELECT id, "parentCategoryId" FROM hisab."productCategories" WHERE id = $1
                    UNION ALL
                    SELECT c.id, c."parentCategoryId" FROM hisab."productCategories" c
                    JOIN category_tree ct ON c.id = ct."parentCategoryId"
                )
                SELECT id FROM category_tree WHERE id = $2`,
                [parentCategoryId, categoryId]
            );

            if (circularCheck.rows.length > 0) {
                await client.query("ROLLBACK");
                return errorResponse(res, "Cannot set parent category as it would create a circular reference", 400);
            }
        }

        // Update category
        const updateQuery = `
            UPDATE hisab."productCategories"
            SET 
                "name" = COALESCE($1, "name"),
                "description" = COALESCE($2, "description"),
                "parentCategoryId" = COALESCE($3, "parentCategoryId"),
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE id = $4 AND "companyId" = $5
            RETURNING *
        `;

        const result = await client.query(updateQuery, [
            name,
            description,
            parentCategoryId || null,
            categoryId,
            companyId
        ]);

        await client.query("COMMIT");

        return successResponse(res, {
            message: "Category updated successfully",
            category: result.rows[0]
        });

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error updating category:", error);
        return errorResponse(res, "Error updating category", 500);
    } finally {
        client.release();
    }
}

export async function deleteCategory(req, res) {
    const categoryId = req.params.id;
    const companyId = req.currentUser?.companyId;

    if (!companyId) {
        return errorResponse(res, "Unauthorized access", 401);
    }

    if (!categoryId) {
        return errorResponse(res, "Category ID is required", 400);
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Verify category exists and belongs to company
        const categoryCheck = await client.query(
            `SELECT id FROM hisab."productCategories" 
             WHERE id = $1 AND "companyId" = $2`,
            [categoryId, companyId]
        );

        if (categoryCheck.rows.length === 0) {
            await client.query("ROLLBACK");
            return errorResponse(res, "Category not found or unauthorized", 404);
        }

        // Check if category has any products
        const productsCheck = await client.query(
            `SELECT "productId" FROM hisab."productCategoryMappings" 
             WHERE "categoryId" = $1 AND "companyId" = $2 LIMIT 1`,
            [categoryId, companyId]
        );

        if (productsCheck.rows.length > 0) {
            await client.query("ROLLBACK");
            return errorResponse(res, "Cannot delete category with associated products", 400);
        }

        // Check if category has any subcategories
        const subcategoriesCheck = await client.query(
            `SELECT id FROM hisab."productCategories" 
             WHERE "parentCategoryId" = $1 AND "companyId" = $2 LIMIT 1`,
            [categoryId, companyId]
        );

        if (subcategoriesCheck.rows.length > 0) {
            await client.query("ROLLBACK");
            return errorResponse(res, "Cannot delete category with subcategories", 400);
        }

        // Delete category
        const deleteQuery = `
            DELETE FROM hisab."productCategories"
            WHERE id = $1 AND "companyId" = $2
            RETURNING *
        `;

        const result = await client.query(deleteQuery, [categoryId, companyId]);

        await client.query("COMMIT");

        return successResponse(res, {
            message: "Category deleted successfully",
            category: result.rows[0]
        });

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error deleting category:", error);
        return errorResponse(res, "Error deleting category", 500);
    } finally {
        client.release();
    }
}