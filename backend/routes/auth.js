const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadProfileImage } = require('../middleware/upload');
const config = require('../config/config');
const nodemailer = require('nodemailer');
let mailer = null;
if (config.mail.host && config.mail.user) {
  mailer = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: { user: config.mail.user, pass: config.mail.pass }
  });
}
let twilioClient = null;
if (config.sms.twilioSid && config.sms.twilioAuth) {
  twilioClient = require('twilio')(config.sms.twilioSid, config.sms.twilioAuth);
}

const router = express.Router();

// @desc    Register user (creates user, issues OTP requirement)
// @route   POST /api/auth/register
// @access  Public
router.post('/register', uploadProfileImage, [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('role').optional().isIn(['customer', 'pharmacist', 'delivery_agent', 'doctor']).withMessage('Invalid role'),
  body('address.street').notEmpty().withMessage('Street address is required'),
  body('address.city').notEmpty().withMessage('City is required'),
  body('address.state').notEmpty().withMessage('State is required'),
  body('address.zipCode').notEmpty().withMessage('ZIP code is required')
], async (req, res) => {
  try {
    // Debug: log sanitized payload for troubleshooting
    try {
      const dbg = { ...req.body };
      if (dbg.password) dbg.password = '***';
      console.log('Register payload (sanitized):', JSON.stringify({
        role: dbg.role,
        firstName: dbg.firstName,
        lastName: dbg.lastName,
        email: dbg.email,
        phone: dbg.phone,
        address: dbg.address,
        licenseNumber: dbg.licenseNumber,
        licenseExpiry: dbg.licenseExpiry,
        pharmacyName: dbg.pharmacyName,
        vehicleType: dbg.vehicleType,
        vehicleNumber: dbg.vehicleNumber,
        drivingLicense: dbg.drivingLicense,
      }));
    } catch {}

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      try {
        console.warn('Register validation errors:', JSON.stringify(errors.array()), 'payload.role=', req.body?.role);
      } catch {}
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { 
      firstName, 
      lastName, 
      email, 
      password, 
      phone, 
      role = 'customer',
      address,
      licenseNumber,
      licenseExpiry,
      pharmacyName,
      vehicleType,
      vehicleNumber,
      drivingLicense
    } = req.body;

    // Enforce allowed pincodes for customer accounts
    try {
      if (
        role === 'customer' &&
        Array.isArray(config.allowedPincodes) &&
        config.allowedPincodes.length > 0 &&
        config.featureFlags.enforceLocationRestrictions
      ) {
        const pin = String(address?.zipCode || '').trim();
        if (!pin || !config.allowedPincodes.includes(pin)) {
          return res.status(400).json({ success: false, message: 'Service not available at this pincode' });
        }
      }
    } catch {}

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Create user object
    const userData = {
      firstName,
      lastName,
      email: email.toLowerCase(),
      password,
      phone,
      role,
      address,
      isApproved: role === 'customer' ? true : false
    };

    // Add role-specific fields
    if (role === 'pharmacist') {
      if (!licenseNumber || !licenseExpiry || !pharmacyName) {
        return res.status(400).json({
          success: false,
          message: 'License number, expiry date, and pharmacy name are required for pharmacists'
        });
      }
      userData.licenseNumber = licenseNumber;
      userData.licenseExpiry = licenseExpiry;
      userData.pharmacyName = pharmacyName;
    }

    if (role === 'doctor') {
      if (!licenseNumber || !licenseExpiry) {
        return res.status(400).json({
          success: false,
          message: 'License number and expiry date are required for doctors'
        });
      }
      userData.licenseNumber = licenseNumber;
      userData.licenseExpiry = licenseExpiry;
    }

    if (role === 'delivery_agent') {
      if (!vehicleType || !vehicleNumber || !drivingLicense) {
        return res.status(400).json({
          success: false,
          message: 'Vehicle type, vehicle number, and driving license are required for delivery agents'
        });
      }
      userData.vehicleType = vehicleType;
      userData.vehicleNumber = vehicleNumber;
      userData.drivingLicense = drivingLicense;
    }

    // Attach profile image if uploaded
    if (req.file) {
      const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
      userData.profileImage = `${baseUrl}/uploads/profiles/${req.file.filename}`;
    }

    // Create user
    const user = await User.create(userData);

    // Create an OTP record (fallback dummy)
    const code = config.otp.dummy;
    user.otp = {
      code,
      channel: user.email ? 'email' : 'phone',
      expireAt: new Date(Date.now() + config.otp.ttlMin * 60 * 1000)
    };
    await user.save();

    // Attempt to send via email/SMS (best-effort)
    try {
      if (mailer && user.email) {
        await mailer.sendMail({ from: config.mail.from, to: user.email, subject: 'Your OTP Code', text: `Your OTP code is ${code}` });
      } else if (twilioClient && user.phone && config.sms.from) {
        await twilioClient.messages.create({ to: user.phone, from: config.sms.from, body: `Your OTP code is ${code}` });
      }
    } catch {}

    res.status(201).json({
      success: true,
      message: 'User registered. Please verify OTP to activate your account.',
      data: { userId: user._id, otpChannel: user.otp.channel }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    try {
      // Authenticate user
      const user = await User.getAuthenticated(email.toLowerCase(), password);

      // Require OTP verification (email or phone) before issuing token
      if (!user.isEmailVerified && !user.isPhoneVerified) {
        return res.status(403).json({ success: false, message: 'OTP verification required' });
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate JWT token
      const token = user.generateAuthToken();

      res.json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          profileImage: user.profileImage
        }
      });

    } catch (authError) {
      return res.status(401).json({
        success: false,
        message: authError.message
      });
    }

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// @desc    Request OTP (email or phone)
// @route   POST /api/auth/request-otp
// @access  Public
router.post('/request-otp', [
  body('email').optional().isEmail(),
  body('phone').optional().isString()
], async (req, res) => {
  try {
    const { email, phone } = req.body;
    const user = await User.findOne(email ? { email: email.toLowerCase() } : { phone });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const code = config.otp.dummy;
    user.otp = { code, channel: email ? 'email' : 'phone', expireAt: new Date(Date.now() + config.otp.ttlMin * 60 * 1000) };
    await user.save();
    try {
      if (mailer && email) {
        await mailer.sendMail({ from: config.mail.from, to: email.toLowerCase(), subject: 'Your OTP Code', text: `Your OTP code is ${code}` });
      } else if (twilioClient && phone && config.sms.from) {
        await twilioClient.messages.create({ to: phone, from: config.sms.from, body: `Your OTP code is ${code}` });
      }
    } catch {}
    res.json({ success: true, message: 'OTP sent', data: { otpChannel: user.otp.channel } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
router.post('/verify-otp', [
  body('email').optional().isEmail(),
  body('phone').optional().isString(),
  body('code').notEmpty().withMessage('Code is required')
], async (req, res) => {
  try {
    const { email, phone, code } = req.body;
    const user = await User.findOne(email ? { email: email.toLowerCase() } : { phone });
    if (!user || !user.otp || !user.otp.code) {
      return res.status(400).json({ success: false, message: 'OTP not requested' });
    }
    if (user.otp.expireAt && user.otp.expireAt < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP expired' });
    }
    if (String(code).trim() !== String(user.otp.code).trim()) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
    if (email) user.isEmailVerified = true; else user.isPhoneVerified = true;
    user.otp = undefined;
    await user.save();
    // Issue token now
    const token = user.generateAuthToken();
    res.json({ success: true, message: 'Verified', token, user: { id: user._id, email: user.email, role: user.role } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Update profile
// @route   PUT /api/auth/profile
// @access  Private
router.put('/profile', authenticate, uploadProfileImage, [
  body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
  body('phone').optional().notEmpty().withMessage('Phone number cannot be empty')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const allowedUpdates = ['firstName', 'lastName', 'phone', 'address'];
    const updates = {};

    // Filter allowed updates
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    // Handle profile image upload
    if (req.file) {
      const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
      updates.profileImage = `${baseUrl}/uploads/profiles/${req.file.filename}`;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during profile update'
    });
  }
});

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
router.put('/change-password', authenticate, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password change'
    });
  }
});

// @desc    Logout user (client-side token removal)
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', authenticate, (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

module.exports = router; 