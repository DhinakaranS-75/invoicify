import Expense from '../models/Expense.js';

// GET /api/expenses
export async function getExpenses(req, res) {
  try {
    const expenses = await Expense.find({ companyId: req.user.companyId }).sort({ createdAt: 1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/expenses
export async function createExpense(req, res) {
  try {
    const expense = await Expense.create({ ...req.body, companyId: req.user.companyId });
    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// DELETE /api/expenses/:id
export async function deleteExpense(req, res) {
  try {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, companyId: req.user.companyId });
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    res.json({ message: 'Expense deleted', id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}