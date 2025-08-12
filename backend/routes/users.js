const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');
const config = require('../config/config');

const router = express.Router();

// @desc    Get all users (Admin only)
// @route   GET /api/users
// @access  Private (Admin only)
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { 
      role, 
      isActive, 
      page = 1, 
      limit = 20, 
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    let query = {};
    
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (req.query.isApproved !== undefined) query.isApproved = req.query.isApproved === 'true';
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(query)
      .select('-password')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: users,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Public listing helpers (approved only) for app use
router.get('/approved/pharmacists', authenticate, async (req, res) => {
  try {
    const list = await User.find({ role: 'pharmacist', isActive: true, isApproved: true }).select('firstName lastName email phone address');
    res.json({ success: true, data: list });
  } catch (e) { res.status(500).json({ success: false, message: 'Server error' }); }
});

router.get('/approved/delivery_agents', authenticate, async (req, res) => {
  try {
    const list = await User.find({ role: 'delivery_agent', isActive: true, isApproved: true }).select('firstName lastName email phone address');
    res.json({ success: true, data: list });
  } catch (e) { res.status(500).json({ success: false, message: 'Server error' }); }
});

// Admin approve/reject user
router.post('/:id/approval', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { approve, reviewNotes } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isApproved: !!approve, reviewNotes: reviewNotes || null },
      { new: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user, message: approve ? 'User approved' : 'User rejected' });
  } catch (e) { res.status(500).json({ success: false, message: 'Server error' }); }
});

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private (Admin or own profile)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user can access this profile
    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Admin or own profile)
router.put('/:id', authenticate, [
  body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
  body('phone').optional().notEmpty().withMessage('Phone number cannot be empty'),
  body('email').optional().isEmail().withMessage('Please provide a valid email')
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

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user can update this profile
    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Define allowed updates based on role
    let allowedUpdates = ['firstName', 'lastName', 'phone', 'address'];
    
    if (req.user.role === 'admin') {
      allowedUpdates = [...allowedUpdates, 'email', 'role', 'isActive', 'isEmailVerified'];
    }

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    // Enforce allowed pincodes for customer address updates
    try {
      const isCustomer = user.role === 'customer';
      const pin = req.body?.address?.zipCode ? String(req.body.address.zipCode).trim() : null;
      if (isCustomer && pin && Array.isArray(config.allowedPincodes) && config.allowedPincodes.length > 0) {
        if (!config.allowedPincodes.includes(pin)) {
          return res.status(400).json({ success: false, message: 'Service not available at this pincode' });
        }
      }
    } catch {}

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Delete/Deactivate user
// @route   DELETE /api/users/:id
// @access  Private (Admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Soft delete by deactivating the user
    user.isActive = false;
    await user.save();

    res.json({
      success: true,
      message: 'User deactivated successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get pharmacists
// @route   GET /api/users/pharmacists
// @access  Private (Admin only)
router.get('/role/pharmacists', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { isActive = true, page = 1, limit = 20 } = req.query;
    
    const query = { 
      role: 'pharmacist',
      isActive: isActive === 'true'
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const pharmacists = await User.find(query)
      .select('firstName lastName email phone licenseNumber licenseExpiry pharmacyName isActive')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: pharmacists,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get pharmacists error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get delivery agents
// @route   GET /api/users/delivery-agents
// @access  Private (Admin/Pharmacist only)
router.get('/role/delivery-agents', authenticate, authorize('admin', 'pharmacist'), async (req, res) => {
  try {
    const { 
      isActive = true, 
      isAvailable,
      page = 1, 
      limit = 20 
    } = req.query;
    
    const query = { 
      role: 'delivery_agent',
      isActive: isActive === 'true'
    };

    if (isAvailable !== undefined) {
      query.isAvailable = isAvailable === 'true';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const agents = await User.find(query)
      .select('firstName lastName email phone vehicleType vehicleNumber drivingLicense isAvailable currentLocation')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: agents,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get delivery agents error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get customers
// @route   GET /api/users/customers
// @access  Private (Admin/Pharmacist only)
router.get('/role/customers', authenticate, authorize('admin', 'pharmacist'), async (req, res) => {
  try {
    const { 
      isActive = true, 
      page = 1, 
      limit = 20,
      search
    } = req.query;
    
    const query = { 
      role: 'customer',
      isActive: isActive === 'true'
    };

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const customers = await User.find(query)
      .select('firstName lastName email phone address isEmailVerified lastLogin')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: customers,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Update agent availability
// @route   PATCH /api/users/:id/availability
// @access  Private (Delivery Agent or Admin)
router.patch('/:id/availability', authenticate, [
  body('isAvailable').isBoolean().withMessage('Availability must be true or false')
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

    const { isAvailable } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (user.role !== 'delivery_agent') {
      return res.status(400).json({
        success: false,
        message: 'Only delivery agents can update availability'
      });
    }

    user.isAvailable = isAvailable;
    await user.save();

    res.json({
      success: true,
      message: `Availability updated to ${isAvailable ? 'available' : 'unavailable'}`,
      data: {
        isAvailable: user.isAvailable
      }
    });

  } catch (error) {
    console.error('Update availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get user statistics
// @route   GET /api/users/stats
// @access  Private (Admin only)
router.get('/meta/stats', authenticate, authorize('admin'), async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: {
            role: '$role',
            isActive: '$isActive'
          },
          count: { $sum: 1 }
        }
      }
    ]);

    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const recentUsers = await User.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        recentUsers,
        breakdown: stats
      }
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Search users
// @route   GET /api/users/search/:query
// @access  Private (Admin only)
router.get('/search/:query', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { query } = req.params;
    const { role, limit = 10 } = req.query;

    let searchQuery = {
      $or: [
        { firstName: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    };

    if (role) {
      searchQuery.role = role;
    }

    const users = await User.find(searchQuery)
      .select('firstName lastName email role isActive')
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: users
    });

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router; 