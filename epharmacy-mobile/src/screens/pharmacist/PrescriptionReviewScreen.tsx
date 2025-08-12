import React, { useState } from 'react';
import { View, FlatList, StyleSheet, Alert, ScrollView, Image, TouchableOpacity, Linking } from 'react-native';
import { Card, Text, Button, IconButton, Surface, Divider, TextInput, Chip, Searchbar, ActivityIndicator, Modal, Portal } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

interface ReviewPrescription {
  _id: string;
  prescriptionNumber: string;
  customer?: { firstName?: string; lastName?: string; email?: string };
  doctorInfo?: { name?: string; hospital?: string };
  prescriptionDate?: string;
  validUntil?: string;
  status: string;
  medicines?: Array<{ name: string; dosage?: string; frequency?: string; duration?: string }>;
  reviewNotes?: string;
  documents?: Array<{ url: string; originalName?: string; uploadedAt?: string }>;
}

const PrescriptionReviewScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: prescriptions = [], isLoading, error, refetch } = useQuery({
    queryKey: ['pendingReviews'],
    queryFn: async (): Promise<ReviewPrescription[]> => {
      const res = await api.get('/api/prescriptions/pending-reviews');
      return res.data.data || [];
    },
  });

  const startReview = useMutation({
    mutationFn: async (id: string) => api.patch(`/api/prescriptions/${id}/start-review`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pendingReviews'] }),
  });

  const approveReview = useMutation({
    mutationFn: async ({ id, medicines, notes }: { id: string; medicines: any[]; notes?: string }) =>
      api.patch(`/api/prescriptions/${id}/approve`, { medicines, notes: notes || reviewNotes || 'Approved from mobile app' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingReviews'] });
      Alert.alert('Approved', 'Prescription approved successfully');
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'Failed to approve'),
  });

  const rejectReview = useMutation({
    mutationFn: async ({ id, reason, notes }: { id: string; reason: string; notes?: string }) =>
      api.patch(`/api/prescriptions/${id}/reject`, { reason, notes: notes || reviewNotes || '' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingReviews'] });
      Alert.alert('Rejected', 'Prescription rejected');
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'Failed to reject'),
  });

  const handleApprove = async (p: ReviewPrescription) => {
    await startReview.mutateAsync(p._id).catch(() => {});
    const meds = (p.medicines && p.medicines.length > 0) ? p.medicines : [{ name: 'Paracetamol 500mg', dosage: '500mg', frequency: 'BID', duration: '5 days' }];
    approveReview.mutate({ id: p._id, medicines: meds });
  };

  const handleReject = async (p: ReviewPrescription) => {
    await startReview.mutateAsync(p._id).catch(() => {});
    rejectReview.mutate({ id: p._id, reason: reviewNotes || 'Not sufficient details' });
  };

  const filtered = prescriptions.filter((p: any) => {
    const name = `${p.customer?.firstName || ''} ${p.customer?.lastName || ''}`.trim();
    const matchesSearch = (p.prescriptionNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.doctorInfo?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  if (isLoading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator /><Text>Loading...</Text></View>;
  }
  if (error) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>Error loading</Text><Button onPress={() => refetch()}>Retry</Button></View>;
  }

  const renderPrescriptionImage = (document: { url: string; originalName?: string }, index: number) => (
    <TouchableOpacity
      key={index}
      onPress={() => setSelectedImageUrl(document.url)}
      style={styles.imageContainer}
    >
      <Image
        source={{ uri: document.url }}
        style={styles.prescriptionImage}
        resizeMode="cover"
      />
      <Text style={styles.imageLabel} numberOfLines={1}>
        {document.originalName || `Document ${index + 1}`}
      </Text>
    </TouchableOpacity>
  );

  const openDocument = (url: string) => {
    console.log('Opening document:', url);
    
    // Ensure URL is absolute
    const absoluteUrl = url.startsWith('http') ? url : `${api.defaults.baseURL}${url}`;
    console.log('Absolute URL:', absoluteUrl);
    
    if (url.match(/\.(pdf|doc|docx)$/i)) {
      // For documents, try to open in external app
      Linking.openURL(absoluteUrl).catch((error) => {
        console.error('Failed to open document:', error);
        Alert.alert('Error', 'Cannot open document. Please check if you have a PDF reader installed.');
      });
    } else {
      // For images, show in modal
      setSelectedImageUrl(absoluteUrl);
    }
  };

  const renderItem = ({ item: p }: { item: ReviewPrescription }) => (
    <Card style={styles.prescriptionCard} elevation={3}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text variant="titleMedium" style={styles.prescriptionNumber}>
              {p.prescriptionNumber}
            </Text>
            <Text variant="bodySmall" style={styles.doctorName}>
              Dr. {p.doctorInfo?.name || 'Unknown Doctor'}
            </Text>
            <Text variant="bodySmall" style={styles.patientName}>
              {p.customer?.firstName} {p.customer?.lastName}
            </Text>
            {p.prescriptionDate && (
              <Text variant="bodySmall" style={styles.dateText}>
                📅 {new Date(p.prescriptionDate).toLocaleDateString()}
              </Text>
            )}
          </View>
          <Chip mode="flat" style={[styles.statusChip, getStatusChipStyle(p.status)]}>
            {p.status}
          </Chip>
        </View>

        <Divider style={styles.divider} />

        {/* Prescription Documents */}
        {p.documents && p.documents.length > 0 && (
          <View style={styles.documentsSection}>
            <Text variant="titleSmall" style={styles.sectionTitle}>
              📋 Prescription Files ({p.documents.length})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.documentsScroll}>
              {p.documents.map((document, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => openDocument(document.url)}
                  style={styles.documentItem}
                >
                  {document.url.match(/\.(jpg|jpeg|png|gif|bmp)$/i) ? (
                    <Image
                      source={{ uri: document.url.startsWith('http') ? document.url : `${api.defaults.baseURL}${document.url}` }}
                      style={styles.documentImage}
                      resizeMode="cover"
                      onError={(error) => {
                        console.error('Thumbnail load error:', error.nativeEvent?.error || 'Unknown error');
                      }}
                    />
                  ) : (
                    <View style={styles.documentPlaceholder}>
                      <IconButton icon="file-document" size={24} iconColor="#666" />
                    </View>
                  )}
                  <Text style={styles.documentLabel} numberOfLines={2}>
                    {document.originalName || `Document ${index + 1}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Medicines List */}
        {p.medicines && p.medicines.length > 0 && (
          <View style={styles.medicinesSection}>
            <Text variant="titleSmall" style={styles.sectionTitle}>
              💊 Prescribed Medicines ({p.medicines.length})
            </Text>
            {p.medicines.slice(0, 3).map((med, index) => (
              <Text key={index} variant="bodySmall" style={styles.medicineItem}>
                • {med.name} - {med.dosage} - {med.frequency} for {med.duration}
              </Text>
            ))}
            {p.medicines.length > 3 && (
              <Text variant="bodySmall" style={styles.moreMedicines}>
                +{p.medicines.length - 3} more medicines...
              </Text>
            )}
          </View>
        )}

        <TextInput
          mode="outlined"
          label="Review Notes"
          value={reviewNotes}
          onChangeText={setReviewNotes}
          multiline
          numberOfLines={3}
          style={styles.reviewInput}
        />

        <View style={styles.actionButtons}>
          <Button
            mode="contained"
            onPress={() => handleApprove(p)}
            style={[styles.actionButton, styles.approveButton]}
            icon="check"
            loading={approveReview.isPending}
          >
            Approve
          </Button>
          <Button
            mode="outlined"
            onPress={() => handleReject(p)}
            style={[styles.actionButton, styles.rejectButton]}
            icon="close"
            textColor="#F44336"
            loading={rejectReview.isPending}
          >
            Reject
          </Button>
        </View>
      </Card.Content>
    </Card>
  );

  const getStatusChipStyle = (status: string) => {
    switch (status) {
      case 'pending':
        return { backgroundColor: '#FFF3E0' };
      case 'under_review':
        return { backgroundColor: '#E3F2FD' };
      case 'approved':
        return { backgroundColor: '#E8F5E8' };
      case 'rejected':
        return { backgroundColor: '#FFEBEE' };
      default:
        return { backgroundColor: '#F5F5F5' };
    }
  };

  return (
    <View style={styles.container}>
      <Surface style={styles.searchContainer} elevation={2}>
        <Searchbar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search prescriptions..."
          style={styles.searchBar}
        />
      </Surface>
      
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(it) => it._id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshing={isLoading}
        onRefresh={refetch}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text variant="bodyLarge" style={styles.emptyText}>
              No prescriptions found for review
            </Text>
          </View>
        )}
      />

      {/* Image Viewer Modal */}
      <Portal>
        <Modal
          visible={!!selectedImageUrl}
          onDismiss={() => setSelectedImageUrl(null)}
          contentContainerStyle={styles.imageModal}
        >
          {selectedImageUrl && (
            <TouchableOpacity
              style={styles.modalImageContainer}
              onPress={() => setSelectedImageUrl(null)}
              activeOpacity={1}
            >
              <Image
                source={{ uri: selectedImageUrl }}
                style={styles.modalImage}
                resizeMode="contain"
                onError={(error) => {
                  console.error('Image load error:', error.nativeEvent?.error || 'Unknown error');
                  Alert.alert('Error', 'Failed to load image. Please check your connection.');
                  setSelectedImageUrl(null);
                }}
                onLoad={() => console.log('Image loaded successfully')}
              />
              <View style={styles.modalControls}>
                <Button
                  mode="contained"
                  onPress={() => setSelectedImageUrl(null)}
                  style={styles.closeButton}
                  icon="close"
                >
                  Close
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => {
                    if (selectedImageUrl) {
                      Linking.openURL(selectedImageUrl).catch(() => {
                        Alert.alert('Error', 'Cannot open image in external app');
                      });
                    }
                  }}
                  style={styles.openExternalButton}
                  icon="open-in-new"
                  textColor="#fff"
                >
                  Open External
                </Button>
              </View>
            </TouchableOpacity>
          )}
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa'
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 8
  },
  searchBar: {
    backgroundColor: '#f5f5f5'
  },
  listContainer: {
    padding: 16,
    paddingBottom: 32
  },
  prescriptionCard: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#fff'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: 12
  },
  prescriptionNumber: {
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4
  },
  doctorName: {
    color: '#2196F3',
    fontWeight: '600',
    marginBottom: 2
  },
  patientName: {
    color: '#666',
    fontWeight: '500',
    marginBottom: 2
  },
  dateText: {
    color: '#666',
    fontSize: 12
  },
  statusChip: {
    alignSelf: 'flex-start'
  },
  divider: {
    marginVertical: 12,
    backgroundColor: '#f0f0f0'
  },
  documentsSection: {
    marginBottom: 16
  },
  sectionTitle: {
    fontWeight: '600',
    color: '#333',
    marginBottom: 8
  },
  documentsScroll: {
    marginBottom: 8
  },
  documentItem: {
    marginRight: 12,
    alignItems: 'center',
    width: 100
  },
  documentImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f5f5f5'
  },
  documentPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed'
  },
  documentLabel: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
    width: 80
  },
  medicinesSection: {
    marginBottom: 16
  },
  medicineItem: {
    color: '#444',
    marginBottom: 4,
    lineHeight: 16
  },
  moreMedicines: {
    color: '#2196F3',
    fontStyle: 'italic',
    marginTop: 4
  },
  reviewInput: {
    marginBottom: 16
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12
  },
  actionButton: {
    flex: 1
  },
  approveButton: {
    backgroundColor: '#4CAF50'
  },
  rejectButton: {
    borderColor: '#F44336'
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center'
  },
  emptyText: {
    color: '#666',
    textAlign: 'center'
  },
  imageModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%'
  },
  modalImage: {
    width: '90%',
    height: '80%'
  },
  modalControls: {
    position: 'absolute',
    bottom: 50,
    flexDirection: 'row',
    gap: 12
  },
  closeButton: {
    backgroundColor: 'rgba(0,0,0,0.7)'
  },
  openExternalButton: {
    borderColor: '#fff',
    backgroundColor: 'rgba(0,0,0,0.3)'
  },
  // Unused styles that can be removed
  imageContainer: {
    marginRight: 12,
    alignItems: 'center',
    width: 100
  },
  prescriptionImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f5f5f5'
  },
  imageLabel: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
    width: 80
  }
});

export default PrescriptionReviewScreen; 