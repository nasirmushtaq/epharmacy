const express = require('express');
const { body, validationResult } = require('express-validator');
const Medicine = require('../models/Medicine');
const User = require('../models/User');
const { authenticate, authorize, checkPharmacistLicense } = require('../middleware/auth');
const { uploadMedicineImages, uploadExcel } = require('../middleware/upload');
const XLSX = require('xlsx');

const router = express.Router();

// @desc    Get all medicines with filters and search
// @route   GET /api/medicines
// @access  Public/Private (Pharmacists see only their inventory)
router.get('/', (req, res, next) => {
  // Optional authentication - if token exists, authenticate, otherwise proceed
  if (req.headers.authorization) {
    authenticate(req, res, next);
  } else {
    next();
  }
}, async (req, res) => {
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

    // Build base query
    let query = { isActive: true, isAvailable: true };
    
    // If authenticated user is a pharmacist, filter by their own medicines
    if (req.user && req.user.role === 'pharmacist') {
      query.addedBy = req.user._id;
    }

    // Enhanced search functionality - supports partial matching
    if (search) {
      const searchTerm = search.trim();
      console.log(`[SEARCH] Searching for: "${searchTerm}"`);
      
      // Create case-insensitive regex for partial matching
      const searchRegex = new RegExp(searchTerm, 'i');
      
      // Simple but effective multi-field search
      query.$or = [
        { name: { $regex: searchRegex } },
        { genericName: { $regex: searchRegex } },
        { brand: { $regex: searchRegex } },
        { description: { $regex: searchRegex } },
        { 'composition.ingredient': { $regex: searchRegex } }
      ];
      
      console.log(`[SEARCH] Using regex: ${searchRegex}`);
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
    const searchTerm = req.params.query.trim();
    const { limit = 10 } = req.query;

    // Simplified flexible search logic
    const searchRegex = new RegExp(searchTerm, 'i');
    console.log(`[SEARCH_ENDPOINT] Searching for: "${searchTerm}"`);

    const searchQuery = {
      $or: [
        { name: { $regex: searchRegex } },
        { genericName: { $regex: searchRegex } },
        { brand: { $regex: searchRegex } },
        { description: { $regex: searchRegex } },
        { 'composition.ingredient': { $regex: searchRegex } }
      ],
      isActive: true,
      isAvailable: true
    };

    const medicines = await Medicine.find(searchQuery)
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

// @desc    Import medicines from Excel/CSV (admin only)
// @route   POST /api/medicines/import
// @access  Private (Admin only)
router.post('/import', authenticate, authorize('admin'), uploadExcel, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded (field name "excel")' });
    // Find pharmacy admin by email
    const owner = await User.findOne({ email: 'admin@gmail.com' });
    if (!owner) return res.status(404).json({ success: false, message: 'Owner user admin@gmail.com not found' });

    const wb = XLSX.readFile(req.file.path, { cellDates: true });
    const wsName = wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wsName], { defval: '' });
    if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ success: false, message: 'Empty sheet' });

    const created = [];
    const failed = [];

    for (const [idx, r] of rows.entries()) {
      try {
        // Expect certain columns; map leniently
        const name = String(r.name || r.Name || r.Medicine || '').trim();
        const genericName = String(r.genericName || r.Generic || r.GenericName || '').trim();
        const brand = String(r.brand || r.Brand || '').trim();
        const manufacturer = String(r.manufacturer || r.Manufacturer || '').trim();
        const description = String(r.description || r.Description || '');
        const category = String(r.category || r.Category || 'others').toLowerCase();
        const dosageForm = String(r.dosageForm || r.Form || 'tablet').toLowerCase();
        const strength = String(r.strength || r.Strength || '');
        const packSize = Number(r.packSize || r.PackSize || 1);
        const unit = String(r.unit || r.Unit || 'strips');
        const mrp = Number(r.mrp || r.MRP || 0);
        const sellingPrice = Number(r.sellingPrice || r.SellingPrice || mrp);
        const stockQuantity = Number(r.stockQuantity || r.Stock || 0);
        const scheduleType = String(r.scheduleType || r.Schedule || 'OTC');
        const batchNumber = String(r.batchNumber || r.BatchNumber || `BATCH-${Date.now()}-${idx}`);
        const manufacturingDate = r.manufacturingDate || r.MfgDate || r.Mfd || new Date();
        const expiryDate = r.expiryDate || r.Expiry || new Date(Date.now() + 180*24*60*60*1000);
        const isPrescriptionRequired = String(r.isPrescriptionRequired || r.Prescription || 'false').toString().toLowerCase() === 'true';

        if (!name || !genericName || !brand || !manufacturer || !strength) throw new Error('Missing required columns');

        const payload = {
          name,
          genericName,
          brand,
          manufacturer,
          description,
          category,
          composition: strength ? [{ ingredient: genericName, strength, unit: 'mg' }] : [],
          dosageForm,
          strength,
          packSize,
          unit,
          mrp,
          sellingPrice,
          stockQuantity,
          manufacturingDate: new Date(manufacturingDate),
          expiryDate: new Date(expiryDate),
          batchNumber,
          scheduleType,
          isPrescriptionRequired,
          addedBy: owner._id,
          images: []
        };

        const m = await Medicine.create(payload);
        created.push({ id: m._id, name: m.name });
      } catch (e) {
        failed.push({ row: idx + 2, error: e.message });
      }
    }

    res.json({ success: true, message: `Imported ${created.length} medicines`, data: { created, failed } });
  } catch (e) {
    console.error('[MEDICINES][IMPORT] error', e);
    res.status(500).json({ success: false, message: 'Import failed' });
  }
});

module.exports = router; 