const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  pharmacy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },

  // Commercials (per pharmacy)
  mrp: { type: Number, min: 0, default: 0 },
  sellingPrice: { type: Number, min: 0, default: 0 },

  // Stock
  stockQuantity: { type: Number, min: 0, default: 0 },
  minStockLevel: { type: Number, min: 0, default: 0 },
  isActive: { type: Boolean, default: true },

  // Batch
  batchNumber: { type: String, default: null },
  manufacturingDate: { type: Date },
  expiryDate: { type: Date },
}, {
  timestamps: true
});

inventorySchema.index({ pharmacy: 1, product: 1, batchNumber: 1 }, { unique: true, sparse: true });

inventorySchema.virtual('isExpired').get(function() {
  return this.expiryDate && this.expiryDate < new Date();
});

inventorySchema.methods.updateStock = function(quantity, op = 'subtract') {
  if (op === 'add') this.stockQuantity += quantity; else this.stockQuantity = Math.max(0, this.stockQuantity - quantity);
  return this.save();
};

module.exports = mongoose.model('Inventory', inventorySchema);


