const express = require('express');
const { body, validationResult } = require('express-validator');
const Medicine = require('../models/Medicine');
const { authenticate, authorize, checkPharmacistLicense } = require('../middleware/auth');
const { uploadMedicineImages } = require('../middleware/upload');

const router = express.Router();

// @desc    Get all medicines with filters and search
// @route   GET /api/medicines
// @access  Public
router.get('/', async (req, res) => {
  try {
    const {
      search,
      category,
      minPrice,
      maxPrice,
      isPrescriptionRequired,
      page = 1,
      limit = 20,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    // Build query
    let query = { isActive: true, isAvailable: true };

    // Search functionality
    if (search) {
      query.$text = { $search: search };
    }

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by price range
    if (minPrice || maxPrice) {
      query.sellingPrice = {};
      if (minPrice) query.sellingPrice.$gte = parseFloat(minPrice);
      if (maxPrice) query.sellingPrice.$lte = parseFloat(maxPrice);
    }

    // Filter by prescription requirement
    if (isPrescriptionRequired !== undefined) {
      query.isPrescriptionRequired = isPrescriptionRequired === 'true';
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const medicines = await Medicine.find(query)
      .populate('addedBy', 'firstName lastName pharmacyName')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Medicine.countDocuments(query);

    res.json({
      success: true,
      data: medicines,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get medicines error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get single medicine
// @route   GET /api/medicines/:id
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const medicine = await Medicine.findById(req.params.id)
      .populate('addedBy', 'firstName lastName pharmacyName licenseNumber');

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    // Increment view count
    await medicine.incrementViewCount();

    res.json({
      success: true,
      data: medicine
    });

  } catch (error) {
    console.error('Get medicine error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Create new medicine
// @route   POST /api/medicines
// @access  Private (Pharmacist only)
router.post('/', authenticate, authorize('pharmacist'), checkPharmacistLicense, uploadMedicineImages, [
  body('name').trim().notEmpty().withMessage('Medicine name is required'),
  body('genericName').trim().notEmpty().withMessage('Generic name is required'),
  body('brand').trim().notEmpty().withMessage('Brand is required'),
  body('manufacturer').trim().notEmpty().withMessage('Manufacturer is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('dosageForm').notEmpty().withMessage('Dosage form is required'),
  body('strength').notEmpty().withMessage('Strength is required'),
  body('packSize').isNumeric().withMessage('Pack size must be a number'),
  body('mrp').isNumeric().withMessage('MRP must be a number'),
  body('sellingPrice').isNumeric().withMessage('Selling price must be a number'),
  body('stockQuantity').isNumeric().withMessage('Stock quantity must be a number'),
  body('manufacturingDate').isISO8601().withMessage('Valid manufacturing date is required'),
  body('expiryDate').isISO8601().withMessage('Valid expiry date is required'),
  body('batchNumber').notEmpty().withMessage('Batch number is required'),
  body('scheduleType').notEmpty().withMessage('Schedule type is required')
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

    // Prepare medicine data
    const medicineData = {
      ...req.body,
      addedBy: req.user._id
    };

    // Handle composition - convert string to array format if needed
    if (typeof req.body.composition === 'string' && req.body.composition.trim()) {
      medicineData.composition = [{
        ingredient: req.body.composition.trim(),
        strength: req.body.strength || 'N/A',
        unit: 'mg' // Default unit for composition
      }];
    } else {
      medicineData.composition = []; // Empty array if no composition provided
    }

    // Handle image uploads
    if (req.files && req.files.length > 0) {
      const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
      medicineData.images = req.files.map((file, index) => ({
        url: `${baseUrl}/uploads/medicines/${file.filename}`,
        alt: `${req.body.name} image ${index + 1}`,
        isPrimary: index === 0
      }));
    }

    // Create medicine
    const medicine = await Medicine.create(medicineData);

    // Populate the addedBy field
    await medicine.populate('addedBy', 'firstName lastName pharmacyName');

    res.status(201).json({
      success: true,
      message: 'Medicine added successfully',
      data: medicine
    });

  } catch (error) {
    console.error('Create medicine error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Update medicine
// @route   PUT /api/medicines/:id
// @access  Private (Pharmacist only - own medicines or admin)
router.put('/:id', authenticate, authorize('pharmacist', 'admin'), checkPharmacistLicense, uploadMedicineImages, async (req, res) => {
  try {
    const medicine = await Medicine.findById(req.params.id);

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    // Check ownership (except for admin)
    if (req.user.role !== 'admin' && medicine.addedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own medicines'
      });
    }

    // Handle image uploads
    if (req.files && req.files.length > 0) {
      const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
      const newImages = req.files.map((file, index) => ({
        url: `${baseUrl}/uploads/medicines/${file.filename}`,
        alt: `${req.body.name || medicine.name} image ${index + 1}`,
        isPrimary: index === 0 && (!medicine.images || medicine.images.length === 0)
      }));
      
      req.body.images = [...(medicine.images || []), ...newImages];
    }

    // Update medicine
    const updatedMedicine = await Medicine.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('addedBy', 'firstName lastName pharmacyName');

    res.json({
      success: true,
      message: 'Medicine updated successfully',
      data: updatedMedicine
    });

  } catch (error) {
    console.error('Update medicine error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Delete medicine
// @route   DELETE /api/medicines/:id
// @access  Private (Pharmacist only - own medicines or admin)
router.delete('/:id', authenticate, authorize('pharmacist', 'admin'), async (req, res) => {
  try {
    const medicine = await Medicine.findById(req.params.id);

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    // Check ownership (except for admin)
    if (req.user.role !== 'admin' && medicine.addedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own medicines'
      });
    }

    // Soft delete by setting isActive to false
    medicine.isActive = false;
    await medicine.save();

    res.json({
      success: true,
      message: 'Medicine deleted successfully'
    });

  } catch (error) {
    console.error('Delete medicine error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Update stock
// @route   PATCH /api/medicines/:id/stock
// @access  Private (Pharmacist only)
router.patch('/:id/stock', authenticate, authorize('pharmacist'), [
  body('quantity').isNumeric().withMessage('Quantity must be a number'),
  body('operation').isIn(['add', 'subtract']).withMessage('Operation must be add or subtract')
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

    const { quantity, operation } = req.body;
    const medicine = await Medicine.findById(req.params.id);

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    // Update stock
    await medicine.updateStock(parseInt(quantity), operation);

    res.json({
      success: true,
      message: 'Stock updated successfully',
      data: {
        stockQuantity: medicine.stockQuantity,
        isLowStock: medicine.isLowStock
      }
    });

  } catch (error) {
    console.error('Update stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get medicine categories
// @route   GET /api/medicines/categories
// @access  Public
router.get('/meta/categories', async (req, res) => {
  try {
    const categories = await Medicine.distinct('category', { isActive: true });
    
    res.json({
      success: true,
      data: categories
    });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Search medicines
// @route   GET /api/medicines/search/:query
// @access  Public
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const { limit = 10 } = req.query;

    const medicines = await Medicine.find({
      $text: { $search: query },
      isActive: true,
      isAvailable: true
    })
    .select('name genericName brand sellingPrice mrp images isPrescriptionRequired')
    .limit(parseInt(limit));

    res.json({
      success: true,
      data: medicines
    });

  } catch (error) {
    console.error('Search medicines error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router; 