import Invoice from '../models/Invoice.js';

// All routes below are protected; req.user is the logged-in user.
// Invoices are scoped to the user's companyId so team members share data.

// GET /api/invoices
export async function getInvoices(req, res) {
  try {
    const invoices = await Invoice.find({ companyId: req.user.companyId }).sort({ createdAt: 1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/invoices
export async function createInvoice(req, res) {
  try {
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
    Object.assign(invoice, req.body);
    await invoice.save();
    res.json(invoice);
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
