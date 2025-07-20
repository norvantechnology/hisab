import express from 'express';
import { rolePermissionsController } from '../controllers/index.js';
import { authenticateUser, checkCompanyModulePermission } from '../middleware/index.js';

const router = express.Router();

router.get('/getRolePermissions', authenticateUser, checkCompanyModulePermission('role permissions','VIEW'), rolePermissionsController.getRolePermissions);
router.post('/updateRolePermissions', authenticateUser, checkCompanyModulePermission('role permissions','EDIT'), rolePermissionsController.updateRolePermissions);

export default router;
