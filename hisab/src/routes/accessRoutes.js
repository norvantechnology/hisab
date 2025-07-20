import express from 'express';
import { accessController } from '../controllers/index.js';
import { authenticateUser, checkCompanyModulePermission } from '../middleware/index.js';

const router = express.Router();

router.post('/grant', authenticateUser, checkCompanyModulePermission('companyAccess','CREATE'), accessController.grantCompanyAccess);
router.put('/update', authenticateUser, checkCompanyModulePermission('companyAccess','EDIT'), accessController.updateCompanyAccess);
router.delete('/revoke', authenticateUser, checkCompanyModulePermission('companyAccess','DELETE'), accessController.revokeCompanyAccess);
router.get('/list', authenticateUser, checkCompanyModulePermission('companyAccess','VIEW'), accessController.listCompanyAccess);

export default router;