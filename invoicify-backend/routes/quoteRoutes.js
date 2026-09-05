import express from 'express';
import { getQuotes, createQuote, updateQuote, deleteQuote, emailQuotePdf } from '../controllers/quoteController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All quote routes require login
router.use(protect);

router.get('/', getQuotes);
router.post('/', createQuote);
router.put('/:id', updateQuote);
router.post('/:id/email', emailQuotePdf);
router.delete('/:id', deleteQuote);

export default router;