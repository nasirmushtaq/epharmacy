const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
  // References
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  deliveryAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryAgent',
    required: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  pharmacyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Pharmacist
    required: true
  },

  // Delivery Details
  deliveryId: {
    type: String,
    unique: true,
    required: true,
    uppercase: true
  },
  status: {
    type: String,
    enum: [
      'assigned',      // Assigned to delivery agent
      'accepted',      // Agent accepted the delivery
      'picked_up',     // Agent picked up from pharmacy
      'in_transit',    // On the way to customer
      'delivered',     // Successfully delivered
      'failed',        // Delivery failed
      'cancelled',     // Delivery cancelled
      'returned'       // Returned to pharmacy
    ],
    default: 'assigned'
  },

  // Locations
  pickupLocation: {
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: { type: String, default: 'India' }
    },
    coordinates: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true }
    },
    contactPerson: String,
    contactPhone: String
  },
  deliveryLocation: {
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: { type: String, default: 'India' }
    },
    coordinates: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true }
    },
    contactPerson: String,
    contactPhone: String,
    specialInstructions: String
  },

  // Distance & Fee Calculation
  distanceDetails: {
    totalDistance: { type: Number, required: true }, // in kilometers
    estimatedTime: { type: Number, required: true }, // in minutes
    actualDistance: Number, // tracked distance
    actualTime: Number // actual delivery time
  },
  deliveryFee: {
    baseFee: { type: Number, required: true },
    distanceFee: { type: Number, required: true },
    totalFee: { type: Number, required: true },
    agentEarning: { type: Number, required: true },
    platformFee: { type: Number, required: true }
  },

  // Timeline Tracking
  timeline: [{
    status: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    location: {
      latitude: Number,
      longitude: Number
    },
    notes: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'timeline.updatedByModel'
    },
    updatedByModel: {
      type: String,
      enum: ['User', 'DeliveryAgent', 'System']
    }
  }],

  // Real-time Tracking
  currentLocation: {
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    lastUpdated: Date,
    accuracy: Number // GPS accuracy in meters
  },
  route: [{
    latitude: Number,
    longitude: Number,
    timestamp: Date,
    speed: Number // km/h
  }],

  // Delivery Verification
  deliveryProof: {
    type: {
      type: String,
      enum: ['photo', 'signature', 'otp', 'customer_confirmation'],
      default: 'customer_confirmation'
    },
    data: String, // photo URL, signature data, OTP code, etc.
    verifiedAt: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  deliveryOTP: {
    code: String,
    generatedAt: Date,
    expiresAt: Date,
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 }
  },

  // Scheduling
  scheduledPickupTime: Date,
  scheduledDeliveryTime: Date,
  actualPickupTime: Date,
  actualDeliveryTime: Date,
  estimatedDeliveryTime: Date,

  // Payment & COD
  paymentMethod: {
    type: String,
    enum: ['prepaid', 'cod'],
    required: true
  },
  codAmount: {
    type: Number,
    default: 0
  },
  codCollected: {
    type: Boolean,
    default: false
  },
  codCollectedAt: Date,

  // Quality & Feedback
  customerRating: {
    rating: { type: Number, min: 1, max: 5 },
    feedback: String,
    ratedAt: Date
  },
  deliveryNotes: String,
  specialRequirements: [String], // ['handle_with_care', 'cold_storage', 'fragile']

  // Priority & Type
  priority: {
    type: String,
    enum: ['normal', 'urgent', 'emergency'],
    default: 'normal'
  },
  deliveryType: {
    type: String,
    enum: ['standard', 'express', 'same_day'],
    default: 'standard'
  },

  // Cancellation/Failure Details
  cancellationReason: String,
  failureReason: String,
  rescheduledFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Delivery'
  },
  rescheduledTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Delivery'
  }
}, {
  timestamps: true
});

// Generate delivery ID
deliverySchema.pre('save', async function(next) {
  if (this.isNew && !this.deliveryId) {
    const count = await this.constructor.countDocuments();
    this.deliveryId = `DEL${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Add timeline entry when status changes
deliverySchema.pre('save', function(next) {
  if (this.isModified('status') && !this.isNew) {
    this.timeline.push({
      status: this.status,
      timestamp: new Date(),
      location: this.currentLocation?.coordinates,
      updatedByModel: 'System'
    });
  }
  next();
});

// Calculate delivery fee based on distance
deliverySchema.statics.calculateDeliveryFee = function(distance, priority = 'normal', deliveryType = 'standard') {
  const baseFee = 20; // ₹20 base fee
  let distanceRate = 8; // ₹8 per km
  
  // Priority multipliers
  const priorityMultipliers = {
    normal: 1,
    urgent: 1.5,
    emergency: 2
  };
  
  // Delivery type multipliers
  const typeMultipliers = {
    standard: 1,
    express: 1.3,
    same_day: 1.6
  };
  
  const priorityMultiplier = priorityMultipliers[priority] || 1;
  const typeMultiplier = typeMultipliers[deliveryType] || 1;
  
  const distanceFee = Math.ceil(distance * distanceRate * priorityMultiplier * typeMultiplier);
  const totalFee = baseFee + distanceFee;
  
  // Platform takes 20%, agent gets 80%
  const platformFee = Math.ceil(totalFee * 0.2);
  const agentEarning = totalFee - platformFee;
  
  return {
    baseFee,
    distanceFee,
    totalFee,
    agentEarning,
    platformFee
  };
};

// Calculate distance between two coordinates (Haversine formula)
deliverySchema.statics.calculateDistance = function(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return Math.round(distance * 100) / 100; // Round to 2 decimal places
};

// Estimate delivery time based on distance and traffic conditions
deliverySchema.statics.estimateDeliveryTime = function(distance, trafficMultiplier = 1.2) {
  const averageSpeed = 25; // km/h average speed in Srinagar
  const baseTime = (distance / averageSpeed) * 60; // in minutes
  const estimatedTime = Math.ceil(baseTime * trafficMultiplier);
  return Math.max(estimatedTime, 15); // Minimum 15 minutes
};

// Generate delivery OTP
deliverySchema.methods.generateDeliveryOTP = function() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
  this.deliveryOTP = {
    code: otp,
    generatedAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    attempts: 0,
    maxAttempts: 3
  };
  return otp;
};

// Verify delivery OTP
deliverySchema.methods.verifyDeliveryOTP = function(otp) {
  if (!this.deliveryOTP || !this.deliveryOTP.code) {
    return { success: false, message: 'No OTP generated' };
  }
  
  if (this.deliveryOTP.attempts >= this.deliveryOTP.maxAttempts) {
    return { success: false, message: 'Maximum attempts exceeded' };
  }
  
  if (new Date() > this.deliveryOTP.expiresAt) {
    return { success: false, message: 'OTP expired' };
  }
  
  this.deliveryOTP.attempts += 1;
  
  if (this.deliveryOTP.code === otp) {
    this.deliveryProof = {
      type: 'otp',
      data: otp,
      verifiedAt: new Date()
    };
    return { success: true, message: 'OTP verified successfully' };
  }
  
  return { success: false, message: 'Invalid OTP' };
};

// Update delivery location
deliverySchema.methods.updateLocation = function(latitude, longitude, accuracy = null) {
  this.currentLocation = {
    coordinates: { latitude, longitude },
    lastUpdated: new Date(),
    accuracy
  };
  
  // Add to route tracking
  this.route.push({
    latitude,
    longitude,
    timestamp: new Date()
  });
  
  // Keep only last 100 route points to avoid document size issues
  if (this.route.length > 100) {
    this.route = this.route.slice(-100);
  }
  
  return this.save();
};

// Check if delivery is active (can be tracked)
deliverySchema.methods.isTrackable = function() {
  return ['accepted', 'picked_up', 'in_transit'].includes(this.status);
};

module.exports = mongoose.model('Delivery', deliverySchema);