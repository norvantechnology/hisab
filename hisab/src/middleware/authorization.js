import jwt from 'jsonwebtoken';
import pool from '../config/dbConnection.js';
import { errorResponse } from '../utils/index.js';

const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const companyId = req.headers['companyid'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return errorResponse(res, 'Access denied. No token provided.', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userQuery = `
      SELECT 
        "id", "email", "name", "role", "isVerified", "isActive" 
      FROM hisab."users" 
      WHERE "id" = $1
    `;
    const { rows } = await pool.query(userQuery, [decoded.id]);

    if (rows.length === 0) {
      return errorResponse(res, 'User not found.', 404);
    }

    const user = rows[0];

    if (!user.isActive) {
      return errorResponse(res, 'User account is inactive.', 403);
    }

    if (!user.isVerified) {
      return errorResponse(res, 'Email is not verified.', 403);
    }

    req.currentUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: companyId
    };

    next();

  } catch (error) {
    console.error('Error in authenticateUser middleware:', error);

    if (error.name === 'JsonWebTokenError') {
      return errorResponse(res, 'Invalid token.', 401);
    } else if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 'Token expired.', 401);
    } else {
      return errorResponse(res, 'Authentication error.', 500);
    }
  }
};

export default authenticateUser;
