const express = require('express');
const router = express.Router();
const Delivery = require('../models/Delivery');
const Order = require('../models/Order');
const User = require('../models/User');
const auth = require('../middleware/auth');

// @route   POST /api/deliveries
// @desc    Create a new delivery for an order
// @access  Private (Admin/Pharmacist)
router.post('/', auth, async (req, res) => {
  try {
    const { orderId, agentId, priority = 'normal' } = req.body;

    // Check if user is admin or pharmacist
    if (req.user.role !== 'admin' && req.user.role !== 'pharmacist') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin or pharmacist role required.'
      });
    }

    // Verify order exists
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

    // Check if delivery already exists for this order
    const existingDelivery = await Delivery.findOne({ orderId });
    if (existingDelivery) {
      return res.status(400).json({
        success: false,
        message: 'Delivery already assigned for this order'
      });
    }

    // Verify agent exists and is available
    const agent = await User.findOne({
      _id: agentId,
      role: 'delivery_agent',
      isActive: true
    });

    if (!agent) {
      return res.status(400).json({
        success: false,
        message: 'Delivery agent not found or unavailable'
      });
    }

    // Get pickup location (pharmacy address)
    const pickupCoords = {
      latitude: order.pharmacy.address?.location?.latitude || 34.0837,
      longitude: order.pharmacy.address?.location?.longitude || 74.7973
    };

    // Get delivery location
    const deliveryCoords = {
      latitude: order.deliveryAddress.location.latitude,
      longitude: order.deliveryAddress.location.longitude
    };

    // Calculate route using OpenRouteService
    const routeData = await Delivery.calculateDistanceAndRoute(
      pickupCoords.latitude,
      pickupCoords.longitude,
      deliveryCoords.latitude,
      deliveryCoords.longitude
    );

    const distance = routeData.distance;
    const estimatedTime = routeData.estimatedTime;
    const deliveryFee = Delivery.calculateDeliveryFee(distance, priority);

    // Create delivery
    const delivery = new Delivery({
      orderId,
      customerId: order.customerId._id,
      pharmacyId: order.pharmacy._id,
      deliveryAgentId: agentId,
      
      pickupLocation: {
        address: `${order.pharmacy.address?.street || ''}, ${order.pharmacy.address?.city || ''}`,
        latitude: pickupCoords.latitude,
        longitude: pickupCoords.longitude,
        contactName: `${order.pharmacy.firstName} ${order.pharmacy.lastName}`,
        contactPhone: order.pharmacy.phone
      },
      
      deliveryLocation: {
        address: `${order.deliveryAddress.line1}, ${order.deliveryAddress.city}`,
        latitude: deliveryCoords.latitude,
        longitude: deliveryCoords.longitude,
        contactName: order.deliveryAddress.name,
        contactPhone: order.deliveryAddress.phone
      },
      
      distance,
      estimatedTime,
      deliveryFee: deliveryFee.totalFee,
      
      routeData: {
        geometry: routeData.geometry,
        fallback: routeData.fallback,
        duration: routeData.duration,
        bbox: routeData.bbox
      },
      
      status: 'assigned',
      assignedAt: new Date()
    });

    await delivery.save();

    // Update order status
    order.status = 'assigned_for_delivery';
    order.deliveryFee = deliveryFee.totalFee;
    order.total += deliveryFee.totalFee;
    await order.save();

    // Populate delivery for response
    const populatedDelivery = await Delivery.findById(delivery._id)
      .populate('deliveryAgentId', 'firstName lastName phone')
      .populate('customerId', 'firstName lastName phone')
      .populate('pharmacyId', 'firstName lastName phone');

    res.status(201).json({
      success: true,
      message: 'Delivery assigned successfully',
      data: populatedDelivery
    });
  } catch (error) {
    console.error('Create delivery error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/deliveries
// @desc    Get deliveries (Admin) or agent's deliveries (Delivery Agent)
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    
    // If delivery agent, only show their deliveries
    if (req.user.role === 'delivery_agent') {
      query.deliveryAgentId = req.user.id;
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { status, page = 1, limit = 10 } = req.query;
    
    if (status) {
      query.status = status;
    }

    const deliveries = await Delivery.find(query)
      .populate('deliveryAgentId', 'firstName lastName phone')
      .populate('customerId', 'firstName lastName phone')
      .populate('pharmacyId', 'firstName lastName phone')
      .populate('orderId', 'orderNumber total items')
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

// @route   PUT /api/deliveries/:id/status
// @desc    Update delivery status
// @access  Private (Delivery Agent for their deliveries, Admin for all)
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status, notes, latitude, longitude } = req.body;

    let delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found'
      });
    }

    // Check permissions
    if (req.user.role === 'delivery_agent' && delivery.deliveryAgentId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    } else if (req.user.role !== 'admin' && req.user.role !== 'delivery_agent') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update location if provided
    if (latitude && longitude) {
      await delivery.updateLocation(latitude, longitude);
    }

    // Update status
    await delivery.updateStatus(status, notes);

    // Update order status accordingly
    const order = await Order.findById(delivery.orderId);
    if (order) {
      if (status === 'picked_up') {
        order.status = 'picked_up';
      } else if (status === 'in_transit') {
        order.status = 'in_transit';
      } else if (status === 'delivered') {
        order.status = 'delivered';
        order.deliveredAt = new Date();
      }
      await order.save();
    }

    const updatedDelivery = await Delivery.findById(delivery._id)
      .populate('deliveryAgentId', 'firstName lastName phone')
      .populate('customerId', 'firstName lastName phone')
      .populate('pharmacyId', 'firstName lastName phone');

    res.json({
      success: true,
      message: 'Delivery status updated successfully',
      data: updatedDelivery
    });
  } catch (error) {
    console.error('Update delivery status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/deliveries/:id/location
// @desc    Update delivery agent location
// @access  Private (Delivery Agent)
router.put('/:id/location', auth, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found'
      });
    }

    // Check if user is the assigned delivery agent
    if (req.user.role !== 'delivery_agent' || delivery.deliveryAgentId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await delivery.updateLocation(latitude, longitude);

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
// @desc    Track delivery (Customer can track their delivery, Admin can track all)
// @access  Private
router.get('/:id/track', auth, async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id)
      .populate('deliveryAgentId', 'firstName lastName phone')
      .populate('customerId', 'firstName lastName')
      .populate('orderId', 'orderNumber');

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found'
      });
    }

    // Check permissions - customer can only track their own delivery
    if (req.user.role === 'customer' && delivery.customerId._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Return tracking information
    const trackingData = {
      deliveryId: delivery._id,
      orderNumber: delivery.orderId.orderNumber,
      status: delivery.status,
      estimatedTime: delivery.estimatedTime,
      distance: delivery.distance,
      deliveryAgent: delivery.deliveryAgentId,
      pickupLocation: delivery.pickupLocation,
      deliveryLocation: delivery.deliveryLocation,
      currentLocation: delivery.currentLocation,
      assignedAt: delivery.assignedAt,
      pickedUpAt: delivery.pickedUpAt,
      deliveredAt: delivery.deliveredAt,
      routeData: delivery.routeData
    };

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

module.exports = router;