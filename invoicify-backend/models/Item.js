import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  companyId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, default: 'Goods' },
  sku: String,
  category: String,
  description: String,
  price: { type: Number, default: 0 },        // purchase rate
  sellingPrice: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  unit: { type: String, default: 'Box' }
}, { timestamps: true });

const Item = mongoose.model('Item', itemSchema);
export default Item;
