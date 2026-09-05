import express from 'express';
import { getInvoices, createInvoice, updateInvoice, deleteInvoice, checkInvoiceNumber, emailInvoicePdf } from '../controllers/invoiceController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All invoice routes require login
router.use(protect);

router.get('/', getInvoices);
router.get('/check-number', checkInvoiceNumber);
router.post('/', createInvoice);
router.put('/:id', updateInvoice);
router.post('/:id/email', emailInvoicePdf);
router.delete('/:id', deleteInvoice);

export default router;