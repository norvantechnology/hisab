import express from 'express';
import { bankTransferController } from '../controllers/index.js';
import { authenticateUser, checkCompanyModulePermission } from '../middleware/index.js';

const router = express.Router();

router.post('/createBankTransfer', authenticateUser,  bankTransferController.createBankTransfer);
router.delete('/deleteBankTransfer', authenticateUser,  bankTransferController.deleteBankTransfer);
router.get('/getBankTransferDetails', authenticateUser,  bankTransferController.getBankTransferDetails);
router.get('/listBankTransfers', authenticateUser,  bankTransferController.listBankTransfers);
router.put('/updateBankTransfer', authenticateUser,  bankTransferController.updateBankTransfer);

export default router;
