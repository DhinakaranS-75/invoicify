import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  companyId: { type: String, required: true, index: true },
  desc: { type: String, required: true },
  amount: { type: Number, required: true },
  date: String,          // ISO date string, e.g. "2026-08-20"
  category: { type: String, default: 'Other' },
  method: { type: String, default: 'Cash' }
}, { timestamps: true });

const Expense = mongoose.model('Expense', expenseSchema);
export default Expense;