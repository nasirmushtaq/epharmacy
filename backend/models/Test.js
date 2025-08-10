const mongoose = require('mongoose');

const TestSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true, unique: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  sampleType: { type: String, default: 'blood' },
  preparation: { type: String, default: '' },
  turnaroundTimeHours: { type: Number, default: 24 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Test', TestSchema); 