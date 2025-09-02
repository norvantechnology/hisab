import express from 'express';
import { contactStatementController } from '../controllers/index.js';
import { authenticateUser, checkCompanyModulePermission } from '../middleware/index.js';

const router = express.Router();

// Get contact statement (supports JSON, PDF, Excel formats)
router.get('/statement/:contactId', 
    authenticateUser, 
    checkCompanyModulePermission('contact', 'READ'), 
    contactStatementController.getContactStatement
);

// Share contact statement via email
router.post('/statement/:contactId/share', 
    authenticateUser, 
    checkCompanyModulePermission('contact', 'READ'), 
    contactStatementController.shareContactStatement
);

export default router; 