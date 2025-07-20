import express from 'express';
import { taxCategoryController } from '../controllers/index.js';
import { authenticateUser } from '../middleware/index.js';

const router = express.Router();

router.get('/getTaxCategory', authenticateUser, taxCategoryController.getTaxCategory);

export default router;
