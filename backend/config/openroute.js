const axios = require('axios');

class OpenRouteService {
  constructor() {
    this.apiKey = process.env.OPENROUTE_API_KEY || '';
    this.baseUrl = 'https://api.openrouteservice.org';
    
    // Create axios instance with default config
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'Authorization': this.apiKey,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Calculate driving distance and time between two coordinates
   * @param {number} startLat - Starting latitude
   * @param {number} startLng - Starting longitude  
   * @param {number} endLat - Ending latitude
   * @param {number} endLng - Ending longitude
   * @param {string} profile - Routing profile (driving-car, cycling-regular, foot-walking)
   * @returns {Promise<Object>} Distance in km, duration in minutes, and route geometry
   */
  async getDirections(startLat, startLng, endLat, endLng, profile = 'driving-car') {
    try {
      const coordinates = [[startLng, startLat], [endLng, endLat]];
      
      const response = await this.client.post(`/v2/directions/${profile}`, {
        coordinates,
        format: 'json',
        instructions: false,
        geometry: true,
        elevation: false
      });

      const route = response.data.routes[0];
      if (!route) {
        throw new Error('No route found');
      }

      return {
        distance: Math.round(route.summary.distance / 1000 * 100) / 100, // km with 2 decimals
        duration: Math.round(route.summary.duration / 60), // minutes
        geometry: route.geometry,
        bbox: route.bbox,
        segments: route.segments
      };
    } catch (error) {
      console.error('OpenRouteService directions error:', error.response?.data || error.message);
      // Fallback to Haversine distance if API fails
      const distance = this.calculateHaversineDistance(startLat, startLng, endLat, endLng);
      const duration = Math.round((distance / 25) * 60); // Assume 25 km/h average speed
      
      return {
        distance,
        duration,
        geometry: null,
        bbox: null,
        segments: null,
        fallback: true
      };
    }
  }

  /**
   * Geocode an address to coordinates
   * @param {string} address - Address to geocode
   * @param {Object} options - Geocoding options
   * @returns {Promise<Object>} Geocoding results
   */
  async geocode(address, options = {}) {
    try {
      const params = {
        text: address,
        size: options.size || 5,
        'boundary.country': 'IN', // India
        'focus.point.lat': 34.0837, // Srinagar center (main city)
        'focus.point.lon': 74.7973,
        'boundary.circle.lat': 34.0837,
        'boundary.circle.lon': 74.7973,
        'boundary.circle.radius': 200, // 200km radius to cover entire Kashmir
        layers: options.layers || ['address', 'street', 'venue']
      };

      const response = await this.client.get('/geocoding/v1/search', { params });
      
      return {
        success: true,
        results: response.data.features.map(feature => ({
          id: feature.properties.id,
          label: feature.properties.label,
          name: feature.properties.name,
          confidence: feature.properties.confidence,
          coordinates: {
            latitude: feature.geometry.coordinates[1],
            longitude: feature.geometry.coordinates[0]
          },
          address: {
            name: feature.properties.name,
            street: feature.properties.street,
            housenumber: feature.properties.housenumber,
            neighbourhood: feature.properties.neighbourhood,
            locality: feature.properties.locality,
            region: feature.properties.region,
            country: feature.properties.country,
            postalcode: feature.properties.postalcode
          },
          layer: feature.properties.layer,
          source: feature.properties.source
        }))
      };
    } catch (error) {
      console.error('OpenRouteService geocoding error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        results: []
      };
    }
  }

  /**
   * Reverse geocode coordinates to address
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Promise<Object>} Reverse geocoding result
   */
  async reverseGeocode(lat, lng) {
    try {
      const params = {
        'point.lat': lat,
        'point.lon': lng,
        size: 1,
        layers: ['address', 'street', 'venue']
      };

      const response = await this.client.get('/geocoding/v1/reverse', { params });
      
      if (response.data.features.length === 0) {
        return {
          success: false,
          error: 'No address found for coordinates',
          result: null
        };
      }

      const feature = response.data.features[0];
      return {
        success: true,
        result: {
          id: feature.properties.id,
          label: feature.properties.label,
          confidence: feature.properties.confidence,
          coordinates: {
            latitude: feature.geometry.coordinates[1],
            longitude: feature.geometry.coordinates[0]
          },
          address: {
            name: feature.properties.name,
            street: feature.properties.street,
            housenumber: feature.properties.housenumber,
            neighbourhood: feature.properties.neighbourhood,
            locality: feature.properties.locality,
            region: feature.properties.region,
            country: feature.properties.country,
            postalcode: feature.properties.postalcode
          },
          layer: feature.properties.layer,
          source: feature.properties.source
        }
      };
    } catch (error) {
      console.error('OpenRouteService reverse geocoding error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        result: null
      };
    }
  }

  /**
   * Get address suggestions (autocomplete)
   * @param {string} text - Partial address text
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Address suggestions
   */
  async getAddressSuggestions(text, options = {}) {
    try {
      const params = {
        text,
        size: options.size || 5,
        'boundary.country': 'IN',
        'focus.point.lat': 34.0837,
        'focus.point.lon': 74.7973,
        'boundary.circle.lat': 34.0837,
        'boundary.circle.lon': 74.7973,
        'boundary.circle.radius': 200,
        layers: ['address', 'street', 'venue']
      };

      const response = await this.client.get('/geocoding/v1/autocomplete', { params });
      
      return {
        success: true,
        suggestions: response.data.features.map(feature => ({
          id: feature.properties.id,
          text: feature.properties.label,
          mainText: feature.properties.name || feature.properties.street || '',
          secondaryText: [
            feature.properties.locality,
            feature.properties.region,
            feature.properties.country
          ].filter(Boolean).join(', '),
          coordinates: {
            latitude: feature.geometry.coordinates[1],
            longitude: feature.geometry.coordinates[0]
          },
          confidence: feature.properties.confidence,
          layer: feature.properties.layer
        }))
      };
    } catch (error) {
      console.error('OpenRouteService autocomplete error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        suggestions: []
      };
    }
  }

  /**
   * Check if coordinates are within Kashmir region boundaries
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {boolean} True if within Kashmir region
   */
  isWithinKashmir(lat, lng) {
    // Extended Kashmir region boundaries (including entire J&K and Ladakh)
    const kashmirBounds = {
      north: 37.0,    // Northern Kashmir (near LOC, including Gilgit-Baltistan region)
      south: 32.3,    // Southern Kashmir (Jammu region including Kathua)
      east: 78.5,     // Eastern Kashmir (entire Ladakh region including Daulat Beg Oldi)
      west: 73.0      // Western Kashmir (near Pakistan border)
    };

    return (
      lat >= kashmirBounds.south &&
      lat <= kashmirBounds.north &&
      lng >= kashmirBounds.west &&
      lng <= kashmirBounds.east
    );
  }

  /**
   * Check if coordinates are within Srinagar city (backward compatibility)
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {boolean} True if within Srinagar
   */
  isWithinSrinagar(lat, lng) {
    // For backward compatibility, use Kashmir boundaries
    return this.isWithinKashmir(lat, lng);
  }

  /**
   * Fallback Haversine distance calculation
   * @param {number} lat1 - First latitude
   * @param {number} lng1 - First longitude
   * @param {number} lat2 - Second latitude
   * @param {number} lng2 - Second longitude
   * @returns {number} Distance in kilometers
   */
  calculateHaversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return Math.round(distance * 100) / 100;
  }

  /**
   * Estimate delivery time with traffic consideration
   * @param {number} distance - Distance in kilometers
   * @param {number} duration - Base duration from routing
   * @returns {number} Estimated delivery time in minutes
   */
  estimateDeliveryTime(distance, duration) {
    if (duration) {
      // Add buffer time for traffic and delivery preparation
      const bufferTime = Math.max(15, distance * 2); // Minimum 15 min, +2 min per km
      return Math.ceil(duration + bufferTime);
    }
    
    // Fallback calculation
    const averageSpeed = 20; // km/h in Srinagar traffic
    const baseTime = (distance / averageSpeed) * 60;
    const bufferTime = Math.max(15, distance * 2);
    return Math.ceil(baseTime + bufferTime);
  }

  /**
   * Check if OpenRouteService is configured
   * @returns {boolean} True if API key is available
   */
  isConfigured() {
    return !!this.apiKey && this.apiKey.length > 0;
  }
}

// Create singleton instance
const openRouteService = new OpenRouteService();

module.exports = openRouteService;
