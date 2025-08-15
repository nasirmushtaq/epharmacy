const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const deliveryAgentSchema = new mongoose.Schema({
  // Basic Information
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    select: false
  },

  // Agent Details
  agentId: {
    type: String,
    unique: true,
    required: true,
    uppercase: true
  },
  vehicleType: {
    type: String,
    enum: ['bike', 'scooter', 'bicycle', 'car'],
    required: true
  },
  vehicleNumber: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  licenseNumber: {
    type: String,
    required: true,
    trim: true
  },
  
  // Location & Coverage
  baseLocation: {
    address: String,
    coordinates: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true }
    }
  },
  currentLocation: {
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  coverageRadius: {
    type: Number,
    default: 10, // kilometers
    min: 1,
    max: 50
  },

  // Status & Availability
  status: {
    type: String,
    enum: ['available', 'busy', 'offline', 'on_break'],
    default: 'offline'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  
  // Performance Metrics
  totalDeliveries: {
    type: Number,
    default: 0
  },
  successfulDeliveries: {
    type: Number,
    default: 0
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  
  // Documents & Verification
  documents: {
    aadharCard: {
      url: String,
      verified: { type: Boolean, default: false }
    },
    drivingLicense: {
      url: String,
      verified: { type: Boolean, default: false }
    },
    vehicleRC: {
      url: String,
      verified: { type: Boolean, default: false }
    },
    profilePhoto: {
      url: String,
      verified: { type: Boolean, default: false }
    }
  },

  // Shifts & Working Hours
  workingHours: {
    monday: { start: String, end: String, isWorking: Boolean },
    tuesday: { start: String, end: String, isWorking: Boolean },
    wednesday: { start: String, end: String, isWorking: Boolean },
    thursday: { start: String, end: String, isWorking: Boolean },
    friday: { start: String, end: String, isWorking: Boolean },
    saturday: { start: String, end: String, isWorking: Boolean },
    sunday: { start: String, end: String, isWorking: Boolean }
  },

  // Financial
  earningsPerKm: {
    type: Number,
    default: 5, // ₹5 per km base rate
    min: 1
  },
  bankDetails: {
    accountNumber: String,
    ifscCode: String,
    accountHolderName: String,
    verified: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

// Generate agent ID
deliveryAgentSchema.pre('save', async function(next) {
  if (this.isNew && !this.agentId) {
    const count = await this.constructor.countDocuments();
    this.agentId = `DA${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Hash password before saving
deliveryAgentSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
deliveryAgentSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Calculate success rate
deliveryAgentSchema.virtual('successRate').get(function() {
  if (this.totalDeliveries === 0) return 0;
  return Math.round((this.successfulDeliveries / this.totalDeliveries) * 100);
});

// Check if agent is available for delivery
deliveryAgentSchema.methods.isAvailableForDelivery = function() {
  if (!this.isActive || !this.isApproved) return false;
  if (this.status !== 'available') return false;
  
  // Check working hours
  const now = new Date();
  const dayOfWeek = now.toLocaleLowerCase('en-US', { weekday: 'long' });
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
  
  const workingDay = this.workingHours[dayOfWeek];
  if (!workingDay || !workingDay.isWorking) return false;
  
  return currentTime >= workingDay.start && currentTime <= workingDay.end;
};

// Update location
deliveryAgentSchema.methods.updateLocation = function(latitude, longitude) {
  this.currentLocation = {
    coordinates: { latitude, longitude },
    lastUpdated: new Date()
  };
  return this.save();
};

module.exports = mongoose.model('DeliveryAgent', deliveryAgentSchema);
