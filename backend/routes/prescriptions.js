const express = require('express');
const { body, validationResult } = require('express-validator');
const Prescription = require('../models/Prescription');
const Medicine = require('../models/Medicine');
const { authenticate, authorize, checkPharmacistLicense } = require('../middleware/auth');
const { uploadPrescription, getFileUrl } = require('../middleware/upload');
const { 
  uploadToS3, 
  getSignedDownloadUrl, 
  createS3Multer, 
  generateFileName, 
  isS3Configured 
} = require('../config/s3');

const router = express.Router();

// Create S3 multer instance
const s3Upload = createS3Multer();

// @desc    Upload prescription
// @route   POST /api/prescriptions
// @access  Private (Customer only)
router.post('/', authenticate, authorize('customer'), s3Upload.array('documents', 5), [
  body('doctorName').trim().notEmpty().withMessage('Doctor name is required'),
  body('doctorRegistrationNumber').trim().notEmpty().withMessage('Doctor registration number is required'),
  body('patientName').trim().notEmpty().withMessage('Patient name is required'),
  body('patientAge').isNumeric().withMessage('Patient age must be a number'),
  body('patientGender').isIn(['male', 'female', 'other']).withMessage('Valid gender is required'),
  body('prescriptionDate').isISO8601().withMessage('Valid prescription date is required'),
  body('validUntil').isISO8601().withMessage('Valid expiry date is required')
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

    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one prescription document is required'
      });
    }

    // Generate unique prescription number
    const prescriptionNumber = 'RX' + Date.now() + Math.random().toString(36).substr(2, 4).toUpperCase();

    // Process uploaded files
    const documents = [];
    
    if (isS3Configured()) {
      // Upload to S3
      console.log('📤 Uploading prescription documents to S3...');
      for (const file of req.files) {
        try {
          const fileName = generateFileName(file.originalname, 'prescriptions');
          const uploadResult = await uploadToS3(file, fileName);
          
          documents.push({
            url: uploadResult.location,
            s3Key: uploadResult.key,
            originalName: uploadResult.originalName,
            mimetype: uploadResult.mimetype,
            size: uploadResult.size,
            storageType: 's3'
          });
          
          console.log(`✅ Uploaded ${file.originalname} to S3: ${uploadResult.key}`);
        } catch (uploadError) {
          console.error(`❌ Failed to upload ${file.originalname}:`, uploadError);
          throw new Error(`Failed to upload ${file.originalname}: ${uploadError.message}`);
        }
      }
    } else {
      // Fallback to local storage (for development)
      console.log('📁 Using local file storage (S3 not configured)');
      documents.push(...req.files.map(file => ({
        url: getFileUrl(req, file.filename, 'prescriptions'),
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        storageType: 'local'
      })));
    }

    // Prepare prescription data
    const prescriptionData = {
      prescriptionNumber,
      doctorInfo: {
        name: req.body.doctorName,
        registrationNumber: req.body.doctorRegistrationNumber
      },
      patientInfo: {
        name: req.body.patientName,
        age: parseInt(req.body.patientAge),
        gender: req.body.patientGender
      },
      prescriptionDate: req.body.prescriptionDate,
      validUntil: req.body.validUntil,
      notes: req.body.notes || '',
      customer: req.user._id,
      documents
    };

    // Create prescription
    const prescription = await Prescription.create(prescriptionData);

    // Populate customer info
    await prescription.populate('customer', 'firstName lastName email phone');

    res.status(201).json({
      success: true,
      message: 'Prescription uploaded successfully',
      data: prescription
    });

  } catch (error) {
    console.error('Upload prescription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during prescription upload'
    });
  }
});

// @desc    Get user's prescriptions
// @route   GET /api/prescriptions/my-prescriptions
// @access  Private (Customer only)
router.get('/my-prescriptions', authenticate, authorize('customer'), async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    let query = { customer: req.user._id };
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const prescriptions = await Prescription.find(query)
      .populate('reviewedBy', 'firstName lastName pharmacyName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Prescription.countDocuments(query);

    res.json({
      success: true,
      data: prescriptions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get user prescriptions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get prescription for review (Pharmacist)
// @route   GET /api/prescriptions/pending-reviews
// @access  Private (Pharmacist only)
router.get('/pending-reviews', authenticate, authorize('pharmacist'), async (req, res) => {
  try {
    const { page = 1, limit = 10, priority } = req.query;

    let query = {
      status: { $in: ['pending', 'under_review'] },
      isExpired: false
    };

    if (priority) {
      query.priority = priority;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const prescriptions = await Prescription.find(query)
      .populate('customer', 'firstName lastName email phone address')
      .sort({ priority: -1, createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Prescription.countDocuments(query);

    res.json({
      success: true,
      data: prescriptions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get pending prescriptions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get single prescription
// @route   GET /api/prescriptions/:id
// @access  Private
router.get('/:id', authenticate, async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate('customer', 'firstName lastName email phone address')
      .populate('reviewedBy', 'firstName lastName pharmacyName licenseNumber')
      .populate('medicines.medicineId', 'name genericName brand sellingPrice stockQuantity')
      .populate('communicationHistory.sender', 'firstName lastName role');

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    // Check access permissions
    const canAccess = 
      req.user.role === 'admin' ||
      req.user.role === 'pharmacist' ||
      (req.user.role === 'customer' && prescription.customer._id.toString() === req.user._id.toString());

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: prescription
    });

  } catch (error) {
    console.error('Get prescription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Start prescription review
// @route   PATCH /api/prescriptions/:id/start-review
// @access  Private (Pharmacist only)
router.patch('/:id/start-review', authenticate, authorize('pharmacist'), async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    if (prescription.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Prescription is not in pending status'
      });
    }

    prescription.status = 'under_review';
    prescription.reviewedBy = req.user._id;
    await prescription.save();

    res.json({
      success: true,
      message: 'Prescription review started',
      data: prescription
    });

  } catch (error) {
    console.error('Start review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Approve prescription
// @route   PATCH /api/prescriptions/:id/approve
// @access  Private (Pharmacist only)
router.patch('/:id/approve', authenticate, authorize('pharmacist'), [
  body('medicines').isArray().withMessage('Medicines must be an array'),
  body('medicines.*.name').trim().notEmpty().withMessage('Medicine name is required'),
  body('medicines.*.dosage').trim().notEmpty().withMessage('Dosage is required'),
  body('medicines.*.frequency').trim().notEmpty().withMessage('Frequency is required'),
  body('medicines.*.duration').trim().notEmpty().withMessage('Duration is required'),
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

    const { medicines, notes = '' } = req.body;
    const prescription = await Prescription.findById(req.params.id);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    if (prescription.status !== 'under_review') {
      return res.status(400).json({
        success: false,
        message: 'Prescription must be under review to approve'
      });
    }

    // Process medicines and check availability
    const processedMedicines = [];
    for (const med of medicines) {
      // Find matching medicine in database
      const dbMedicine = await Medicine.findOne({
        $or: [
          { name: new RegExp(med.name, 'i') },
          { genericName: new RegExp(med.name, 'i') }
        ],
        isActive: true,
        isAvailable: true
      });

      processedMedicines.push({
        ...med,
        medicineId: dbMedicine ? dbMedicine._id : null,
        isAvailable: dbMedicine ? true : false,
        quantity: med.quantity || 1
      });
    }

    // Update prescription directly
    prescription.medicines = processedMedicines;
    prescription.status = 'approved';
    prescription.reviewedBy = req.user._id;
    prescription.reviewDate = new Date();
    prescription.reviewNotes = notes;
    prescription.isVerified = true;
    
    await prescription.save();

    res.json({
      success: true,
      message: 'Prescription approved successfully',
      data: {
        id: prescription._id,
        status: prescription.status,
        prescriptionNumber: prescription.prescriptionNumber,
        medicines: processedMedicines.length,
        reviewedBy: prescription.reviewedBy
      }
    });

  } catch (error) {
    console.error('Approve prescription error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
      details: error.stack?.split('\n')[1]
    });
  }
});

// @desc    Reject prescription
// @route   PATCH /api/prescriptions/:id/reject
// @access  Private (Pharmacist only)
router.patch('/:id/reject', authenticate, authorize('pharmacist'), [
  body('reason').trim().notEmpty().withMessage('Rejection reason is required'),
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

    const { reason, notes = '' } = req.body;
    const prescription = await Prescription.findById(req.params.id);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    if (prescription.status !== 'under_review') {
      return res.status(400).json({
        success: false,
        message: 'Prescription must be under review to reject'
      });
    }

    await prescription.reject(req.user._id, reason, notes);

    res.json({
      success: true,
      message: 'Prescription rejected',
      data: prescription
    });

  } catch (error) {
    console.error('Reject prescription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Add communication to prescription
// @route   POST /api/prescriptions/:id/communication
// @access  Private
router.post('/:id/communication', authenticate, [
  body('message').trim().notEmpty().withMessage('Message is required'),
  body('type').optional().isIn(['note', 'question', 'clarification', 'approval', 'rejection'])
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

    const { message, type = 'note' } = req.body;
    const prescription = await Prescription.findById(req.params.id);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    // Check access permissions
    const canAccess = 
      req.user.role === 'admin' ||
      req.user.role === 'pharmacist' ||
      (req.user.role === 'customer' && prescription.customer.toString() === req.user._id.toString());

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await prescription.addCommunication(message, req.user._id, type);

    res.json({
      success: true,
      message: 'Communication added successfully'
    });

  } catch (error) {
    console.error('Add communication error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get prescription document (S3 signed URL)
// @route   GET /api/prescriptions/:id/document/:documentIndex
// @access  Private
router.get('/:id/document/:documentIndex', authenticate, async (req, res) => {
  try {
    const { id, documentIndex } = req.params;
    const prescription = await Prescription.findById(id);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    // Check access permissions
    const canAccess = 
      req.user.role === 'admin' ||
      req.user.role === 'pharmacist' ||
      (req.user.role === 'customer' && prescription.customer.toString() === req.user._id.toString());

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const docIndex = parseInt(documentIndex);
    if (docIndex < 0 || docIndex >= prescription.documents.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document index'
      });
    }

    const document = prescription.documents[docIndex];

    if (document.storageType === 's3' && document.s3Key) {
      try {
        // Generate signed URL for S3 object (valid for 1 hour)
        const signedUrl = await getSignedDownloadUrl(document.s3Key, 3600);
        
        return res.json({
          success: true,
          data: {
            url: signedUrl,
            originalName: document.originalName,
            mimetype: document.mimetype,
            size: document.size,
            expiresIn: 3600
          }
        });
      } catch (error) {
        console.error('Error generating signed URL:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to generate download URL'
        });
      }
    } else {
      // Local file - return direct URL
      return res.json({
        success: true,
        data: {
          url: document.url,
          originalName: document.originalName,
          mimetype: document.mimetype,
          size: document.size
        }
      });
    }

  } catch (error) {
    console.error('Get prescription document error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get prescription statistics (Pharmacist)
// @route   GET /api/prescriptions/stats
// @access  Private (Pharmacist/Admin only)
router.get('/meta/stats', authenticate, authorize('pharmacist', 'admin'), async (req, res) => {
  try {
    const stats = await Prescription.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalPrescriptions = await Prescription.countDocuments();
    const pendingReviews = await Prescription.countDocuments({
      status: { $in: ['pending', 'under_review'] },
      isExpired: false
    });

    res.json({
      success: true,
      data: {
        total: totalPrescriptions,
        pendingReviews,
        statusBreakdown: stats
      }
    });

  } catch (error) {
    console.error('Get prescription stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router; 