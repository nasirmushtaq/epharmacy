const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { calculateDeliveryFee, getDeliveryEstimate } = require('../utils/deliveryFee');
const Address = require('../models/Address');
const config = require('../config/config');

// @desc    Calculate delivery fee for an address
// @route   POST /api/delivery/calculate-fee
// @access  Private
router.post('/calculate-fee', authenticate, async (req, res) => {
  try {
    const { addressId, address, orderValue = 0 } = req.body;
    
    let targetAddress;
    
    if (addressId) {
      // Use existing address
      targetAddress = await Address.findOne({
        _id: addressId,
        user: req.user._id
      });
      
      if (!targetAddress) {
        return res.status(404).json({
          success: false,
          message: 'Address not found'
        });
      }
    } else if (address) {
      // Use provided address object
      targetAddress = address;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Either addressId or address object is required'
      });
    }
    
    const estimate = getDeliveryEstimate(targetAddress, orderValue);
    
    res.json({
      success: true,
      data: {
        ...estimate,
        orderValue,
        centralLocation: config.delivery.centralLocation,
        policies: {
          freeDeliveryThreshold: config.delivery.freeDeliveryThreshold,
          maxDeliveryDistance: config.delivery.maxDeliveryDistance,
          baseFee: config.delivery.baseFee,
          perKmRate: config.delivery.perKmRate,
        }
      }
    });
    
  } catch (error) {
    console.error('Error calculating delivery fee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate delivery fee',
      error: error.message
    });
  }
});

// @desc    Get delivery configuration
// @route   GET /api/delivery/config
// @access  Private
router.get('/config', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        centralLocation: config.delivery.centralLocation,
        baseFee: config.delivery.baseFee,
        perKmRate: config.delivery.perKmRate,
        freeDeliveryThreshold: config.delivery.freeDeliveryThreshold,
        maxDeliveryDistance: config.delivery.maxDeliveryDistance,
      }
    });
  } catch (error) {
    console.error('Error fetching delivery config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch delivery configuration',
      error: error.message
    });
  }
});

module.exports = router;
