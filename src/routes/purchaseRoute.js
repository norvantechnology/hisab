import express from 'express';
import { purchaseController } from '../controllers/index.js';
import { authenticateUser } from '../middleware/index.js';

const router = express.Router();

router.post('/createPurchase', authenticateUser, purchaseController.createPurchase);
router.get('/getPurchase', authenticateUser, purchaseController.getPurchase);
router.get('/listPurchases', authenticateUser, purchaseController.listPurchases);
router.put('/updatePurchases/:id', authenticateUser, purchaseController.updatePurchase);
router.delete('/deletePurchase', authenticateUser, purchaseController.deletePurchase);

export default router;
