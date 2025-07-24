import express from 'express';
import { componyController } from '../controllers/index.js';
import { authenticateUser, checkCompanyModulePermission } from '../middleware/index.js';
import { conditionalUpload } from '../utils/index.js';

const router = express.Router();

router.post('/createCompany', authenticateUser, conditionalUpload, componyController.createCompany);
router.get('/getAllCompanies', authenticateUser, componyController.getAllCompanies);
router.put('/updateCompany', authenticateUser, conditionalUpload, componyController.updateCompany);
router.delete('/deleteCompany/:id', authenticateUser, componyController.deleteCompany);

export default router;
