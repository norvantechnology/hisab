import express from 'express';
import { 
  portalLogin, 
  getContactTransactions, 
  getContactSummary, 
  getContactFinancialSummary,
  getContactProfile,
  getDashboardFinancialSummary
} from '../controllers/portalController.js';
import authenticatePortalUser from '../middleware/portalAuth.js';

const router = express.Router();

// Portal authentication
router.post('/login', portalLogin);

// Portal routes (require authentication)
router.get('/transactions/:contactId', authenticatePortalUser, getContactTransactions);
router.get('/summary/:contactId', authenticatePortalUser, getContactSummary);
router.get('/financial-summary/:contactId', authenticatePortalUser, getContactFinancialSummary);
router.get('/dashboard-summary/:contactId', authenticatePortalUser, getDashboardFinancialSummary);
router.get('/profile/:contactId', authenticatePortalUser, getContactProfile);

export default router;
