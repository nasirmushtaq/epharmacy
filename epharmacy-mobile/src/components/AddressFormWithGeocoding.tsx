import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Platform,
  ScrollView
} from 'react-native';
import {
  TextInput,
  Button,
  Chip,
  Surface,
  ActivityIndicator,
  Menu,
  Divider
} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Location from 'expo-location';
import { useLocationTracking } from '../hooks/useLocationTracking';

interface AddressData {
  title: string;
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  landmark: string;
  addressType: 'home' | 'office' | 'other';
  location: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    source: 'gps' | 'network' | 'manual' | 'google_maps';
  };
  googleMapsData?: {
    placeId?: string;
    formattedAddress?: string;
    addressComponents?: any[];
    geometry?: any;
    types?: string[];
  };
}

interface GooglePlaceSuggestion {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  types: string[];
}

interface AddressFormWithGeocodingProps {
  initialData?: Partial<AddressData>;
  onSubmit: (data: AddressData) => void;
  onCancel: () => void;
  loading?: boolean;
}

const AddressFormWithGeocoding: React.FC<AddressFormWithGeocodingProps> = ({
  initialData,
  onSubmit,
  onCancel,
  loading = false
}) => {
  const [formData, setFormData] = useState<Partial<AddressData>>({
    title: '',
    name: '',
    phone: '',
    line1: '',
    line2: '',
    city: 'Srinagar',
    state: 'Jammu and Kashmir',
    zipCode: '',
    country: 'India',
    landmark: '',
    addressType: 'home',
    ...initialData
  });

  const [addressSuggestions, setAddressSuggestions] = useState<GooglePlaceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [addressTypeMenuVisible, setAddressTypeMenuVisible] = useState(false);

  const { getCurrentLocation, permissionStatus, requestPermissions } = useLocationTracking({
    enableTracking: false
  });

  // Debounced address search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (formData.line1 && formData.line1.length > 3) {
        searchAddressSuggestions(formData.line1);
      } else {
        setAddressSuggestions([]);
        setShowSuggestions(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData.line1]);

  // Mock Google Places API (replace with actual implementation)
  const searchAddressSuggestions = async (query: string) => {
    setLoadingSuggestions(true);
    try {
      // This would be replaced with actual Google Places Autocomplete API
      // For now, using mock data for common Srinagar locations
      const mockSuggestions: GooglePlaceSuggestion[] = [
        {
          place_id: 'ChIJ1234567890',
          description: `${query}, Srinagar, Jammu and Kashmir, India`,
          structured_formatting: {
            main_text: query,
            secondary_text: 'Srinagar, Jammu and Kashmir, India'
          },
          types: ['street_address']
        },
        {
          place_id: 'ChIJ0987654321',
          description: `${query}, Dal Lake, Srinagar, Jammu and Kashmir, India`,
          structured_formatting: {
            main_text: `${query}, Dal Lake`,
            secondary_text: 'Srinagar, Jammu and Kashmir, India'
          },
          types: ['point_of_interest']
        },
        {
          place_id: 'ChIJ1357924680',
          description: `${query}, Lal Chowk, Srinagar, Jammu and Kashmir, India`,
          structured_formatting: {
            main_text: `${query}, Lal Chowk`,
            secondary_text: 'Srinagar, Jammu and Kashmir, India'
          },
          types: ['establishment']
        }
      ];

      setAddressSuggestions(mockSuggestions);
      setShowSuggestions(true);
    } catch (error) {
      console.warn('Address search error:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Get place details from place_id (mock implementation)
  const getPlaceDetails = async (placeId: string): Promise<any> => {
    // This would be replaced with actual Google Places Details API
    return {
      place_id: placeId,
      formatted_address: formData.line1 + ', Srinagar, Jammu and Kashmir 190001, India',
      geometry: {
        location: {
          lat: 34.0837 + (Math.random() - 0.5) * 0.01, // Random location in Srinagar
          lng: 74.7973 + (Math.random() - 0.5) * 0.01
        },
        location_type: 'ROOFTOP',
        viewport: {
          northeast: { lat: 34.0847, lng: 74.7983 },
          southwest: { lat: 34.0827, lng: 74.7963 }
        }
      },
      address_components: [
        { long_name: formData.line1, short_name: formData.line1, types: ['street_address'] },
        { long_name: 'Srinagar', short_name: 'Srinagar', types: ['locality'] },
        { long_name: 'Jammu and Kashmir', short_name: 'JK', types: ['administrative_area_level_1'] },
        { long_name: 'India', short_name: 'IN', types: ['country'] },
        { long_name: '190001', short_name: '190001', types: ['postal_code'] }
      ],
      types: ['street_address']
    };
  };

  const handleSuggestionSelect = async (suggestion: GooglePlaceSuggestion) => {
    try {
      setShowSuggestions(false);
      setLoadingSuggestions(true);

      const placeDetails = await getPlaceDetails(suggestion.place_id);
      
      // Extract address components
      const components = placeDetails.address_components;
      const streetNumber = components.find((c: any) => c.types.includes('street_number'))?.long_name || '';
      const route = components.find((c: any) => c.types.includes('route'))?.long_name || '';
      const locality = components.find((c: any) => c.types.includes('locality'))?.long_name || '';
      const state = components.find((c: any) => c.types.includes('administrative_area_level_1'))?.long_name || '';
      const zipCode = components.find((c: any) => c.types.includes('postal_code'))?.long_name || '';
      const country = components.find((c: any) => c.types.includes('country'))?.long_name || '';

      // Update form data
      setFormData(prev => ({
        ...prev,
        line1: streetNumber && route ? `${streetNumber} ${route}` : suggestion.structured_formatting.main_text,
        city: locality || 'Srinagar',
        state: state || 'Jammu and Kashmir',
        zipCode: zipCode || prev.zipCode,
        country: country || 'India',
        location: {
          latitude: placeDetails.geometry.location.lat,
          longitude: placeDetails.geometry.location.lng,
          source: 'google_maps'
        },
        googleMapsData: {
          placeId: placeDetails.place_id,
          formattedAddress: placeDetails.formatted_address,
          addressComponents: components,
          geometry: placeDetails.geometry,
          types: placeDetails.types
        }
      }));
    } catch (error) {
      console.warn('Error getting place details:', error);
      Alert.alert('Error', 'Failed to get address details');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const getCurrentLocationAndAddress = async () => {
    setGettingLocation(true);
    try {
      const hasPermission = permissionStatus === 'granted' || await requestPermissions();
      if (!hasPermission) {
        Alert.alert('Permission Required', 'Location permission is required to get your current address');
        return;
      }

      const location = await getCurrentLocation();
      if (!location) {
        Alert.alert('Error', 'Failed to get current location');
        return;
      }

      // Reverse geocoding (mock implementation)
      // In a real app, you would use Google Geocoding API
      const mockAddress = {
        line1: 'Current Location Street',
        city: 'Srinagar',
        state: 'Jammu and Kashmir',
        zipCode: '190001',
        country: 'India'
      };

      setFormData(prev => ({
        ...prev,
        ...mockAddress,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          source: 'gps'
        }
      }));

      Alert.alert('Success', 'Current location added to address');
    } catch (error) {
      console.warn('Error getting current location:', error);
      Alert.alert('Error', 'Failed to get current location');
    } finally {
      setGettingLocation(false);
    }
  };

  const validateForm = (): boolean => {
    const required = ['title', 'name', 'phone', 'line1', 'city', 'state', 'zipCode'];
    const missing = required.filter(field => !formData[field as keyof typeof formData]);
    
    if (missing.length > 0) {
      Alert.alert('Validation Error', `Please fill in: ${missing.join(', ')}`);
      return false;
    }

    if (!formData.location?.latitude || !formData.location?.longitude) {
      Alert.alert('Location Required', 'Please select a location or use current location');
      return false;
    }

    // Validate phone number
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,15}$/;
    if (!phoneRegex.test(formData.phone || '')) {
      Alert.alert('Validation Error', 'Please enter a valid phone number');
      return false;
    }

    // Validate zip code
    const zipRegex = /^[\d\-\s]{3,10}$/;
    if (!zipRegex.test(formData.zipCode || '')) {
      Alert.alert('Validation Error', 'Please enter a valid zip code');
      return false;
    }

    return true;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;
    onSubmit(formData as AddressData);
  };

  const addressTypeOptions = [
    { label: 'Home', value: 'home', icon: 'home' },
    { label: 'Office', value: 'office', icon: 'office-building' },
    { label: 'Other', value: 'other', icon: 'map-marker' }
  ];

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Address Type Selection */}
      <View style={styles.typeContainer}>
        <Text style={styles.sectionLabel}>Address Type</Text>
        <View style={styles.typeChips}>
          {addressTypeOptions.map((option) => (
            <Chip
              key={option.value}
              mode={formData.addressType === option.value ? 'flat' : 'outlined'}
              selected={formData.addressType === option.value}
              onPress={() => setFormData(prev => ({ ...prev, addressType: option.value as any }))}
              icon={option.icon}
              style={styles.typeChip}
            >
              {option.label}
            </Chip>
          ))}
        </View>
      </View>

      {/* Basic Information */}
      <Text style={styles.sectionLabel}>Basic Information</Text>
      
      <TextInput
        label="Address Title *"
        value={formData.title}
        onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
        mode="outlined"
        style={styles.input}
        placeholder="e.g., Home, Office, etc."
      />

      <TextInput
        label="Contact Person Name *"
        value={formData.name}
        onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
        mode="outlined"
        style={styles.input}
      />

      <TextInput
        label="Phone Number *"
        value={formData.phone}
        onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
        mode="outlined"
        style={styles.input}
        keyboardType="phone-pad"
        placeholder="+91 XXXXXXXXXX"
      />

      {/* Address Details */}
      <Text style={styles.sectionLabel}>Address Details</Text>

      <View style={styles.addressInputContainer}>
        <TextInput
          label="Street Address *"
          value={formData.line1}
          onChangeText={(text) => setFormData(prev => ({ ...prev, line1: text }))}
          mode="outlined"
          style={styles.input}
          placeholder="Enter street address"
          right={
            <TextInput.Icon 
              icon="map-search" 
              onPress={() => setShowSuggestions(!showSuggestions)}
            />
          }
        />
        
        {/* Address Suggestions */}
        {showSuggestions && (
          <Surface style={styles.suggestionsContainer}>
            {loadingSuggestions ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" />
                <Text style={styles.loadingText}>Searching addresses...</Text>
              </View>
            ) : addressSuggestions.length > 0 ? (
              addressSuggestions.map((suggestion, index) => (
                <View key={suggestion.place_id}>
                  <View
                    style={styles.suggestion}
                    onTouchEnd={() => handleSuggestionSelect(suggestion)}
                  >
                    <Icon name="map-marker" size={20} color="#666" />
                    <View style={styles.suggestionText}>
                      <Text style={styles.suggestionMain}>
                        {suggestion.structured_formatting.main_text}
                      </Text>
                      <Text style={styles.suggestionSecondary}>
                        {suggestion.structured_formatting.secondary_text}
                      </Text>
                    </View>
                  </View>
                  {index < addressSuggestions.length - 1 && <Divider />}
                </View>
              ))
            ) : (
              <Text style={styles.noSuggestions}>No address suggestions found</Text>
            )}
          </Surface>
        )}
      </View>

      <TextInput
        label="Apartment, Floor, Building (Optional)"
        value={formData.line2}
        onChangeText={(text) => setFormData(prev => ({ ...prev, line2: text }))}
        mode="outlined"
        style={styles.input}
      />

      <View style={styles.row}>
        <TextInput
          label="City *"
          value={formData.city}
          onChangeText={(text) => setFormData(prev => ({ ...prev, city: text }))}
          mode="outlined"
          style={[styles.input, styles.halfInput]}
        />
        <TextInput
          label="ZIP Code *"
          value={formData.zipCode}
          onChangeText={(text) => setFormData(prev => ({ ...prev, zipCode: text }))}
          mode="outlined"
          style={[styles.input, styles.halfInput]}
          keyboardType="numeric"
        />
      </View>

      <TextInput
        label="State *"
        value={formData.state}
        onChangeText={(text) => setFormData(prev => ({ ...prev, state: text }))}
        mode="outlined"
        style={styles.input}
      />

      <TextInput
        label="Landmark (Optional)"
        value={formData.landmark}
        onChangeText={(text) => setFormData(prev => ({ ...prev, landmark: text }))}
        mode="outlined"
        style={styles.input}
        placeholder="Nearby landmark for easy identification"
      />

      {/* Location Information */}
      <Text style={styles.sectionLabel}>Location</Text>
      
      <Surface style={styles.locationContainer}>
        {formData.location?.latitude && formData.location?.longitude ? (
          <View style={styles.locationInfo}>
            <Icon name="map-marker-check" size={24} color="#4CAF50" />
            <View style={styles.locationText}>
              <Text style={styles.locationTitle}>Location Set</Text>
              <Text style={styles.locationCoords}>
                {formData.location.latitude.toFixed(6)}, {formData.location.longitude.toFixed(6)}
              </Text>
              <Text style={styles.locationSource}>
                Source: {formData.location.source}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.locationInfo}>
            <Icon name="map-marker-off" size={24} color="#FF9800" />
            <View style={styles.locationText}>
              <Text style={styles.locationTitle}>Location Required</Text>
              <Text style={styles.locationSubtext}>
                Please set your location for accurate delivery
              </Text>
            </View>
          </View>
        )}
      </Surface>

      <Button
        mode="outlined"
        onPress={getCurrentLocationAndAddress}
        loading={gettingLocation}
        disabled={gettingLocation}
        style={styles.locationButton}
        icon="crosshairs-gps"
      >
        {gettingLocation ? 'Getting Location...' : 'Use Current Location'}
      </Button>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <Button
          mode="outlined"
          onPress={onCancel}
          style={styles.actionButton}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          mode="contained"
          onPress={handleSubmit}
          style={styles.actionButton}
          loading={loading}
          disabled={loading}
        >
          Save Address
        </Button>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  typeContainer: {
    marginBottom: 16,
  },
  typeChips: {
    flexDirection: 'row',
    gap: 8,
  },
  typeChip: {
    marginRight: 8,
  },
  input: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  halfInput: {
    flex: 1,
  },
  addressInputContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    elevation: 8,
    borderRadius: 4,
    maxHeight: 200,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  suggestionText: {
    flex: 1,
  },
  suggestionMain: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  suggestionSecondary: {
    fontSize: 12,
    color: '#666',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  noSuggestions: {
    padding: 16,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  locationContainer: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationText: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  locationCoords: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  locationSource: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  locationSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  locationButton: {
    marginBottom: 20,
  },
  actionContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    paddingBottom: 32,
  },
  actionButton: {
    flex: 1,
  },
});

export default AddressFormWithGeocoding;
