import jwt from 'jsonwebtoken';
import pool from '../config/dbConnection.js';
import { errorResponse } from '../utils/index.js';

const authenticatePortalUser = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return errorResponse(res, 'Access denied. No token provided.', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if this is a portal contact token
    if (decoded.type !== 'portal_contact') {
      return errorResponse(res, 'Invalid token type for portal access.', 401);
    }

    // Verify contact exists and portal access is enabled
    const contactQuery = `
      SELECT 
        id, name, email, "companyId", "enablePortal"
      FROM hisab.contacts 
      WHERE id = $1 AND "enablePortal" = true AND "deletedAt" IS NULL
    `;
    
    const { rows } = await pool.query(contactQuery, [decoded.id]);

    if (rows.length === 0) {
      return errorResponse(res, 'Contact not found or portal access disabled.', 404);
    }

    const contact = rows[0];

    req.currentUser = {
      id: contact.id,
      name: contact.name,
      email: contact.email,
      companyId: contact.companyId,
      type: 'portal_contact'
    };

    next();

  } catch (error) {
    console.error('Error in authenticatePortalUser middleware:', error);

    if (error.name === 'JsonWebTokenError') {
      return errorResponse(res, 'Invalid token.', 401);
    } else if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 'Token expired.', 401);
    } else {
      return errorResponse(res, 'Authentication error.', 500);
    }
  }
};

export default authenticatePortalUser; 