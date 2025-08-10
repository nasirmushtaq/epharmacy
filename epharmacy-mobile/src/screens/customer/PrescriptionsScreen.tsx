import React, { useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import {
  Card,
  Text,
  Button,
  IconButton,
  Surface,
  Divider,
  Chip,
  FAB,
  ActivityIndicator,
} from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import api from '../../services/api';

interface Prescription {
  id: string;
  prescriptionNumber: string;
  doctorName: string;
  hospitalName?: string;
  createdAt: string;
  validUntil: string;
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'expired' | 'partially_approved';
  medicines: Array<{ name: string; dosage?: string; frequency?: string; duration?: string }>;
  reviewNotes?: string;
}

const PrescriptionsScreen = () => {
  const queryClient = useQueryClient();
  
  // Fetch prescriptions from API
  const { data: prescriptions = [], isLoading, error } = useQuery({
    queryKey: ['prescriptions'],
    queryFn: async (): Promise<Prescription[]> => {
      const response = await api.get('/api/prescriptions/my-prescriptions');
      const list = response.data.data || [];
      return list.map((p: any) => ({
        id: p._id,
        prescriptionNumber: p.prescriptionNumber,
        doctorName: p.doctorInfo?.name || 'Doctor',
        hospitalName: p.doctorInfo?.hospital,
        createdAt: p.prescriptionDate || p.createdAt,
        validUntil: p.validUntil,
        status: p.status,
        medicines: (p.medicines || []).map((m: any) => ({
          name: m.name,
          dosage: m.dosage,
          frequency: m.frequency,
          duration: m.duration,
        })),
        reviewNotes: p.reviewNotes,
      }));
    }
  });

  // Upload prescription mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      console.log('Uploading prescription...');
      const response = await api.post('/api/prescriptions', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: () => {
      console.log('Upload success, invalidating prescriptions');
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      Alert.alert('Success', 'Prescription uploaded successfully!');
    },
    onError: (error: any) => {
      console.error('Upload failed', error?.response?.data || error);
      Alert.alert('Upload Failed', error.response?.data?.message || 'Failed to upload prescription');
    }
  });

  // adjust status colors to include all statuses
  const statusColors: Record<string, string> = {
    pending: '#FF9800',
    under_review: '#FFB300',
    approved: '#4CAF50',
    partially_approved: '#8BC34A',
    rejected: '#F44336',
    expired: '#9E9E9E'
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Under Review';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'expired': return 'Expired';
      default: return status;
    }
  };

  const buildFormData = async (assets: Array<{ uri: string; fileName?: string; mimeType?: string }>) => {
    const formData = new FormData();

    for (let index = 0; index < assets.length; index++) {
      const asset = assets[index];
      let uri = asset.uri;
      const name = asset.fileName || `prescription_${Date.now()}_${index}.jpg`;
      let type = asset.mimeType || 'image/jpeg';

      // iOS specific file handling
      if (Platform.OS === 'ios' && !uri.startsWith('http') && !uri.startsWith('file://')) {
        // For iOS, we need to copy the file to a accessible location
        try {
          const fileInfo = await FileSystem.getInfoAsync(uri);
          if (!fileInfo.exists) {
            console.warn('File does not exist at URI:', uri);
            continue;
          }
          
          // Copy file to cache directory with proper extension
          const extension = type.split('/')[1] || 'jpg';
          const fileName = `upload_${Date.now()}_${index}.${extension}`;
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
        // For React Native (iOS/Android)
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

    formData.append('doctorName', 'Dr. Mobile Upload');
    formData.append('doctorRegistrationNumber', `REG-${Date.now()}`);
    formData.append('patientName', 'Mobile Patient');
    formData.append('patientAge', String(30));
    formData.append('patientGender', 'other');
    formData.append('prescriptionDate', today.toISOString().split('T')[0]);
    formData.append('validUntil', validUntil.toISOString().split('T')[0]);
    formData.append('notes', 'Uploaded from mobile app');

    return formData;
  };

  const pickImagesFromLibrary = async () => {
    try {
      // Use DocumentPicker on iOS to avoid public.jpeg representation issues
      if (Platform.OS === 'ios') {
        const result = await DocumentPicker.getDocumentAsync({
          multiple: true,
          copyToCacheDirectory: true,
          type: ['image/*', 'application/pdf']
        });
        if (result.canceled) return;
        const assets = (result.assets || []).map((a: any, index: number) => ({
          uri: a.uri, // should be file:// in cache
          fileName: a.name || `prescription_${Date.now()}_${index}`,
          mimeType: a.mimeType || (a.name?.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg')
        }));
        const formData = await buildFormData(assets);
        uploadMutation.mutate(formData);
        return;
      }

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

      console.log('📁 Launching image picker (Android)...');
      const result = await ImagePicker.launchImageLibraryAsync({
        // Using MediaTypeOptions for compatibility across SDKs
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        allowsEditing: false,
        base64: false,
        exif: false,
      });

      console.log('📁 Image picker result:', result);

      if (result.canceled) {
        console.log('📁 User canceled image selection');
        return;
      }

      if (!result.assets || result.assets.length === 0) {
        Alert.alert('No Images', 'No images were selected');
        return;
      }

      const assets = await Promise.all(
        result.assets.map(async (asset, index) => {
          console.log(`📁 Processing asset ${index}:`, {
            uri: asset.uri,
            type: asset.type,
            mimeType: asset.mimeType,
            fileName: asset.fileName
          });

          let mimeType = 'image/jpeg';
          if (asset.mimeType) mimeType = asset.mimeType;
          else if (asset.uri.toLowerCase().includes('.png')) mimeType = 'image/png';
          else if (asset.uri.toLowerCase().includes('.heic')) mimeType = 'image/heic';

          const extension = mimeType.split('/')[1] || 'jpg';
          const fileName = asset.fileName || `prescription_${Date.now()}_${index}.${extension}`;

          return {
            uri: asset.uri,
            fileName,
            mimeType
          };
        })
      );

      console.log('📁 Processed assets:', assets);
      const formData = await buildFormData(assets);
      uploadMutation.mutate(formData);
    } catch (e: any) {
      console.error('❌ Upload via library failed:', e);
      Alert.alert(
        'Upload Failed', 
        `Error: ${e.message || 'Could not access photo library'}\n\nTry using the camera instead or use the Document Picker option.`,
        [
          { text: 'Try Camera', onPress: () => takePhotoWithCamera() },
          { text: 'Use Files', onPress: async () => {
              const res = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: ['image/*','application/pdf'] });
              if (!res.canceled) {
                const assets = (res.assets || []).map((a: any, idx: number) => ({ uri: a.uri, fileName: a.name || `prescription_${Date.now()}_${idx}`, mimeType: a.mimeType }));
                const fd = await buildFormData(assets);
                uploadMutation.mutate(fd);
              }
            }
          },
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

      console.log('📸 Launching camera for iOS...');
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: false,
        base64: false,
        exif: false,
      });

      console.log('📸 Camera result:', result);

      if (result.canceled) {
        console.log('📸 User canceled camera');
        return;
      }

      const asset = result.assets?.[0];
      if (!asset) {
        Alert.alert('No Photo', 'No photo was taken');
        return;
      }

      console.log('📸 Processing camera asset:', {
        uri: asset.uri,
        type: asset.type,
        mimeType: asset.mimeType,
        fileName: asset.fileName
      });

      // Camera images are usually JPEG
      const mimeType = asset.mimeType || 'image/jpeg';
      const fileName = asset.fileName || `camera_prescription_${Date.now()}.jpg`;

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

  const handleUploadPrescription = () => {
    console.log('📸 Upload FAB pressed - handleUploadPrescription called');
    Alert.alert(
      'Upload Prescription',
      'Choose an option',
      [
        { text: 'Camera', onPress: () => { 
          console.log('📸 Upload via camera selected'); 
          takePhotoWithCamera(); 
        } },
        { text: 'Photo Library', onPress: () => { 
          console.log('📁 Upload via library selected'); 
          pickImagesFromLibrary(); 
        } },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleViewPrescription = (prescription: Prescription) => {
    console.log('👁️ View prescription clicked for:', prescription.prescriptionNumber);
    const medsText = (prescription.medicines || []).map(m => {
      const parts = [m.name];
      if (m.dosage) parts.push(m.dosage);
      if (m.frequency) parts.push(m.frequency);
      if (m.duration) parts.push(`for ${m.duration}`);
      return `• ${parts.join(' - ')}`;
    }).join('\n');
    Alert.alert(
      `Prescription Details`,
      `Number: ${prescription.prescriptionNumber}\nDoctor: ${prescription.doctorName}\nHospital: ${prescription.hospitalName}\nIssued: ${new Date(prescription.createdAt).toLocaleDateString()}\nExpires: ${new Date(prescription.validUntil).toLocaleDateString()}\nStatus: ${getStatusText(prescription.status)}\n\nMedicines:\n${medsText}\n\n${prescription.reviewNotes ? `Notes: ${prescription.reviewNotes}` : ''}`
    );
  };

  const handleOrderMedicines = async (prescription: any) => {
    console.log('🛒 Order medicines clicked for:', prescription.prescriptionNumber);
    if (prescription.status !== 'approved') {
      Alert.alert('Cannot Order', 'Only approved prescriptions can be used for ordering medicines.');
      return;
    }

    const isExpired = new Date(prescription.validUntil) < new Date();
    if (isExpired) {
      Alert.alert('Prescription Expired', 'This prescription has expired and cannot be used for ordering.');
      return;
    }

    try {
      console.log('Fetching medicines for prescription...');
      const response = await api.get(`/api/medicines?search=${prescription.medicines[0]?.name || ''}`);
      const medicines = response.data.data || [];
      
      if (medicines.length === 0) {
        Alert.alert('No Medicines Found', 'No medicines found for this prescription.');
        return;
      }

      Alert.alert(
        'Add to Cart',
        `Found ${medicines.length} medicine(s). Add ${medicines[0]?.name || 'medicine'} to cart?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add to Cart', onPress: async () => {
            try {
              console.log('Adding medicine to cart...');
              // Add first medicine to cart
              const medicine = medicines[0];
              // Implementation depends on cart context
              Alert.alert('Success', 'Medicine added to cart!');
            } catch (error) {
              console.error('Failed to add to cart:', error);
              Alert.alert('Error', 'Failed to add medicine to cart');
            }
          }}
        ]
      );
    } catch (error) {
      console.error('Failed to fetch medicines:', error);
      Alert.alert('Error', 'Failed to fetch medicines for this prescription');
    }
  };

  const handleDeletePrescription = async (prescriptionId: string) => {
    Alert.alert(
      'Delete Prescription',
      'Are you sure you want to delete this prescription?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await api.delete(`/api/prescriptions/${prescriptionId}`);
              if (response.data.success) {
                queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
                Alert.alert('Deleted', 'Prescription deleted successfully');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete prescription');
            }
          }
        }
      ]
    );
  };

  const renderPrescriptionCard = ({ item: prescription }: { item: Prescription }) => {
    const isExpired = new Date(prescription.validUntil) < new Date();
    const daysUntilExpiry = Math.ceil((new Date(prescription.validUntil).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

    console.log(`📋 Prescription ${prescription.prescriptionNumber}: expired=${isExpired}, days=${daysUntilExpiry}`);

    return (
      <Card style={styles.prescriptionCard}>
        <Card.Content>
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={styles.prescriptionInfo}>
              <Text style={styles.prescriptionNumber}>#{prescription.prescriptionNumber}</Text>
              <Text style={styles.doctorName}>Dr. {prescription.doctorName}</Text>
            </View>
            <View style={styles.headerActions}>
              <Chip
                mode="flat"
                style={[styles.statusChip, { backgroundColor: (statusColors[prescription.status] || '#607D8B') + '20' }]}
                textStyle={[styles.statusText, { color: statusColors[prescription.status] || '#607D8B' }]}
              >
                {getStatusText(prescription.status)}
              </Chip>
            </View>
          </View>

          <Divider style={styles.divider} />

          {/* Prescription Details */}
          <View style={styles.detailsSection}>
            <View style={styles.dateRow}>
              <View style={styles.dateItem}>
                <Text style={styles.dateLabel}>Issued:</Text>
                <Text style={styles.dateValue}>{new Date(prescription.createdAt).toLocaleDateString()}</Text>
              </View>
              <View style={styles.dateItem}>
                <Text style={styles.dateLabel}>Valid Until:</Text>
                <Text style={[
                  styles.dateValue,
                  { color: isExpired ? '#F44336' : daysUntilExpiry <= 7 ? '#FF9800' : '#333' }
                ]}>
                  {new Date(prescription.validUntil).toLocaleDateString()}
                </Text>
              </View>
            </View>

            {!isExpired && daysUntilExpiry <= 7 && daysUntilExpiry > 0 && (
              <Surface style={styles.warningBanner}>
                <Text style={styles.warningText}>
                  ⚠️ Expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}
                </Text>
              </Surface>
            )}

            {isExpired && (
              <Surface style={styles.expiredBanner}>
                <Text style={styles.expiredText}>❌ This prescription has expired</Text>
              </Surface>
            )}
          </View>

          {/* Medicines List */}
          <View style={styles.medicinesSection}>
            <Text style={styles.sectionTitle}>Medicines:</Text>
            {prescription.medicines?.map((medicine, index) => (
              <View key={index} style={styles.medicineItem}>
                <Text style={styles.medicineName}>• {medicine.name}</Text>
                <Text style={styles.medicineDetails}>
                  {medicine.dosage} - {medicine.frequency} for {medicine.duration}
                </Text>
              </View>
            ))}
          </View>

          {/* Notes Section */}
          {prescription.reviewNotes && (
            <>
              <Divider style={styles.divider} />
              <View style={styles.notesSection}>
                <Text style={styles.sectionTitle}>Notes:</Text>
                <Text style={styles.notesText}>{prescription.reviewNotes}</Text>
              </View>
            </>
          )}

          {/* Action Buttons */}
          <View style={styles.actionSection}>
            <Button
              mode="outlined"
              onPress={() => handleViewPrescription(prescription)}
              style={styles.actionButton}
              compact
            >
              View Details
            </Button>
            
            {prescription.status === 'approved' && !isExpired && (
              <Button
                mode="contained"
                onPress={() => handleOrderMedicines(prescription)}
                style={styles.actionButton}
                compact
              >
                Order Medicines
              </Button>
            )}
          </View>
        </Card.Content>
      </Card>
    );
  };

  // Helper function to check if prescription is expired
  const isExpiredPrescription = (prescription: Prescription) => new Date(prescription.validUntil) < new Date();
  const activePrescriptions: Prescription[] = prescriptions.filter((p: Prescription) => !isExpiredPrescription(p));
  const expiredPrescriptions: Prescription[] = prescriptions.filter((p: Prescription) => isExpiredPrescription(p));

  console.log('📋 Active prescriptions:', activePrescriptions.length);
  console.log('📋 Expired prescriptions:', expiredPrescriptions.length);

  if (prescriptions.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <IconButton icon="file-document-outline" size={80} iconColor="#ccc" />
          <Text style={styles.emptyTitle}>No Prescriptions</Text>
          <Text style={styles.emptySubtitle}>Upload your first prescription to get started</Text>
          <Button mode="contained" onPress={handleUploadPrescription} style={styles.uploadButton}>
            Upload Prescription
          </Button>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading prescriptions...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Failed to load prescriptions</Text>
        <Button mode="contained" onPress={() => queryClient.invalidateQueries({ queryKey: ['prescriptions'] })}>
          Retry
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <Surface style={styles.statCard}>
            <Text style={styles.statNumber}>{activePrescriptions.length}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </Surface>
          <Surface style={styles.statCard}>
            <Text style={styles.statNumber}>{prescriptions.filter(p => p.status === 'approved').length}</Text>
            <Text style={styles.statLabel}>Approved</Text>
          </Surface>
          <Surface style={styles.statCard}>
            <Text style={styles.statNumber}>{prescriptions.filter(p => p.status === 'pending').length}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </Surface>
        </View>

        {/* Active Prescriptions */}
        {activePrescriptions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Active Prescriptions</Text>
            <FlatList
              data={activePrescriptions}
              renderItem={renderPrescriptionCard}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          </View>
        )}

        {/* Expired Prescriptions */}
        {expiredPrescriptions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Expired Prescriptions</Text>
            <FlatList
              data={expiredPrescriptions}
              renderItem={renderPrescriptionCard}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <FAB
        icon="plus"
        label="Upload"
        style={styles.fab}
        onPress={handleUploadPrescription}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  errorText: {
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyState: {
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
  uploadButton: {
    paddingHorizontal: 30,
  },
  scrollView: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    padding: 16,
    marginHorizontal: 4,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  section: {
    margin: 16,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  prescriptionCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  prescriptionInfo: {
    flex: 1,
  },
  prescriptionNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  doctorName: {
    fontSize: 14,
    color: '#2196F3',
    marginBottom: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusChip: {
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    marginVertical: 12,
  },
  detailsSection: {
    marginBottom: 8,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateItem: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  warningBanner: {
    backgroundColor: '#FFF3E0',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  warningText: {
    fontSize: 12,
    color: '#F57C00',
    textAlign: 'center',
  },
  expiredBanner: {
    backgroundColor: '#FFEBEE',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  expiredText: {
    fontSize: 12,
    color: '#D32F2F',
    textAlign: 'center',
  },
  medicinesSection: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  medicineItem: {
    marginBottom: 4,
  },
  medicineName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  medicineDetails: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  notesSection: {
    marginBottom: 8,
  },
  notesText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  actionSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#2196F3',
  },
});

export default PrescriptionsScreen; 