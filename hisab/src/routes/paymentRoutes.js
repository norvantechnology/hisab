import express from 'express';
import { paymentController } from '../controllers/index.js';
import { authenticateUser } from '../middleware/index.js';

const router = express.Router();

router.post('/createPayment', authenticateUser, paymentController.createPayment);
router.delete('/deletePayment', authenticateUser, paymentController.deletePayment);
router.get('/getPendingTransactions', authenticateUser, paymentController.getPendingTransactions);
router.get('/getPaymentDetails', authenticateUser, paymentController.getPaymentDetails);
router.put('/updatePayment', authenticateUser, paymentController.updatePayment);
router.get('/listPayments', authenticateUser, paymentController.listPayments);
router.get('/generateInvoicePDF', authenticateUser, paymentController.generatePaymentInvoicePDF);
router.get('/getPaymentForPrint/:id', authenticateUser, paymentController.getPaymentForPrint);


export default router;
