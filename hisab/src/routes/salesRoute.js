import express from 'express';
import { authenticateUser } from '../middleware/index.js';
import * as salesController from '../controllers/salesController.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateUser);

// Sales routes
router.post('/createSale', salesController.createSale);
router.put('/updateSale', salesController.updateSale);
router.delete('/deleteSale', salesController.deleteSale);
router.get('/getSale', salesController.getSale);
router.get('/listSales', salesController.listSales);
router.get('/getNextInvoiceNumber', salesController.getNextInvoiceNumber);

export default router; 