import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema({
  attention: String,
  country: String,
  street1: String,
  street2: String,
  city: String,
  state: String,
  pincode: String,
  phone: String
}, { _id: false });

const customerSchema = new mongoose.Schema({
  companyId: { type: String, required: true, index: true },
  type: { type: String, default: 'Business' },
  company: String,
  gst: String,
  name: { type: String, required: true },
  email: String,
  phone: String,
  address: String,        // short "City, State" summary
  billing: addressSchema,
  shipping: addressSchema
}, { timestamps: true });

const Customer = mongoose.model('Customer', customerSchema);
export default Customer;
