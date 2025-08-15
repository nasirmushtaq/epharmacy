const express = require('express');
const router = express.Router();
const openRouteService = require('../config/openroute');
const { authenticate: auth } = require('../middleware/auth');

// @route   GET /api/geocoding/search
// @desc    Search for addresses using OpenRouteService
// @access  Private
router.get('/search', auth, async (req, res) => {
  try {
    const { q: query, size = 5 } = req.query;

    if (!query || query.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Query must be at least 3 characters long'
      });
    }

    if (!openRouteService.isConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Geocoding service not configured'
      });
    }

    const result = await openRouteService.geocode(query.trim(), { size: parseInt(size) });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error || 'Geocoding failed',
        results: []
      });
    }

    res.json({
      success: true,
      data: {
        query: query.trim(),
        results: result.results
      }
    });
  } catch (error) {
    console.error('Geocoding search error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during geocoding',
      error: error.message
    });
  }
});

// @route   GET /api/geocoding/autocomplete
// @desc    Get address suggestions using OpenRouteService autocomplete
// @access  Private
router.get('/autocomplete', auth, async (req, res) => {
  try {
    const { q: query, size = 5 } = req.query;

    if (!query || query.trim().length < 2) {
      return res.json({
        success: true,
        data: {
          query: query || '',
          suggestions: []
        }
      });
    }

    if (!openRouteService.isConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Geocoding service not configured'
      });
    }

    const result = await openRouteService.getAddressSuggestions(query.trim(), { size: parseInt(size) });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error || 'Autocomplete failed',
        suggestions: []
      });
    }

    res.json({
      success: true,
      data: {
        query: query.trim(),
        suggestions: result.suggestions
      }
    });
  } catch (error) {
    console.error('Geocoding autocomplete error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during autocomplete',
      error: error.message
    });
  }
});

// @route   GET /api/geocoding/reverse
// @desc    Reverse geocode coordinates to address
// @access  Private
router.get('/reverse', auth, async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid latitude or longitude'
      });
    }

    // Validate coordinates are within reasonable bounds
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        message: 'Coordinates out of valid range'
      });
    }

    // Check if coordinates are within Srinagar (optional warning)
    if (!openRouteService.isWithinSrinagar(latitude, longitude)) {
      console.warn(`Reverse geocoding coordinates outside Srinagar: ${latitude}, ${longitude}`);
    }

    if (!openRouteService.isConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Geocoding service not configured'
      });
    }

    const result = await openRouteService.reverseGeocode(latitude, longitude);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.error || 'No address found for coordinates'
      });
    }

    res.json({
      success: true,
      data: {
        coordinates: { latitude, longitude },
        address: result.result
      }
    });
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during reverse geocoding',
      error: error.message
    });
  }
});

// @route   POST /api/geocoding/validate-address
// @desc    Validate and enhance address with geocoding
// @access  Private
router.post('/validate-address', auth, async (req, res) => {
  try {
    const {
      line1,
      line2,
      city,
      state,
      zipCode,
      country = 'India'
    } = req.body;

    if (!line1 || !city || !state) {
      return res.status(400).json({
        success: false,
        message: 'Street address, city, and state are required'
      });
    }

    // Construct full address
    const addressParts = [line1];
    if (line2) addressParts.push(line2);
    addressParts.push(city, state);
    if (zipCode) addressParts.push(zipCode);
    addressParts.push(country);

    const fullAddress = addressParts.join(', ');

    if (!openRouteService.isConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Geocoding service not configured'
      });
    }

    const result = await openRouteService.geocode(fullAddress, { size: 1 });

    if (!result.success || result.results.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Address could not be geocoded',
        suggestions: []
      });
    }

    const geocodedAddress = result.results[0];

    // Check if geocoded address is within Srinagar
    if (!openRouteService.isWithinSrinagar(
      geocodedAddress.coordinates.latitude,
      geocodedAddress.coordinates.longitude
    )) {
      return res.status(400).json({
        success: false,
        message: 'Address is outside Srinagar delivery area',
        geocoded: geocodedAddress
      });
    }

    res.json({
      success: true,
      data: {
        original: {
          line1,
          line2,
          city,
          state,
          zipCode,
          country
        },
        geocoded: geocodedAddress,
        enhanced: {
          line1: geocodedAddress.address.street || line1,
          line2: line2 || geocodedAddress.address.housenumber,
          city: geocodedAddress.address.locality || city,
          state: geocodedAddress.address.region || state,
          zipCode: geocodedAddress.address.postalcode || zipCode,
          country: geocodedAddress.address.country || country,
          location: {
            latitude: geocodedAddress.coordinates.latitude,
            longitude: geocodedAddress.coordinates.longitude,
            source: 'openroute_service'
          },
          openRouteData: {
            id: geocodedAddress.id,
            label: geocodedAddress.label,
            confidence: geocodedAddress.confidence,
            layer: geocodedAddress.layer,
            source: geocodedAddress.source,
            address: geocodedAddress.address
          }
        }
      }
    });
  } catch (error) {
    console.error('Address validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during address validation',
      error: error.message
    });
  }
});

// @route   GET /api/geocoding/status
// @desc    Check OpenRouteService configuration status
// @access  Private
router.get('/status', auth, async (req, res) => {
  try {
    const isConfigured = openRouteService.isConfigured();
    
    let status = 'unavailable';
    let message = 'OpenRouteService not configured';

    if (isConfigured) {
      try {
        // Test with a simple geocoding request
        const testResult = await openRouteService.geocode('Srinagar, Kashmir', { size: 1 });
        if (testResult.success) {
          status = 'available';
          message = 'OpenRouteService is working correctly';
        } else {
          status = 'error';
          message = 'OpenRouteService configured but not responding correctly';
        }
      } catch (error) {
        status = 'error';
        message = 'OpenRouteService configured but encountered an error';
      }
    }

    res.json({
      success: true,
      data: {
        status,
        message,
        configured: isConfigured
      }
    });
  } catch (error) {
    console.error('Geocoding status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during status check',
      error: error.message
    });
  }
});

module.exports = router;
