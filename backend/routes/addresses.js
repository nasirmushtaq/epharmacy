const express = require('express');
const router = express.Router();
const Address = require('../models/Address');
const config = require('../config/config');
const { authenticate } = require('../middleware/auth');

// @desc    Get all addresses for the authenticated user
// @route   GET /api/addresses
// @access  Private
router.get('/', authenticate, async (req, res) => {
  try {
    const addresses = await Address.find({ user: req.user._id })
      .sort({ isDefault: -1, createdAt: -1 });

    res.json({
      success: true,
      data: addresses,
      count: addresses.length
    });
  } catch (error) {
    console.error('Error fetching addresses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch addresses',
      error: error.message
    });
  }
});

// @desc    Get a specific address by ID
// @route   GET /api/addresses/:id
// @access  Private
router.get('/:id', authenticate, async (req, res) => {
  try {
    const address = await Address.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    res.json({
      success: true,
      data: address
    });
  } catch (error) {
    console.error('Error fetching address:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch address',
      error: error.message
    });
  }
});

// @desc    Create a new address
// @route   POST /api/addresses
// @access  Private
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      title,
      name,
      phone,
      line1,
      line2,
      city,
      state,
      zipCode,
      country,
      location,
      isDefault,
      addressType,
      landmark
    } = req.body;

    // Validate required fields
    if (!title || !name || !phone || !line1 || !city || !state || !zipCode) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, name, phone, line1, city, state, zipCode'
      });
    }

    // Enforce allowed pincodes only if feature flag is enabled
    const pin = String(zipCode).trim();
    if (
      config.featureFlags.enforceLocationRestrictions &&
      Array.isArray(config.allowedPincodes) && 
      config.allowedPincodes.length > 0
    ) {
      if (!pin || !config.allowedPincodes.includes(pin)) {
        return res.status(400).json({ success: false, message: 'Service not available at this pincode' });
      }
    }

    // Check if this is the user's first address, make it default
    const existingAddressCount = await Address.countDocuments({ user: req.user._id });
    const shouldBeDefault = existingAddressCount === 0 || isDefault;

    const addressData = {
      user: req.user._id,
      title: title.trim(),
      name: name.trim(),
      phone: phone.trim(),
      line1: line1.trim(),
      line2: line2?.trim(),
      city: city.trim(),
      state: state.trim(),
      zipCode: zipCode.trim(),
      country: country || 'India',
      location,
      isDefault: shouldBeDefault,
      addressType: addressType || 'home',
      landmark: landmark?.trim()
    };

    const address = new Address(addressData);
    await address.save();

    res.status(201).json({
      success: true,
      data: address,
      message: 'Address created successfully'
    });
  } catch (error) {
    console.error('Error creating address:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create address',
      error: error.message
    });
  }
});

// @desc    Update an address
// @route   PUT /api/addresses/:id
// @access  Private
router.put('/:id', authenticate, async (req, res) => {
  try {
    const address = await Address.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    const {
      title,
      name,
      phone,
      line1,
      line2,
      city,
      state,
      zipCode,
      country,
      location,
      isDefault,
      addressType,
      landmark
    } = req.body;

    // Update fields
    if (title !== undefined) address.title = title.trim();
    if (name !== undefined) address.name = name.trim();
    if (phone !== undefined) address.phone = phone.trim();
    if (line1 !== undefined) address.line1 = line1.trim();
    if (line2 !== undefined) address.line2 = line2?.trim();
    if (city !== undefined) address.city = city.trim();
    if (state !== undefined) address.state = state.trim();
    if (zipCode !== undefined) {
      const pin = String(zipCode).trim();
      if (
        config.featureFlags.enforceLocationRestrictions &&
        Array.isArray(config.allowedPincodes) && 
        config.allowedPincodes.length > 0
      ) {
        if (!pin || !config.allowedPincodes.includes(pin)) {
          return res.status(400).json({ success: false, message: 'Service not available at this pincode' });
        }
      }
      address.zipCode = pin;
    }
    if (country !== undefined) address.country = country;
    if (location !== undefined) address.location = location;
    if (isDefault !== undefined) address.isDefault = isDefault;
    if (addressType !== undefined) address.addressType = addressType;
    if (landmark !== undefined) address.landmark = landmark?.trim();

    await address.save();

    res.json({
      success: true,
      data: address,
      message: 'Address updated successfully'
    });
  } catch (error) {
    console.error('Error updating address:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update address',
      error: error.message
    });
  }
});

// @desc    Set an address as default
// @route   PUT /api/addresses/:id/set-default
// @access  Private
router.put('/:id/set-default', authenticate, async (req, res) => {
  try {
    const address = await Address.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // The pre-save hook will handle removing default from other addresses
    address.isDefault = true;
    await address.save();

    res.json({
      success: true,
      data: address,
      message: 'Default address updated successfully'
    });
  } catch (error) {
    console.error('Error setting default address:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set default address',
      error: error.message
    });
  }
});

// @desc    Delete an address
// @route   DELETE /api/addresses/:id
// @access  Private
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const address = await Address.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // If deleting the default address, make another address default
    if (address.isDefault) {
      const otherAddress = await Address.findOne({
        user: req.user._id,
        _id: { $ne: req.params.id }
      }).sort({ createdAt: -1 });

      if (otherAddress) {
        otherAddress.isDefault = true;
        await otherAddress.save();
      }
    }

    await Address.deleteOne({ _id: req.params.id });

    res.json({
      success: true,
      message: 'Address deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting address:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete address',
      error: error.message
    });
  }
});

module.exports = router;
