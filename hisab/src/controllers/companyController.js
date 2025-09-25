import pool from "../config/dbConnection.js";
import { errorResponse, successResponse, uploadFileToS3 } from "../utils/index.js";
import axios from "axios";

// Function to get authentication token using Client ID and Secret
async function getAuthToken(gstin) {
  try {
    const authUrl = "https://api.sandbox.core.irisirp.com/eivital/v1.04/auth";

    // The request body should contain the GSTIN and other required parameters
    const requestBody = {
      gstin: gstin
    };

    const authResponse = await axios.post(authUrl, requestBody, {
      headers: {
        "Content-Type": "application/json",
        "client_id": "525pucQoEsmmxkT58pWQwq/XuV9v6e4d",
        "client_secret": "ZMKw0+cGAphj9/669FCPkrogq/6U+oxU",
        "gstin": gstin
      },
      timeout: 10000
    });

    if (authResponse.data?.Data?.AuthToken) {
      return {
        success: true,
        authToken: authResponse.data.Data.AuthToken,
        sek: authResponse.data.Data.Sek, // Session Encryption Key
        tokenExpiry: authResponse.data.Data.TokenExpiry
      };
    } else {
      throw new Error("Failed to get authentication token");
    }
  } catch (error) {
    console.error("Auth token error:", error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.ErrorDetails || error.message || "Authentication failed"
    };
  }
}

// Function to fetch GSTIN business details
async function fetchGSTINDetails(gstin) {
  try {
    // Get auth token first with the GSTIN
    const authResult = await getAuthToken(gstin);

    if (!authResult.success) {
      return {
        success: false,
        error: `Authentication failed: ${authResult.error}`
      };
    }

    // Fetch GSTIN details
    const gstApiUrl = `https://api.sandbox.core.irisirp.com/eivital/v1.04/Master/gstin/${gstin}`;

    const gstResponse = await axios.get(gstApiUrl, {
      headers: {
        "Authorization": `Bearer ${authResult.authToken}`,
        "Content-Type": "application/json",
        "gstin": gstin // GSTIN might be required for this endpoint too
      },
      timeout: 15000
    });

    if (gstResponse.data?.Data) {
      return {
        success: true,
        data: gstResponse.data.Data
      };
    } else {
      return {
        success: false,
        error: "No data received from GST API"
      };
    }
  } catch (error) {
    console.error("GST API error:", error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.ErrorDetails || error.message || "Failed to fetch GST details"
    };
  }
}

export async function createCompany(req, res) {
  let {
    gstin,
    name,
    country,
    currency,
    address1,
    address2,
    city,
    pincode,
    state,
  } = req.body;

  const userId = req.currentUser?.id;

  if (!userId) {
    return errorResponse(res, "Unauthorized. Please login again.", 401);
  }

  const client = await pool.connect();

  try {
    // Handle logo upload if provided
    let logoUrl = null;
    if (req.file && req.file.buffer) {
      try {
        logoUrl = await uploadFileToS3(req.file.buffer, req.file.originalname);
      } catch (error) {
        console.error('Logo upload failed:', error);
        return errorResponse(res, `Logo upload failed: ${error.message}`, 400);
      }
    }

    // If GSTIN is provided, auto-fetch company details from IRIS IRP API
    if (gstin) {
      const gstResult = await fetchGSTINDetails(gstin);

      if (gstResult.success && gstResult.data) {
        const gstData = gstResult.data;

        // Map the API response to your fields
        // Note: Adjust field names based on actual API response structure
        name = name || gstData.LegalName || gstData.TradeName || gstData.BusinessName;

        // Handle address details
        if (gstData.PrincipalPlace) {
          const addr = gstData.PrincipalPlace;
          address1 = address1 || `${addr.BuildingName || ''} ${addr.BuildingNumber || ''}`.trim() || addr.AddressLine1;
          address2 = address2 || `${addr.Street || ''} ${addr.Location || ''}`.trim() || addr.AddressLine2;
          city = city || addr.City || addr.District;
          pincode = pincode || addr.Pincode;
          state = state || addr.StateName || addr.State;
        }

        // Set defaults for India
        country = country || "India";
        currency = currency || "INR";

      } else {
        console.error("GST API failed:", gstResult.error);
        return errorResponse(res, `Failed to fetch GST details: ${gstResult.error}`, 400);
      }
    }

    // Validate required fields
    if (!name || !country || !currency || !address1 || !city || !pincode || !state) {
      const missingFields = [];
      if (!name) missingFields.push('name');
      if (!country) missingFields.push('country');
      if (!currency) missingFields.push('currency');
      if (!address1) missingFields.push('address1');
      if (!city) missingFields.push('city');
      if (!pincode) missingFields.push('pincode');
      if (!state) missingFields.push('state');

      return errorResponse(res, `Missing required fields: ${missingFields.join(', ')}`, 400);
    }

    // Insert company into database
    const insertQuery = `
      INSERT INTO hisab."companies"
        ("userId", "gstin", "name", "country", "currency", "address1", "address2", "city", "pincode", "state", "logoUrl", "createdAt", "updatedAt")
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, "name", "gstin", "country", "currency", "city", "state", "pincode", "logoUrl", "createdAt"
    `;

    const result = await client.query(insertQuery, [
      userId,
      gstin || null,
      name,
      country,
      currency,
      address1,
      address2 || null,
      city,
      pincode,
      state,
      logoUrl,
    ]);

    const newCompany = result.rows[0];
    const companyId = newCompany.id;

    // Create default "Cash On Hand" bank account for the new company
    const bankAccountInsertQuery = `
      INSERT INTO hisab."bankAccounts" 
        ("userId", "companyId", "accountType", "accountName", "currentBalance", "openingBalance", "isActive")
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, "accountName", "accountType"
    `;

    try {
      const bankAccountResult = await client.query(bankAccountInsertQuery, [
        userId,
        companyId,
        'cash',
        'Cash On Hand',
        0,
        0,
        true
      ]);

      return successResponse(res, {
        message: gstin ? "Company created successfully with GST details and default cash account" : "Company created successfully with default cash account",
        company: newCompany,
        defaultBankAccount: bankAccountResult.rows[0]
      });

    } catch (bankAccountError) {
      console.error("Error creating default bank account:", bankAccountError);
      
      // Company was created successfully, but default bank account creation failed
      // Log the error but don't fail the entire operation
      
      return successResponse(res, {
        message: gstin ? "Company created successfully with GST details (default bank account creation failed)" : "Company created successfully (default bank account creation failed)",
        company: newCompany,
        warning: "Default bank account could not be created automatically"
      });
    }

  } catch (error) {
    console.error("Error creating company:", error);

    if (error.code === '23505') { // PostgreSQL unique violation
      return errorResponse(res, "Company with this GSTIN already exists", 400);
    }

    return errorResponse(res, "Error creating company", 500);
  } finally {
    client.release();
  }
}

export async function getAllCompanies(req, res) {
  const userId = req.currentUser?.id;

  if (!userId) {
    return errorResponse(res, "Unauthorized. Please login again.", 401);
  }

  const client = await pool.connect();

  try {
    // Query to fetch:
    // 1. Companies owned by the user
    // 2. Companies shared with the user through userCompanyAccess
    const query = `
      SELECT 
        c.id, 
        c."name", 
        c."gstin", 
        c."country", 
        c."currency", 
        c."address1", 
        c."address2", 
        c."city", 
        c."state",
        c."pincode",
        c."logoUrl",
        c."createdAt",
        u.id as "ownerId",
        u."name" as "ownerName",
        CASE 
          WHEN c."userId" = $1 THEN 'owner'
          ELSE uca."roleId"::TEXT
        END as "accessType"
      FROM hisab."companies" c
      LEFT JOIN hisab."users" u ON c."userId" = u.id
      LEFT JOIN hisab."userCompanyAccess" uca ON c.id = uca."companyId" AND uca."grantedUserId" = $1
      WHERE c."userId" = $1 OR uca."grantedUserId" = $1
      ORDER BY c."name" ASC
    `;

    const result = await client.query(query, [userId]);

    // Transform the data for better frontend consumption
    const companies = result.rows.map(company => ({
      id: company.id,
      name: company.name,
      gstin: company.gstin,
      logoUrl: company.logoUrl,
      location: {
        city: company.city,
        state: company.state,
        pincode: company.pincode,
        country: company.country,
        address1 : company.address1,
        address2 : company.address2,
      },
      currency: company.currency,
      createdAt: company.createdAt,
      owner: {
        id: company.ownerId,
        name: company.ownerName || ''
      },
      accessType: company.accessType || 'unknown',
      isOwner: company.accessType === 'owner'
    }));

    return successResponse(res, {
      message: "Companies fetched successfully",
      companies,
      count: companies.length
    });

  } catch (error) {
    console.error("Error fetching companies:", error);
    return errorResponse(res, "Error fetching companies", 500);
  } finally {
    client.release();
  }
}


export async function updateCompany(req, res) {
  const {
    gstin,
    name,
    country,
    currency,
    address1,
    address2,
    city,
    pincode,
    state,
    id
  } = req.body;

  const userId = req.currentUser?.id;

  const client = await pool.connect();

  try {
    // Handle logo upload if provided
    let logoUrl = null;
    if (req.file && req.file.buffer) {
      try {
        logoUrl = await uploadFileToS3(req.file.buffer, req.file.originalname);
      } catch (error) {
        console.error('Logo upload failed:', error);
        return errorResponse(res, `Logo upload failed: ${error.message}`, 400);
      }
    }

    // If GSTIN is provided, auto-fetch company details from IRIS IRP API
    let updatedFields = {};
    if (gstin) {
      const gstResult = await fetchGSTINDetails(gstin);

      if (gstResult.success && gstResult.data) {
        const gstData = gstResult.data;

        // Map the API response to fields
        updatedFields.name = name || gstData.LegalName || gstData.TradeName || gstData.BusinessName;

        // Handle address details
        if (gstData.PrincipalPlace) {
          const addr = gstData.PrincipalPlace;
          updatedFields.address1 = address1 || `${addr.BuildingName || ''} ${addr.BuildingNumber || ''}`.trim() || addr.AddressLine1;
          updatedFields.address2 = address2 || `${addr.Street || ''} ${addr.Location || ''}`.trim() || addr.AddressLine2;
          updatedFields.city = city || addr.City || addr.District;
          updatedFields.pincode = pincode || addr.Pincode;
          updatedFields.state = state || addr.StateName || addr.State;
        }

        // Set defaults for India
        updatedFields.country = country || "India";
        updatedFields.currency = currency || "INR";

      } else {
        console.error("GST API failed:", gstResult.error);
        return errorResponse(res, `Failed to fetch GST details: ${gstResult.error}`, 400);
      }
    }

    // Prepare the update query
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    // Add fields from request body or GST API response
    const fieldsToUpdate = {
      gstin,
      name,
      country,
      currency,
      address1,
      address2,
      city,
      pincode,
      state,
      ...(logoUrl && { logoUrl }), // Only include logoUrl if it exists
      ...updatedFields
    };

    // Build dynamic update query
    for (const [key, value] of Object.entries(fieldsToUpdate)) {
      if (value !== undefined) {
        updateFields.push(`"${key}" = $${paramIndex}`);
        updateValues.push(value);
        paramIndex++;
      }
    }

    // If no fields to update
    if (updateFields.length === 0) {
      return errorResponse(res, "No fields provided for update", 400);
    }

    // Add updatedAt timestamp
    updateFields.push(`"updatedAt" = CURRENT_TIMESTAMP`);
    
    // Add companyId to the parameters
    updateValues.push(id);

    const updateQuery = `
      UPDATE hisab."companies"
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, "name", "gstin", "country", "currency", "address1", "address2", 
                "city", "pincode", "state", "logoUrl", "createdAt", "updatedAt"
    `;

    const result = await client.query(updateQuery, updateValues);

    if (result.rowCount === 0) {
      return errorResponse(res, "Company not found", 404);
    }

    return successResponse(res, {
      message: "Company updated successfully",
      company: result.rows[0],
    });

  } catch (error) {
    console.error("Error updating company:", error);

    if (error.code === '23505') { // PostgreSQL unique violation
      return errorResponse(res, "Company with this GSTIN already exists", 400);
    }

    return errorResponse(res, "Error updating company", 500);
  } finally {
    client.release();
  }
}

export async function deleteCompany(req, res) {
  const { id } = req.params;
  const userId = req.currentUser?.id;

  if (!userId) {
    return errorResponse(res, "Unauthorized. Please login again.", 401);
  }

  if (!id) {
    return errorResponse(res, "Company ID is required", 400);
  }

  const client = await pool.connect();

  try {
    // First, check if the company exists and user has permission to delete it
    const checkQuery = `
      SELECT id, "name", "userId" 
      FROM hisab."companies" 
      WHERE id = $1
    `;
    
    const checkResult = await client.query(checkQuery, [id]);
    
    if (checkResult.rowCount === 0) {
      return errorResponse(res, "Company not found", 404);
    }

    const company = checkResult.rows[0];
    
    // Only company owner can delete the company
    if (company.userId !== userId) {
      return errorResponse(res, "You don't have permission to delete this company", 403);
    }

    // Check if this is the currently selected company
    const isCurrentlySelected = req.currentUser?.companyId === parseInt(id);
    
    // Delete the company
    const deleteQuery = `
      DELETE FROM hisab."companies" 
      WHERE id = $1 AND "userId" = $2
    `;
    
    const deleteResult = await client.query(deleteQuery, [id, userId]);
    
    if (deleteResult.rowCount === 0) {
      return errorResponse(res, "Failed to delete company", 500);
    }

    return successResponse(res, {
      message: "Company deleted successfully",
      companyId: id,
      companyName: company.name,
      wasCurrentlySelected: isCurrentlySelected
    });

  } catch (error) {
    console.error("Error deleting company:", error);
    return errorResponse(res, "Error deleting company", 500);
  } finally {
    client.release();
  }
}