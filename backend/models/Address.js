const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    match: [/^\+?[\d\s\-\(\)]{10,15}$/, 'Please enter a valid phone number']
  },
  line1: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  line2: {
    type: String,
    trim: true,
    maxlength: 200
  },
  city: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  state: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  zipCode: {
    type: String,
    required: true,
    trim: true,
    match: [/^[\d\-\s]{3,10}$/, 'Please enter a valid zip code']
  },
  country: {
    type: String,
    default: 'India',
    maxlength: 50
  },
  location: {
    latitude: {
      type: Number,
      required: false, // Made optional since location capture might not always be available
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      required: false, // Made optional since location capture might not always be available
      min: -180,
      max: 180
    },
    accuracy: {
      type: Number, // GPS accuracy in meters
      min: 0
    },
    source: {
      type: String,
      enum: ['gps', 'network', 'manual', 'openroute_service'],
      default: 'manual'
    }
  },
  
  // OpenRouteService Integration
  openRouteData: {
    id: String, // OpenRouteService feature ID
    label: String, // Formatted address label
    confidence: Number, // Geocoding confidence score
    layer: String, // Layer type (address, street, venue, etc.)
    source: String, // Data source
    address: {
      name: String,
      street: String,
      housenumber: String,
      neighbourhood: String,
      locality: String,
      region: String,
      country: String,
      postalcode: String
    }
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  addressType: {
    type: String,
    enum: ['home', 'office', 'other'],
    default: 'home'
  },
  landmark: {
    type: String,
    trim: true,
    maxlength: 200
  }
}, {
  timestamps: true
});

// Index for faster queries
addressSchema.index({ user: 1, isDefault: 1 });
addressSchema.index({ user: 1, createdAt: -1 });

// Ensure only one default address per user
addressSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    // Remove default flag from other addresses of the same user
    await this.constructor.updateMany(
      { user: this.user, _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }
  next();
});

// Virtual for full address
addressSchema.virtual('fullAddress').get(function() {
  const parts = [this.line1];
  if (this.line2) parts.push(this.line2);
  if (this.landmark) parts.push(`Near ${this.landmark}`);
  parts.push(`${this.city}, ${this.state} ${this.zipCode}`);
  return parts.join(', ');
});

// Calculate distance to another address
addressSchema.methods.distanceTo = function(otherAddress) {
  if (!this.location?.latitude || !this.location?.longitude || 
      !otherAddress.location?.latitude || !otherAddress.location?.longitude) {
    return null;
  }
  
  const R = 6371; // Earth's radius in kilometers
  const dLat = (otherAddress.location.latitude - this.location.latitude) * Math.PI / 180;
  const dLon = (otherAddress.location.longitude - this.location.longitude) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(this.location.latitude * Math.PI / 180) * Math.cos(otherAddress.location.latitude * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return Math.round(distance * 100) / 100; // Round to 2 decimal places
};

// Check if address is within Srinagar city limits
addressSchema.methods.isWithinSrinagar = function() {
  if (!this.location?.latitude || !this.location?.longitude) {
    return false;
  }
  
  const openRouteService = require('../config/openroute');
  return openRouteService.isWithinSrinagar(this.location.latitude, this.location.longitude);
};

// Validate if coordinates match the city (only when feature flag is enabled and location is provided)
addressSchema.pre('save', function(next) {
  // Only validate location if both latitude and longitude are provided
  if (this.location?.latitude && this.location?.longitude) {
    const config = require('../config/config');
    if (config.featureFlags.enforceLocationRestrictions && !this.isWithinSrinagar()) {
      return next(new Error('Address coordinates must be within Srinagar city limits'));
    }
  }
  // If no location provided, skip validation (location is optional)
  next();
});

// Ensure virtuals are included in JSON output
addressSchema.set('toJSON', { virtuals: true });
addressSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Address', addressSchema);
