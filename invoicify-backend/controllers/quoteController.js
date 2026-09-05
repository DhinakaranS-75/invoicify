import Quote from '../models/Quote.js';
import { sendQuotePdf } from '../utils/mailer.js';

// All routes below are protected; req.user is the logged-in user.
// Quotes are scoped to the user's companyId so team members share data.

// GET /api/quotes
export async function getQuotes(req, res) {
  try {
    const quotes = await Quote.find({ companyId: req.user.companyId }).sort({ createdAt: 1 });
    res.json(quotes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/quotes
export async function createQuote(req, res) {
  try {
    const quote = await Quote.create({
      ...req.body,
      companyId: req.user.companyId,
      createdBy: req.user._id
    });
    res.status(201).json(quote);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/quotes/:id/email
// Body: { recipientEmail, pdfBase64 } — same pattern as invoice email-send.
export async function emailQuotePdf(req, res) {
  try {
    const { recipientEmail, pdfBase64 } = req.body;
    if (!recipientEmail || !pdfBase64) {
      return res.status(400).json({ message: 'recipientEmail and pdfBase64 are required.' });
    }
    const quote = await Quote.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!quote) return res.status(404).json({ message: 'Quote not found' });

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const companyName = req.user.company?.name || 'InvoicifysPro';
    const totalFormatted = quote.total != null ? `${req.user.company?.currency || 'INR'} ${quote.total.toFixed(2)}` : null;

    await sendQuotePdf({
      email: recipientEmail,
      name: quote.client,
      companyName,
      quoteNumber: quote.number,
      totalFormatted,
      pdfBuffer
    });

    res.json({ message: 'Quote emailed successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// PUT /api/quotes/:id
export async function updateQuote(req, res) {
  try {
    const quote = await Quote.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!quote) return res.status(404).json({ message: 'Quote not found' });
    Object.assign(quote, req.body);
    await quote.save();
    res.json(quote);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// DELETE /api/quotes/:id
export async function deleteQuote(req, res) {
  try {
    const quote = await Quote.findOneAndDelete({ _id: req.params.id, companyId: req.user.companyId });
    if (!quote) return res.status(404).json({ message: 'Quote not found' });
    res.json({ message: 'Quote deleted', id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}