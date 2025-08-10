import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Linking,
} from 'react-native';
import {
  Card,
  Text,
  Button,
  IconButton,
  Surface,
  Divider,
  TextInput,
  Snackbar,
  ActivityIndicator,
} from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useCart } from '../../contexts/CartContext';
import PaymentModal from '../../components/PaymentModal';
import { useNavigation } from '@react-navigation/native';

interface CartItem {
  id: string;
  name: string;
  brand: string;
  price: number;
  quantity: number;
  isPrescriptionRequired: boolean;
  image?: string;
}

const CartScreen = () => {
  const { items, updateQuantity, removeItem, clear, subtotal } = useCart();
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [lastUploadedPrescriptionId, setLastUploadedPrescriptionId] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [rxRequiredError, setRxRequiredError] = useState<string | null>(null);
  const [rxAutoPrompted, setRxAutoPrompted] = useState<boolean>(false);
  const [searchText, setSearchText] = useState('');
  const [placeSuggestions, setPlaceSuggestions] = useState<Array<{ id: string; description: string }>>([]);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [paymentContext, setPaymentContext] = useState<{ rpOrderId: string; keyId: string; amount: number; orderId: string; cfSessionId?: string; cfEnv?: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Distance-based delivery fee
  const PHARMACY_LAT = Number(process.env.EXPO_PUBLIC_PHARMACY_LAT || 28.6139);
  const PHARMACY_LNG = Number(process.env.EXPO_PUBLIC_PHARMACY_LNG || 77.2090);

  const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  useEffect(() => {
    if (selectedLocation) {
      const d = haversineKm(PHARMACY_LAT, PHARMACY_LNG, selectedLocation.lat, selectedLocation.lng);
      setDistanceKm(d);
    } else {
      setDistanceKm(null);
    }
  }, [selectedLocation]);

  const dynamicDeliveryCharge = useMemo(() => {
    if (distanceKm == null) return 50; // fallback default when no location
    const perKm = Number(process.env.EXPO_PUBLIC_DELIVERY_PER_KM || 12);
    const minFee = Number(process.env.EXPO_PUBLIC_DELIVERY_MIN || 30);
    return Math.max(minFee, Math.ceil(distanceKm) * perKm);
  }, [distanceKm]);

  const deliveryCharges = dynamicDeliveryCharge;
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + deliveryCharges + tax;
  const prescriptionItems = items.filter(i => i.isPrescriptionRequired);
  const hasPrescriptionItems = prescriptionItems.length > 0;

  const queryClient = useQueryClient();

  // Upload mutation for prescriptions
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      // Backend expects POST /api/prescriptions with field 'prescription'
      const response = await api.post('/api/prescriptions', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    onSuccess: (data) => {
      try {
        const createdId = data?.data?._id || data?._id;
        if (createdId) setLastUploadedPrescriptionId(createdId);
      } catch {}
      setRxRequiredError(null);
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
    },
    onError: (error: any) => {
      console.error('❌ Prescription upload failed:', error);
    },
  });

  // If Rx items exist and no upload in this session, show inline error (do not auto-open picker)
  useEffect(() => {
    if (hasPrescriptionItems && !lastUploadedPrescriptionId && !rxAutoPrompted) {
      setRxRequiredError('Prescription required to proceed. Please upload a valid prescription.');
      setRxAutoPrompted(true);
    }
  }, [hasPrescriptionItems, lastUploadedPrescriptionId, rxAutoPrompted]);

  const buildFormData = async (assets: Array<{ uri: string; fileName?: string; mimeType?: string }>) => {
    const formData = new FormData();

    // Get prescription medicines from cart
    const prescriptionMedicines = items.filter(item => item.isPrescriptionRequired);
    const medicineNames = prescriptionMedicines.map(item => item.name).join(', ');

    for (let index = 0; index < assets.length; index++) {
      const asset = assets[index];
      let uri = asset.uri;
      const name = asset.fileName || `cart_prescription_${Date.now()}_${index}.jpg`;
      let type = asset.mimeType || 'image/jpeg';

      // iOS specific file handling
      if (Platform.OS === 'ios' && !uri.startsWith('http') && !uri.startsWith('file://')) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(uri);
          if (!fileInfo.exists) {
            console.warn('File does not exist at URI:', uri);
            continue;
          }
          
          const extension = type.split('/')[1] || 'jpg';
          const fileName = `cart_upload_${Date.now()}_${index}.${extension}`;
          const newUri = `${FileSystem.cacheDirectory}${fileName}`;
          
          await FileSystem.copyAsync({
            from: uri,
            to: newUri,
          });
          
          uri = newUri;
          console.log('📁 File copied to accessible location:', uri);
        } catch (error) {
          console.error('📁 Failed to copy file:', error);
          continue;
        }
      }

      if (Platform.OS === 'web') {
        try {
          const res = await fetch(uri);
          const blob = await res.blob();
          const file = new File([blob], name, { type });
          formData.append('prescription', file as any);
        } catch (e) {
          console.warn('Blob conversion failed for', uri, e);
        }
      } else {
        formData.append('prescription', {
          uri,
          name,
          type,
        } as any);
      }
    }

    const today = new Date();
    const validUntil = new Date();
    validUntil.setDate(today.getDate() + 30);

    // Include cart-specific information
    formData.append('doctorName', 'Dr. Cart Upload');
    formData.append('doctorRegistrationNumber', `CART-REG-${Date.now()}`);
    formData.append('patientName', 'Cart Patient');
    formData.append('patientAge', String(30));
    formData.append('patientGender', 'other');
    formData.append('prescriptionDate', today.toISOString().split('T')[0]);
    formData.append('validUntil', validUntil.toISOString().split('T')[0]);
    formData.append('notes', `Uploaded for cart medicines: ${medicineNames}`);

    return formData;
  };

  // Google Places Autocomplete (no extra packages). Requires EXPO_PUBLIC_GOOGLE_PLACES_KEY
  const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY;
  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!GOOGLE_KEY) return;
      const q = searchText.trim();
      if (!q || q.length < 3) { if (active) setPlaceSuggestions([]); return; }
      try {
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&key=${GOOGLE_KEY}`;
        const res = await fetch(url);
        const json = await res.json();
        if (active && json?.predictions) {
          setPlaceSuggestions(json.predictions.map((p: any) => ({ id: p.place_id, description: p.description })));
        }
      } catch (e) {
        console.warn('Places autocomplete failed', e);
      }
    };
    run();
    return () => { active = false; };
  }, [searchText, GOOGLE_KEY]);

  const selectPlace = async (placeId: string, description: string) => {
    try {
      if (!GOOGLE_KEY) return;
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_address,geometry/location&key=${GOOGLE_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      const loc = json?.result?.geometry?.location;
      if (loc?.lat && loc?.lng) {
        setSelectedLocation({ lat: loc.lat, lng: loc.lng });
        setDeliveryAddress(json?.result?.formatted_address || description);
        setSearchText(description);
        setPlaceSuggestions([]);
        setAddressError(null);
      }
    } catch (e) { console.warn('Place details failed', e); }
  };

  const pickImagesFromLibrary = async () => {
    try {
      if (Platform.OS === 'web') {
        const result = await DocumentPicker.getDocumentAsync({ 
          multiple: true, 
          type: ['image/*', 'application/pdf'] 
        });
        if (result.canceled) return;
        const assets = (result.assets || []).map((a: any) => ({ 
          uri: a.uri, 
          fileName: a.name, 
          mimeType: a.mimeType 
        }));
        const formData = await buildFormData(assets);
        uploadMutation.mutate(formData);
        return;
      }

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow photo library access');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        allowsEditing: false,
        base64: false,
        exif: false,
      });

      if (result.canceled) return;

      if (!result.assets || result.assets.length === 0) {
        Alert.alert('No Images', 'No images were selected');
        return;
      }

      const assets = await Promise.all(
        result.assets.map(async (asset, index) => {
          let mimeType = 'image/jpeg';
          if (asset.mimeType) {
            mimeType = asset.mimeType;
          } else if (asset.uri.toLowerCase().includes('.png')) {
            mimeType = 'image/png';
          } else if (asset.uri.toLowerCase().includes('.heic')) {
            mimeType = 'image/heic';
          }

          const extension = mimeType.split('/')[1] || 'jpg';
          const fileName = asset.fileName || `cart_prescription_${Date.now()}_${index}.${extension}`;

          return {
            uri: asset.uri,
            fileName,
            mimeType
          };
        })
      );

      const formData = await buildFormData(assets);
      uploadMutation.mutate(formData);
    } catch (e: any) {
      console.error('❌ Upload via library failed:', e);
      Alert.alert(
        'Upload Failed', 
        `Error: ${e.message || 'Could not access photo library'}\n\nTry using the camera instead.`,
        [
          { text: 'Try Camera', onPress: () => takePhotoWithCamera() },
          { text: 'OK', style: 'cancel' }
        ]
      );
    }
  };

  const takePhotoWithCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow camera access');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: false,
        base64: false,
        exif: false,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset) {
        Alert.alert('No Photo', 'No photo was taken');
        return;
      }

      const mimeType = asset.mimeType || 'image/jpeg';
      const fileName = asset.fileName || `cart_camera_prescription_${Date.now()}.jpg`;

      const formData = await buildFormData([{ 
        uri: asset.uri, 
        fileName, 
        mimeType 
      }]);
      uploadMutation.mutate(formData);
    } catch (e: any) {
      console.error('❌ Camera upload failed:', e);
      Alert.alert(
        'Camera Failed', 
        `Error: ${e.message || 'Could not take photo'}\n\nTry selecting from photo library instead.`,
        [
          { text: 'Try Photo Library', onPress: () => pickImagesFromLibrary() },
          { text: 'OK', style: 'cancel' }
        ]
      );
    }
  };

  const handlePrescriptionUpload = () => {
    console.log('📋 Prescription upload clicked for cart!');
    // Open library directly (non-blocking); user can cancel
    pickImagesFromLibrary();
  };

  const validateCheckout = () => {
    if (items.length === 0) {
      Alert.alert('Checkout Blocked', 'No items in your cart. Please add some medicines.');
      return false;
    }

    const rxItems = items.filter(item => item.isPrescriptionRequired);
    if (rxItems.length > 0 && !lastUploadedPrescriptionId) {
      Alert.alert('Checkout Blocked', 'Prescription required for prescription medicines. Please upload a valid prescription.');
      return false;
    }

    if (!deliveryAddress.trim()) {
      Alert.alert('Checkout Blocked', 'Delivery address is required. Please enter a location or address.');
      return false;
    }
    setAddressError('');

    return true;
  };

  const handleCheckout = async () => {
    if (!validateCheckout()) return;

    try {
      // Create medicine order
      const orderData = {
        orderType: 'medicine',
        items: items.map(item => ({
          medicine: item.medicine._id,
          quantity: item.quantity,
          price: item.medicine.price,
          total: item.medicine.price * item.quantity
        })),
        subtotal,
        deliveryCharges,
        tax,
        totalAmount: total,
        payment: { 
          method: 'online',
          gateway: 'cashfree'
        },
        deliveryAddress: {
          street: deliveryAddress || '',
          city: '',
          state: '',
          zipCode: '',
          phone: '',
          location: selectedLocation || undefined,
          distanceKm: distanceKm || undefined
        },
        prescription: lastUploadedPrescriptionId,
        isPrescriptionOrder: !!lastUploadedPrescriptionId
      };
      
      const orderRes = await api.post('/api/orders', orderData);
      
      const created = orderRes.data?.data;
      if (!created?._id) {
        throw new Error('Order creation failed');
      }
      
      // Create Cashfree session
      const cfRes = await api.post(`/api/payments/cashfree/create`, { 
        amount: total, 
        orderId: created.orderNumber, 
        currency: 'INR' 
      });
      
      const { sessionId, appId, env } = cfRes.data?.data || {};
      
      if (!sessionId || !appId) {
        throw new Error('Payment init failed');
      }
      
      const paymentContext = { 
        rpOrderId: created.orderNumber, 
        keyId: appId, 
        amount: total, 
        orderId: created.orderNumber, 
        cfSessionId: sessionId, 
        cfEnv: env 
      };
      
      setPaymentContext(paymentContext);
      setPaymentVisible(true);
      
    } catch (e: any) {
      setErrorMessage(`Checkout failed: ${e?.response?.data?.message || e?.message || 'Unknown error'}`);
    }
  };

  const onPaymentSuccess = async ({ orderId, paymentId, signature }: any) => {
    try {
      if (signature) {
        await api.post('/api/payments/verify', { 
          razorpay_order_id: orderId, 
          razorpay_payment_id: paymentId, 
          razorpay_signature: signature 
        });
      }
      
      clear();
      setLastUploadedPrescriptionId(null);
      setPaymentVisible(false);
      setPaymentContext(null);
      
      // Navigate to Orders page after successful payment
      setTimeout(() => {
        const globalNav = (global as any)?.navigation;
        if (globalNav && globalNav.navigate) {
          globalNav.navigate('Orders');
        }
      }, 1000);
      
    } catch (error: any) {
      setPaymentVisible(false);
    }
  };

  const onPaymentFailure = (message: string) => {
    setPaymentVisible(false);
    setPaymentContext(null);
    setErrorMessage(`Payment failed: ${message}`);
  };

  const handleStartShopping = () => {
    console.log('🛒 Start Shopping button clicked!');
    Alert.alert('Navigation', 'Going to Medicines tab...', [
      {
        text: 'OK',
        onPress: () => {
          try {
            const globalNav = (global as any)?.navigation;
            if (globalNav && globalNav.navigate) {
              console.log('Navigating to Medicines...');
              globalNav.navigate('Medicines');
            } else {
              console.log('No navigation available, fallback message');
              Alert.alert('Info', 'Please use the Medicines tab at the bottom to browse products.');
            }
          } catch (error) {
            console.error('Navigation error:', error);
          }
        }
      }
    ]);
  };

  const processOrder = async () => {
    console.log('🚀 Processing order started...');
    try {
      // If there are Rx items, choose ONE valid prescription to attach
      let selectedPrescriptionId: string | null = null;
      if (hasPrescriptionItems) {
        try {
          if (lastUploadedPrescriptionId) {
            selectedPrescriptionId = lastUploadedPrescriptionId;
          } else {
            const pres = await api.get('/api/prescriptions/my-prescriptions');
            const list = (pres.data.data || []) as any[];
            const okStatuses = new Set(['approved', 'partially_approved', 'pending']);
            const usable = list.filter((p) => okStatuses.has(p.status) && !p.isExpired);
            if (usable.length > 0) {
              // pick the most recent
              usable.sort((a,b)=> new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              selectedPrescriptionId = usable[0]._id;
            }
          }
        } catch {}
      }

      const orderData = {
        items: items.map(item => ({ medicine: item.medicineId, quantity: item.quantity, price: item.price })),
        deliveryAddress: { street: deliveryAddress, city: 'City', state: 'State', zipCode: '123456', phone: '1234567890', location: selectedLocation || undefined, distanceKm: distanceKm || undefined },
        payment: { method: 'cash_on_delivery' },
        notes: '',
        prescriptions: selectedPrescriptionId ? [selectedPrescriptionId] : [],
        subtotal,
        deliveryCharges,
        tax,
        totalAmount: total,
      };

      const response = await api.post('/api/orders', orderData);
      
      if (response.data.success) {
        console.log('Order placed successfully');
        await clear();
        setDeliveryAddress('');
        setCouponCode('');
        // Clear any cached uploaded prescription so next order requires a fresh upload
        setLastUploadedPrescriptionId(null);
        setRxAutoPrompted(false);
        setRxRequiredError(null);
      } else {
        console.warn('Order placement error:', response.data.message || 'Failed to place order');
      }
    } catch (error: any) {
      console.error('❌ Order placement error:', error.response?.data || error);
    }
  };

  const applyCoupon = () => {
    console.log('🎫 Apply coupon clicked!');
    if (couponCode === 'SAVE10') {
      Alert.alert('Coupon Applied', '10% discount applied successfully!');
    } else if (couponCode.trim()) {
      Alert.alert('Invalid Coupon', 'The coupon code you entered is not valid');
      setCouponCode('');
    } else {
      Alert.alert('Enter Coupon', 'Please enter a coupon code');
    }
  };

  const renderCartItem = ({ item }: { item: any }) => (
    <Card style={styles.cartItem}>
      <Card.Content>
        <View style={styles.itemHeader}>
          <Text style={styles.itemName}>{item.name}</Text>
          <IconButton 
            icon="close" 
            size={20}
            onPress={() => removeItem(item.medicineId)}
          />
        </View>
        <View style={styles.itemDetails}>
          <Text style={styles.itemPrice}>₹{item.price}</Text>
          <View style={styles.quantityControls}>
            <IconButton icon="minus" onPress={() => updateQuantity(item.medicineId, Math.max(1, item.quantity - 1))} />
            <Text style={styles.quantityText}>{item.quantity}</Text>
            <IconButton icon="plus" onPress={() => updateQuantity(item.medicineId, item.quantity + 1)} />
          </View>
        </View>
        {item.isPrescriptionRequired && (
          <Surface style={styles.prescriptionBadge}>
            <Text style={styles.prescriptionText}>Rx Required</Text>
          </Surface>
        )}
      </Card.Content>
    </Card>
  );

  if (items.length === 0) {
    return (
      <View style={styles.emptyCart}>
        <IconButton icon="cart-off" size={80} iconColor="#ccc" />
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySubtitle}>Add medicines to get started</Text>
        <TouchableOpacity onPress={handleStartShopping} style={styles.touchableButton}>
          <Button mode="contained" style={styles.shopButton}>
            Start Shopping
          </Button>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView style={styles.container} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
          {/* Cart Items */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cart Items ({items.length})</Text>
            <FlatList
              data={items}
              renderItem={renderCartItem}
              keyExtractor={(item) => item.medicineId}
              scrollEnabled={false}
            />
          </View>

          {/* Prescription Upload Alert */}
          {hasPrescriptionItems && (
            <Card style={[styles.section, styles.prescriptionAlert]}>
              <Card.Content>
                <View style={styles.alertHeader}>
                  <IconButton icon="alert-circle" iconColor="#FF9800" />
                  <View style={styles.alertContent}>
                    <Text style={styles.alertTitle}>Prescription Required</Text>
                    <Text style={styles.alertText}>
                      {prescriptionItems.length} item(s) require prescription
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={handlePrescriptionUpload}>
                  <Button
                    mode="outlined"
                    style={styles.uploadButton}
                  >
                    Upload Prescription
                  </Button>
                </TouchableOpacity>
                {rxRequiredError ? <Text style={{ color: '#F44336', marginTop: 8 }}>{rxRequiredError}</Text> : null}
              </Card.Content>
            </Card>
          )}

          {/* Delivery Address */}
          <Card style={styles.section}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Delivery Address</Text>
              {!!GOOGLE_KEY && (
                <>
                  <TextInput
                    label="Search location (Google Places)"
                    value={searchText}
                    onChangeText={(t)=>{ setSearchText(t); }}
                    mode="outlined"
                    style={{ marginBottom: 8 }}
                    right={<TextInput.Icon icon="magnify" />}
                  />
                  {placeSuggestions.length > 0 && (
                    <View style={{ backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#eee', marginBottom: 8 }}>
                      {placeSuggestions.slice(0,5).map(s => (
                        <TouchableOpacity key={s.id} onPress={()=>selectPlace(s.id, s.description)} style={{ padding: 10 }}>
                          <Text style={{ color: '#333' }}>{s.description}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              )}
              <TextInput
                label="Enter delivery address"
                value={deliveryAddress}
                onChangeText={(t)=>{ setDeliveryAddress(t); if (t?.trim()) setAddressError(null); }}
                mode="outlined"
                multiline
                numberOfLines={3}
                style={[styles.addressInput, addressError ? { borderColor: '#F44336', borderWidth: 1 } : null]}
              />
              {addressError ? <Text style={{ color: '#F44336', marginTop: 6 }}>{addressError}</Text> : null}
              {selectedLocation && distanceKm != null ? (
                <Text style={{ marginTop: 6, color: '#666' }}>Distance: {distanceKm.toFixed(1)} km • Delivery fee will be calculated accordingly.</Text>
              ) : null}
            </Card.Content>
          </Card>

          {/* Coupon Code */}
          <Card style={styles.section}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Coupon Code</Text>
              <View style={styles.couponRow}>
                <TextInput
                  label="Coupon Code"
                  value={couponCode}
                  onChangeText={setCouponCode}
                  mode="outlined"
                  style={styles.couponInput}
                  placeholder="e.g., SAVE10"
                />
                <TouchableOpacity onPress={applyCoupon}>
                  <Button
                    mode="outlined"
                    style={styles.couponButton}
                  >
                    Apply
                  </Button>
                </TouchableOpacity>
              </View>
              {tax > 0 && (
                <Text style={styles.discountText}>✅ 5% tax applied!</Text>
              )}
            </Card.Content>
          </Card>

          {/* Order Summary */}
          <Card style={styles.section}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Order Summary</Text>
              <Divider style={styles.divider} />
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal:</Text>
                <Text style={styles.summaryValue}>₹{subtotal}</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery:</Text>
                <Text style={styles.summaryValue}>
                  {deliveryCharges === 0 ? 'FREE' : `₹${deliveryCharges}`}
                </Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tax (5%):</Text>
                <Text style={styles.summaryValue}>₹{tax}</Text>
              </View>
              
              {tax > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: '#4CAF50' }]}>Tax:</Text>
                  <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>+₹{tax}</Text>
                </View>
              )}
              
              <Divider style={styles.divider} />
              
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total:</Text>
                <Text style={styles.totalValue}>₹{total}</Text>
              </View>
              
              {deliveryCharges > 0 && (
                <Text style={styles.freeDeliveryText}>
                  Delivery fee based on distance: ₹{deliveryCharges}
                </Text>
              )}
            </Card.Content>
          </Card>

          {/* Checkout Button */}
          <View style={styles.checkoutSection}>
            <TouchableOpacity onPress={handleCheckout} style={styles.touchableButton}>
              <Button
                mode="contained"
                onPress={handleCheckout}
                disabled={hasPrescriptionItems && !lastUploadedPrescriptionId}
                style={styles.checkoutButton}
                contentStyle={styles.checkoutButtonContent}
              >
                Proceed to Checkout - ₹{total}
              </Button>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
      {paymentVisible && paymentContext && (
        <PaymentModal
          visible={paymentVisible}
          onClose={() => {
            setPaymentVisible(false);
            setPaymentContext(null);
          }}
          mode="cashfree"
          apiBaseUrl={(api.defaults.baseURL || '').replace(/\/$/, '')}
          appId={paymentContext.keyId}
          sessionId={paymentContext.cfSessionId}
          env={(paymentContext.cfEnv as any) || 'SANDBOX'}
          amount={paymentContext.amount}
          orderId={paymentContext.orderId as any}
          onSuccess={onPaymentSuccess}
          onFailure={onPaymentFailure}
        />
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  shopButton: {
    paddingHorizontal: 30,
  },
  touchableButton: {
    width: '100%',
    alignItems: 'center',
  },
  section: {
    margin: 16,
    borderRadius: 12,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  cartItem: {
    marginBottom: 12,
    borderRadius: 8,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  itemBrand: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  prescriptionTag: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '500',
  },
  itemBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 12,
    minWidth: 30,
    textAlign: 'center',
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  prescriptionAlert: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertContent: {
    flex: 1,
    marginLeft: 8,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF9800',
  },
  alertText: {
    fontSize: 14,
    color: '#666',
  },
  uploadButton: {
    borderColor: '#FF9800',
  },
  addressInput: {
    marginTop: 8,
  },
  couponRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 8,
  },
  couponInput: {
    flex: 1,
    marginRight: 12,
  },
  couponButton: {
    height: 56,
  },
  discountText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  divider: {
    marginVertical: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  freeDeliveryText: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 8,
    textAlign: 'center',
  },
  checkoutSection: {
    margin: 16,
    marginBottom: 32,
  },
  checkoutButton: {
    borderRadius: 12,
  },
  checkoutButtonContent: {
    paddingVertical: 12,
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  prescriptionBadge: {
    backgroundColor: '#FF9800',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 8,
  },
  prescriptionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default CartScreen; 