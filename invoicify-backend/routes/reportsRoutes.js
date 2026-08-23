import express from 'express';
import { emailReport } from '../controllers/reportsController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.post('/email', emailReport);

export default router;
