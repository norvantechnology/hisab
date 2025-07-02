import express from 'express';
import { stockCategoryController } from '../controllers/index.js';
import { authenticateUser } from '../middleware/index.js';

const router = express.Router();

router.post('/createStockCategory', authenticateUser, stockCategoryController.createStockCategory);
router.get('/listStockCategories', authenticateUser, stockCategoryController.listStockCategories);
router.put('/updateStockCategory/:id', authenticateUser, stockCategoryController.updateStockCategory);
router.delete('/deleteStockCategory/:id', authenticateUser, stockCategoryController.deleteStockCategory);

export default router;
