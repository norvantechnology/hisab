import express from 'express';
import { userRoleController } from '../controllers/index.js';
import { authenticateUser, checkCompanyModulePermission } from '../middleware/index.js';

const router = express.Router();

router.post('/createUserRole', authenticateUser, userRoleController.createUserRole);
router.delete('/deleteUserRole', authenticateUser, userRoleController.deleteUserRole);
router.get('/getUserRolesByCompany', authenticateUser, userRoleController.getUserRolesByCompany);


export default router;
