import express from 'express';
import pool from '../config/dbConnection.js';
import { 
  getBusinessAnalytics, 
  getQuickStats,
  exportDashboardData,
  getChartData,
  getRevenueChartData,
  getCashFlowChartData,
  getPaymentStatusChartData,
  getMonthlyTrendsData,
  getDashboardInsights,
  getRecentActivities
} from '../controllers/dashboardController.js';
import { authenticateUser } from '../middleware/index.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateUser);

// Business Analytics Dashboard Routes
router.get('/analytics', getBusinessAnalytics);
router.get('/quick-stats', getQuickStats);
router.get('/export', exportDashboardData);

// Chart Data Routes
router.get('/charts', getChartData);
router.get('/charts/revenue', getRevenueChartData);
router.get('/charts/cashflow', getCashFlowChartData);
router.get('/charts/payment-status', getPaymentStatusChartData);
router.get('/charts/monthly-trends', getMonthlyTrendsData);

// Enhanced Dashboard Features
router.get('/insights', getDashboardInsights);
router.get('/activities', getRecentActivities);

export default router; 