import express from 'express';
import { authenticateUser } from '../middleware/index.js';
import * as copyPreferencesController from '../controllers/copyPreferencesController.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateUser);

// Copy preferences routes
router.get('/preferences', copyPreferencesController.getCopyPreferences);
router.post('/preferences', copyPreferencesController.setCopyPreference);
router.get('/default', copyPreferencesController.getDefaultCopies);

export default router; 