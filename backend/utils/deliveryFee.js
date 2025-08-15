const config = require('../config/config');

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate delivery fee based on distance from central location
 * @param {Object} address - Address object with location coordinates
 * @param {number} orderValue - Total order value
 * @returns {Object} Delivery fee calculation details
 */
function calculateDeliveryFee(address, orderValue = 0) {
  const { delivery } = config;
  
  // If no coordinates, return base fee
  if (!address?.location?.latitude || !address?.location?.longitude) {
    return {
      fee: delivery.baseFee,
      distance: null,
      isFree: orderValue >= delivery.freeDeliveryThreshold,
      finalFee: orderValue >= delivery.freeDeliveryThreshold ? 0 : delivery.baseFee,
      breakdown: {
        baseFee: delivery.baseFee,
        distanceFee: 0,
        freeDeliveryApplied: orderValue >= delivery.freeDeliveryThreshold,
      }
    };
  }
  
  // Calculate distance from central location
  const distance = calculateDistance(
    delivery.centralLocation.latitude,
    delivery.centralLocation.longitude,
    address.location.latitude,
    address.location.longitude
  );
  
  // Check if within delivery range
  const isWithinRange = distance <= delivery.maxDeliveryDistance;
  
  if (!isWithinRange) {
    return {
      fee: null,
      distance,
      isFree: false,
      finalFee: null,
      isDeliverable: false,
      message: `Delivery not available beyond ${delivery.maxDeliveryDistance}km from ${delivery.centralLocation.name}`,
      breakdown: {
        baseFee: delivery.baseFee,
        distanceFee: 0,
        freeDeliveryApplied: false,
        exceedsRange: true,
      }
    };
  }
  
  // Calculate distance-based fee
  const distanceFee = Math.max(0, (distance - 5)) * delivery.perKmRate; // Free for first 5km
  const totalFee = delivery.baseFee + distanceFee;
  
  // Check for free delivery
  const isFree = orderValue >= delivery.freeDeliveryThreshold;
  const finalFee = isFree ? 0 : totalFee;
  
  return {
    fee: totalFee,
    distance,
    isFree,
    finalFee,
    isDeliverable: true,
    centralLocation: delivery.centralLocation.name,
    breakdown: {
      baseFee: delivery.baseFee,
      distanceFee,
      freeDeliveryApplied: isFree,
      freeThreshold: delivery.freeDeliveryThreshold,
    }
  };
}

/**
 * Get delivery estimate for an address
 * @param {Object} address - Address object
 * @param {number} orderValue - Order value
 * @returns {Object} Delivery estimate
 */
function getDeliveryEstimate(address, orderValue = 0) {
  const feeCalculation = calculateDeliveryFee(address, orderValue);
  
  // Estimated delivery time based on distance
  let estimatedHours = 24; // Default 24 hours
  if (feeCalculation.distance) {
    if (feeCalculation.distance <= 10) estimatedHours = 2;
    else if (feeCalculation.distance <= 25) estimatedHours = 6;
    else if (feeCalculation.distance <= 50) estimatedHours = 12;
  }
  
  return {
    ...feeCalculation,
    estimatedDeliveryHours: estimatedHours,
    estimatedDeliveryTime: new Date(Date.now() + estimatedHours * 60 * 60 * 1000),
  };
}

module.exports = {
  calculateDistance,
  calculateDeliveryFee,
  getDeliveryEstimate,
};
