import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  Card,
  ActivityIndicator,
  SegmentedButtons,
  Divider,
} from 'react-native-paper';
import { useAuth } from '../../contexts/AuthContext';

const RegisterScreen = ({ navigation }: any) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'customer',
    // Address fields
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'India',
    // Pharmacist fields
    licenseNumber: '',
    licenseExpiry: '',
    pharmacyName: '',
    // Delivery agent fields
    vehicleType: '',
    vehicleNumber: '',
    drivingLicense: '',
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { state, register, clearError } = useAuth();

  const roleOptions = [
    { value: 'customer', label: 'Customer' },
    { value: 'pharmacist', label: 'Pharmacist' },
    { value: 'delivery_agent', label: 'Delivery Agent' },
  ];

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const { firstName, lastName, email, phone, password, confirmPassword, role } = formData;

    if (!firstName || !lastName || !email || !phone || !password) {
      Alert.alert('Error', 'Please fill in all required fields');
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return false;
    }

    if (phone.length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return false;
    }

    // Role-specific validation
    if (role === 'pharmacist') {
      const { licenseNumber, licenseExpiry, pharmacyName } = formData;
      if (!licenseNumber || !licenseExpiry || !pharmacyName) {
        Alert.alert('Error', 'Please fill in all pharmacist details');
        return false;
      }
    }

    if (role === 'delivery_agent') {
      const { vehicleType, vehicleNumber, drivingLicense } = formData;
      if (!vehicleType || !vehicleNumber || !drivingLicense) {
        Alert.alert('Error', 'Please fill in all delivery agent details');
        return false;
      }
    }

    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    const registrationData = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
      role: formData.role,
      address: {
        street: formData.street || 'Not provided',
        city: formData.city || 'Not provided',
        state: formData.state || 'Not provided',
        zipCode: formData.zipCode || '000000',
        country: formData.country,
      },
    };

    // Add role-specific fields
    if (formData.role === 'pharmacist') {
      Object.assign(registrationData, {
        licenseNumber: formData.licenseNumber,
        licenseExpiry: formData.licenseExpiry,
        pharmacyName: formData.pharmacyName,
      });
    }

    if (formData.role === 'delivery_agent') {
      Object.assign(registrationData, {
        vehicleType: formData.vehicleType,
        vehicleNumber: formData.vehicleNumber,
        drivingLicense: formData.drivingLicense,
      });
    }

    const result = await register(registrationData);
    if (!result.success) {
      Alert.alert('Registration Failed', result.message || 'Please try again');
    }
  };

  const handleLoginNavigation = () => {
    clearError();
    navigation.navigate('Login');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.logoContainer}>
          <Text style={styles.title}>Join E-Pharmacy</Text>
          <Text style={styles.subtitle}>Create your account</Text>
        </View>

        <Card style={styles.card}>
          <Card.Content>
            {/* Role Selection */}
            <Text style={styles.sectionTitle}>Account Type</Text>
            <SegmentedButtons
              value={formData.role}
              onValueChange={(value) => updateField('role', value)}
              buttons={roleOptions}
              style={styles.segmentedButtons}
            />

            <Divider style={styles.divider} />

            {/* Personal Information */}
            <Text style={styles.sectionTitle}>Personal Information</Text>
            
            <View style={styles.row}>
              <TextInput
                label="First Name"
                value={formData.firstName}
                onChangeText={(value) => updateField('firstName', value)}
                mode="outlined"
                style={[styles.input, styles.halfInput]}
              />
              <TextInput
                label="Last Name"
                value={formData.lastName}
                onChangeText={(value) => updateField('lastName', value)}
                mode="outlined"
                style={[styles.input, styles.halfInput]}
              />
            </View>

            <TextInput
              label="Email"
              value={formData.email}
              onChangeText={(value) => updateField('email', value)}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              left={<TextInput.Icon icon="email" />}
            />

            <TextInput
              label="Phone Number"
              value={formData.phone}
              onChangeText={(value) => updateField('phone', value)}
              mode="outlined"
              keyboardType="phone-pad"
              style={styles.input}
              left={<TextInput.Icon icon="phone" />}
            />

            <TextInput
              label="Password"
              value={formData.password}
              onChangeText={(value) => updateField('password', value)}
              mode="outlined"
              secureTextEntry={!showPassword}
              style={styles.input}
              left={<TextInput.Icon icon="lock" />}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
            />

            <TextInput
              label="Confirm Password"
              value={formData.confirmPassword}
              onChangeText={(value) => updateField('confirmPassword', value)}
              mode="outlined"
              secureTextEntry={!showConfirmPassword}
              style={styles.input}
              left={<TextInput.Icon icon="lock-check" />}
              right={
                <TextInput.Icon
                  icon={showConfirmPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                />
              }
            />

            {/* Address Information */}
            <Divider style={styles.divider} />
            <Text style={styles.sectionTitle}>Address (Optional)</Text>

            <TextInput
              label="Street Address"
              value={formData.street}
              onChangeText={(value) => updateField('street', value)}
              mode="outlined"
              style={styles.input}
            />

            <View style={styles.row}>
              <TextInput
                label="City"
                value={formData.city}
                onChangeText={(value) => updateField('city', value)}
                mode="outlined"
                style={[styles.input, styles.halfInput]}
              />
              <TextInput
                label="State"
                value={formData.state}
                onChangeText={(value) => updateField('state', value)}
                mode="outlined"
                style={[styles.input, styles.halfInput]}
              />
            </View>

            <TextInput
              label="ZIP Code"
              value={formData.zipCode}
              onChangeText={(value) => updateField('zipCode', value)}
              mode="outlined"
              keyboardType="numeric"
              style={styles.input}
            />

            {/* Role-specific fields */}
            {formData.role === 'pharmacist' && (
              <>
                <Divider style={styles.divider} />
                <Text style={styles.sectionTitle}>Pharmacist Details</Text>
                
                <TextInput
                  label="License Number *"
                  value={formData.licenseNumber}
                  onChangeText={(value) => updateField('licenseNumber', value)}
                  mode="outlined"
                  style={styles.input}
                />

                <TextInput
                  label="License Expiry Date (YYYY-MM-DD) *"
                  value={formData.licenseExpiry}
                  onChangeText={(value) => updateField('licenseExpiry', value)}
                  mode="outlined"
                  placeholder="2025-12-31"
                  style={styles.input}
                />

                <TextInput
                  label="Pharmacy Name *"
                  value={formData.pharmacyName}
                  onChangeText={(value) => updateField('pharmacyName', value)}
                  mode="outlined"
                  style={styles.input}
                />
              </>
            )}

            {formData.role === 'delivery_agent' && (
              <>
                <Divider style={styles.divider} />
                <Text style={styles.sectionTitle}>Delivery Agent Details</Text>
                
                <TextInput
                  label="Vehicle Type *"
                  value={formData.vehicleType}
                  onChangeText={(value) => updateField('vehicleType', value)}
                  mode="outlined"
                  placeholder="e.g., Motorcycle, Car, Bicycle"
                  style={styles.input}
                />

                <TextInput
                  label="Vehicle Number *"
                  value={formData.vehicleNumber}
                  onChangeText={(value) => updateField('vehicleNumber', value)}
                  mode="outlined"
                  style={styles.input}
                />

                <TextInput
                  label="Driving License Number *"
                  value={formData.drivingLicense}
                  onChangeText={(value) => updateField('drivingLicense', value)}
                  mode="outlined"
                  style={styles.input}
                />
              </>
            )}

            <Button
              mode="contained"
              onPress={handleRegister}
              style={styles.registerButton}
              contentStyle={styles.buttonContent}
              disabled={state.isLoading}
            >
              {state.isLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                'Create Account'
              )}
            </Button>

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <Button
                mode="text"
                onPress={handleLoginNavigation}
                compact
                contentStyle={styles.loginButtonContent}
              >
                Sign In
              </Button>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  card: {
    elevation: 8,
    borderRadius: 12,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  segmentedButtons: {
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  input: {
    marginBottom: 15,
  },
  halfInput: {
    flex: 0.48,
  },
  divider: {
    marginVertical: 20,
  },
  registerButton: {
    marginTop: 20,
    marginBottom: 15,
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
    color: '#666',
  },
  loginButtonContent: {
    paddingVertical: 0,
  },
});

export default RegisterScreen; 