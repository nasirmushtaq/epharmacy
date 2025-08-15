const express = require('express');
const { body, validationResult } = require('express-validator');
const Order = require('../models/Order');
const Medicine = require('../models/Medicine');
const Product = require('../models/Product');
const Prescription = require('../models/Prescription');
const Doctor = require('../models/Doctor');
const Test = require('../models/Test');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');
const crypto = require('crypto');
const emailService = require('../services/emailService');

const router = express.Router();
const https = require('https');
const { v4: uuidv4 } = require('uuid');

// Function to assign pharmacy based on inventory (now used on confirmation, not at placement)
async function assignPharmacy(order) {
  try {
    if (order.orderType !== 'medicine' || !order.items || order.items.length === 0) {
      return null; // Only assign pharmacy for medicine orders
    }

    // Get all pharmacists
    const pharmacists = await User.find({ 
      role: 'pharmacist', 
      isActive: true, 
      isApproved: true 
    }).select('_id firstName lastName address');

    if (pharmacists.length === 0) {
      console.log('[ASSIGN_PHARMACY] No active pharmacists found');
      return null;
    }

    // Check stock availability for each pharmacist
    const pharmacistStockMap = [];
    
    for (const pharmacist of pharmacists) {
      const medicineIds = order.items.map(item => item.medicine);
      
      // Find medicines that this pharmacist has in stock
      const availableMedicines = await Medicine.find({
        _id: { $in: medicineIds },
        addedBy: pharmacist._id,
        stockQuantity: { $gt: 0 },
        isActive: true,
        isAvailable: true
      });

      // Calculate stock coverage percentage
      let totalItemsNeeded = 0;
      let availableItemsCount = 0;
      
      for (const orderItem of order.items) {
        totalItemsNeeded += orderItem.quantity;
        const availableMedicine = availableMedicines.find(m => m._id.toString() === orderItem.medicine.toString());
        if (availableMedicine && availableMedicine.stockQuantity >= orderItem.quantity) {
          availableItemsCount += orderItem.quantity;
        }
      }

      const stockCoverage = totalItemsNeeded > 0 ? (availableItemsCount / totalItemsNeeded) * 100 : 0;
      
      // Calculate distance (simplified - using city match for now)
      let distance = 100; // Default distance
      if (order.deliveryAddress && pharmacist.address) {
        // Simple city match - in real implementation, use geolocation
        if (pharmacist.address.city && order.deliveryAddress.city) {
          distance = pharmacist.address.city.toLowerCase() === order.deliveryAddress.city.toLowerCase() ? 5 : 50;
        }
      }

      pharmacistStockMap.push({
        pharmacist: pharmacist._id,
        stockCoverage,
        distance,
        score: stockCoverage - (distance * 0.5) // Higher stock coverage, lower distance = higher score
      });
    }

    // Sort by score (highest first) and pick the best one
    pharmacistStockMap.sort((a, b) => b.score - a.score);
    
    const bestPharmacist = pharmacistStockMap[0];
    if (bestPharmacist && bestPharmacist.stockCoverage > 0) {
      console.log(`[ASSIGN_PHARMACY] Assigned pharmacy ${bestPharmacist.pharmacist} with ${bestPharmacist.stockCoverage}% stock coverage`);
      return bestPharmacist.pharmacist;
    }

    console.log('[ASSIGN_PHARMACY] No pharmacist found with required stock');
    return null;
  } catch (error) {
    console.error('[ASSIGN_PHARMACY] Error:', error);
    return null;
  }
}

async function refundRazorpayPayment({ paymentId, amountInRupees }) {
  return new Promise((resolve, reject) => {
    try {
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keyId || !keySecret) return reject(new Error('Razorpay keys not configured'));
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const payload = JSON.stringify({ amount: Math.round(Number(amountInRupees) * 100) });
      const req = https.request({
        hostname: 'api.razorpay.com',
        path: `/v1/payments/${paymentId}/refund`,
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let data = '';
        res.on('data', (d) => data += d);
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data || '{}'));
          } else {
            reject(new Error(`Razorpay refund failed (${res.statusCode}): ${data}`));
          }
        });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    } catch (e) { reject(e); }
  });
}

async function refundCashfreeOrder({ orderId, amountInRupees }) {
  return new Promise((resolve, reject) => {
    try {
      const appId = process.env.CASHFREE_APP_ID;
      const secretKey = process.env.CASHFREE_SECRET_KEY;
      const env = (process.env.CASHFREE_ENV || 'SANDBOX').toUpperCase();
      if (!appId || !secretKey) return reject(new Error('Cashfree keys not configured'));
      const host = env === 'PROD' || env === 'PRODUCTION' ? 'api.cashfree.com' : 'sandbox.cashfree.com';
      const refundId = uuidv4();
      const payload = JSON.stringify({
        refund_amount: Number(amountInRupees),
        refund_note: 'Auto-refund on cancellation before confirmation',
        refund_id: refundId
      });
      const req = https.request({
        hostname: host,
        path: `/pg/orders/${encodeURIComponent(orderId)}/refunds`,
        method: 'POST',
        headers: {
          'x-client-id': appId,
          'x-client-secret': secretKey,
          'x-api-version': '2022-09-01',
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let data = '';
        res.on('data', (d) => data += d);
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data || '{}'));
          } else {
            reject(new Error(`Cashfree refund failed (${res.statusCode}): ${data}`));
          }
        });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    } catch (e) { reject(e); }
  });
}

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
    
    // Generate order number
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const orderNumber = `ORD-${timestamp}-${random}`;

    // Base order data
    const newOrder = {
      orderNumber,
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

      // Accept either catalog product or legacy medicine, normalize and validate
      const normalizedItems = [];
      for (const it of orderData.items) {
        if (it.product) {
          const p = await Product.findById(it.product);
          if (!p) return res.status(400).json({ success: false, message: 'Some products not found' });
          normalizedItems.push({ product: p._id, quantity: it.quantity, price: it.price, total: it.total });
        } else if (it.medicine) {
          const m = await Medicine.findById(it.medicine);
          if (!m) return res.status(400).json({ success: false, message: 'Some medicines not found' });
          normalizedItems.push({ medicine: m._id, quantity: it.quantity, price: it.price, total: it.total });
        } else {
          return res.status(400).json({ success: false, message: 'Each item must include product' });
        }
      }
      newOrder.items = normalizedItems;
      
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

    // Do NOT send order confirmation email yet - only send after payment confirmation
    console.log(`[ORDERS] Order created: ${order.orderNumber} (${orderType}) - awaiting payment confirmation`);

    // Do not auto-assign pharmacy on creation; pharmacists can claim/confirm later
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
        const order = await Order.findByIdAndUpdate(entityId, { 'payment.status': 'paid', status: 'confirmed' }, { new: true });
        
        // Send order confirmation email ONLY after payment is successful
        try {
          const customer = await User.findById(order.customer);
          if (emailService && emailService.sendOrderConfirmationEmail) {
            await emailService.sendOrderConfirmationEmail(order, customer);
            console.log(`✅ Order confirmation email sent to ${customer.email} after payment confirmation`);
          } else {
            console.log(`⚠️ Email service not configured, order ${order.orderNumber} payment confirmed for ${customer.email}`);
          }
        } catch (error) {
          console.error('❌ Failed to send order confirmation email after payment:', error.message);
          // Don't fail payment processing if email fails
        }
        
        // Assign pharmacy if not already assigned for medicine orders
        if (order && order.orderType === 'medicine' && !order.pharmacy) {
          const assignedPharmacy = await assignPharmacy(order);
          if (assignedPharmacy) {
            order.pharmacy = assignedPharmacy;
            await order.save();
            console.log(`[WEBHOOK] Pharmacy assigned after payment: ${assignedPharmacy}`);
          }
        }
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
      .populate('items.product')
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
      .populate('items.product')
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

    // On medicine confirmation by pharmacist, assign and decrement inventory
    if (orderType === 'doctor_booking') {
      order.doctorBooking.status = status;
    } else if (orderType === 'test_booking') {
      order.testBooking.status = status;
    } else {
      order.status = status;
      if (status === 'confirmed' && req.user.role === 'pharmacist') {
        // Assign if not assigned
        if (!order.pharmacy) {
          order.pharmacy = req.user._id;
        }
        // Decrement pharmacist's inventory for the ordered products
        try {
          const Inventory = require('../models/Inventory');
          for (const it of (order.items || [])) {
            // Try any batch; prioritize non-expired with stock
            const inv = await Inventory.findOne({
              pharmacy: order.pharmacy,
              product: it.product || it.medicine, // prefer product id, fallback legacy medicine id
              isActive: true,
              $or: [ { expiryDate: null }, { expiryDate: { $gt: new Date() } } ]
            }).sort({ expiryDate: 1 });
            if (inv) {
              inv.stockQuantity = Math.max(0, (inv.stockQuantity || 0) - (it.quantity || 0));
              await inv.save();
            }
          }
        } catch (e) {
          console.error('[ORDERS] Inventory decrement on confirm failed:', e.message);
        }
      }
    }

    await order.save();

    // Send status update email to customer
    try {
      const customer = await User.findById(order.customer);
      await emailService.sendOrderStatusUpdateEmail(order, customer, status);
      console.log(`✅ Status update email sent to ${customer.email}`);
    } catch (error) {
      console.error('❌ Failed to send status update email:', error.message);
      // Don't fail status update if email fails
    }
    
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
router.patch('/:id/cancel', authenticate, async (req, res) => {
  try {
    console.log(`[ORDERS] Cancel request: id=${req.params.id} by=${req.user?._id} body=${JSON.stringify(req.body || {})}`);
    const reason = (req.body && typeof req.body.reason === 'string' && req.body.reason.trim())
      ? req.body.reason.trim()
      : 'Cancelled by customer';
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

    // Allow cancellation only when order is just placed (pending)
    if (!order.canBeCancelled) {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage. Only newly placed orders can be cancelled.'
      });
    }

    // Restore inventory if pharmacy already assigned (medicine orders)
    if (order.orderType === 'medicine' && order.pharmacy) {
      try {
        const Inventory = require('../models/Inventory');
        for (const item of order.items) {
          const inv = await Inventory.findOne({ pharmacy: order.pharmacy, product: item.product || item.medicine });
          if (inv) {
            inv.stockQuantity = (inv.stockQuantity || 0) + (item.quantity || 0);
            await inv.save();
          }
        }
      } catch (e) {
        console.error('[ORDERS] Inventory restore on cancel failed:', e.message);
      }
    }

    const ok = await order.cancel(reason, req.user._id);
    if (!ok) {
      return res.status(400).json({ success: false, message: 'Order cancellation rejected' });
    }

    // Auto-refund: for Razorpay only when captured; for Cashfree try if we have gateway orderId
    let refund = { attempted: false, success: false, message: null, gatewayResponse: null };
    try {
      if (order.payment && order.payment.method === 'online') {
        const amount = order.payment.amount || order.totalAmount;
        if (order.payment.gateway === 'razorpay') {
          if (order.payment.status === 'paid' && order.payment.paymentId) {
            refund.attempted = true;
            const rp = await refundRazorpayPayment({ paymentId: order.payment.paymentId, amountInRupees: amount });
            refund.success = true;
            refund.gatewayResponse = rp;
            order.updatePaymentStatus('refunded', 'admin', { reason: 'auto_refund_on_cancel', refundGateway: 'razorpay', rp });
            await order.save();
          } else {
            refund.message = 'Razorpay refund skipped (not paid or missing paymentId)';
          }
        } else if (order.payment.gateway === 'cashfree') {
          const cfOrderId = order.payment.gatewayOrderId || order.orderNumber;
          if (cfOrderId) {
            refund.attempted = true;
            const cf = await refundCashfreeOrder({ orderId: cfOrderId, amountInRupees: amount });
            refund.success = true;
            refund.gatewayResponse = cf;
            order.updatePaymentStatus('refunded', 'admin', { reason: 'auto_refund_on_cancel', refundGateway: 'cashfree', cf });
            await order.save();
          } else {
            refund.message = 'Missing Cashfree orderId for refund';
          }
        } else {
          refund.message = 'Unsupported or missing gateway/paymentId for refund';
        }
      }
    } catch (e) {
      console.error('[ORDERS][CANCEL][REFUND_ERROR]', e);
      refund.message = e.message || 'Refund failed';
    }

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: { refund }
    });

  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Reorder items from a previous order (returns items so client can add to cart)
router.post('/:id/reorder', authenticate, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.medicine')
      .populate('prescription');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only reorder your own orders' });
    }
    
    console.log(`[REORDER] Order ${req.params.id} has ${order.items?.length || 0} items`);
    
    const items = [];
    const unavailable = [];
    const adjusted = [];

    for (const it of (order.items || [])) {
      const med = it.medicine;
      const medId = med?._id?.toString() || it.medicine?.toString();
      console.log(`[REORDER] Processing item: medId=${medId}, medicine=`, med ? { name: med.name, isActive: med.isActive, isAvailable: med.isAvailable, stockQuantity: med.stockQuantity } : 'NOT_POPULATED');
      
      if (!medId) {
        console.log(`[REORDER] Skipping item - no medicine ID`);
        continue;
      }
      
      const isActive = med?.isActive !== false;
      const isAvailable = med?.isAvailable !== false;
      const stockQty = typeof med?.stockQuantity === 'number' ? med.stockQuantity : 0;
      
      console.log(`[REORDER] Medicine ${medId} availability: active=${isActive}, available=${isAvailable}, stock=${stockQty}`);
      
      if (!isActive || !isAvailable || stockQty <= 0) {
        const reason = !isActive ? 'inactive' : !isAvailable ? 'unavailable' : 'out_of_stock';
        console.log(`[REORDER] Medicine ${medId} not available: ${reason}`);
        unavailable.push({ medicineId: medId, name: med?.name || 'Medicine', reason });
        continue;
      }
      const desiredQty = it.quantity || 1;
      const finalQty = Math.min(desiredQty, stockQty);
      if (finalQty <= 0) {
        unavailable.push({ medicineId: medId, name: med?.name || 'Medicine', reason: 'out_of_stock' });
        continue;
      }
      if (finalQty < desiredQty) {
        adjusted.push({ medicineId: medId, name: med?.name || 'Medicine', from: desiredQty, to: finalQty });
      }
      items.push({
        medicineId: medId,
        name: med?.name || 'Medicine',
        price: it.price,
        quantity: finalQty,
        isPrescriptionRequired: med?.isPrescriptionRequired || false,
      });
    }

    let prescriptionId = null;
    if (order.isPrescriptionOrder && order.prescription && order.prescription._id) {
      const p = order.prescription;
      if (p.isExpired === false || typeof p.isExpired === 'undefined') {
        prescriptionId = p._id.toString();
      }
    }

    res.json({ success: true, data: { items, unavailable, adjusted, prescriptionId } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Get orders for processing (Pharmacist)
// @route   GET /api/orders/pending
// @access  Private (Pharmacist/Admin only)
router.get('/status/pending', authenticate, authorize('pharmacist', 'admin'), async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build filter based on user role
    let filter = {
      status: { $in: ['pending', 'confirmed', 'processing'] }
    };
    
    // For pharmacists, only show orders assigned to them or unassigned orders (for medicine orders)
    if (req.user.role === 'pharmacist') {
      filter.$or = [
        // Orders assigned to this pharmacist
        { pharmacy: req.user._id },
        // Unassigned medicine orders (so they can be picked up)
        { orderType: 'medicine', pharmacy: { $exists: false } },
        { orderType: 'medicine', pharmacy: null },
        // Non-medicine orders (doctor/test bookings - all pharmacists can see)
        { orderType: { $ne: 'medicine' } }
      ];
    }

    const orders = await Order.find(filter)
    .populate('customer', 'firstName lastName phone')
    .populate('items.medicine', 'name brand')
    .sort({ priority: -1, createdAt: -1 })
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
      return [...baseFields, 'items.medicine', 'items.product', 'prescription', 'pharmacy'];
    case 'doctor_booking':
      return [...baseFields, 'doctorBooking.doctor'];
    case 'test_booking':
      return [...baseFields, 'testBooking.test', 'testBooking.assignedTechnician'];
    default:
      return baseFields;
  }
}

// @desc    Assign pharmacy to order (claim order)
// @route   PATCH /api/orders/:id/claim
// @access  Private (Pharmacist only)
router.patch('/:id/claim', authenticate, authorize('pharmacist'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    if (order.orderType !== 'medicine') {
      return res.status(400).json({
        success: false,
        message: 'Only medicine orders can be claimed'
      });
    }
    
    if (order.pharmacy) {
      return res.status(400).json({
        success: false,
        message: 'Order is already assigned to a pharmacy'
      });
    }
    
    // Check if pharmacist has required medicines in stock
    const medicineIds = order.items.map(item => item.medicine);
    const availableMedicines = await Medicine.find({
      _id: { $in: medicineIds },
      addedBy: req.user._id,
      stockQuantity: { $gt: 0 },
      isActive: true,
      isAvailable: true
    });
    
    // Verify stock availability for all items
    let hasAllStock = true;
    for (const orderItem of order.items) {
      const medicine = availableMedicines.find(m => m._id.toString() === orderItem.medicine.toString());
      if (!medicine || medicine.stockQuantity < orderItem.quantity) {
        hasAllStock = false;
        break;
      }
    }
    
    if (!hasAllStock) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock for one or more items in this order'
      });
    }
    
    // Assign the order to this pharmacist
    order.pharmacy = req.user._id;
    await order.save();
    
    await order.populate('pharmacy', 'firstName lastName pharmacyName');
    
    res.json({
      success: true,
      message: 'Order claimed successfully',
      data: order
    });
    
  } catch (error) {
    console.error('Claim order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router; 