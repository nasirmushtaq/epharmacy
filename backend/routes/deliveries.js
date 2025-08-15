const express = require('express');
const router = express.Router();
const Delivery = require('../models/Delivery');
const DeliveryAgent = require('../models/DeliveryAgent');
const Order = require('../models/Order');
const User = require('../models/User');
const Address = require('../models/Address');
const auth = require('../middleware/auth');
const { adminOnly, pharmacistOnly, deliveryAgentOnly } = require('../middleware/roleAuth');

// @route   POST /api/deliveries/assign
// @desc    Assign delivery to an agent (when order is confirmed by pharmacist)
// @access  Private (Admin/Pharmacist)
router.post('/assign', auth, async (req, res) => {
  try {
    const { orderId, deliveryAgentId, priority = 'normal', deliveryType = 'standard' } = req.body;

    // Verify order exists and is confirmed
    const order = await Order.findById(orderId)
      .populate('customerId', 'firstName lastName phone')
      .populate('pharmacy', 'firstName lastName phone address')
      .populate('deliveryAddress');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Order must be confirmed before assigning delivery'
      });
    }

    // Check if delivery already exists for this order
    const existingDelivery = await Delivery.findOne({ orderId });
    if (existingDelivery) {
      return res.status(400).json({
        success: false,
        message: 'Delivery already assigned for this order'
      });
    }

    // Verify delivery agent
    const deliveryAgent = await DeliveryAgent.findById(deliveryAgentId);
    if (!deliveryAgent || !deliveryAgent.isActive || !deliveryAgent.isApproved) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or unavailable delivery agent'
      });
    }

    // Get pharmacy address from user profile
    const pharmacy = await User.findById(order.pharmacy._id);
    if (!pharmacy.address) {
      return res.status(400).json({
        success: false,
        message: 'Pharmacy address not found'
      });
    }

    // Calculate distance and delivery fee
    const pickupCoords = {
      latitude: pharmacy.address.location?.latitude || 34.0837, // Default Srinagar coords
      longitude: pharmacy.address.location?.longitude || 74.7973
    };

    const deliveryCoords = {
      latitude: order.deliveryAddress.location.latitude,
      longitude: order.deliveryAddress.location.longitude
    };

    const distance = Delivery.calculateDistance(
      pickupCoords.latitude,
      pickupCoords.longitude,
      deliveryCoords.latitude,
      deliveryCoords.longitude
    );

    const estimatedTime = Delivery.estimateDeliveryTime(distance);
    const deliveryFee = Delivery.calculateDeliveryFee(distance, priority, deliveryType);

    // Create delivery
    const delivery = new Delivery({
      orderId,
      deliveryAgent: deliveryAgentId,
      customerId: order.customerId._id,
      pharmacyId: order.pharmacy._id,
      
      pickupLocation: {
        address: {
          street: pharmacy.address.street,
          city: pharmacy.address.city,
          state: pharmacy.address.state,
          zipCode: pharmacy.address.zipCode,
          country: pharmacy.address.country
        },
        coordinates: pickupCoords,
        contactPerson: `${pharmacy.firstName} ${pharmacy.lastName}`,
        contactPhone: pharmacy.phone
      },
      
      deliveryLocation: {
        address: {
          street: order.deliveryAddress.line1,
          city: order.deliveryAddress.city,
          state: order.deliveryAddress.state,
          zipCode: order.deliveryAddress.zipCode,
          country: order.deliveryAddress.country
        },
        coordinates: deliveryCoords,
        contactPerson: order.deliveryAddress.name,
        contactPhone: order.deliveryAddress.phone,
        specialInstructions: order.deliveryAddress.landmark
      },
      
      distanceDetails: {
        totalDistance: distance,
        estimatedTime
      },
      
      deliveryFee,
      
      paymentMethod: order.paymentMethod === 'cod' ? 'cod' : 'prepaid',
      codAmount: order.paymentMethod === 'cod' ? order.total : 0,
      
      priority,
      deliveryType,
      
      scheduledPickupTime: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
      estimatedDeliveryTime: new Date(Date.now() + (estimatedTime + 30) * 60 * 1000),
      
      timeline: [{
        status: 'assigned',
        timestamp: new Date(),
        notes: 'Delivery assigned to agent',
        updatedByModel: 'User',
        updatedBy: req.user.id
      }]
    });

    await delivery.save();

    // Update order with delivery info
    order.deliveryFee = deliveryFee.totalFee;
    order.total += deliveryFee.totalFee;
    order.status = 'out_for_delivery';
    await order.save();

    // Update delivery agent status
    deliveryAgent.status = 'busy';
    await deliveryAgent.save();

    // Populate delivery for response
    const populatedDelivery = await Delivery.findById(delivery._id)
      .populate('deliveryAgent', 'firstName lastName phone agentId vehicleType vehicleNumber')
      .populate('customerId', 'firstName lastName phone')
      .populate('pharmacyId', 'firstName lastName phone');

    res.status(201).json({
      success: true,
      message: 'Delivery assigned successfully',
      data: populatedDelivery
    });
  } catch (error) {
    console.error('Assign delivery error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/deliveries/agent/pending
// @desc    Get pending deliveries for delivery agent
// @access  Private (Delivery Agent)
router.get('/agent/pending', auth, deliveryAgentOnly, async (req, res) => {
  try {
    const deliveries = await Delivery.find({
      deliveryAgent: req.user.id,
      status: { $in: ['assigned', 'accepted', 'picked_up', 'in_transit'] }
    })
    .populate('orderId', 'orderNumber items total paymentMethod')
    .populate('customerId', 'firstName lastName phone')
    .populate('pharmacyId', 'firstName lastName phone')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: deliveries
    });
  } catch (error) {
    console.error('Get pending deliveries error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/deliveries/:id/accept
// @desc    Accept delivery assignment
// @access  Private (Delivery Agent)
router.put('/:id/accept', auth, deliveryAgentOnly, async (req, res) => {
  try {
    const delivery = await Delivery.findOne({
      _id: req.params.id,
      deliveryAgent: req.user.id,
      status: 'assigned'
    });

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found or already processed'
      });
    }

    delivery.status = 'accepted';
    delivery.timeline.push({
      status: 'accepted',
      timestamp: new Date(),
      notes: 'Delivery accepted by agent',
      updatedByModel: 'DeliveryAgent',
      updatedBy: req.user.id
    });

    await delivery.save();

    // Generate delivery OTP for customer verification
    const otp = delivery.generateDeliveryOTP();
    await delivery.save();

    res.json({
      success: true,
      message: 'Delivery accepted successfully',
      data: {
        delivery,
        deliveryOTP: otp
      }
    });
  } catch (error) {
    console.error('Accept delivery error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/deliveries/:id/pickup
// @desc    Mark order as picked up from pharmacy
// @access  Private (Delivery Agent)
router.put('/:id/pickup', auth, deliveryAgentOnly, async (req, res) => {
  try {
    const { latitude, longitude, notes } = req.body;

    const delivery = await Delivery.findOne({
      _id: req.params.id,
      deliveryAgent: req.user.id,
      status: 'accepted'
    });

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found or not in correct status'
      });
    }

    delivery.status = 'picked_up';
    delivery.actualPickupTime = new Date();
    
    if (latitude && longitude) {
      await delivery.updateLocation(latitude, longitude);
    }

    delivery.timeline.push({
      status: 'picked_up',
      timestamp: new Date(),
      location: { latitude, longitude },
      notes: notes || 'Order picked up from pharmacy',
      updatedByModel: 'DeliveryAgent',
      updatedBy: req.user.id
    });

    await delivery.save();

    // Update order status
    await Order.findByIdAndUpdate(delivery.orderId, {
      status: 'picked_up'
    });

    res.json({
      success: true,
      message: 'Order marked as picked up',
      data: delivery
    });
  } catch (error) {
    console.error('Pickup delivery error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/deliveries/:id/in-transit
// @desc    Mark delivery as in transit
// @access  Private (Delivery Agent)
router.put('/:id/in-transit', auth, deliveryAgentOnly, async (req, res) => {
  try {
    const { latitude, longitude, notes } = req.body;

    const delivery = await Delivery.findOne({
      _id: req.params.id,
      deliveryAgent: req.user.id,
      status: 'picked_up'
    });

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found or not in correct status'
      });
    }

    delivery.status = 'in_transit';
    
    if (latitude && longitude) {
      await delivery.updateLocation(latitude, longitude);
    }

    delivery.timeline.push({
      status: 'in_transit',
      timestamp: new Date(),
      location: { latitude, longitude },
      notes: notes || 'On the way to customer',
      updatedByModel: 'DeliveryAgent',
      updatedBy: req.user.id
    });

    await delivery.save();

    // Update order status
    await Order.findByIdAndUpdate(delivery.orderId, {
      status: 'in_transit'
    });

    res.json({
      success: true,
      message: 'Delivery marked as in transit',
      data: delivery
    });
  } catch (error) {
    console.error('In transit delivery error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/deliveries/:id/deliver
// @desc    Mark delivery as completed
// @access  Private (Delivery Agent)
router.put('/:id/deliver', auth, deliveryAgentOnly, async (req, res) => {
  try {
    const { latitude, longitude, otp, notes, proofType = 'customer_confirmation' } = req.body;

    const delivery = await Delivery.findOne({
      _id: req.params.id,
      deliveryAgent: req.user.id,
      status: 'in_transit'
    });

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found or not in correct status'
      });
    }

    // Verify OTP if provided
    if (otp) {
      const otpVerification = delivery.verifyDeliveryOTP(otp);
      if (!otpVerification.success) {
        return res.status(400).json({
          success: false,
          message: otpVerification.message
        });
      }
    }

    // Handle COD collection
    if (delivery.paymentMethod === 'cod' && !delivery.codCollected) {
      delivery.codCollected = true;
      delivery.codCollectedAt = new Date();
    }

    delivery.status = 'delivered';
    delivery.actualDeliveryTime = new Date();
    
    if (latitude && longitude) {
      await delivery.updateLocation(latitude, longitude);
      
      // Calculate actual distance traveled
      if (delivery.route && delivery.route.length > 1) {
        let totalDistance = 0;
        for (let i = 1; i < delivery.route.length; i++) {
          totalDistance += Delivery.calculateDistance(
            delivery.route[i-1].latitude,
            delivery.route[i-1].longitude,
            delivery.route[i].latitude,
            delivery.route[i].longitude
          );
        }
        delivery.distanceDetails.actualDistance = totalDistance;
      }
      
      // Calculate actual delivery time
      const actualTime = Math.round((delivery.actualDeliveryTime - delivery.actualPickupTime) / (1000 * 60));
      delivery.distanceDetails.actualTime = actualTime;
    }

    delivery.deliveryProof = {
      type: proofType,
      data: otp || 'customer_confirmation',
      verifiedAt: new Date(),
      verifiedBy: delivery.customerId
    };

    delivery.timeline.push({
      status: 'delivered',
      timestamp: new Date(),
      location: { latitude, longitude },
      notes: notes || 'Order delivered successfully',
      updatedByModel: 'DeliveryAgent',
      updatedBy: req.user.id
    });

    await delivery.save();

    // Update order status
    await Order.findByIdAndUpdate(delivery.orderId, {
      status: 'delivered',
      deliveredAt: new Date()
    });

    // Update delivery agent metrics
    const agent = await DeliveryAgent.findById(req.user.id);
    agent.totalDeliveries += 1;
    agent.successfulDeliveries += 1;
    agent.status = 'available'; // Agent becomes available again
    await agent.save();

    res.json({
      success: true,
      message: 'Delivery completed successfully',
      data: delivery
    });
  } catch (error) {
    console.error('Complete delivery error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/deliveries/:id/location
// @desc    Update delivery location (real-time tracking)
// @access  Private (Delivery Agent)
router.put('/:id/location', auth, deliveryAgentOnly, async (req, res) => {
  try {
    const { latitude, longitude, accuracy, speed } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const delivery = await Delivery.findOne({
      _id: req.params.id,
      deliveryAgent: req.user.id,
      status: { $in: ['accepted', 'picked_up', 'in_transit'] }
    });

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Active delivery not found'
      });
    }

    await delivery.updateLocation(latitude, longitude, accuracy);

    // Add speed if provided
    if (speed && delivery.route.length > 0) {
      delivery.route[delivery.route.length - 1].speed = speed;
      await delivery.save();
    }

    res.json({
      success: true,
      message: 'Location updated successfully',
      data: {
        currentLocation: delivery.currentLocation
      }
    });
  } catch (error) {
    console.error('Update delivery location error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/deliveries/:id/track
// @desc    Track delivery (for customers)
// @access  Private (Customer/Admin)
router.get('/:id/track', auth, async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id)
      .populate('deliveryAgent', 'firstName lastName phone agentId vehicleType vehicleNumber')
      .populate('orderId', 'orderNumber')
      .populate('customerId', 'firstName lastName');

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found'
      });
    }

    // Check authorization (customer can only see their own deliveries)
    if (req.user.role === 'customer' && delivery.customerId._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Only return tracking info if delivery is trackable
    const trackingData = {
      deliveryId: delivery.deliveryId,
      status: delivery.status,
      estimatedDeliveryTime: delivery.estimatedDeliveryTime,
      timeline: delivery.timeline,
      deliveryAgent: delivery.deliveryAgent,
      pickupLocation: delivery.pickupLocation,
      deliveryLocation: delivery.deliveryLocation
    };

    // Include current location only for active deliveries
    if (delivery.isTrackable() && delivery.currentLocation?.coordinates) {
      trackingData.currentLocation = delivery.currentLocation;
    }

    res.json({
      success: true,
      data: trackingData
    });
  } catch (error) {
    console.error('Track delivery error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/deliveries/customer/my-deliveries
// @desc    Get customer's deliveries
// @access  Private (Customer)
router.get('/customer/my-deliveries', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const query = { customerId: req.user.id };
    if (status) query.status = status;

    const deliveries = await Delivery.find(query)
      .populate('deliveryAgent', 'firstName lastName phone agentId vehicleType')
      .populate('orderId', 'orderNumber items total')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Delivery.countDocuments(query);

    res.json({
      success: true,
      data: {
        deliveries,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get customer deliveries error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/deliveries
// @desc    Get all deliveries (Admin)
// @access  Private (Admin)
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      deliveryAgent,
      startDate,
      endDate 
    } = req.query;

    const query = {};
    
    if (status) query.status = status;
    if (deliveryAgent) query.deliveryAgent = deliveryAgent;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const deliveries = await Delivery.find(query)
      .populate('deliveryAgent', 'firstName lastName agentId vehicleType')
      .populate('customerId', 'firstName lastName phone')
      .populate('pharmacyId', 'firstName lastName phone')
      .populate('orderId', 'orderNumber total')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Delivery.countDocuments(query);

    res.json({
      success: true,
      data: {
        deliveries,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get deliveries error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;