const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Medicine name is required'],
    trim: true,
    maxlength: [200, 'Medicine name cannot exceed 200 characters']
  },
  genericName: {
    type: String,
    required: [true, 'Generic name is required'],
    trim: true
  },
  brand: {
    type: String,
    required: [true, 'Brand is required'],
    trim: true
  },
  manufacturer: {
    type: String,
    required: [true, 'Manufacturer is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'tablets', 'capsules', 'syrups', 'injections', 'ointments', 
      'drops', 'inhalers', 'supplements', 'antibiotics', 'painkillers',
      'diabetes', 'heart', 'blood_pressure', 'vitamins', 'others'
    ]
  },
  composition: [{
    ingredient: {
      type: String,
      required: true
    },
    strength: {
      type: String,
      required: true
    },
    unit: {
      type: String,
      required: true,
      enum: ['mg', 'g', 'ml', 'mcg', 'iu', '%']
    }
  }],
  dosageForm: {
    type: String,
    required: [true, 'Dosage form is required'],
    enum: ['tablet', 'capsule', 'syrup', 'injection', 'ointment', 'cream', 'drops', 'inhaler', 'patch']
  },
  strength: {
    type: String,
    required: [true, 'Strength is required']
  },
  packSize: {
    type: Number,
    required: [true, 'Pack size is required'],
    min: [1, 'Pack size must be at least 1']
  },
  unit: {
    type: String,
    required: [true, 'Unit is required'],
    enum: ['tablets', 'capsules', 'ml', 'grams', 'pieces', 'strips']
  },
  
  // Pricing
  mrp: {
    type: Number,
    required: [true, 'MRP is required'],
    min: [0, 'MRP cannot be negative']
  },
  sellingPrice: {
    type: Number,
    required: [true, 'Selling price is required'],
    min: [0, 'Selling price cannot be negative']
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative'],
    max: [100, 'Discount cannot exceed 100%']
  },
  
  // Prescription requirements
  isPrescriptionRequired: {
    type: Boolean,
    default: true
  },
  scheduleType: {
    type: String,
    enum: ['H', 'H1', 'X', 'G', 'OTC'], // H=Schedule H, H1=Schedule H1, X=Narcotic, G=Schedule G, OTC=Over the counter
    required: [true, 'Schedule type is required']
  },
  
  // Inventory
  stockQuantity: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock quantity cannot be negative']
  },
  minStockLevel: {
    type: Number,
    default: 10,
    min: [0, 'Minimum stock level cannot be negative']
  },
  maxStockLevel: {
    type: Number,
    default: 1000,
    min: [1, 'Maximum stock level must be at least 1']
  },
  
  // Dates
  manufacturingDate: {
    type: Date,
    required: [true, 'Manufacturing date is required']
  },
  expiryDate: {
    type: Date,
    required: [true, 'Expiry date is required'],
    validate: {
      validator: function(value) {
        return value > this.manufacturingDate;
      },
      message: 'Expiry date must be after manufacturing date'
    }
  },
  
  // Additional information
  sideEffects: [{
    type: String,
    trim: true
  }],
  contraindications: [{
    type: String,
    trim: true
  }],
  interactions: [{
    type: String,
    trim: true
  }],
  usageInstructions: {
    type: String,
    required: [true, 'Usage instructions are required'],
    maxlength: [1000, 'Usage instructions cannot exceed 1000 characters']
  },
  storageInstructions: {
    type: String,
    required: [true, 'Storage instructions are required'],
    maxlength: [500, 'Storage instructions cannot exceed 500 characters']
  },
  
  // Images
  images: [{
    url: String,
    alt: String,
    isPrimary: { type: Boolean, default: false }
  }],
  
  // Status and visibility
  isActive: {
    type: Boolean,
    default: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  
  // SEO and search
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  
  // Tracking
  totalSold: {
    type: Number,
    default: 0
  },
  viewCount: {
    type: Number,
    default: 0
  },
  
  // Ratings and reviews
  averageRating: {
    type: Number,
    default: 0,
    min: [0, 'Rating cannot be negative'],
    max: [5, 'Rating cannot exceed 5']
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  
  // Pharmacist who added this medicine
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Batch information
  batchNumber: {
    type: String,
    required: [true, 'Batch number is required']
  },
  
  // Regulatory information
  drugLicenseNumber: String,
  fssaiNumber: String,
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtuals
medicineSchema.virtual('isExpired').get(function() {
  return this.expiryDate < new Date();
});

medicineSchema.virtual('isLowStock').get(function() {
  return this.stockQuantity <= this.minStockLevel;
});

medicineSchema.virtual('discountAmount').get(function() {
  return this.mrp - this.sellingPrice;
});

medicineSchema.virtual('discountPercentage').get(function() {
  return this.mrp > 0 ? ((this.mrp - this.sellingPrice) / this.mrp) * 100 : 0;
});

medicineSchema.virtual('isInStock').get(function() {
  return this.stockQuantity > 0 && !this.isExpired && this.isActive;
});

// Indexes for better query performance
medicineSchema.index({ name: 'text', genericName: 'text', brand: 'text', description: 'text' });
medicineSchema.index({ category: 1, isActive: 1 });
medicineSchema.index({ isPrescriptionRequired: 1 });
medicineSchema.index({ expiryDate: 1 });
medicineSchema.index({ stockQuantity: 1 });
medicineSchema.index({ averageRating: -1 });
medicineSchema.index({ totalSold: -1 });
medicineSchema.index({ sellingPrice: 1 });

// Pre-save middleware
medicineSchema.pre('save', function(next) {
  // Ensure at least one image is marked as primary
  if (this.images && this.images.length > 0) {
    const hasPrimary = this.images.some(img => img.isPrimary);
    if (!hasPrimary) {
      this.images[0].isPrimary = true;
    }
  }
  
  // Calculate discount if not set
  if (this.mrp && this.sellingPrice && !this.discount) {
    this.discount = ((this.mrp - this.sellingPrice) / this.mrp) * 100;
  }
  
  next();
});

// Static methods
medicineSchema.statics.findAvailable = function() {
  return this.find({
    isActive: true,
    isAvailable: true,
    stockQuantity: { $gt: 0 },
    expiryDate: { $gt: new Date() }
  });
};

medicineSchema.statics.findByCategory = function(category) {
  return this.findAvailable().where({ category });
};

medicineSchema.statics.findLowStock = function() {
  return this.find({
    $expr: { $lte: ['$stockQuantity', '$minStockLevel'] },
    isActive: true
  });
};

medicineSchema.statics.findExpiringSoon = function(days = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    expiryDate: { $lte: futureDate, $gt: new Date() },
    isActive: true
  });
};

// Instance methods
medicineSchema.methods.updateStock = function(quantity, operation = 'subtract') {
  if (operation === 'add') {
    this.stockQuantity += quantity;
  } else {
    this.stockQuantity = Math.max(0, this.stockQuantity - quantity);
  }
  return this.save();
};

medicineSchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  return this.save();
};

medicineSchema.methods.updateRating = function(newRating) {
  const totalRating = this.averageRating * this.reviewCount + newRating;
  this.reviewCount += 1;
  this.averageRating = totalRating / this.reviewCount;
  return this.save();
};

module.exports = mongoose.model('Medicine', medicineSchema); 