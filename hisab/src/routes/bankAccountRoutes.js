import express from 'express';
import { bankAccountController } from '../controllers/index.js';
import { authenticateUser, checkCompanyModulePermission } from '../middleware/index.js';

const router = express.Router();

router.post('/activateBankAccount', authenticateUser, checkCompanyModulePermission('bank', 'EDIT'), bankAccountController.activateBankAccount);
router.post('/createBankAccount', authenticateUser, checkCompanyModulePermission('bank', 'CREATE'), bankAccountController.createBankAccount);
router.post('/deactivateBankAccount', authenticateUser, checkCompanyModulePermission('bank', 'EDIT'), bankAccountController.deactivateBankAccount);
router.delete('/deleteBankAccount', authenticateUser, checkCompanyModulePermission('bank', 'DELETE'), bankAccountController.deleteBankAccount);
router.get('/getBankAccounts', authenticateUser, checkCompanyModulePermission('bank', 'VIEW'), bankAccountController.getBankAccounts);
router.put('/updateBankAccount', authenticateUser, checkCompanyModulePermission('bank', 'EDIT'), bankAccountController.updateBankAccount);

export default router;
