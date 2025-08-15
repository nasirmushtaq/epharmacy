const express = require('express');
const router = express.Router();
const Delivery = require('../models/Delivery');
const Order = require('../models/Order');
const User = require('../models/User');
const { authenticate: auth } = require('../middleware/auth');

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

    // Get pickup location - Use Sopore as central dispatch location
    // Sopore coordinates: 34.298676, 74.470146 (Apple Town of Kashmir)
    const pickupCoords = {
      latitude: 34.298676,  // Sopore latitude
      longitude: 74.470146  // Sopore longitude
    };

    // Validate pharmacy coordinates are set (for future route optimization)
    if (!order.pharmacy.hasValidCoordinates || !order.pharmacy.hasValidCoordinates()) {
      console.warn(`⚠️ Pharmacy ${order.pharmacy._id} missing valid coordinates. Using central dispatch (Sopore).`);
    } else {
      console.log(`✅ Pharmacy ${order.pharmacy._id} has valid coordinates but using central dispatch (Sopore) for consistency.`);
    }

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
        address: 'Central Dispatch - Sopore, Baramulla, Jammu & Kashmir 193201',
        latitude: pickupCoords.latitude,
        longitude: pickupCoords.longitude,
        contactName: 'Central Dispatch',
        contactPhone: order.pharmacy.phone, // Keep pharmacy contact for coordination
        pharmacyDetails: {
          name: `${order.pharmacy.firstName} ${order.pharmacy.lastName}`,
          address: `${order.pharmacy.address?.street || ''}, ${order.pharmacy.address?.city || ''}`,
          coordinates: order.pharmacy.getCoordinates ? order.pharmacy.getCoordinates() : {
            latitude: order.pharmacy.address?.coordinates?.latitude || null,
            longitude: order.pharmacy.address?.coordinates?.longitude || null
          }
        }
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

// @route   GET /api/deliveries/available
// @desc    Get available orders for delivery assignment (for delivery agents)
// @access  Private (Delivery Agent only)
router.get('/available', auth, async (req, res) => {
  try {
    if (req.user.role !== 'delivery_agent') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Delivery agent role required.'
      });
    }

    const { page = 1, limit = 10, lat, lng } = req.query;
    
    // Find orders ready for delivery (confirmed/processing) without assigned delivery agent
    const availableOrders = await Order.find({
      status: { $in: ['confirmed', 'processing'] },
      pharmacy: { $exists: true, $ne: null }, // Must have pharmacy assigned
      $or: [
        { 'delivery.agent': { $exists: false } },
        { 'delivery.agent': null }
      ]
    })
    .populate('customer', 'firstName lastName phone')
    .populate('pharmacy', 'firstName lastName phone address')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    // Calculate distances if agent location provided
    if (lat && lng) {
      const agentLat = parseFloat(lat);
      const agentLng = parseFloat(lng);
      
      availableOrders.forEach(order => {
        if (order.deliveryAddress && order.deliveryAddress.coordinates) {
          const distance = calculateDistance(
            agentLat, agentLng,
            order.deliveryAddress.coordinates.latitude,
            order.deliveryAddress.coordinates.longitude
          );
          order._doc.distanceFromAgent = Math.round(distance * 100) / 100; // Round to 2 decimals
        }
      });
      
      // Sort by distance (closest first)
      availableOrders.sort((a, b) => (a._doc.distanceFromAgent || 999) - (b._doc.distanceFromAgent || 999));
    }

    const total = await Order.countDocuments({
      status: { $in: ['confirmed', 'processing'] },
      pharmacy: { $exists: true, $ne: null },
      $or: [
        { 'delivery.agent': { $exists: false } },
        { 'delivery.agent': null }
      ]
    });

    res.json({
      success: true,
      data: {
        orders: availableOrders,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get available orders error:', error);
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

// @route   POST /api/deliveries/assign-self
// @desc    Allow delivery agent to assign themselves to an order
// @access  Private (Delivery Agent only)
router.post('/assign-self', auth, async (req, res) => {
  try {
    if (req.user.role !== 'delivery_agent') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Delivery agent role required.'
      });
    }

    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    // Verify order exists and is available for delivery
    const order = await Order.findById(orderId)
      .populate('customer', 'firstName lastName phone')
      .populate('pharmacy', 'firstName lastName phone address');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (!['confirmed', 'processing'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Order is not ready for delivery'
      });
    }

    if (!order.pharmacy) {
      return res.status(400).json({
        success: false,
        message: 'Order must have pharmacy assigned first'
      });
    }

    // Check if delivery already assigned
    if (order.delivery && order.delivery.agent) {
      return res.status(400).json({
        success: false,
        message: 'Order already assigned to another delivery agent'
      });
    }

    // Check if delivery record already exists
    const existingDelivery = await Delivery.findOne({ orderId });
    if (existingDelivery) {
      return res.status(400).json({
        success: false,
        message: 'Delivery already assigned for this order'
      });
    }

    // Assign delivery agent to order
    order.delivery = {
      agent: req.user.id,
      status: 'assigned',
      assignedAt: new Date()
    };
    order.status = 'out_for_delivery';
    await order.save();

    // Create delivery record (simplified for self-assignment)
    const delivery = new Delivery({
      orderId: order._id,
      customerId: order.customer._id,
      pharmacyId: order.pharmacy._id,
      deliveryAgentId: req.user.id,
      
      pickupLocation: {
        address: 'Central Dispatch - Sopore, Baramulla, Jammu & Kashmir 193201',
        latitude: 34.298676,
        longitude: 74.470146,
        contactName: 'Central Dispatch',
        contactPhone: order.pharmacy.phone || '1234567890'
      },
      
      deliveryLocation: {
        address: `${order.deliveryAddress.street}, ${order.deliveryAddress.city}`,
        latitude: order.deliveryAddress.coordinates?.latitude || 0,
        longitude: order.deliveryAddress.coordinates?.longitude || 0,
        contactName: order.deliveryAddress.name || order.customer.firstName,
        contactPhone: order.deliveryAddress.phone || order.customer.phone
      },
      
      distance: 0, // Will be calculated by frontend or updated later
      estimatedTime: 60, // Default 1 hour
      deliveryFee: order.deliveryCharges || 50,
      
      status: 'assigned',
      assignedAt: new Date()
    });

    await delivery.save();

    const populatedDelivery = await Delivery.findById(delivery._id)
      .populate('deliveryAgentId', 'firstName lastName phone')
      .populate('customerId', 'firstName lastName phone')
      .populate('pharmacyId', 'firstName lastName phone')
      .populate('orderId', 'orderNumber total items');

    res.json({
      success: true,
      message: 'Order assigned successfully',
      data: populatedDelivery
    });

  } catch (error) {
    console.error('Self-assign delivery error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Helper function to calculate distance between two coordinates
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
  
  return distance;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

module.exports = router;