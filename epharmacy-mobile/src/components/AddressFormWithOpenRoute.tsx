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
  Divider
} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Location from 'expo-location';
import api from '../services/api';

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
    source: 'gps' | 'network' | 'manual' | 'openroute_service';
  };
  openRouteData?: {
    id?: string;
    label?: string;
    confidence?: number;
    layer?: string;
    source?: string;
    address?: any;
  };
}

interface OpenRouteSuggestion {
  id: string;
  text: string;
  mainText: string;
  secondaryText: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  confidence: number;
  layer: string;
}

interface AddressFormWithOpenRouteProps {
  initialData?: Partial<AddressData>;
  onSubmit: (data: AddressData) => void;
  onCancel: () => void;
  loading?: boolean;
}

const AddressFormWithOpenRoute: React.FC<AddressFormWithOpenRouteProps> = ({
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

  const [addressSuggestions, setAddressSuggestions] = useState<OpenRouteSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Debounced address search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (formData.line1 && formData.line1.length > 2) {
        searchAddressSuggestions(formData.line1);
      } else {
        setAddressSuggestions([]);
        setShowSuggestions(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData.line1]);

  // Search for address suggestions using OpenRouteService
  const searchAddressSuggestions = async (query: string) => {
    setLoadingSuggestions(true);
    try {
      const response = await api.get('/api/geocoding/autocomplete', {
        params: { q: query, size: 5 }
      });

      if (response.data.success) {
        setAddressSuggestions(response.data.data.suggestions);
        setShowSuggestions(true);
      } else {
        setAddressSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.warn('Address search error:', error);
      setAddressSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = async (suggestion: OpenRouteSuggestion) => {
    try {
      setShowSuggestions(false);
      setLoadingSuggestions(true);

      // Validate the selected address
      const response = await api.post('/api/geocoding/validate-address', {
        line1: suggestion.mainText,
        line2: '',
        city: 'Srinagar',
        state: 'Jammu and Kashmir',
        zipCode: formData.zipCode,
        country: 'India'
      });

      if (response.data.success) {
        const enhanced = response.data.data.enhanced;
        
        setFormData(prev => ({
          ...prev,
          line1: enhanced.line1 || suggestion.mainText,
          line2: enhanced.line2 || prev.line2,
          city: enhanced.city || 'Srinagar',
          state: enhanced.state || 'Jammu and Kashmir',
          zipCode: enhanced.zipCode || prev.zipCode,
          country: enhanced.country || 'India',
          location: enhanced.location,
          openRouteData: enhanced.openRouteData
        }));
      } else {
        // Fallback to basic suggestion data
        setFormData(prev => ({
          ...prev,
          line1: suggestion.mainText,
          city: 'Srinagar',
          state: 'Jammu and Kashmir',
          location: {
            latitude: suggestion.coordinates.latitude,
            longitude: suggestion.coordinates.longitude,
            source: 'openroute_service'
          },
          openRouteData: {
            id: suggestion.id,
            confidence: suggestion.confidence,
            layer: suggestion.layer
          }
        }));
      }
    } catch (error) {
      console.warn('Error processing suggestion:', error);
      Alert.alert('Error', 'Failed to process address suggestion');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Get current location and reverse geocode
  const getCurrentLocationAndAddress = async () => {
    setGettingLocation(true);
    try {
      // Request permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is required to get your current address');
        return;
      }

      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        maximumAge: 10000,
      });

      const { latitude, longitude } = location.coords;

      // Reverse geocode using OpenRouteService
      const response = await api.get('/api/geocoding/reverse', {
        params: { lat: latitude, lng: longitude }
      });

      if (response.data.success) {
        const result = response.data.data.address;
        
        setFormData(prev => ({
          ...prev,
          line1: result.address.street || 'Current Location',
          line2: result.address.housenumber || prev.line2,
          city: result.address.locality || 'Srinagar',
          state: result.address.region || 'Jammu and Kashmir',
          zipCode: result.address.postalcode || prev.zipCode,
          country: result.address.country || 'India',
          location: {
            latitude,
            longitude,
            accuracy: location.coords.accuracy || undefined,
            source: 'gps'
          },
          openRouteData: {
            id: result.id,
            label: result.label,
            confidence: result.confidence,
            layer: result.layer,
            source: result.source,
            address: result.address
          }
        }));

        Alert.alert('Success', 'Current location added to address');
      } else {
        // Fallback to just coordinates
        setFormData(prev => ({
          ...prev,
          line1: 'Current Location',
          location: {
            latitude,
            longitude,
            accuracy: location.coords.accuracy || undefined,
            source: 'gps'
          }
        }));
        
        Alert.alert('Location Set', 'Location coordinates added. Please enter address details manually.');
      }
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
                <View key={suggestion.id}>
                  <View
                    style={styles.suggestion}
                    onTouchEnd={() => handleSuggestionSelect(suggestion)}
                  >
                    <Icon name="map-marker" size={20} color="#666" />
                    <View style={styles.suggestionText}>
                      <Text style={styles.suggestionMain}>
                        {suggestion.mainText}
                      </Text>
                      <Text style={styles.suggestionSecondary}>
                        {suggestion.secondaryText}
                      </Text>
                      <Text style={styles.suggestionConfidence}>
                        Confidence: {Math.round(suggestion.confidence * 100)}% • {suggestion.layer}
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
                {formData.openRouteData?.confidence && 
                  ` • Confidence: ${Math.round(formData.openRouteData.confidence * 100)}%`
                }
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
    maxHeight: 250,
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
    marginTop: 2,
  },
  suggestionConfidence: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
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

export default AddressFormWithOpenRoute;
