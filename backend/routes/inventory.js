const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize, checkPharmacistLicense } = require('../middleware/auth');
const Inventory = require('../models/Inventory');
const Product = require('../models/Product');

const router = express.Router();

// Pharmacist: list own inventory
router.get('/', authenticate, authorize('pharmacist', 'admin'), async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { pharmacy: req.user._id };
    const items = await Inventory.find(filter).populate('product');
    res.json({ success: true, data: items });
  } catch (e) { res.status(500).json({ success: false, message: 'Server error' }); }
});

// Pharmacist: add or update a product in inventory (price not exposed to customers)
router.post('/', authenticate, authorize('pharmacist'), checkPharmacistLicense, [
  body('product').notEmpty(),
  body('stockQuantity').isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const { product, stockQuantity, batchNumber, manufacturingDate, expiryDate, mrp, minStockLevel, sellingPrice } = req.body;
    const p = await Product.findById(product);
    if (!p || !p.isActive) return res.status(404).json({ success: false, message: 'Product not found' });

    const doc = await Inventory.findOneAndUpdate(
      { pharmacy: req.user._id, product, batchNumber: batchNumber || null },
      { $set: { sellingPrice, stockQuantity, batchNumber: batchNumber || null, manufacturingDate, expiryDate, mrp, minStockLevel, isActive: true } },
      { upsert: true, new: true }
    );
    res.status(201).json({ success: true, data: doc });
  } catch (e) { res.status(500).json({ success: false, message: 'Server error' }); }
});

// Pharmacist: patch stock
router.patch('/:id/stock', authenticate, authorize('pharmacist'), [
  body('quantity').isInt(), body('operation').isIn(['add','subtract'])
], async (req, res) => {
  try {
    const inv = await Inventory.findById(req.params.id);
    if (!inv) return res.status(404).json({ success: false, message: 'Inventory item not found' });
    if (req.user.role !== 'admin' && inv.pharmacy.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Not allowed' });
    await inv.updateStock(parseInt(req.body.quantity), req.body.operation);
    res.json({ success: true, data: { stockQuantity: inv.stockQuantity } });
  } catch (e) { res.status(500).json({ success: false, message: 'Server error' }); }
});

// Pharmacist: deactivate inventory row
router.delete('/:id', authenticate, authorize('pharmacist', 'admin'), async (req, res) => {
  try {
    const inv = await Inventory.findById(req.params.id);
    if (!inv) return res.status(404).json({ success: false, message: 'Inventory item not found' });
    if (req.user.role !== 'admin' && inv.pharmacy.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Not allowed' });
    inv.isActive = false; await inv.save();
    res.json({ success: true, message: 'Inventory deactivated' });
  } catch (e) { res.status(500).json({ success: false, message: 'Server error' }); }
});

module.exports = router;


