const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Customer is required']
  },
  prescriptionNumber: {
    type: String,
    unique: true,
    required: [true, 'Prescription number is required']
  },
  
  // Prescription images/documents
  documents: [{
    url: {
      type: String,
      required: true
    },
    originalName: String,
    mimetype: String,
    size: Number,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Doctor information
  doctorInfo: {
    name: {
      type: String,
      required: [true, 'Doctor name is required'],
      trim: true
    },
    registrationNumber: {
      type: String,
      required: [true, 'Doctor registration number is required'],
      trim: true
    },
    specialty: {
      type: String,
      trim: true
    },
    hospital: {
      type: String,
      trim: true
    },
    phone: {
      type: String,
      match: [/^\+?[\d\s\-\(\)]+$/, 'Please provide a valid phone number']
    }
  },
  
  // Patient information
  patientInfo: {
    name: {
      type: String,
      required: [true, 'Patient name is required'],
      trim: true
    },
    age: {
      type: Number,
      required: [true, 'Patient age is required'],
      min: [0, 'Age cannot be negative'],
      max: [150, 'Age cannot exceed 150']
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: [true, 'Gender is required']
    },
    weight: {
      type: Number,
      min: [0, 'Weight cannot be negative']
    },
    allergies: [{
      type: String,
      trim: true
    }],
    medicalConditions: [{
      type: String,
      trim: true
    }]
  },
  
  // Prescribed medicines (parsed from prescription)
  medicines: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    dosage: {
      type: String,
      required: true
    },
    frequency: {
      type: String,
      required: true
    },
    duration: {
      type: String,
      required: true
    },
    instructions: {
      type: String,
      trim: true
    },
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine'
    },
    quantity: {
      type: Number,
      min: [1, 'Quantity must be at least 1']
    },
    isAvailable: {
      type: Boolean,
      default: false
    },
    substitutes: [{
      medicineId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Medicine'
      },
      name: String,
      reason: String
    }]
  }],
  
  // Prescription dates
  prescriptionDate: {
    type: Date,
    required: [true, 'Prescription date is required']
  },
  validUntil: {
    type: Date,
    required: [true, 'Prescription validity is required']
  },
  
  // Status workflow
  status: {
    type: String,
    enum: ['pending', 'under_review', 'approved', 'rejected', 'partially_approved', 'expired'],
    default: 'pending'
  },
  
  // Review information
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Pharmacist who reviewed
  },
  reviewDate: Date,
  reviewNotes: {
    type: String,
    maxlength: [1000, 'Review notes cannot exceed 1000 characters']
  },
  rejectionReason: {
    type: String,
    maxlength: [500, 'Rejection reason cannot exceed 500 characters']
  },
  
  // Additional verification
  verificationCode: {
    type: String,
    unique: true,
    sparse: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  
  // Priority
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  
  // Usage tracking
  orderCreated: {
    type: Boolean,
    default: false
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  
  // Metadata
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  
  // Auto-expiry handling
  isExpired: {
    type: Boolean,
    default: false
  },
  
  // Communication
  communicationHistory: [{
    message: String,
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    type: {
      type: String,
      enum: ['note', 'question', 'clarification', 'approval', 'rejection']
    }
  }]
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtuals
prescriptionSchema.virtual('isValid').get(function() {
  return this.validUntil > new Date() && !this.isExpired;
});

prescriptionSchema.virtual('daysUntilExpiry').get(function() {
  const now = new Date();
  const diffTime = this.validUntil - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

prescriptionSchema.virtual('totalMedicines').get(function() {
  return this.medicines.length;
});

prescriptionSchema.virtual('availableMedicines').get(function() {
  return this.medicines.filter(med => med.isAvailable).length;
});

prescriptionSchema.virtual('approvalPercentage').get(function() {
  if (this.medicines.length === 0) return 0;
  return (this.availableMedicines / this.totalMedicines) * 100;
});

// Indexes
prescriptionSchema.index({ customer: 1, status: 1 });
prescriptionSchema.index({ prescriptionNumber: 1 });
prescriptionSchema.index({ status: 1, priority: 1 });
prescriptionSchema.index({ prescriptionDate: -1 });
prescriptionSchema.index({ validUntil: 1 });
prescriptionSchema.index({ reviewedBy: 1 });
prescriptionSchema.index({ 'doctorInfo.registrationNumber': 1 });

// Pre-save middleware
prescriptionSchema.pre('save', function(next) {
  // Generate prescription number if not exists
  if (!this.prescriptionNumber) {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.prescriptionNumber = `RX-${timestamp}-${random}`;
  }
  
  // Generate verification code if not exists
  if (!this.verificationCode && this.status === 'approved') {
    this.verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
  }
  
  // Check if prescription has expired
  if (this.validUntil < new Date()) {
    this.isExpired = true;
    if (this.status === 'pending' || this.status === 'under_review') {
      this.status = 'expired';
    }
  }
  
  // Set priority based on patient age or medical conditions
  if (!this.priority || this.priority === 'normal') {
    if (this.patientInfo.age >= 65 || this.patientInfo.age <= 5) {
      this.priority = 'high';
    } else if (this.patientInfo.medicalConditions.some(condition => 
      ['diabetes', 'heart disease', 'cancer', 'kidney disease'].includes(condition.toLowerCase())
    )) {
      this.priority = 'high';
    }
  }
  
  next();
});

// Static methods
prescriptionSchema.statics.findPendingReviews = function() {
  return this.find({
    status: { $in: ['pending', 'under_review'] },
    isExpired: false
  }).sort({ priority: -1, createdAt: 1 });
};

prescriptionSchema.statics.findByPharmacist = function(pharmacistId) {
  return this.find({ reviewedBy: pharmacistId });
};

prescriptionSchema.statics.findExpiringSoon = function(days = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    validUntil: { $lte: futureDate, $gt: new Date() },
    status: { $in: ['approved', 'partially_approved'] },
    isExpired: false
  });
};

prescriptionSchema.statics.findByCustomer = function(customerId) {
  return this.find({ customer: customerId }).sort({ createdAt: -1 });
};

// Instance methods
prescriptionSchema.methods.approve = function(pharmacistId, notes = '') {
  this.status = 'approved';
  this.reviewedBy = pharmacistId;
  this.reviewDate = new Date();
  this.reviewNotes = notes;
  this.isVerified = true;
  
  // Mark all medicines as available (would be checked against inventory)
  this.medicines.forEach(med => {
    med.isAvailable = true;
  });
  
  return this.save();
};

prescriptionSchema.methods.reject = function(pharmacistId, reason, notes = '') {
  this.status = 'rejected';
  this.reviewedBy = pharmacistId;
  this.reviewDate = new Date();
  this.rejectionReason = reason;
  this.reviewNotes = notes;
  
  return this.save();
};

prescriptionSchema.methods.partiallyApprove = function(pharmacistId, availableMedicineIds, notes = '') {
  this.status = 'partially_approved';
  this.reviewedBy = pharmacistId;
  this.reviewDate = new Date();
  this.reviewNotes = notes;
  
  // Mark only available medicines
  this.medicines.forEach(med => {
    med.isAvailable = availableMedicineIds.includes(med._id.toString());
  });
  
  return this.save();
};

prescriptionSchema.methods.addCommunication = function(message, senderId, type = 'note') {
  this.communicationHistory.push({
    message,
    sender: senderId,
    type,
    timestamp: new Date()
  });
  
  return this.save();
};

prescriptionSchema.methods.markAsOrderCreated = function(orderId) {
  this.orderCreated = true;
  this.orderId = orderId;
  return this.save();
};

// Check and update expired prescriptions
prescriptionSchema.statics.updateExpiredPrescriptions = async function() {
  const result = await this.updateMany(
    {
      validUntil: { $lt: new Date() },
      isExpired: false
    },
    {
      $set: { isExpired: true },
      $addToSet: { status: 'expired' }
    }
  );
  
  return result;
};

module.exports = mongoose.model('Prescription', prescriptionSchema); 