import express from 'express';
import {  contactController } from '../controllers/index.js';
import { authenticateUser, checkCompanyModulePermission } from '../middleware/index.js';


const router = express.Router();

router.post('/createContact', authenticateUser, checkCompanyModulePermission('contact', 'EDIT'), contactController.createContact);
router.post('/bulkImportContacts', authenticateUser, checkCompanyModulePermission('contact', 'EDIT'), contactController.bulkImportContacts);
router.delete('/deleteContact', authenticateUser, checkCompanyModulePermission('contact', 'DELETE'), contactController.deleteContact);
router.get('/getContactDetails', authenticateUser, checkCompanyModulePermission('contact', 'VIEW'), contactController.getContactDetails);
router.get('/getContacts', authenticateUser, checkCompanyModulePermission('contact', 'VIEW'), contactController.getContacts);
router.put('/updateContact', authenticateUser, checkCompanyModulePermission('contact', 'VIEW'), contactController.updateContact);

// New balance calculation routes
router.get('/:contactId/currentBalance', authenticateUser, checkCompanyModulePermission('contact', 'VIEW'), contactController.getContactCurrentBalance);
router.get('/:contactId/pendingBalanceSummary', authenticateUser, checkCompanyModulePermission('contact', 'VIEW'), contactController.getContactPendingBalanceSummary);
router.put('/:contactId/updateBalance', authenticateUser, checkCompanyModulePermission('contact', 'EDIT'), contactController.updateContactCurrentBalance);
router.put('/updateAllBalances', authenticateUser, checkCompanyModulePermission('contact', 'EDIT'), contactController.updateAllContactsCurrentBalance);

// Portal access routes
router.post('/:contactId/generate-portal-access', authenticateUser, checkCompanyModulePermission('contact', 'EDIT'), contactController.generateContactPortalAccess);


export default router;
