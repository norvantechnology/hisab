import express from 'express';
import {  contactController } from '../controllers/index.js';
import { authenticateUser, checkCompanyModulePermission } from '../middleware/index.js';


const router = express.Router();

router.post('/createContact', authenticateUser, checkCompanyModulePermission('contact', 'EDIT'), contactController.createContact);
router.delete('/deleteContact', authenticateUser, checkCompanyModulePermission('contact', 'DELETE'), contactController.deleteContact);
router.get('/getContactDetails', authenticateUser, checkCompanyModulePermission('contact', 'VIEW'), contactController.getContactDetails);
router.get('/getContacts', authenticateUser, checkCompanyModulePermission('contact', 'VIEW'), contactController.getContacts);
router.put('/updateContact', authenticateUser, checkCompanyModulePermission('contact', 'VIEW'), contactController.updateContact);


export default router;
