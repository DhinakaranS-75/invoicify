import mongoose from 'mongoose';

const quoteItemSchema = new mongoose.Schema({
  name: String,
  description: String,
  hsn: String,
  qty: Number,
  rate: Number
}, { _id: false });

const quoteSchema = new mongoose.Schema({
  // Which company this quote belongs to (team members share a companyId)
  companyId: { type: String, required: true, index: true },
  // Who created it
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  number: String,
  date: String,
  validUntil: String,
  client: String,
  // Draft -> Sent -> Accepted/Rejected/Expired. 'Converted' once turned into
  // an invoice (see convertedInvoiceId) — kept as its own terminal status so
  // the list clearly shows which quotes already became real invoices.
  status: { type: String, default: 'Draft' },
  total: { type: Number, default: 0 },

  // Set once this quote has been converted to an invoice. The quote itself
  // is kept (not deleted) as a record of what was originally quoted.
  convertedInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },

  // Snapshot of all quote detail fields (mirrors the invoice snapshot shape)
  snapshot: {
    toEmail: String,
    toPhone: String,
    toAddr: String,
    shipTo: String,
    subject: String,
    notes: String,
    taxPct: Number,
    discountPct: Number,
    signature: String,
    items: [quoteItemSchema]
  }
}, { timestamps: true });

const Quote = mongoose.model('Quote', quoteSchema);
export default Quote;