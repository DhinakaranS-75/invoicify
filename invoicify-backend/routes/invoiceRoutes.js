import express from 'express';
import { getInvoices, createInvoice, updateInvoice, deleteInvoice } from '../controllers/invoiceController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All invoice routes require login
router.use(protect);

router.get('/', getInvoices);
router.post('/', createInvoice);
router.put('/:id', updateInvoice);
router.delete('/:id', deleteInvoice);

export default router;
