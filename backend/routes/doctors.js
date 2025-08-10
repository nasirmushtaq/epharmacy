const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const Doctor = require('../models/Doctor');
const DoctorBooking = require('../models/DoctorBooking');
const { uploadPrescription, getFileUrl } = require('../middleware/upload');
const Order = require('../models/Order'); // Added Order model import

const router = express.Router();

// Debug logger for doctors routes (logs token and user info)
router.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'test') {
    try {
      const start = Date.now();
      const auth = req.headers?.authorization || 'none';
      console.log(`[DOCTORS][REQ] ${req.method} ${req.originalUrl} auth=${auth} query=${JSON.stringify(req.query)}`);
      res.on('finish', () => {
        const dur = Date.now() - start;
        const userId = req.user?._id || 'anon';
        const role = req.user?.role || 'anon';
        console.log(`[DOCTORS][RES] ${req.method} ${req.originalUrl} -> ${res.statusCode} user=${userId} role=${role} ${dur}ms`);
      });
    } catch {}
  }
  next();
});

// Create or update doctor profile (doctor or admin)
router.post('/profile', authenticate, authorize('doctor','admin'), [
  body('specialties').isArray({ min: 1 }),
  body('clinics').isArray({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const data = {
      user: req.user._id,
      specialties: req.body.specialties,
      clinics: req.body.clinics,
      fee: req.body.fee,
      bio: req.body.bio,
      experienceYears: req.body.experienceYears,
    };
    const doc = await Doctor.findOneAndUpdate({ user: req.user._id }, data, { new: true, upsert: true });
    res.json({ success: true, data: doc });
  } catch (e) {
    console.error('Doctor profile error', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add/replace schedule (array of date with slots)
router.post('/schedule', authenticate, authorize('doctor','admin'), async (req, res) => {
  try {
    const doc = await Doctor.findOne({ user: req.user._id });
    if (!doc) return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    // Normalize incoming ranges into 15-minute windows
    const toMin = (t) => { const [h,m] = String(t).split(':').map(Number); return h*60 + m; };
    const toStr = (m) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
    const norm = [];
    for (const day of (req.body.schedule || [])) {
      if (!day?.date) continue;
      const d = new Date(day.date);
      d.setHours(0,0,0,0);
      const ranges = Array.isArray(day.slots) ? day.slots : [];
      const windows = [];
      for (const r of ranges) {
        if (!r?.from || !r?.to) continue;
        const start = toMin(r.from);
        const end = toMin(r.to);
        if (!(end > start)) continue;
        for (let cur = start; cur + 15 <= end; cur += 15) {
          windows.push({ from: toStr(cur), to: toStr(cur + 15) });
        }
      }
      if (windows.length) norm.push({ date: d, slots: windows });
    }
    doc.schedule = norm;
    await doc.save();
    res.json({ success: true, data: doc });
  } catch (e) {
    console.error('Schedule error', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Search doctors by specialty and city
router.get('/', authenticate, async (req, res) => {
  try {
    const { q, specialty } = req.query;
    const query = { isActive: true };
    if (specialty) query.specialties = specialty;
    const list = await Doctor.find(query).populate({ path: 'user', select: 'firstName lastName email phone address isApproved role', match: { isApproved: true } });
    const filtered = list.filter(d => d.user); // only approved
    res.json({ success: true, data: filtered });
  } catch (e) { res.status(500).json({ success: false, message: 'Server error' }); }
});

// Free slots for a given doctor and date
router.get('/:id/slots', authenticate, async (req, res) => {
  try {
    const { date } = req.query; // ISO date
    if (!date) return res.status(400).json({ success: false, message: 'date is required (YYYY-MM-DD)' });
    const dateStr = String(date).slice(0,10);
    const doc = await Doctor.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Doctor not found' });

    // Find schedule day that matches date (by day only)
    const day = doc.schedule?.find(s => new Date(s.date).toISOString().slice(0,10) === dateStr);
    if (!day) return res.json({ success: true, data: [] });

    // Day schedule already stores 15-minute slots
    const windows = (day.slots || []).map(s => ({ from: s.from, to: s.to }));

    // Remove windows that overlap existing bookings for that date
    const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);
    const bookings = await DoctorBooking.find({ doctor: doc._id, date: { $gte: dayStart, $lte: dayEnd } });
    const isBooked = (win) => bookings.some(b => b.from === win.from && b.to === win.to);
    const free = windows.filter(w => !isBooked(w));
    res.json({ success: true, data: free });
  } catch (e) { console.error('Get slots error', e); res.status(500).json({ success: false, message: 'Server error' }); }
});

// Book a slot
router.post('/:id/book', authenticate, authorize('customer'), [
  body('clinicIndex').isInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    
    const doc = await Doctor.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Doctor not found' });
    
    const { date, from, to, clinicIndex } = req.body;
    
    // Basic time validation HH:MM and order
    const hhmm = /^\d{2}:\d{2}$/;
    if (!hhmm.test(from) || !hhmm.test(to)) return res.status(400).json({ success: false, message: 'from/to must be HH:MM' });
    
    const toMin = (t) => { const [h,m] = t.split(':').map(Number); return h*60 + m; };
    const reqStart = toMin(from);
    const reqEnd = toMin(to);
    
    if (!(reqEnd > reqStart)) return res.status(400).json({ success: false, message: 'Invalid time range' });
    if ((reqEnd - reqStart) !== 15) return res.status(400).json({ success: false, message: 'Slot must be exactly 15 minutes' });
    if (reqStart % 15 !== 0 || reqEnd % 15 !== 0) return res.status(400).json({ success: false, message: 'Times must align to 15-minute increments' });
    if (clinicIndex < 0 || clinicIndex >= (doc.clinics?.length || 0)) return res.status(400).json({ success: false, message: 'Invalid clinic index' });
    
    const dateStr = String(date).slice(0,10);
    const day = doc.schedule?.find(s => new Date(s.date).toISOString().slice(0,10) === dateStr);
    if (!day) return res.status(400).json({ success: false, message: 'No schedule for selected date' });

    // Validate that requested 15-min window falls within any scheduled range
    const within = day.slots.some(s => reqStart >= toMin(s.from) && reqEnd <= toMin(s.to));
    if (!within) return res.status(400).json({ success: false, message: 'Requested time not within schedule' });

    // Ensure not already booked by checking existing orders
    const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);
    
    const existingBookings = await Order.find({ 
      orderType: 'doctor_booking',
      'doctorBooking.doctor': doc._id,
      'doctorBooking.date': { $gte: dayStart, $lte: dayEnd }
    });
    
    const overlaps = existingBookings.some(order => {
      const booking = order.doctorBooking;
      if (!hhmm.test(booking.from) || !hhmm.test(booking.to)) return false;
      const bStart = toMin(booking.from);
      const bEnd = toMin(booking.to);
      return (reqStart < bEnd) && (reqEnd > bStart);
    });
    
    if (overlaps) return res.status(400).json({ success: false, message: 'Overlapping slot already booked' });

    // Create order with doctor booking
    const bookingNumber = 'DB' + Date.now() + Math.random().toString(36).slice(2,6).toUpperCase();
    
    const orderData = {
      orderType: 'doctor_booking',
      customer: req.user._id,
      totalAmount: doc.fee || 500,
      payment: {
        method: 'online',
        status: 'pending',
        amount: doc.fee || 500,
        gateway: 'cashfree'
      },
      doctorBooking: {
        doctor: doc._id,
        date: new Date(date),
        from,
        to,
        clinicIndex,
        fee: doc.fee || 500,
        bookingNumber,
        status: 'scheduled'
      }
    };

    const order = await Order.create(orderData);
    await order.populate('doctorBooking.doctor');
    
    console.log('[DOCTORS] Booking created as order:', order.orderNumber);
    res.status(201).json({ success: true, data: order });
    
  } catch (e) { 
    console.error('Book doctor error', e); 
    res.status(500).json({ success: false, message: 'Server error' }); 
  }
});

// Get doctor bookings (for logged-in doctor)
router.get('/doctor/bookings', authenticate, authorize('doctor', 'admin'), async (req, res) => {
  try {
    const { status, date, patientId } = req.query;
    
    // Find doctor profile
    const doctor = await Doctor.findOne({ user: req.user._id });
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    
    let query = {
      orderType: 'doctor_booking',
      'doctorBooking.doctor': doctor._id
    };

    if (status) {
      query['doctorBooking.status'] = status;
    }

    if (date) {
      const dateStr = String(date).slice(0,10);
      const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
      const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);
      query['doctorBooking.date'] = { $gte: dayStart, $lte: dayEnd };
    }

    if (patientId) {
      query.customer = patientId;
    }

    const bookings = await Order.find(query)
      .populate('customer', 'firstName lastName email phone')
      .populate('doctorBooking.doctor')
      .sort({ 'doctorBooking.date': -1, 'doctorBooking.from': 1 });

    res.json({ success: true, data: bookings });
    
  } catch (e) { 
    console.error('Get doctor bookings error', e);
    res.status(500).json({ success: false, message: 'Server error' }); 
  }
});

// Get patient bookings (for logged-in customer)
router.get('/patient/bookings', authenticate, authorize('customer'), async (req, res) => {
  try {
    const { status, date } = req.query;
    
    let query = {
      orderType: 'doctor_booking',
      customer: req.user._id
    };

    if (status) {
      query['doctorBooking.status'] = status;
    }

    if (date) {
      const dateStr = String(date).slice(0,10);
      const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
      const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);
      query['doctorBooking.date'] = { $gte: dayStart, $lte: dayEnd };
    }

    const bookings = await Order.find(query)
      .populate('customer', 'firstName lastName email phone')
      .populate({
        path: 'doctorBooking.doctor',
        populate: {
          path: 'user',
          select: 'firstName lastName email profileImage'
        }
      })
      .sort({ 'doctorBooking.date': -1, 'doctorBooking.from': 1 });

    res.json({ success: true, data: bookings });
    
  } catch (e) { 
    console.error('Get patient bookings error', e);
    res.status(500).json({ success: false, message: 'Server error' }); 
  }
});

// Confirm consultation (doctor)
router.post('/bookings/:id/confirm', authenticate, authorize('doctor','admin'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order || order.orderType !== 'doctor_booking') {
      return res.status(404).json({ success: false, message: 'Doctor booking not found' });
    }
    
    order.doctorBooking.status = 'confirmed';
    await order.save();
    
    res.json({ success: true, data: order });
  } catch (e) { 
    console.error('Confirm booking error', e);
    res.status(500).json({ success: false, message: 'Server error' }); 
  }
});

// Cancel booking
router.post('/bookings/:id/cancel', authenticate, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order || order.orderType !== 'doctor_booking') {
      return res.status(404).json({ success: false, message: 'Doctor booking not found' });
    }
    
    // Check authorization
    const isOwner = order.customer.toString() === req.user._id.toString();
    const isDoctor = req.user.role === 'doctor';
    const isAdmin = req.user.role === 'admin';
    
    if (!isOwner && !isDoctor && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    order.doctorBooking.status = 'cancelled';
    await order.save();
    
    res.json({ success: true, data: order });
  } catch (e) { 
    console.error('Cancel booking error', e);
    res.status(500).json({ success: false, message: 'Server error' }); 
  }
});

// Upload prescription file for a booking (doctor)
router.post('/bookings/:id/prescriptions', authenticate, authorize('doctor','admin'), uploadPrescription, async (req, res) => {
  try {
    const booking = await DoctorBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!req.files || req.files.length === 0) return res.status(400).json({ success: false, message: 'No files uploaded' });
    booking.prescriptionFiles = booking.prescriptionFiles.concat(
      req.files.map(f => ({ url: getFileUrl(req, f.filename, 'prescriptions'), originalName: f.originalname, mimetype: f.mimetype, size: f.size }))
    );
    await booking.save();
    res.json({ success: true, data: booking });
  } catch (e) { res.status(500).json({ success: false, message: 'Server error' }); }
}); 