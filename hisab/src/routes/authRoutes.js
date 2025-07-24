import express from 'express';
import { authController } from '../controllers/index.js';
import { authenticateUser } from '../middleware/index.js';

const router = express.Router();

router.post('/signup', authController.signup);
router.get('/verifyEmail', authController.verifyEmail);
router.post('/resendVerification', authController.resendVerificationEmail);
router.post('/login', authController.login);
router.post('/changePassword', authenticateUser, authController.changePassword);

export default router;
