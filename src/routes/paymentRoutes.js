import express from 'express';
import { paymentController } from '../controllers/index.js';
import { authenticateUser } from '../middleware/index.js';

const router = express.Router();

router.post('/createPayment', authenticateUser, paymentController.createPayment);
router.delete('/deletePayment', authenticateUser, paymentController.deletePayment);
router.get('/getContactPayments', authenticateUser, paymentController.getContactPayments);
router.get('/getPaymentDetails', authenticateUser, paymentController.getPaymentDetails);
router.put('/updatePayment', authenticateUser, paymentController.updatePayment);

export default router;
