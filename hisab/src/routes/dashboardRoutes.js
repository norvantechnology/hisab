import express from 'express';
import pool from '../config/dbConnection.js';
import { 
  getBusinessAnalytics, 
  getCashFlowAnalytics, 
  getProductPerformance, 
  getQuickStats,
  getDashboardFilters
} from '../controllers/dashboardController.js';
import { authenticateUser } from '../middleware/index.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateUser);

// Test endpoint for debugging authentication
router.get('/test', (req, res) => {
    const userId = req.currentUser?.id;
    const companyId = req.currentUser?.companyId;
    
    console.log('🔍 Dashboard test - User ID:', userId, 'Company ID:', companyId);
    console.log('🔍 Dashboard test - Headers:', req.headers);
    
    return res.json({
        success: true,
        message: 'Authentication working!',
        userId,
        companyId,
        timestamp: new Date().toISOString()
    });
});

// Debug endpoint to check sales data consistency
router.get('/debug-sales', async (req, res) => {
    const companyId = req.currentUser?.companyId;
    const client = await pool.connect();
    
    try {
        const debugQuery = `
            SELECT 
                s.id,
                s."invoiceNumber",
                s."netReceivable",
                s."basicAmount",
                COALESCE(SUM(si.total), 0) as line_items_total,
                s."totalDiscount",
                s."taxAmount",
                s."roundOff"
            FROM hisab.sales s
            LEFT JOIN hisab.sale_items si ON s.id = si."saleId"
            WHERE s."companyId" = $1 AND s."deletedAt" IS NULL
            GROUP BY s.id, s."invoiceNumber", s."netReceivable", s."basicAmount", s."totalDiscount", s."taxAmount", s."roundOff"
            ORDER BY s.id DESC
            LIMIT 5
        `;
        
        const result = await client.query(debugQuery, [companyId]);
        return res.json({
            success: true,
            sales: result.rows
        });
    } catch (error) {
        return res.json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
});

// Business Analytics Dashboard Routes
router.get('/filters', getDashboardFilters);
router.get('/analytics', getBusinessAnalytics);
router.get('/cash-flow', getCashFlowAnalytics);
router.get('/product-performance', getProductPerformance);
router.get('/quick-stats', getQuickStats);

export default router; 