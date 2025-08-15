const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
  // Basic delivery information
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  pharmacyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  deliveryAgentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled'],
    default: 'pending'
  },
  
  // Location details
  pickupLocation: {
    address: String,
    latitude: Number,
    longitude: Number,
    contactName: String,
    contactPhone: String
  },
  
  deliveryLocation: {
    address: String,
    latitude: Number,
    longitude: Number,
    contactName: String,
    contactPhone: String
  },
  
  // Distance and timing
  distance: {
    type: Number, // in kilometers
    required: true
  },
  estimatedTime: {
    type: Number, // in minutes
    required: true
  },
  
  // OpenRouteService route data
  routeData: {
    geometry: String, // Encoded polyline from OpenRouteService
    fallback: { type: Boolean, default: false }, // True if used fallback calculation
    duration: Number, // Original route duration from ORS
    bbox: [Number] // Bounding box from ORS
  },
  
  // Delivery fee
  deliveryFee: {
    type: Number,
    required: true
  },
  
  // Timestamps
  assignedAt: Date,
  pickedUpAt: Date,
  deliveredAt: Date,
  
  // Tracking
  currentLocation: {
    latitude: Number,
    longitude: Number,
    lastUpdated: Date
  },
  
  // Notes
  deliveryNotes: String,
  
}, {
  timestamps: true
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

// Calculate distance and route using OpenRouteService
deliverySchema.statics.calculateDistanceAndRoute = async function(startLat, startLng, endLat, endLng) {
  const openRouteService = require('../config/openroute');
  
  try {
    if (openRouteService.isConfigured()) {
      const route = await openRouteService.getDirections(startLat, startLng, endLat, endLng);
      return {
        distance: route.distance,
        duration: route.duration,
        estimatedTime: openRouteService.estimateDeliveryTime(route.distance, route.duration),
        geometry: route.geometry,
        bbox: route.bbox,
        fallback: route.fallback || false
      };
    } else {
      console.warn('OpenRouteService not configured, using Haversine fallback');
      const distance = this.calculateHaversineDistance(startLat, startLng, endLat, endLng);
      const estimatedTime = this.estimateDeliveryTimeFallback(distance);
      return {
        distance,
        duration: estimatedTime,
        estimatedTime,
        geometry: null,
        bbox: null,
        fallback: true
      };
    }
  } catch (error) {
    console.error('Route calculation error:', error);
    const distance = this.calculateHaversineDistance(startLat, startLng, endLat, endLng);
    const estimatedTime = this.estimateDeliveryTimeFallback(distance);
    return {
      distance,
      duration: estimatedTime,
      estimatedTime,
      geometry: null,
      bbox: null,
      fallback: true
    };
  }
};

// Fallback Haversine distance calculation
deliverySchema.statics.calculateHaversineDistance = function(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return Math.round(distance * 100) / 100;
};

// Legacy method for backward compatibility
deliverySchema.statics.calculateDistance = function(lat1, lng1, lat2, lng2) {
  return this.calculateHaversineDistance(lat1, lng1, lat2, lng2);
};

// Fallback delivery time estimation
deliverySchema.statics.estimateDeliveryTimeFallback = function(distance) {
  const averageSpeed = 20; // km/h average speed in Srinagar traffic
  const baseTime = (distance / averageSpeed) * 60; // in minutes
  const bufferTime = Math.max(15, distance * 2); // Minimum 15 min, +2 min per km
  return Math.ceil(baseTime + bufferTime);
};

// Estimate delivery time (legacy method)
deliverySchema.statics.estimateDeliveryTime = function(distance, trafficMultiplier = 1.2) {
  return this.estimateDeliveryTimeFallback(distance);
};

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