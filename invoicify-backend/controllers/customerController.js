import Customer from '../models/Customer.js';

// GET /api/customers
export async function getCustomers(req, res) {
  try {
    const customers = await Customer.find({ companyId: req.user.companyId }).sort({ createdAt: 1 });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/customers
export async function createCustomer(req, res) {
  try {
    const customer = await Customer.create({ ...req.body, companyId: req.user.companyId });
    res.status(201).json(customer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// PUT /api/customers/:id
export async function updateCustomer(req, res) {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    Object.assign(customer, req.body);
    await customer.save();
    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// DELETE /api/customers/:id
export async function deleteCustomer(req, res) {
  try {
    const customer = await Customer.findOneAndDelete({ _id: req.params.id, companyId: req.user.companyId });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json({ message: 'Customer deleted', id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}
