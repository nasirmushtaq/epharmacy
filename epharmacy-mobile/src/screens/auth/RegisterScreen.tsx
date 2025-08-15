import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, Pressable } from 'react-native';
import { Text, TextInput, Button, HelperText, Menu, Avatar } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import DatePickerField from '../../components/DatePickerField';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../../services/api';
import * as Location from 'expo-location';
const ENABLE_LOCATION_CAPTURE = (process.env.EXPO_PUBLIC_ENABLE_LOCATION_CAPTURE || '').toLowerCase() === 'true';

const RegisterScreen = ({ navigation }: any) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'customer'|'pharmacist'|'doctor'|'delivery_agent'>('customer');
  const [roleMenuVisible, setRoleMenuVisible] = useState(false);
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [zipCode, setZipCode] = useState('');

  // Role-specific fields
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [pharmacyName, setPharmacyName] = useState('');

  const [vehicleType, setVehicleType] = useState('bike');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [drivingLicense, setDrivingLicense] = useState('');

  const [msg, setMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [profileUri, setProfileUri] = useState<string | null>(null);
  const [capturedCoords, setCapturedCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);

  const registerMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        firstName, lastName, email, password, phone, role,
        address: { street, city, state: stateName, zipCode }
      };
      if (ENABLE_LOCATION_CAPTURE && capturedCoords) {
        payload.address.coordinates = capturedCoords;
      }
      // Location capture disabled (behind feature flag). No dependency on expo-location.
      if (role === 'pharmacist') Object.assign(payload, { licenseNumber, licenseExpiry, pharmacyName });
      if (role === 'doctor') Object.assign(payload, { licenseNumber, licenseExpiry });
      if (role === 'delivery_agent') Object.assign(payload, { vehicleType, vehicleNumber, drivingLicense });
      console.log('Register payload:', payload);
      const res = await authApi.post('/api/auth/register', payload);
      return res.data;
    },
    onSuccess: async (data: any) => {
      setMsg('Registered. Please verify OTP sent to your email/phone.');
      try {
        await authApi.post('/api/auth/request-otp', { email });
      } catch {}
      navigation.navigate('OtpVerify', { email });
    },
    onError: (e: any) => { console.error('Register error:', e.response?.data || e); setMsg(e.response?.data?.message || 'Registration failed'); }
  });

  const handleRegister = async () => {
    setMsg(null);
    setErrors({});
    // basic required fields
    const newErrors: any = {};
    if (!firstName) newErrors.firstName = 'Required';
    if (!lastName) newErrors.lastName = 'Required';
    if (!email) newErrors.email = 'Required';
    if (!password) newErrors.password = 'Required';
    if (!phone) newErrors.phone = 'Required';
    if (!street) newErrors.street = 'Required';
    if (!city) newErrors.city = 'Required';
    if (!stateName) newErrors.stateName = 'Required';
    if (!zipCode) newErrors.zipCode = 'Required';
    // role specific
    if (role === 'pharmacist' || role === 'doctor') {
      if (!licenseNumber) newErrors.licenseNumber = 'Required';
      if (!licenseExpiry) newErrors.licenseExpiry = 'Required';
      if (role === 'pharmacist' && !pharmacyName) newErrors.pharmacyName = 'Required';
    }
    if (role === 'delivery_agent') {
      if (!vehicleType) newErrors.vehicleType = 'Required';
      if (!vehicleNumber) newErrors.vehicleNumber = 'Required';
      if (!drivingLicense) newErrors.drivingLicense = 'Required';
    }
    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      setMsg('Please fill required fields');
      return;
    }
    setLoading(true);
    try { await registerMutation.mutateAsync(); } finally { setLoading(false); }
  };

  const captureCurrentLocation = async () => {
    if (!ENABLE_LOCATION_CAPTURE) return;
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setMsg('Location permission denied');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCapturedCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      setMsg('Location captured');
    } catch (e: any) {
      setMsg('Failed to capture location');
    } finally {
      setLocLoading(false);
    }
  };

  const pickProfileImage = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files && input.files[0];
        if (file) {
          setProfileUri(URL.createObjectURL(file));
        }
      };
      input.click();
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { setMsg('Permission denied for media library'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!result.canceled) {
      // @ts-ignore
      const uri = result.assets?.[0]?.uri;
      if (uri) setProfileUri(uri);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Create an account</Text>
      <View style={{ alignItems: 'center', marginBottom: 8 }}>
        {profileUri ? (
          <Avatar.Image size={84} source={{ uri: profileUri }} />
        ) : (
          <Avatar.Icon size={84} icon="account" />
        )}
        <Button mode="text" onPress={pickProfileImage} style={{ marginTop: 6 }}>Add Profile Photo</Button>
      </View>

      <View style={styles.row}>
        <TextInput label="First Name" value={firstName} onChangeText={setFirstName} mode="outlined" style={[styles.input, styles.half]} error={!!errors.firstName} />
        <TextInput label="Last Name" value={lastName} onChangeText={setLastName} mode="outlined" style={[styles.input, styles.half]} error={!!errors.lastName} />
      </View>
      <TextInput label="Email" value={email} onChangeText={setEmail} mode="outlined" style={styles.input} keyboardType="email-address" autoCapitalize='none' error={!!errors.email} />
      <TextInput label="Password" value={password} onChangeText={setPassword} mode="outlined" style={styles.input} secureTextEntry error={!!errors.password} />
      <TextInput label="Phone" value={phone} onChangeText={setPhone} mode="outlined" style={styles.input} keyboardType='phone-pad' error={!!errors.phone} />

      <Text style={styles.subtitle}>Role</Text>
      <Menu
        visible={roleMenuVisible}
        onDismiss={() => setRoleMenuVisible(false)}
        anchor={
          <Pressable onPress={() => setRoleMenuVisible(true)}>
            <TextInput
              label="Select Role"
              value={
                role === 'customer' ? 'Customer' : role === 'pharmacist' ? 'Pharmacist' : role === 'doctor' ? 'Doctor' : 'Delivery Agent'
              }
              mode="outlined"
              right={<TextInput.Icon icon="menu-down" />}
              editable={false}
              style={styles.input}
            />
          </Pressable>
        }
      >
        <Menu.Item onPress={() => { setRole('customer'); setRoleMenuVisible(false); }} title="Customer" />
        <Menu.Item onPress={() => { setRole('pharmacist'); setRoleMenuVisible(false); }} title="Pharmacist" />
        <Menu.Item onPress={() => { setRole('doctor'); setRoleMenuVisible(false); }} title="Doctor" />
        <Menu.Item onPress={() => { setRole('delivery_agent'); setRoleMenuVisible(false); }} title="Delivery Agent" />
      </Menu>

      <Text style={styles.subtitle}>Address</Text>
      <TextInput label="Street" value={street} onChangeText={setStreet} mode="outlined" style={styles.input} error={!!errors.street} />
      <View style={styles.row}>
        <TextInput label="City" value={city} onChangeText={setCity} mode="outlined" style={[styles.input, styles.half]} error={!!errors.city} />
        <TextInput label="State" value={stateName} onChangeText={setStateName} mode="outlined" style={[styles.input, styles.half]} error={!!errors.stateName} />
      </View>
      <TextInput label="ZIP Code" value={zipCode} onChangeText={setZipCode} mode="outlined" style={styles.input} keyboardType='number-pad' error={!!errors.zipCode} />

      {ENABLE_LOCATION_CAPTURE && (
        <View>
          <Button mode="outlined" onPress={captureCurrentLocation} loading={locLoading} disabled={locLoading}>
            {locLoading ? 'Capturing Location...' : 'Use Current Location (Optional)'}
          </Button>
          {capturedCoords && (
            <Text style={{ marginTop: 6, color: '#666' }}>
              {capturedCoords.latitude.toFixed(6)}, {capturedCoords.longitude.toFixed(6)}
            </Text>
          )}
        </View>
      )}

      {(role === 'pharmacist' || role === 'doctor') && (
        <>
          <Text style={styles.subtitle}>{role === 'doctor' ? 'Doctor License' : 'Pharmacist Info'}</Text>
          <TextInput label="License Number" value={licenseNumber} onChangeText={setLicenseNumber} mode="outlined" style={styles.input} error={!!errors.licenseNumber} />
          <DatePickerField label="License Expiry" value={licenseExpiry} onChange={setLicenseExpiry} style={styles.input} />
          {role === 'pharmacist' && (
            <TextInput label="Pharmacy Name" value={pharmacyName} onChangeText={setPharmacyName} mode="outlined" style={styles.input} error={!!errors.pharmacyName} />
          )}
        </>
      )}

      {role === 'delivery_agent' && (
        <>
          <Text style={styles.subtitle}>Vehicle Info</Text>
          <TextInput label="Vehicle Type (bike/scooter/car/bicycle)" value={vehicleType} onChangeText={setVehicleType} mode="outlined" style={styles.input} />
          <TextInput label="Vehicle Number" value={vehicleNumber} onChangeText={setVehicleNumber} mode="outlined" style={styles.input} />
          <TextInput label="Driving License" value={drivingLicense} onChangeText={setDrivingLicense} mode="outlined" style={styles.input} />
        </>
      )}

      <Button mode="contained" onPress={handleRegister} loading={loading} style={{ marginTop: 10 }}>{loading ? 'Registering...' : 'Sign Up'}</Button>
      {msg ? <Text style={{ color: msg.includes('failed') ? '#F44336' : '#4CAF50', marginTop: 8 }}>{msg}</Text> : null}

      <Button mode="text" onPress={() => navigation.navigate('Login')} style={{ marginTop: 10 }}>Back to Login</Button>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  subtitle: { fontSize: 14, fontWeight: '600', marginTop: 12 },
  input: { marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  half: { flex: 1, marginHorizontal: 4 }
});

export default RegisterScreen;
