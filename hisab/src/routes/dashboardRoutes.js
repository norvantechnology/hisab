import express from 'express';
import pool from '../config/dbConnection.js';
import { 
  getBusinessAnalytics, 
  getQuickStats,
  exportDashboardData
} from '../controllers/dashboardController.js';
import { authenticateUser } from '../middleware/index.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateUser);

// Debug routes removed - no longer needed

// Business Analytics Dashboard Routes
router.get('/analytics', getBusinessAnalytics);
router.get('/quick-stats', getQuickStats);
router.get('/export', exportDashboardData);

export default router; 