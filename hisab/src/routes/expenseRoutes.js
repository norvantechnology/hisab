import express from 'express';
import { expenseController } from '../controllers/index.js';
import { authenticateUser, checkCompanyModulePermission } from '../middleware/index.js';

const router = express.Router();

router.post('/createExpenseCategory', authenticateUser, checkCompanyModulePermission('expense', 'CREATE'), expenseController.createExpenseCategory);
router.delete('/deleteExpenseCategory', authenticateUser, checkCompanyModulePermission('expense', 'DELETE'), expenseController.deleteExpenseCategory);
router.get('/getExpenseCategories', authenticateUser, checkCompanyModulePermission('expense', 'VIEW'), expenseController.getExpenseCategories);
router.post('/createExpense', authenticateUser, checkCompanyModulePermission('expense', 'CREATE'), expenseController.createExpense);
router.delete('/deleteExpense', authenticateUser, checkCompanyModulePermission('expense', 'DELETE'), expenseController.deleteExpense);
router.get('/getExpenses', authenticateUser, checkCompanyModulePermission('expense', 'VIEW'), expenseController.getExpenses);
router.put('/updateExpense', authenticateUser, checkCompanyModulePermission('expense', 'EDIT'), expenseController.updateExpense);


export default router;
