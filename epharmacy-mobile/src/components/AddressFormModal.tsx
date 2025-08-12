import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Modal,
  Portal,
  Text,
  TextInput,
  Button,
  RadioButton,
  Switch,
  ActivityIndicator,
  Divider,
} from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { useAddress, Address } from '../contexts/AddressContext';

interface AddressFormModalProps {
  visible: boolean;
  onDismiss: () => void;
  editingAddress?: Address | null;
  onSave?: (address: Address) => void;
}

interface AddressFormData {
  title: string;
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zipCode: string;
  landmark: string;
  addressType: 'home' | 'office' | 'other';
  isDefault: boolean;
}

const initialFormData: AddressFormData = {
  title: '',
  name: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  zipCode: '',
  landmark: '',
  addressType: 'home',
  isDefault: false,
};

export const AddressFormModal: React.FC<AddressFormModalProps> = ({
  visible,
  onDismiss,
  editingAddress,
  onSave,
}) => {
  const { createAddress, updateAddress, state } = useAddress();
  const [formData, setFormData] = useState<AddressFormData>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = Boolean(editingAddress);

  // Reset form when modal visibility changes
  useEffect(() => {
    if (visible) {
      if (editingAddress) {
        setFormData({
          title: editingAddress.title || '',
          name: editingAddress.name || '',
          phone: editingAddress.phone || '',
          line1: editingAddress.line1 || '',
          line2: editingAddress.line2 || '',
          city: editingAddress.city || '',
          state: editingAddress.state || '',
          zipCode: editingAddress.zipCode || '',
          landmark: editingAddress.landmark || '',
          addressType: editingAddress.addressType || 'home',
          isDefault: editingAddress.isDefault || false,
        });
      } else {
        setFormData(initialFormData);
      }
      setErrors({});
    }
  }, [visible, editingAddress]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Address title is required';
    }
    if (!formData.name.trim()) {
      newErrors.name = 'Recipient name is required';
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\+?[\d\s\-\(\)]{10,15}$/.test(formData.phone.trim())) {
      newErrors.phone = 'Please enter a valid phone number';
    }
    if (!formData.line1.trim()) {
      newErrors.line1 = 'Address line 1 is required';
    }
    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    }
    if (!formData.state.trim()) {
      newErrors.state = 'State is required';
    }
    if (!formData.zipCode.trim()) {
      newErrors.zipCode = 'ZIP code is required';
    } else if (!/^[\d\-\s]{3,10}$/.test(formData.zipCode.trim())) {
      newErrors.zipCode = 'Please enter a valid ZIP code';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      const addressData = {
        title: formData.title.trim(),
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        line1: formData.line1.trim(),
        line2: formData.line2.trim() || undefined,
        city: formData.city.trim(),
        state: formData.state.trim(),
        zipCode: formData.zipCode.trim(),
        landmark: formData.landmark.trim() || undefined,
        addressType: formData.addressType,
        isDefault: formData.isDefault,
      };

      let savedAddress: Address;

      if (isEditing && editingAddress) {
        savedAddress = await updateAddress(editingAddress._id, addressData);
      } else {
        savedAddress = await createAddress(addressData);
      }

      onSave?.(savedAddress);
      onDismiss();
      
      Alert.alert(
        'Success',
        `Address ${isEditing ? 'updated' : 'added'} successfully!`
      );
    } catch (error: any) {
      console.error('Error saving address:', error);
      Alert.alert(
        'Error',
        error.message || `Failed to ${isEditing ? 'update' : 'add'} address. Please try again.`
      );
    } finally {
      setLoading(false);
    }
  };

  const updateField = <K extends keyof AddressFormData>(
    field: K,
    value: AddressFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContainer}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <View style={styles.header}>
            <Text style={styles.title}>
              {isEditing ? 'Edit Address' : 'Add New Address'}
            </Text>
            <Button onPress={onDismiss} mode="text" disabled={loading}>
              Cancel
            </Button>
          </View>

          <Divider />

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.form}>
              {/* Address Title */}
              <TextInput
                mode="outlined"
                label="Address Title *"
                value={formData.title}
                onChangeText={(value) => updateField('title', value)}
                error={Boolean(errors.title)}
                style={styles.input}
                placeholder="e.g., Home, Office, etc."
                disabled={loading}
              />
              {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}

              {/* Recipient Name */}
              <TextInput
                mode="outlined"
                label="Recipient Name *"
                value={formData.name}
                onChangeText={(value) => updateField('name', value)}
                error={Boolean(errors.name)}
                style={styles.input}
                placeholder="Full name of the recipient"
                disabled={loading}
              />
              {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

              {/* Phone Number */}
              <TextInput
                mode="outlined"
                label="Phone Number *"
                value={formData.phone}
                onChangeText={(value) => updateField('phone', value)}
                error={Boolean(errors.phone)}
                style={styles.input}
                placeholder="10-digit mobile number"
                keyboardType="phone-pad"
                disabled={loading}
              />
              {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}

              {/* Address Line 1 */}
              <TextInput
                mode="outlined"
                label="Address Line 1 *"
                value={formData.line1}
                onChangeText={(value) => updateField('line1', value)}
                error={Boolean(errors.line1)}
                style={styles.input}
                placeholder="House/Flat/Office No., Building Name"
                disabled={loading}
              />
              {errors.line1 && <Text style={styles.errorText}>{errors.line1}</Text>}

              {/* Address Line 2 */}
              <TextInput
                mode="outlined"
                label="Address Line 2"
                value={formData.line2}
                onChangeText={(value) => updateField('line2', value)}
                style={styles.input}
                placeholder="Area, Street, Sector, Village (Optional)"
                disabled={loading}
              />

              {/* Landmark */}
              <TextInput
                mode="outlined"
                label="Landmark"
                value={formData.landmark}
                onChangeText={(value) => updateField('landmark', value)}
                style={styles.input}
                placeholder="Nearby landmark (Optional)"
                disabled={loading}
              />

              {/* City and State in a row */}
              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <TextInput
                    mode="outlined"
                    label="City *"
                    value={formData.city}
                    onChangeText={(value) => updateField('city', value)}
                    error={Boolean(errors.city)}
                    disabled={loading}
                  />
                  {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
                </View>
                <View style={styles.halfInput}>
                  <TextInput
                    mode="outlined"
                    label="State *"
                    value={formData.state}
                    onChangeText={(value) => updateField('state', value)}
                    error={Boolean(errors.state)}
                    disabled={loading}
                  />
                  {errors.state && <Text style={styles.errorText}>{errors.state}</Text>}
                </View>
              </View>

              {/* ZIP Code */}
              <TextInput
                mode="outlined"
                label="ZIP Code *"
                value={formData.zipCode}
                onChangeText={(value) => updateField('zipCode', value)}
                error={Boolean(errors.zipCode)}
                style={styles.input}
                placeholder="6-digit PIN code"
                keyboardType="numeric"
                disabled={loading}
              />
              {errors.zipCode && <Text style={styles.errorText}>{errors.zipCode}</Text>}

              {/* Address Type */}
              <Text style={styles.sectionTitle}>Address Type</Text>
              <View style={styles.radioGroup}>
                {[
                  { value: 'home', label: 'Home', icon: 'home' },
                  { value: 'office', label: 'Office', icon: 'business' },
                  { value: 'other', label: 'Other', icon: 'location-on' },
                ].map(({ value, label, icon }) => (
                  <View key={value} style={styles.radioOption}>
                    <RadioButton
                      value={value}
                      status={formData.addressType === value ? 'checked' : 'unchecked'}
                      onPress={() => updateField('addressType', value as any)}
                      disabled={loading}
                    />
                    <MaterialIcons name={icon as any} size={20} color="#666" style={styles.radioIcon} />
                    <Text style={styles.radioLabel}>{label}</Text>
                  </View>
                ))}
              </View>

              {/* Default Address Switch */}
              <View style={styles.switchRow}>
                <View style={styles.switchLabel}>
                  <Text style={styles.switchText}>Set as Default Address</Text>
                  <Text style={styles.switchSubtext}>
                    This will be used as your primary delivery address
                  </Text>
                </View>
                <Switch
                  value={formData.isDefault}
                  onValueChange={(value) => updateField('isDefault', value)}
                  disabled={loading}
                />
              </View>
            </View>
          </ScrollView>

          <Divider />

          <View style={styles.footer}>
            <Button
              mode="contained"
              onPress={handleSave}
              style={styles.saveButton}
              loading={loading}
              disabled={loading}
            >
              {isEditing ? 'Update Address' : 'Save Address'}
            </Button>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 8,
    width: '94%',
    alignSelf: 'center',
    maxHeight: '85%',
    elevation: 5,
  },
  container: {
    // Avoid flex:1 to prevent collapse in some layouts
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  scrollView: {
    maxHeight: 500,
  },
  form: {
    padding: 16,
  },
  input: {
    marginBottom: 8,
  },
  errorText: {
    color: '#f44336',
    fontSize: 12,
    marginBottom: 12,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  halfInput: {
    flex: 1,
    marginHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 12,
  },
  radioGroup: {
    marginBottom: 16,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  radioIcon: {
    marginLeft: 8,
    marginRight: 8,
  },
  radioLabel: {
    fontSize: 16,
    color: '#333',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  switchLabel: {
    flex: 1,
    marginRight: 16,
  },
  switchText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  switchSubtext: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  footer: {
    padding: 16,
  },
  saveButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 8,
  },
});
