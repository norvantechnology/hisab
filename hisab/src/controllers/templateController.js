import pool from "../config/dbConnection.js";
import { errorResponse, successResponse } from "../utils/index.js";

// Get all templates for a specific module type
// Returns templates with 'default' key indicating which template is the user's default
export async function getTemplates(req, res) {
  const { moduleType } = req.query;
  const companyId = req.currentUser?.companyId;
  const userId = req.currentUser?.id;

  if (!moduleType || !['sales', 'purchase', 'payment'].includes(moduleType)) {
    return errorResponse(res, "Valid moduleType is required (sales, purchase, payment)", 400);
  }

  if (!companyId || !userId) {
    return errorResponse(res, "Company ID and User ID are required", 401);
  }

  const client = await pool.connect();

  try {
    // Get templates (both global and company-specific) with user default preference
    const templatesQuery = `
      SELECT 
        t.*,
        u."name" as "createdByName",
        CASE 
          WHEN utp."templateId" IS NOT NULL THEN true 
          ELSE false 
        END as "isUserDefault"
      FROM hisab."invoiceTemplates" t
      LEFT JOIN hisab."users" u ON t."createdBy" = u."id"
      LEFT JOIN hisab."userTemplatePreferences" utp 
        ON t."id" = utp."templateId" 
        AND utp."userId" = $1 
        AND utp."companyId" = $2
        AND utp."moduleType" = $3
      WHERE t."moduleType" = $3 
        AND t."isActive" = true 
        AND t."deletedAt" IS NULL
        AND (t."companyId" IS NULL OR t."companyId" = $2)
      ORDER BY t."isDefault" DESC, t."createdAt" DESC
    `;

    const templatesResult = await client.query(templatesQuery, [
      userId,
      companyId,
      moduleType
    ]);

    const templates = templatesResult.rows;
    let defaultTemplateId = null;

    // Find the user's default template
    const userDefaultTemplate = templates.find(template => template.isUserDefault);
    
    if (userDefaultTemplate) {
      defaultTemplateId = userDefaultTemplate.id;
    } else {
      // If no user preference, find the system default template
      const systemDefaultTemplate = templates.find(template => template.isDefault);
      if (systemDefaultTemplate) {
        defaultTemplateId = systemDefaultTemplate.id;
      }
    }

    // Add default key to each template
    const templatesWithDefault = templates.map(template => ({
      ...template,
      default: template.id === defaultTemplateId
    }));

    return successResponse(res, {
      templates: templatesWithDefault,
      total: templatesWithDefault.length,
      defaultTemplateId: defaultTemplateId
    });

  } catch (error) {
    console.error('Error fetching templates:', error);
    return errorResponse(res, "Failed to fetch templates", 500);
  } finally {
    client.release();
  }
}

// Set user's default template for a module
export async function setUserDefaultTemplate(req, res) {
  const { templateId, moduleType } = req.body;
  const userId = req.currentUser?.id;
  const companyId = req.currentUser?.companyId;

  if (!templateId || !moduleType) {
    return errorResponse(res, "Template ID and moduleType are required", 400);
  }

  if (!['sales', 'purchase', 'payment'].includes(moduleType)) {
    return errorResponse(res, "Invalid moduleType. Must be sales, purchase, or payment", 400);
  }

  if (!userId || !companyId) {
    return errorResponse(res, "Unauthorized access", 401);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verify template exists and is accessible
    const templateCheck = await client.query(`
      SELECT "id" FROM hisab."invoiceTemplates" 
      WHERE "id" = $1 
        AND "moduleType" = $2 
        AND "isActive" = true 
        AND "deletedAt" IS NULL
        AND ("companyId" IS NULL OR "companyId" = $3)
    `, [templateId, moduleType, companyId]);

    if (templateCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Template not found or not accessible", 404);
    }

    // Upsert user preference
    const upsertQuery = `
      INSERT INTO hisab."userTemplatePreferences" 
        ("userId", "companyId", "moduleType", "templateId")
      VALUES ($1, $2, $3, $4)
      ON CONFLICT ("userId", "companyId", "moduleType")
      DO UPDATE SET 
        "templateId" = $4,
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await client.query(upsertQuery, [
      userId,
      companyId,
      moduleType,
      templateId
    ]);

    await client.query("COMMIT");

    return successResponse(res, {
      preference: result.rows[0],
      message: "Default template updated successfully"
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error('Error setting default template:', error);
    return errorResponse(res, "Failed to set default template", 500);
  } finally {
    client.release();
  }
} 