const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
  deliveryNumber: {
    type: String,
    unique: true,
    required: [true, 'Delivery number is required']
  },
  
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: [true, 'Order is required']
  },
  
  deliveryAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Delivery agent is required']
  },
  
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Customer is required']
  },
  
  // Delivery addresses
  pickupAddress: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  
  deliveryAddress: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    phone: { type: String, required: true },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  
  // Status tracking
  status: {
    type: String,
    enum: [
      'assigned',
      'picked_up',
      'in_transit', 
      'delivered',
      'failed',
      'returned'
    ],
    default: 'assigned'
  },
  
  // Timing
  assignedAt: {
    type: Date,
    default: Date.now
  },
  pickedUpAt: Date,
  deliveredAt: Date,
  estimatedDeliveryTime: Date,
  
  // Delivery details
  deliveryInstructions: String,
  deliveryNotes: String,
  
  // Proof of delivery
  deliveryImages: [String],
  recipientName: String,
  recipientSignature: String,
  
  // Failed delivery
  failureReason: String,
  attemptCount: {
    type: Number,
    default: 1
  },
  
  // Route optimization
  distance: Number, // in kilometers
  estimatedDuration: Number, // in minutes
  
  // Location tracking
  currentLocation: {
    latitude: Number,
    longitude: Number,
    lastUpdated: Date
  },
  
  // Payment collection (for COD)
  paymentCollected: {
    type: Boolean,
    default: false
  },
  collectedAmount: {
    type: Number,
    default: 0
  },
  
  // Rating
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  feedback: String
  
}, {
  timestamps: true
});

// Generate delivery number
deliverySchema.pre('save', function(next) {
  if (!this.deliveryNumber) {
    this.deliveryNumber = `DEL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }
  next();
});

// Instance methods
deliverySchema.methods.updateStatus = function(newStatus, notes = '') {
  this.status = newStatus;
  
  switch (newStatus) {
    case 'picked_up':
      this.pickedUpAt = new Date();
      break;
    case 'delivered':
      this.deliveredAt = new Date();
      break;
  }
  
  if (notes) {
    this.deliveryNotes = notes;
  }
  
  return this.save();
};

deliverySchema.methods.updateLocation = function(latitude, longitude) {
  this.currentLocation = {
    latitude,
    longitude,
    lastUpdated: new Date()
  };
  return this.save();
};

module.exports = mongoose.model('Delivery', deliverySchema); 