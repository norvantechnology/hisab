import express from 'express';
import { incomesController } from '../controllers/index.js';
import { authenticateUser, checkCompanyModulePermission } from '../middleware/index.js';

const router = express.Router();

router.post('/createIncomeCategory', authenticateUser, checkCompanyModulePermission('income', 'CREATE'), incomesController.createIncomeCategory);
router.delete('/deleteIncomeCategory', authenticateUser, checkCompanyModulePermission('income', 'DELETE'), incomesController.deleteIncomeCategory);
router.get('/getIncomeCategories', authenticateUser, checkCompanyModulePermission('income', 'VIEW'), incomesController.getIncomeCategories);
router.post('/createIncome', authenticateUser, checkCompanyModulePermission('income', 'CREATE'), incomesController.createIncome);
router.delete('/deleteIncome', authenticateUser, checkCompanyModulePermission('income', 'DELETE'), incomesController.deleteIncome);
router.post('/bulkDeleteIncomes', authenticateUser, checkCompanyModulePermission('income', 'DELETE'), incomesController.bulkDeleteIncomes);
router.get('/getIncomes', authenticateUser, checkCompanyModulePermission('income', 'VIEW'), incomesController.getIncomes);
router.put('/updateIncome', authenticateUser, checkCompanyModulePermission('income', 'EDIT'), incomesController.updateIncome);


export default router;
