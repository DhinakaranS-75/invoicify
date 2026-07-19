import Item from '../models/Item.js';

// GET /api/items
export async function getItems(req, res) {
  try {
    const items = await Item.find({ companyId: req.user.companyId }).sort({ createdAt: 1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/items
export async function createItem(req, res) {
  try {
    const item = await Item.create({ ...req.body, companyId: req.user.companyId });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// PUT /api/items/:id
export async function updateItem(req, res) {
  try {
    const item = await Item.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    Object.assign(item, req.body);
    await item.save();
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// DELETE /api/items/:id
export async function deleteItem(req, res) {
  try {
    const item = await Item.findOneAndDelete({ _id: req.params.id, companyId: req.user.companyId });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: 'Item deleted', id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}
