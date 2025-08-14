const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  // Core identity
  name: { type: String, required: true, trim: true, maxlength: 200 },
  genericName: { type: String, required: true, trim: true },
  brand: { type: String, required: true, trim: true },
  manufacturer: { type: String, required: true, trim: true },
  description: { type: String, required: true, maxlength: 2000 },
  category: {
    type: String,
    required: true,
    enum: [
      'tablets', 'capsules', 'syrups', 'injections', 'ointments',
      'drops', 'inhalers', 'supplements', 'antibiotics', 'painkillers',
      'diabetes', 'heart', 'blood_pressure', 'vitamins', 'others'
    ]
  },
  composition: [{
    ingredient: { type: String, required: true },
    strength: { type: String, required: true },
    unit: { type: String, enum: ['mg', 'g', 'ml', 'mcg', 'iu', '%'], required: true }
  }],
  dosageForm: { type: String, required: true, enum: ['tablet', 'capsule', 'syrup', 'injection', 'ointment', 'cream', 'drops', 'inhaler', 'patch'] },
  strength: { type: String, required: true },
  packSize: { type: Number, required: true, min: 1 },
  unit: { type: String, required: true, enum: ['tablets', 'capsules', 'ml', 'grams', 'pieces', 'strips'] },

  // Admin pricing (visible to customers)
  mrp: { type: Number, min: 0, default: 0 },
  sellingPrice: { type: Number, min: 0, default: 0 },
  discount: { type: Number, min: 0, max: 100, default: 0 },

  // Regulatory
  isPrescriptionRequired: { type: Boolean, default: true },
  scheduleType: { type: String, enum: ['H', 'H1', 'X', 'G', 'OTC'], required: true },

  // Media
  images: [{ url: String, alt: String, isPrimary: { type: Boolean, default: false } }],

  // Status
  isActive: { type: Boolean, default: true },
  // Admin-decided availability & catalog stock (customers don't see per-pharmacy stock)
  isAvailable: { type: Boolean, default: true },
  catalogStock: { type: Number, min: 0, default: 0 },
  tags: [{ type: String, lowercase: true, trim: true }],

  // Legacy mapping (for migration from Medicine)
  legacyMedicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', index: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

productSchema.index({ name: 'text', genericName: 'text', brand: 'text', description: 'text' });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ scheduleType: 1 });

// Ensure one image marked primary
productSchema.pre('save', function(next) {
  if (this.images && this.images.length > 0) {
    const hasPrimary = this.images.some(i => i.isPrimary);
    if (!hasPrimary) this.images[0].isPrimary = true;
  }
  if (this.mrp && this.sellingPrice && !this.discount) {
    const d = ((this.mrp - this.sellingPrice) / (this.mrp || 1)) * 100;
    this.discount = Math.max(0, Math.min(100, Math.round(d)));
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);


