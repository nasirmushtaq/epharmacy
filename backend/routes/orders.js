const express = require('express');
const { body, validationResult } = require('express-validator');
const Order = require('../models/Order');
const Medicine = require('../models/Medicine');
const Prescription = require('../models/Prescription');
const Doctor = require('../models/Doctor');
const Test = require('../models/Test');
const { authenticate, authorize } = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();

// Create order (unified for all types)
router.post('/', authenticate, [
  body('orderType').isIn(['medicine', 'doctor_booking', 'test_booking']).withMessage('Invalid order type'),
  body('totalAmount').isNumeric().withMessage('Total amount must be a number'),
  body('payment.method').isIn(['cash_on_delivery', 'online']).withMessage('Invalid payment method')
], async (req, res) => {
  console.log(`[REQ] POST /api/orders auth=Bearer ${req.headers.authorization?.slice(-8) || 'none'} user=${req.user?._id || 'anon'} role=${req.user?.role || 'anon'} query=${JSON.stringify(req.query)} body=${JSON.stringify(req.body)}`);
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('[ORDERS] Validation errors:', errors.array());
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { orderType, totalAmount, payment, ...orderData } = req.body;
    
    // Base order data
    const newOrder = {
      customer: req.user._id,
      orderType,
      totalAmount,
      payment: {
        method: payment.method,
        status: 'pending',
        amount: totalAmount,
        gateway: payment.gateway || 'cashfree'
      },
      ...orderData
    };

    // Type-specific validation and data setup
    if (orderType === 'medicine') {
      if (!orderData.items || orderData.items.length === 0) {
        return res.status(400).json({ success: false, message: 'Medicine orders must have items' });
      }
      if (!orderData.deliveryAddress || !orderData.deliveryAddress.street) {
        return res.status(400).json({ success: false, message: 'Medicine orders must have delivery address' });
      }
      
      // Validate medicines exist
      const medicineIds = orderData.items.map(item => item.medicine);
      const medicines = await Medicine.find({ _id: { $in: medicineIds } });
      if (medicines.length !== medicineIds.length) {
        return res.status(400).json({ success: false, message: 'Some medicines not found' });
      }
      
      // Validate prescription if required
      if (orderData.prescription) {
        const prescription = await Prescription.findOne({ 
          _id: orderData.prescription, 
          customer: req.user._id 
        });
        if (!prescription) {
          return res.status(400).json({ success: false, message: 'Invalid prescription' });
        }
        newOrder.isPrescriptionOrder = true;
      }
      
    } else if (orderType === 'doctor_booking') {
      if (!orderData.doctorBooking || !orderData.doctorBooking.doctor) {
        return res.status(400).json({ success: false, message: 'Doctor booking details required' });
      }
      
      // Validate doctor exists
      const doctor = await Doctor.findById(orderData.doctorBooking.doctor);
      if (!doctor) {
        return res.status(400).json({ success: false, message: 'Doctor not found' });
      }
      
      // Generate booking number
      newOrder.doctorBooking.bookingNumber = `DB${Date.now()}${Math.random().toString(36).slice(2,6).toUpperCase()}`;
      
    } else if (orderType === 'test_booking') {
      if (!orderData.testBooking || !orderData.testBooking.test) {
        return res.status(400).json({ success: false, message: 'Test booking details required' });
      }
      
      // Validate test exists
      const test = await Test.findById(orderData.testBooking.test);
      if (!test) {
        return res.status(400).json({ success: false, message: 'Test not found' });
      }
      
      // Generate booking number
      newOrder.testBooking.bookingNumber = `TB${Date.now()}${Math.random().toString(36).slice(2,6).toUpperCase()}`;
    }

    const order = await Order.create(newOrder);
    await order.populate(getPopulateFields(orderType));

    console.log(`[ORDERS] Order created: ${order.orderNumber} (${orderType})`);
    res.status(201).json({ success: true, data: order });
    
  } catch (error) {
    console.error('[ORDERS] Create order error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
  
  console.log(`[RES] POST /api/orders -> ${res.statusCode} in ${Date.now() - req.startTime}ms`);
});

// Create payment order for an existing order (online payments)
router.post('/:id/payments/create', authenticate, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.customer.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Not your order' });
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return res.status(500).json({ success: false, message: 'Razorpay keys not configured' });
    const https = require('https');
    const payload = JSON.stringify({ amount: Math.round(order.totalAmount * 100), currency: 'INR', receipt: order.orderNumber, notes: { entityType: 'order', entityId: order._id.toString() } });
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const rpRes = await new Promise((resolve, reject) => {
      const rq = https.request({ hostname: 'api.razorpay.com', path: '/v1/orders', method: 'POST', headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, (r) => {
        let d = ''; r.on('data', c => d += c); r.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
      }); rq.on('error', reject); rq.write(payload); rq.end();
    });
    res.json({ success: true, data: { orderId: rpRes.id, amount: rpRes.amount, currency: rpRes.currency, keyId } });
  } catch (e) { console.error('Create order payment error', e); res.status(500).json({ success: false, message: 'Payment init failed' }); }
});

// Razorpay webhook to capture payments and refunds
router.post('/webhooks/razorpay', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return res.status(500).send('Webhook secret not configured');
    const body = req.body; // raw buffer
    const computed = crypto.createHmac('sha256', secret).update(body).digest('hex');
    if (computed !== signature) return res.status(400).send('Invalid signature');
    const event = JSON.parse(body.toString('utf8'));
    const type = event?.event;
    const payload = event?.payload || {};
    if (type === 'payment.captured') {
      const notes = payload?.payment?.entity?.notes || {};
      const receipt = payload?.payment?.entity?.order_id || '';
      const entityType = notes.entityType;
      const entityId = notes.entityId;
      if (entityType === 'order' && entityId) {
        await Order.findByIdAndUpdate(entityId, { 'payment.status': 'paid', status: 'confirmed' });
      }
    } else if (type === 'refund.processed') {
      const notes = payload?.refund?.entity?.notes || {};
      const entityType = notes.entityType;
      const entityId = notes.entityId;
      if (entityType === 'order' && entityId) {
        await Order.findByIdAndUpdate(entityId, { 'payment.status': 'failed', status: 'cancelled' });
      }
    }
    res.send('ok');
  } catch (e) { console.error('Webhook error', e); res.status(500).send('error'); }
});

// Get user's orders (all types)
router.get('/my-orders', authenticate, async (req, res) => {
  console.log(`[REQ] GET /api/orders/my-orders auth=Bearer ${req.headers.authorization?.slice(-8) || 'none'} user=${req.user?._id || 'anon'} role=${req.user?.role || 'anon'} query=${JSON.stringify(req.query)} body=${JSON.stringify(req.body)}`);
  
  try {
    const { orderType, status } = req.query;
    const filter = { customer: req.user._id };
    
    if (orderType) {
      filter.orderType = orderType;
    }
    
    if (status) {
      if (orderType === 'doctor_booking') {
        filter['doctorBooking.status'] = status;
      } else if (orderType === 'test_booking') {
        filter['testBooking.status'] = status;
      } else {
        filter.status = status;
      }
    }

    const orders = await Order.find(filter)
      .populate('customer', 'firstName lastName email')
      .populate('items.medicine')
      .populate('prescription')
      .populate('doctorBooking.doctor')
      .populate('testBooking.test')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: orders });
    
  } catch (error) {
    console.error('[ORDERS] Get orders error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
  
  console.log(`[RES] GET /api/orders/my-orders -> ${res.statusCode} in ${Date.now() - req.startTime}ms`);
});

// Get specific order
router.get('/:id', authenticate, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'firstName lastName email')
      .populate('items.medicine')
      .populate('prescription')
      .populate('doctorBooking.doctor')
      .populate('testBooking.test');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check if user owns this order or has admin access
    if (order.customer._id.toString() !== req.user._id.toString() && 
        !['admin', 'pharmacist'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, data: order });
    
  } catch (error) {
    console.error('[ORDERS] Get order error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Simple test route without validation
router.patch('/:id/simple-status', authenticate, authorize('pharmacist', 'admin'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    // Simple status update
    order.status = 'confirmed';
    await order.save();
    
    res.json({
      success: true,
      message: 'Order status updated to confirmed',
      data: { id: order._id, status: order.status }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Simple status update error',
      error: error.message
    });
  }
});

// Update payment status (for webhooks and admin)
router.patch('/:id/payment-status', authenticate, async (req, res) => {
  try {
    const { status, source = 'admin', metadata = {}, webhookId } = req.body;
    
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Only admin or webhook can update payment status
    if (req.user.role !== 'admin' && source !== 'webhook') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const updated = order.updatePaymentStatus(status, source, metadata, webhookId);
    
    if (!updated) {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment status update rejected (out of order or invalid transition)' 
      });
    }

    await order.save();
    
    console.log(`[ORDERS] Payment status updated: ${order.orderNumber} -> ${status}`);
    res.json({ success: true, data: order });
    
  } catch (error) {
    console.error('[ORDERS] Update payment status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update order status (for specific order types)
router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const { status, orderType } = req.body;
    
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Authorization based on order type and user role
    const canUpdate = req.user.role === 'admin' || 
                     (order.orderType === 'medicine' && req.user.role === 'pharmacist') ||
                     (order.orderType === 'doctor_booking' && req.user.role === 'doctor') ||
                     (order.orderType === 'test_booking' && req.user.role === 'technician');

    if (!canUpdate) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Update appropriate status field
    if (orderType === 'doctor_booking') {
      order.doctorBooking.status = status;
    } else if (orderType === 'test_booking') {
      order.testBooking.status = status;
    } else {
      order.status = status;
    }

    await order.save();
    
    console.log(`[ORDERS] Status updated: ${order.orderNumber} -> ${status}`);
    res.json({ success: true, data: order });
    
  } catch (error) {
    console.error('[ORDERS] Update status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Cancel order
// @route   PATCH /api/orders/:id/cancel
// @access  Private (Customer/Admin only)
router.patch('/:id/cancel', authenticate, [
  body('reason').trim().notEmpty().withMessage('Cancellation reason is required')
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

    const { reason } = req.body;
    const order = await Order.findById(req.params.id).populate('items.medicine');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user can cancel this order
    if (req.user.role !== 'admin' && order.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only cancel your own orders'
      });
    }

    if (!order.canBeCancelled) {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage'
      });
    }

    // Restore medicine stock
    for (const item of order.items) {
      await Medicine.findByIdAndUpdate(
        item.medicine._id,
        { $inc: { stockQuantity: item.quantity } }
      );
    }

    await order.cancel(reason, req.user._id);

    res.json({
      success: true,
      message: 'Order cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get orders for processing (Pharmacist)
// @route   GET /api/orders/pending
// @access  Private (Pharmacist/Admin only)
router.get('/status/pending', authenticate, authorize('pharmacist', 'admin'), async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const orders = await Order.find({
      status: { $in: ['pending', 'confirmed', 'processing'] }
    })
    .populate('customer', 'firstName lastName phone')
    .populate('items.medicine', 'name brand')
    .sort({ priority: -1, createdAt: 1 })
    .skip(skip)
    .limit(parseInt(limit));

    const total = await Order.countDocuments({
      status: { $in: ['pending', 'confirmed', 'processing'] }
    });

    res.json({
      success: true,
      data: orders,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get pending orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Add feedback to order
// @route   POST /api/orders/:id/feedback
// @access  Private (Customer only)
router.post('/:id/feedback', authenticate, authorize('customer'), [
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
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only rate your own orders'
      });
    }

    if (order.status !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'You can only rate delivered orders'
      });
    }

    await order.addFeedback(rating, feedback);

    res.json({
      success: true,
      message: 'Feedback added successfully'
    });

  } catch (error) {
    console.error('Add feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get order statistics
// @route   GET /api/orders/stats
// @access  Private (Pharmacist/Admin only)
router.get('/meta/stats', authenticate, authorize('pharmacist', 'admin'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const matchFilter = {};
    if (Object.keys(dateFilter).length > 0) {
      matchFilter.createdAt = dateFilter;
    }

    const stats = await Order.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    const totalOrders = await Order.countDocuments(matchFilter);
    const totalRevenue = await Order.aggregate([
      { $match: { ...matchFilter, status: 'delivered' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    res.json({
      success: true,
      data: {
        totalOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
        statusBreakdown: stats
      }
    });

  } catch (error) {
    console.error('Get order stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Helper function to get populate fields based on order type
function getPopulateFields(orderType) {
  const baseFields = ['customer'];
  
  switch (orderType) {
    case 'medicine':
      return [...baseFields, 'items.medicine', 'prescription', 'pharmacy'];
    case 'doctor_booking':
      return [...baseFields, 'doctorBooking.doctor'];
    case 'test_booking':
      return [...baseFields, 'testBooking.test', 'testBooking.assignedTechnician'];
    default:
      return baseFields;
  }
}

module.exports = router; 