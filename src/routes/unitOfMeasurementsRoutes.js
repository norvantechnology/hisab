import express from 'express';
import { unitOfMeasurements } from '../controllers/index.js';
import { authenticateUser } from '../middleware/index.js';

const router = express.Router();

router.get('/getUnitOfMeasurements', authenticateUser, unitOfMeasurements.getUnitOfMeasurements);

export default router;
