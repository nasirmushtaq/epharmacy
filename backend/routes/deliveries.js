const express = require('express');
const { body, validationResult } = require('express-validator');
const Delivery = require('../models/Delivery');
const Order = require('../models/Order');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadDeliveryProof } = require('../middleware/upload');

const router = express.Router();

// @desc    Get available delivery agents
// @route   GET /api/deliveries/agents/available
// @access  Private (Pharmacist/Admin only)
router.get('/agents/available', authenticate, authorize('pharmacist', 'admin'), async (req, res) => {
  try {
    const agents = await User.find({
      role: 'delivery_agent',
      isActive: true,
      isAvailable: true
    }).select('firstName lastName phone vehicleType vehicleNumber currentLocation');

    res.json({
      success: true,
      data: agents
    });

  } catch (error) {
    console.error('Get available agents error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Assign delivery to agent
// @route   POST /api/deliveries/assign
// @access  Private (Pharmacist/Admin only)
router.post('/assign', authenticate, authorize('pharmacist', 'admin'), [
  body('orderId').notEmpty().withMessage('Order ID is required'),
  body('agentId').notEmpty().withMessage('Agent ID is required'),
  body('estimatedDeliveryTime').optional().isISO8601().withMessage('Valid estimated delivery time is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { orderId, agentId, estimatedDeliveryTime, deliveryInstructions } = req.body;

    // Verify order exists and is ready for delivery
    const order = await Order.findById(orderId).populate('customer', 'firstName lastName phone address');
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.status !== 'ready_for_pickup' && order.status !== 'processing') {
      return res.status(400).json({
        success: false,
        message: 'Order is not ready for delivery assignment'
      });
    }

    // Verify agent exists and is available
    const agent = await User.findOne({
      _id: agentId,
      role: 'delivery_agent',
      isActive: true,
      isAvailable: true
    });

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Delivery agent not found or not available'
      });
    }

    // Create delivery
    const deliveryData = {
      order: orderId,
      deliveryAgent: agentId,
      customer: order.customer._id,
      pickupAddress: {
        street: 'Pharmacy Address', // This should come from pharmacy settings
        city: 'Pharmacy City',
        state: 'Pharmacy State',
        zipCode: '123456'
      },
      deliveryAddress: order.deliveryAddress,
      estimatedDeliveryTime: estimatedDeliveryTime || new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours default
      deliveryInstructions
    };

    const delivery = await Delivery.create(deliveryData);

    // Update order with delivery agent
    await order.assignDeliveryAgent(agentId, estimatedDeliveryTime);

    // Update agent availability
    agent.isAvailable = false;
    await agent.save();

    // Populate delivery data
    await delivery.populate('deliveryAgent', 'firstName lastName phone vehicleType vehicleNumber')
                  .populate('customer', 'firstName lastName phone')
                  .populate('order', 'orderNumber totalAmount');

    res.status(201).json({
      success: true,
      message: 'Delivery assigned successfully',
      data: delivery
    });

  } catch (error) {
    console.error('Assign delivery error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get deliveries for agent
// @route   GET /api/deliveries/my-deliveries
// @access  Private (Delivery Agent only)
router.get('/my-deliveries', authenticate, authorize('delivery_agent'), async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    let query = { deliveryAgent: req.user._id };
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const deliveries = await Delivery.find(query)
      .populate('order', 'orderNumber totalAmount items payment')
      .populate('customer', 'firstName lastName phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Delivery.countDocuments(query);

    res.json({
      success: true,
      data: deliveries,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get agent deliveries error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get single delivery
// @route   GET /api/deliveries/:id
// @access  Private
router.get('/:id', authenticate, async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id)
      .populate('deliveryAgent', 'firstName lastName phone vehicleType vehicleNumber')
      .populate('customer', 'firstName lastName phone address')
      .populate('order', 'orderNumber totalAmount items payment deliveryAddress');

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found'
      });
    }

    // Check access permissions
    const canAccess = 
      req.user.role === 'admin' ||
      req.user.role === 'pharmacist' ||
      (req.user.role === 'delivery_agent' && delivery.deliveryAgent._id.toString() === req.user._id.toString()) ||
      (req.user.role === 'customer' && delivery.customer._id.toString() === req.user._id.toString());

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: delivery
    });

  } catch (error) {
    console.error('Get delivery error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Update delivery status
// @route   PATCH /api/deliveries/:id/status
// @access  Private (Delivery Agent only)
router.patch('/:id/status', authenticate, authorize('delivery_agent'), uploadDeliveryProof, [
  body('status').isIn(['picked_up', 'in_transit', 'delivered', 'failed', 'returned']).withMessage('Invalid status'),
  body('notes').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { status, notes, recipientName, paymentCollected, collectedAmount } = req.body;
    const delivery = await Delivery.findById(req.params.id);

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found'
      });
    }

    // Check if agent owns this delivery
    if (delivery.deliveryAgent.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own deliveries'
      });
    }

    // Handle delivery proof images
    if (req.files && req.files.length > 0) {
      const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
      delivery.deliveryImages = req.files.map(file => 
        `${baseUrl}/uploads/delivery/${file.filename}`
      );
    }

    // Update delivery details based on status
    if (status === 'delivered') {
      delivery.recipientName = recipientName;
      if (paymentCollected) {
        delivery.paymentCollected = true;
        delivery.collectedAmount = collectedAmount || 0;
      }
    }

    await delivery.updateStatus(status, notes);

    // Update related order status
    const order = await Order.findById(delivery.order);
    if (order) {
      if (status === 'picked_up') {
        await order.updateStatus('out_for_delivery');
      } else if (status === 'delivered') {
        await order.updateStatus('delivered');
        // Make agent available again
        await User.findByIdAndUpdate(delivery.deliveryAgent, { isAvailable: true });
      } else if (status === 'failed' || status === 'returned') {
        await order.updateStatus('cancelled');
        // Make agent available again
        await User.findByIdAndUpdate(delivery.deliveryAgent, { isAvailable: true });
      }
    }

    res.json({
      success: true,
      message: 'Delivery status updated successfully',
      data: delivery
    });

  } catch (error) {
    console.error('Update delivery status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Update location
// @route   PATCH /api/deliveries/:id/location
// @access  Private (Delivery Agent only)
router.patch('/:id/location', authenticate, authorize('delivery_agent'), [
  body('latitude').isNumeric().withMessage('Valid latitude is required'),
  body('longitude').isNumeric().withMessage('Valid longitude is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { latitude, longitude } = req.body;
    const delivery = await Delivery.findById(req.params.id);

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found'
      });
    }

    // Check if agent owns this delivery
    if (delivery.deliveryAgent.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own deliveries'
      });
    }

    await delivery.updateLocation(latitude, longitude);

    // Also update agent's current location
    await User.findByIdAndUpdate(req.user._id, {
      'currentLocation.latitude': latitude,
      'currentLocation.longitude': longitude,
      'currentLocation.lastUpdated': new Date()
    });

    res.json({
      success: true,
      message: 'Location updated successfully'
    });

  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get delivery tracking for customer
// @route   GET /api/deliveries/track/:orderNumber
// @access  Public (with order number)
router.get('/track/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;

    const order = await Order.findOne({ orderNumber });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const delivery = await Delivery.findOne({ order: order._id })
      .populate('deliveryAgent', 'firstName lastName phone vehicleType')
      .select('status currentLocation estimatedDeliveryTime pickedUpAt deliveredAt');

    if (!delivery) {
      return res.json({
        success: true,
        message: 'Delivery not yet assigned',
        data: {
          orderStatus: order.status,
          deliveryStatus: 'not_assigned'
        }
      });
    }

    res.json({
      success: true,
      data: {
        orderStatus: order.status,
        delivery: delivery
      }
    });

  } catch (error) {
    console.error('Track delivery error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get delivery statistics
// @route   GET /api/deliveries/stats
// @access  Private (Admin/Pharmacist only)
router.get('/meta/stats', authenticate, authorize('admin', 'pharmacist'), async (req, res) => {
  try {
    const stats = await Delivery.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalDeliveries = await Delivery.countDocuments();
    const activeAgents = await User.countDocuments({
      role: 'delivery_agent',
      isActive: true
    });
    const availableAgents = await User.countDocuments({
      role: 'delivery_agent',
      isActive: true,
      isAvailable: true
    });

    res.json({
      success: true,
      data: {
        totalDeliveries,
        activeAgents,
        availableAgents,
        statusBreakdown: stats
      }
    });

  } catch (error) {
    console.error('Get delivery stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Rate delivery
// @route   POST /api/deliveries/:id/rate
// @access  Private (Customer only)
router.post('/:id/rate', authenticate, authorize('customer'), [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('feedback').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { rating, feedback } = req.body;
    const delivery = await Delivery.findById(req.params.id);

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found'
      });
    }

    if (delivery.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only rate your own deliveries'
      });
    }

    if (delivery.status !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'You can only rate completed deliveries'
      });
    }

    delivery.rating = rating;
    delivery.feedback = feedback;
    await delivery.save();

    res.json({
      success: true,
      message: 'Delivery rated successfully'
    });

  } catch (error) {
    console.error('Rate delivery error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router; 