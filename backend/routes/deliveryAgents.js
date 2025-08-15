const express = require('express');
const router = express.Router();
const DeliveryAgent = require('../models/DeliveryAgent');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { adminOnly, deliveryAgentOnly } = require('../middleware/roleAuth');
const multer = require('multer');
const path = require('path');

// Configure multer for document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/delivery-documents/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images (jpeg, jpg, png) and PDF files are allowed'));
    }
  }
});

// @route   POST /api/delivery-agents/register
// @desc    Register a new delivery agent
// @access  Public
router.post('/register', upload.fields([
  { name: 'aadharCard', maxCount: 1 },
  { name: 'drivingLicense', maxCount: 1 },
  { name: 'vehicleRC', maxCount: 1 },
  { name: 'profilePhoto', maxCount: 1 }
]), async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      vehicleType,
      vehicleNumber,
      licenseNumber,
      baseLocation,
      coverageRadius
    } = req.body;

    // Check if agent already exists
    const existingAgent = await DeliveryAgent.findOne({
      $or: [{ email }, { phone }]
    });

    if (existingAgent) {
      return res.status(400).json({
        success: false,
        message: 'Delivery agent with this email or phone already exists'
      });
    }

    // Parse base location
    let parsedBaseLocation;
    try {
      parsedBaseLocation = typeof baseLocation === 'string' ? JSON.parse(baseLocation) : baseLocation;
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid base location format'
      });
    }

    // Prepare document URLs
    const documents = {};
    if (req.files) {
      if (req.files.aadharCard) {
        documents.aadharCard = {
          url: `/uploads/delivery-documents/${req.files.aadharCard[0].filename}`,
          verified: false
        };
      }
      if (req.files.drivingLicense) {
        documents.drivingLicense = {
          url: `/uploads/delivery-documents/${req.files.drivingLicense[0].filename}`,
          verified: false
        };
      }
      if (req.files.vehicleRC) {
        documents.vehicleRC = {
          url: `/uploads/delivery-documents/${req.files.vehicleRC[0].filename}`,
          verified: false
        };
      }
      if (req.files.profilePhoto) {
        documents.profilePhoto = {
          url: `/uploads/delivery-documents/${req.files.profilePhoto[0].filename}`,
          verified: false
        };
      }
    }

    // Create delivery agent
    const deliveryAgent = new DeliveryAgent({
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      password,
      vehicleType,
      vehicleNumber: vehicleNumber.toUpperCase(),
      licenseNumber,
      baseLocation: parsedBaseLocation,
      coverageRadius: coverageRadius || 10,
      documents,
      workingHours: {
        monday: { start: '09:00', end: '18:00', isWorking: true },
        tuesday: { start: '09:00', end: '18:00', isWorking: true },
        wednesday: { start: '09:00', end: '18:00', isWorking: true },
        thursday: { start: '09:00', end: '18:00', isWorking: true },
        friday: { start: '09:00', end: '18:00', isWorking: true },
        saturday: { start: '09:00', end: '18:00', isWorking: true },
        sunday: { start: '10:00', end: '17:00', isWorking: false }
      }
    });

    await deliveryAgent.save();

    // Remove password from response
    const responseAgent = deliveryAgent.toObject();
    delete responseAgent.password;

    res.status(201).json({
      success: true,
      message: 'Delivery agent registered successfully. Waiting for admin approval.',
      data: responseAgent
    });
  } catch (error) {
    console.error('Delivery agent registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message
    });
  }
});

// @route   POST /api/delivery-agents/login
// @desc    Login delivery agent
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find agent with password field
    const agent = await DeliveryAgent.findOne({ 
      email: email.toLowerCase() 
    }).select('+password');

    if (!agent) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isMatch = await agent.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if agent is approved
    if (!agent.isApproved) {
      return res.status(403).json({
        success: false,
        message: 'Account pending approval from admin'
      });
    }

    // Check if agent is active
    if (!agent.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated'
      });
    }

    // Generate JWT token (reusing existing auth logic)
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { 
        id: agent._id, 
        role: 'delivery_agent',
        agentId: agent.agentId 
      },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '30d' }
    );

    // Remove password from response
    const responseAgent = agent.toObject();
    delete responseAgent.password;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        agent: responseAgent,
        token
      }
    });
  } catch (error) {
    console.error('Delivery agent login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message
    });
  }
});

// @route   GET /api/delivery-agents/profile
// @desc    Get delivery agent profile
// @access  Private (Delivery Agent)
router.get('/profile', auth, deliveryAgentOnly, async (req, res) => {
  try {
    const agent = await DeliveryAgent.findById(req.user.id).select('-password');
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Delivery agent not found'
      });
    }

    res.json({
      success: true,
      data: agent
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/delivery-agents/profile
// @desc    Update delivery agent profile
// @access  Private (Delivery Agent)
router.put('/profile', auth, deliveryAgentOnly, async (req, res) => {
  try {
    const updates = req.body;
    const allowedUpdates = [
      'firstName', 'lastName', 'phone', 'vehicleType', 'vehicleNumber',
      'licenseNumber', 'baseLocation', 'coverageRadius', 'workingHours',
      'bankDetails'
    ];
    
    // Filter allowed updates
    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    const agent = await DeliveryAgent.findByIdAndUpdate(
      req.user.id,
      filteredUpdates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Delivery agent not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: agent
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/delivery-agents/location
// @desc    Update delivery agent current location
// @access  Private (Delivery Agent)
router.put('/location', auth, deliveryAgentOnly, async (req, res) => {
  try {
    const { latitude, longitude, accuracy } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    // Validate coordinates are within Srinagar bounds
    const srinargarBounds = {
      north: 34.1269,
      south: 34.0837,
      east: 74.8370,
      west: 74.7729
    };

    if (latitude < srinargarBounds.south || latitude > srinargarBounds.north ||
        longitude < srinargarBounds.west || longitude > srinargarBounds.east) {
      return res.status(400).json({
        success: false,
        message: 'Location must be within Srinagar city limits'
      });
    }

    const agent = await DeliveryAgent.findById(req.user.id);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Delivery agent not found'
      });
    }

    await agent.updateLocation(latitude, longitude);

    res.json({
      success: true,
      message: 'Location updated successfully',
      data: {
        currentLocation: agent.currentLocation
      }
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/delivery-agents/status
// @desc    Update delivery agent status
// @access  Private (Delivery Agent)
router.put('/status', auth, deliveryAgentOnly, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status || !['available', 'busy', 'offline', 'on_break'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required (available, busy, offline, on_break)'
      });
    }

    const agent = await DeliveryAgent.findByIdAndUpdate(
      req.user.id,
      { status },
      { new: true }
    ).select('-password');

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Delivery agent not found'
      });
    }

    res.json({
      success: true,
      message: 'Status updated successfully',
      data: {
        status: agent.status
      }
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/delivery-agents
// @desc    Get all delivery agents (Admin only)
// @access  Private (Admin)
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      isApproved, 
      vehicleType,
      search 
    } = req.query;

    const query = {};
    
    if (status) query.status = status;
    if (isApproved !== undefined) query.isApproved = isApproved === 'true';
    if (vehicleType) query.vehicleType = vehicleType;
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { agentId: { $regex: search, $options: 'i' } }
      ];
    }

    const agents = await DeliveryAgent.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await DeliveryAgent.countDocuments(query);

    res.json({
      success: true,
      data: {
        agents,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get delivery agents error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/delivery-agents/:id/approve
// @desc    Approve/reject delivery agent
// @access  Private (Admin)
router.put('/:id/approve', auth, adminOnly, async (req, res) => {
  try {
    const { isApproved, rejectionReason } = req.body;

    const agent = await DeliveryAgent.findByIdAndUpdate(
      req.params.id,
      { 
        isApproved,
        rejectionReason: isApproved ? undefined : rejectionReason
      },
      { new: true }
    ).select('-password');

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Delivery agent not found'
      });
    }

    res.json({
      success: true,
      message: `Delivery agent ${isApproved ? 'approved' : 'rejected'} successfully`,
      data: agent
    });
  } catch (error) {
    console.error('Approve delivery agent error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/delivery-agents/nearby
// @desc    Get nearby available delivery agents
// @access  Private (Admin/Pharmacist)
router.get('/nearby', auth, async (req, res) => {
  try {
    const { latitude, longitude, radius = 10 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    // Find available agents
    const agents = await DeliveryAgent.find({
      isActive: true,
      isApproved: true,
      status: 'available'
    }).select('-password');

    // Filter by distance and availability
    const nearbyAgents = agents.filter(agent => {
      if (!agent.currentLocation?.coordinates) return false;
      
      // Check if agent is currently available for delivery
      if (!agent.isAvailableForDelivery()) return false;

      // Calculate distance
      const distance = calculateDistance(
        parseFloat(latitude),
        parseFloat(longitude),
        agent.currentLocation.coordinates.latitude,
        agent.currentLocation.coordinates.longitude
      );

      return distance <= parseFloat(radius);
    }).map(agent => {
      const distance = calculateDistance(
        parseFloat(latitude),
        parseFloat(longitude),
        agent.currentLocation.coordinates.latitude,
        agent.currentLocation.coordinates.longitude
      );

      return {
        ...agent.toObject(),
        distance: Math.round(distance * 100) / 100
      };
    }).sort((a, b) => a.distance - b.distance);

    res.json({
      success: true,
      data: nearbyAgents
    });
  } catch (error) {
    console.error('Get nearby agents error:', error);
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
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

module.exports = router;
