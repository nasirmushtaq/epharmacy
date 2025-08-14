const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');

const router = express.Router();

// Public: list/search products
router.get('/', async (req, res) => {
  try {
    const { search, category, page = 1, limit = 20, sortBy = 'name', sortOrder = 'asc' } = req.query;
    const query = { isActive: true };
    if (category) query.category = category;
    if (search) {
      const r = new RegExp(String(search).trim(), 'i');
      query.$or = [
        { name: { $regex: r } },
        { genericName: { $regex: r } },
        { brand: { $regex: r } },
        { description: { $regex: r } },
        { 'composition.ingredient': { $regex: r } },
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = {}; sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    const [items, total] = await Promise.all([
      Product.find(query).select('-tags -legacyMedicineId').sort(sort).skip(skip).limit(parseInt(limit)),
      Product.countDocuments(query)
    ]);
    res.json({ success: true, data: items, pagination: { current: parseInt(page), pages: Math.ceil(total / parseInt(limit)), total, limit: parseInt(limit) } });
  } catch (e) { res.status(500).json({ success: false, message: 'Server error' }); }
});

// Public: single product
router.get('/:id', async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p || !p.isActive) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: p });
  } catch (e) { res.status(500).json({ success: false, message: 'Server error' }); }
});

// Admin: create product
router.post('/', authenticate, authorize('admin'), [
  body('name').notEmpty(), body('genericName').notEmpty(), body('brand').notEmpty(), body('manufacturer').notEmpty(), body('description').notEmpty(),
  body('category').notEmpty(), body('dosageForm').notEmpty(), body('strength').notEmpty(), body('packSize').isNumeric(), body('unit').notEmpty(),
  body('scheduleType').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const p = await Product.create(req.body);
    res.status(201).json({ success: true, data: p });
  } catch (e) { res.status(500).json({ success: false, message: 'Server error' }); }
});

// Admin: update product
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const p = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!p) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: p });
  } catch (e) { res.status(500).json({ success: false, message: 'Server error' }); }
});

// Admin: compute catalog stock and availability from pharmacist inventories
router.get('/:id/aggregate-stock', authenticate, authorize('admin'), async (req, res) => {
  try {
    const productId = req.params.id;
    const agg = await Inventory.aggregate([
      { $match: { product: new (require('mongoose')).Types.ObjectId(productId), isActive: true } },
      { $group: { _id: '$product', total: { $sum: { $ifNull: ['$stockQuantity', 0] } }, nonExpired: { $sum: { $cond: [ { $or: [ { $eq: ['$expiryDate', null] }, { $gt: ['$expiryDate', new Date()] } ] }, '$stockQuantity', 0 ] } } } }
    ]);
    const total = agg[0]?.total || 0;
    const nonExpiredTotal = agg[0]?.nonExpired || 0;
    res.json({ success: true, data: { total, nonExpiredTotal } });
  } catch (e) { res.status(500).json({ success: false, message: 'Server error' }); }
});

// Admin: archive product
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ success: false, message: 'Product not found' });
    p.isActive = false; await p.save();
    res.json({ success: true, message: 'Product archived' });
  } catch (e) { res.status(500).json({ success: false, message: 'Server error' }); }
});

module.exports = router;


