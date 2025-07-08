import express from 'express';
import { productController } from '../controllers/index.js';
import { authenticateUser, checkCompanyModulePermission } from '../middleware/index.js';

const router = express.Router();

router.post('/createProduct', authenticateUser, productController.createProduct);
router.get('/getProduct', authenticateUser, productController.getProduct);
router.get('/listProducts', authenticateUser, productController.listProducts);
router.put('/updateProduct', authenticateUser, productController.updateProduct);
router.delete('/deleteProduct', authenticateUser, productController.deleteProduct);

export default router;