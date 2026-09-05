import Invoice from '../models/Invoice.js';
import { sendInvoicePdf } from '../utils/mailer.js';

// Returns an existing invoice in the same company that already uses this
// number (case-insensitive, trimmed), or null. `excludeId` skips the invoice
// being edited so re-saving it doesn't clash with itself.
async function findDuplicateNumber(number, companyId, excludeId) {
  const trimmed = String(number || '').trim();
  if (!trimmed) return null;
  const esc = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const query = {
    companyId,
    number: { $regex: new RegExp('^' + esc + '$', 'i') }
  };
  if (excludeId) query._id = { $ne: excludeId };
  return Invoice.findOne(query);
}

// All routes below are protected; req.user is the logged-in user.
// Invoices are scoped to the user's companyId so team members share data.

// GET /api/invoices
export async function getInvoices(req, res) {
  try {
    // Lazily flip Sent/Unpaid invoices to Overdue once their due date has
    // passed. Runs on every fetch instead of a cron job — cheap, and keeps
    // the stored status field (used by filters/reports) always accurate.
    const today = new Date().toISOString().slice(0, 10);
    await Invoice.updateMany(
      {
        companyId: req.user.companyId,
        status: { $in: ['Sent', 'Unpaid'] },
        dueDate: { $lt: today },
      },
      { $set: { status: 'Overdue' } }
    );

    const invoices = await Invoice.find({ companyId: req.user.companyId }).sort({ createdAt: 1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// GET /api/invoices/check-number?number=INV-001&excludeId=<id>
// Lightweight lookup used by the invoice form to tell the user, as they type,
// whether a number is already taken. `excludeId` is the invoice being edited.
export async function checkInvoiceNumber(req, res) {
  try {
    const { number, excludeId } = req.query;
    const trimmed = String(number || '').trim();
    if (!trimmed) return res.json({ available: true });
    const dup = await findDuplicateNumber(trimmed, req.user.companyId, excludeId || null);
    res.json({ available: !dup });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/invoices
export async function createInvoice(req, res) {
  try {
    const dup = await findDuplicateNumber(req.body.number, req.user.companyId);
    if (dup) {
      return res.status(409).json({
        code: 'DUPLICATE_NUMBER',
        message: `Invoice number ${String(req.body.number).trim()} is already used. Please use a unique number.`
      });
    }
    const invoice = await Invoice.create({
      ...req.body,
      companyId: req.user.companyId,
      createdBy: req.user._id
    });
    res.status(201).json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// PUT /api/invoices/:id
export async function updateInvoice(req, res) {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (req.body.number) {
      const dup = await findDuplicateNumber(req.body.number, req.user.companyId, invoice._id);
      if (dup) {
        return res.status(409).json({
          code: 'DUPLICATE_NUMBER',
          message: `Invoice number ${String(req.body.number).trim()} is already used. Please use a unique number.`
        });
      }
    }
    Object.assign(invoice, req.body);
    await invoice.save();
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/invoices/:id/email
// Body: { recipientEmail, pdfBase64 } — pdfBase64 is the invoice PDF rendered
// client-side (same html2pdf.js path as Download/Share), base64-encoded with
// no data-URL prefix. Scoped to the requester's companyId like every other
// invoice route, so one company can't email another's invoice.
export async function emailInvoicePdf(req, res) {
  try {
    const { recipientEmail, pdfBase64 } = req.body;
    if (!recipientEmail || !pdfBase64) {
      return res.status(400).json({ message: 'recipientEmail and pdfBase64 are required.' });
    }
    const invoice = await Invoice.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const companyName = req.user.company?.name || 'InvoicifysPro';
    const totalFormatted = invoice.total != null ? `${req.user.company?.currency || 'INR'} ${invoice.total.toFixed(2)}` : null;

    await sendInvoicePdf({
      email: recipientEmail,
      name: invoice.client,
      companyName,
      invoiceNumber: invoice.number,
      totalFormatted,
      pdfBuffer
    });

    res.json({ message: 'Invoice emailed successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// DELETE /api/invoices/:id
export async function deleteInvoice(req, res) {
  try {
    const invoice = await Invoice.findOneAndDelete({ _id: req.params.id, companyId: req.user.companyId });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json({ message: 'Invoice deleted', id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}