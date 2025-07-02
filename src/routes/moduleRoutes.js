import express from 'express';
import { moduleController } from '../controllers/index.js';
import { authenticateUser } from '../middleware/index.js';

const router = express.Router();

router.post('/createModule', authenticateUser, moduleController.createModule);
router.get('/getAllModules', authenticateUser, moduleController.getAllModules);

export default router;
