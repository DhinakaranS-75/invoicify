import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  amount: Number,
  date: String,
  method: String
}, { _id: false });

const invoiceItemSchema = new mongoose.Schema({
  name: String,
  description: String,
  hsn: String, // HSN/SAC code, frozen at invoice time (item's code may change later)
  qty: Number,
  rate: Number
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  // Which company this invoice belongs to (team members share a companyId)
  companyId: { type: String, required: true, index: true },
  // Who created it
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  number: String,
  orderNumber: String,
  date: String,
  dueDate: String,
  client: String,
  status: { type: String, default: 'Draft' },
  total: { type: Number, default: 0 },
  payments: [paymentSchema],

  // Snapshot of all invoice detail fields (matches the frontend "snapshot")
  snapshot: {
    toEmail: String,
    toPhone: String,
    toAddr: String,
    shipTo: String,
    subject: String,
    orderNumber: String,
    notes: String,
    taxPct: Number,
    discountPct: Number,
    signature: String,
    items: [invoiceItemSchema]
  }
}, { timestamps: true });

const Invoice = mongoose.model('Invoice', invoiceSchema);
export default Invoice;
