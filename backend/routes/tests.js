const express = require('express');
const { body, validationResult } = require('express-validator');
const Test = require('../models/Test');
const TestBooking = require('../models/TestBooking');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadDeliveryProof, getFileUrl } = require('../middleware/upload');
const Order = require('../models/Order'); // Added Order model import

const router = express.Router();

// GET /api/tests - list/search tests
router.get('/', authenticate, async (req, res) => {
  try {
    const { q } = req.query;
    const query = { isActive: true };
    if (q) {
      query.$or = [
        { name: new RegExp(q, 'i') },
        { code: new RegExp(q, 'i') },
        { description: new RegExp(q, 'i') },
      ];
    }
    const tests = await Test.find(query).sort({ name: 1 }).limit(100);
    res.json({ success: true, data: tests });
  } catch (err) {
    console.error('List tests error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/tests/book - customer books a test
router.post('/book', authenticate, authorize('customer'), [
  body('testId').notEmpty().withMessage('Test id is required'),
  body('address.line1').notEmpty().withMessage('Address line1 required'),
  body('address.city').notEmpty().withMessage('City required'),
  body('address.state').notEmpty().withMessage('State required'),
  body('address.zip').notEmpty().withMessage('Zip required'),
  body('address.phone').notEmpty().withMessage('Phone required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const test = await Test.findById(req.body.testId);
    if (!test) return res.status(404).json({ success: false, message: 'Test not found' });

    const bookingNumber = 'TB' + Date.now() + Math.random().toString(36).slice(2, 6).toUpperCase();

    // Create order with test booking
    const orderData = {
      orderType: 'test_booking',
      customer: req.user._id,
      totalAmount: test.price || 500,
      payment: {
        method: 'online',
        status: 'pending',
        amount: test.price || 500,
        gateway: 'cashfree'
      },
      testBooking: {
        test: test._id,
        scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : null,
        address: req.body.address,
        bookingNumber,
        status: 'pending_review'
      }
    };

    const order = await Order.create(orderData);
    await order.populate('testBooking.test');

    console.log('[TESTS] Test booking created as order:', order.orderNumber);
    res.status(201).json({ success: true, message: 'Test booked and pending review', data: order });
    
  } catch (err) {
    console.error('Book test error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/tests/my-bookings - list customer test bookings
router.get('/my-bookings', authenticate, authorize('customer'), async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = {
      orderType: 'test_booking',
      customer: req.user._id
    };

    if (status) {
      query['testBooking.status'] = status;
    }

    const bookings = await Order.find(query)
      .populate('testBooking.test')
      .populate('testBooking.assignedTechnician', 'firstName lastName email phone')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: bookings });
    
  } catch (err) {
    console.error('Get test bookings error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/tests/admin/bookings - list all test bookings for admin/technician
router.get('/admin/bookings', authenticate, authorize('admin', 'pharmacist', 'technician'), async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = { orderType: 'test_booking' };

    if (status) {
      query['testBooking.status'] = status;
    }

    const bookings = await Order.find(query)
      .populate('customer', 'firstName lastName email phone')
      .populate('testBooking.test')
      .populate('testBooking.assignedTechnician', 'firstName lastName email phone')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: bookings });
    
  } catch (err) {
    console.error('Get admin test bookings error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/tests/bookings/:id/approve - approve test booking
router.post('/bookings/:id/approve', authenticate, authorize('admin', 'pharmacist'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order || order.orderType !== 'test_booking') {
      return res.status(404).json({ success: false, message: 'Test booking not found' });
    }

    order.testBooking.status = 'approved';
    await order.save();

    res.json({ success: true, message: 'Test booking approved', data: order });
    
  } catch (err) {
    console.error('Approve test booking error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/tests/bookings/:id/assign - assign technician to test booking
router.post('/bookings/:id/assign', authenticate, authorize('admin', 'pharmacist'), [
  body('technicianId').notEmpty().withMessage('Technician ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const order = await Order.findById(req.params.id);
    if (!order || order.orderType !== 'test_booking') {
      return res.status(404).json({ success: false, message: 'Test booking not found' });
    }

    order.testBooking.assignedTechnician = req.body.technicianId;
    order.testBooking.status = 'assigned';
    await order.save();

    await order.populate('testBooking.assignedTechnician', 'firstName lastName email phone');

    res.json({ success: true, message: 'Technician assigned to test booking', data: order });
    
  } catch (err) {
    console.error('Assign technician error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/tests/bookings/:id/results - upload test results
router.post('/bookings/:id/results', authenticate, authorize('admin', 'pharmacist', 'technician'), async (req, res) => {
  try {
    const { resultFiles } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order || order.orderType !== 'test_booking') {
      return res.status(404).json({ success: false, message: 'Test booking not found' });
    }

    // Add result files
    if (resultFiles && Array.isArray(resultFiles)) {
      order.testBooking.resultFiles.push(...resultFiles.map(file => ({
        url: file.url,
        originalName: file.originalName,
        uploadedAt: new Date()
      })));
    }

    order.testBooking.status = 'results_ready';
    await order.save();

    res.json({ success: true, message: 'Test results uploaded', data: order });
    
  } catch (err) {
    console.error('Upload test results error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// List technicians for assignment
router.get('/technicians', authenticate, authorize('pharmacist','admin'), async (req, res) => {
  try {
    const User = require('../models/User');
    const techs = await User.find({ role: 'technician', isActive: true }).select('_id firstName lastName email phone');
    res.json({ success: true, data: techs });
  } catch (err) {
    console.error('List technicians error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Technician: my assigned bookings
router.get('/assigned', authenticate, authorize('technician', 'pharmacist'), async (req, res) => {
  try {
    const bookings = await TestBooking.find({ assignedTechnician: req.user._id })
      .populate('test customer', 'name code price firstName lastName email phone')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: bookings });
  } catch (err) {
    console.error('Assigned bookings error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/tests/bookings/:id/review - pharmacist/admin reviews booking
router.post('/bookings/:id/review', authenticate, authorize('pharmacist', 'admin'), [
  body('status').isIn(['approved','rejected']).withMessage('Status must be approved or rejected'),
  body('reviewNotes').optional().isString(),
], async (req, res) => {
  try {
    const booking = await TestBooking.findById(req.params.id).populate('test');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    booking.status = req.body.status === 'approved' ? 'approved' : 'rejected';
    booking.reviewNotes = req.body.reviewNotes || '';
    await booking.save();

    res.json({ success: true, message: 'Review saved', data: booking });
  } catch (err) {
    console.error('Review booking error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/tests/bookings/:id/assign - pharmacist/admin assign technician
router.post('/bookings/:id/assign', authenticate, authorize('pharmacist', 'admin'), [
  body('technicianId').notEmpty().withMessage('Technician id required'),
], async (req, res) => {
  try {
    const booking = await TestBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    booking.assignedTechnician = req.body.technicianId;
    booking.status = 'assigned';
    await booking.save();

    res.json({ success: true, message: 'Technician assigned', data: booking });
  } catch (err) {
    console.error('Assign technician error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/tests/bookings/:id/results - technician/pharmacist uploads results
router.post('/bookings/:id/results', authenticate, authorize('technician', 'pharmacist'), uploadDeliveryProof, async (req, res) => {
  try {
    const booking = await TestBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one result file is required' });
    }

    booking.resultFiles = booking.resultFiles.concat(
      req.files.map(file => ({
        url: getFileUrl(req, file.filename, 'delivery'),
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      }))
    );
    booking.status = 'completed';
    await booking.save();

    res.json({ success: true, message: 'Results uploaded', data: booking });
  } catch (err) {
    console.error('Upload results error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin: create a new test
router.post('/', authenticate, authorize('admin'), [
  body('name').notEmpty(),
  body('code').notEmpty(),
  body('price').isNumeric(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const existing = await Test.findOne({ code: req.body.code });
    if (existing) return res.status(400).json({ success: false, message: 'Code already exists' });

    const test = await Test.create({
      name: req.body.name,
      code: req.body.code,
      description: req.body.description || '',
      price: req.body.price,
      sampleType: req.body.sampleType || 'blood',
      preparation: req.body.preparation || '',
      turnaroundTimeHours: req.body.turnaroundTimeHours || 24,
      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
    });

    res.status(201).json({ success: true, message: 'Test created', data: test });
  } catch (err) {
    console.error('Create test error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Pharmacist: list bookings with optional status filter
router.get('/bookings', authenticate, authorize('pharmacist','admin'), async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) query.status = status;
    const bookings = await TestBooking.find(query).populate('test customer', 'name code price firstName lastName email phone').sort({ createdAt: -1 });
    res.json({ success: true, data: bookings });
  } catch (err) {
    console.error('List bookings error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router; 