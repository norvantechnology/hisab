import express from 'express';
import { componyController } from '../controllers/index.js';
import { authenticateUser, checkCompanyModulePermission } from '../middleware/index.js';


const router = express.Router();

router.post('/createCompany', authenticateUser, componyController.createCompany);
router.get('/getAllCompanies', authenticateUser, componyController.getAllCompanies);
router.put('/updateCompany', authenticateUser, componyController.updateCompany);



export default router;
