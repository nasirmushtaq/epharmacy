import React, { useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, Platform } from 'react-native';
import { Text, Card, Button, TextInput, IconButton, Divider, Snackbar, Surface, Chip, ActivityIndicator } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

const TestsAdminScreen = () => {
  const qc = useQueryClient();
  const [snack, setSnack] = useState('');
  const [filter, setFilter] = useState('pending_review');
  const [assignTechId, setAssignTechId] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  
  const statusOptions = [
    { value: 'pending_review', label: 'Pending Review', color: '#FF9800' },
    { value: 'approved', label: 'Approved', color: '#4CAF50' },
    { value: 'assigned', label: 'Assigned', color: '#2196F3' },
    { value: 'sample_collected', label: 'Sample Collected', color: '#9C27B0' },
    { value: 'results_ready', label: 'Results Ready', color: '#607D8B' },
    { value: 'completed', label: 'Completed', color: '#4CAF50' },
    { value: 'cancelled', label: 'Cancelled', color: '#F44336' }
  ];

  const { data: bookings = [], isFetching } = useQuery({
    queryKey: ['tests-admin', filter],
    queryFn: async () => {
      const res = await api.get('/api/tests/bookings', { params: filter ? { status: filter } : {} });
      return res.data.data as any[];
    }
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, reviewNotes }: any) => {
      const res = await api.post(`/api/tests/bookings/${id}/review`, { status, reviewNotes });
      return res.data;
    },
    onSuccess: () => { setSnack('Review saved'); qc.invalidateQueries({ queryKey: ['tests-admin'] }); },
    onError: (e:any)=> setSnack(e.response?.data?.message||'Review failed')
  });

  const assignMutation = useMutation({
    mutationFn: async ({ id, technicianId }: any) => {
      const res = await api.post(`/api/tests/bookings/${id}/assign`, { technicianId });
      return res.data;
    },
    onSuccess: () => { setSnack('Technician assigned'); qc.invalidateQueries({ queryKey: ['tests-admin'] }); setAssignTechId(''); },
    onError: (e:any)=> setSnack(e.response?.data?.message||'Assign failed')
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: any) => {
      const res = await api.patch(`/api/tests/bookings/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => { 
      setSnack('Status updated successfully'); 
      qc.invalidateQueries({ queryKey: ['tests-admin'] });
      setSelectedBooking(null);
    },
    onError: (e:any)=> setSnack(e.response?.data?.message||'Status update failed')
  });

  const resultMutation = useMutation({
    mutationFn: async ({ id, file }: any) => {
      const fd = new FormData();
      fd.append('deliveryProof', file as any);
      const res = await api.post(`/api/tests/bookings/${id}/results`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      return res.data;
    },
    onSuccess: ()=> { setSnack('Result uploaded'); qc.invalidateQueries({ queryKey: ['tests-admin'] }); },
    onError: (e:any)=> setSnack(e.response?.data?.message||'Upload failed')
  });

  const getStatusColor = (status: string) => {
    const option = statusOptions.find(opt => opt.value === status);
    return option?.color || '#666';
  };

  const pickFile = async (id: string) => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.onchange = () => {
        const file = (input.files && input.files[0]) as any;
        if (file) resultMutation.mutate({ id, file });
      };
      input.click();
    } else {
      setSnack('Result upload UI is web-focused for admin; use technician app flow on mobile.');
    }
  };

  const renderBookingCard = ({ item }: { item: any }) => (
    <Card style={styles.card} elevation={3}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text variant="titleMedium" style={styles.testName}>
              {item.test?.name || 'Unknown Test'}
            </Text>
            <Text variant="bodySmall" style={styles.patientName}>
              {item.customer?.firstName} {item.customer?.lastName}
            </Text>
          </View>
          <Chip 
            mode="flat" 
            style={[styles.statusChip, { backgroundColor: `${getStatusColor(item.status)}20` }]}
            textStyle={{ color: getStatusColor(item.status), fontWeight: '600' }}
          >
            {statusOptions.find(opt => opt.value === item.status)?.label || item.status}
          </Chip>
        </View>

        <Divider style={styles.divider} />

        <View style={styles.detailsContainer}>
          <Text variant="bodyMedium" style={styles.detailItem}>
            📅 Scheduled: {new Date(item.scheduledAt).toLocaleString()}
          </Text>
          <Text variant="bodyMedium" style={styles.detailItem}>
            💰 Price: ₹{item.test?.price || 0}
          </Text>
          <Text variant="bodySmall" style={styles.detailItem}>
            📧 {item.customer?.email}
          </Text>
          {item.address && (
            <Text variant="bodySmall" style={styles.detailItem}>
              📍 {item.address.line1}, {item.address.city}
            </Text>
          )}
          {item.resultFiles?.length > 0 && (
            <Text variant="bodySmall" style={styles.detailItem}>
              📄 Results: {item.resultFiles.length} file(s) uploaded
            </Text>
          )}
        </View>

        <View style={styles.actionContainer}>
          <Button
            mode="outlined"
            onPress={() => setSelectedBooking(item)}
            style={styles.actionButton}
            icon="edit"
          >
            Update Status
          </Button>
          
          {item.status === 'pending_review' && (
            <View style={styles.quickActions}>
              <Button
                mode="contained"
                onPress={() => reviewMutation.mutate({ id: item._id, status: 'approved', reviewNotes: 'Approved for testing' })}
                style={[styles.quickActionBtn, { backgroundColor: '#4CAF50' }]}
                loading={reviewMutation.isPending}
                compact
              >
                Approve
              </Button>
              <Button
                mode="outlined"
                onPress={() => reviewMutation.mutate({ id: item._id, status: 'cancelled', reviewNotes: 'Test cancelled' })}
                style={styles.quickActionBtn}
                textColor="#F44336"
                compact
              >
                Reject
              </Button>
            </View>
          )}

          {item.status === 'approved' && (
            <View style={styles.assignSection}>
              <TextInput
                mode="outlined"
                label="Technician ID"
                value={assignTechId}
                onChangeText={setAssignTechId}
                style={styles.techInput}
                dense
              />
              <Button
                mode="contained"
                onPress={() => assignMutation.mutate({ id: item._id, technicianId: assignTechId })}
                disabled={!assignTechId}
                loading={assignMutation.isPending}
                compact
              >
                Assign
              </Button>
            </View>
          )}

          {['assigned', 'sample_collected'].includes(item.status) && (
            <Button
              mode="outlined"
              onPress={() => pickFile(item._id)}
              style={styles.actionButton}
              icon="upload"
              loading={resultMutation.isPending}
            >
              Upload Results
            </Button>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  if (isFetching && bookings.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading test bookings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Status Filter Chips */}
      <Surface style={styles.filterContainer} elevation={2}>
        <View style={styles.chipContainer}>
          {statusOptions.map((option) => (
            <Chip
              key={option.value}
              selected={filter === option.value}
              onPress={() => setFilter(option.value)}
              style={[
                styles.filterChip,
                filter === option.value && { backgroundColor: `${option.color}20` }
              ]}
              textStyle={filter === option.value ? { color: option.color, fontWeight: '600' } : {}}
            >
              {option.label}
            </Chip>
          ))}
        </View>
      </Surface>

      {/* Bookings List */}
      <FlatList
        data={bookings}
        keyExtractor={(item) => item._id}
        renderItem={renderBookingCard}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshing={isFetching}
        onRefresh={() => qc.invalidateQueries({ queryKey: ['tests-admin'] })}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text variant="bodyLarge" style={styles.emptyText}>
              No test bookings found for "{statusOptions.find(opt => opt.value === filter)?.label}"
            </Text>
          </View>
        )}
      />

      {/* Status Update Modal */}
      {selectedBooking && (
        <Surface style={styles.modalOverlay}>
          <Card style={styles.modal} elevation={8}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.modalTitle}>
                Update Test Status
              </Text>
              <Text variant="bodyMedium" style={styles.modalSubtitle}>
                {selectedBooking.test?.name} - {selectedBooking.customer?.firstName} {selectedBooking.customer?.lastName}
              </Text>
              
              <View style={styles.statusGrid}>
                {statusOptions.map((option) => (
                  <Button
                    key={option.value}
                    mode={selectedBooking.status === option.value ? "contained" : "outlined"}
                    onPress={() => updateStatusMutation.mutate({ id: selectedBooking._id, status: option.value })}
                    style={[styles.statusButton, { borderColor: option.color }]}
                    buttonColor={selectedBooking.status === option.value ? option.color : undefined}
                    textColor={selectedBooking.status === option.value ? '#fff' : option.color}
                    loading={updateStatusMutation.isPending}
                    disabled={updateStatusMutation.isPending}
                    compact
                  >
                    {option.label}
                  </Button>
                ))}
              </View>

              <View style={styles.modalActions}>
                <Button
                  mode="outlined"
                  onPress={() => setSelectedBooking(null)}
                  style={styles.modalButton}
                >
                  Cancel
                </Button>
              </View>
            </Card.Content>
          </Card>
        </Surface>
      )}

      <Snackbar
        visible={!!snack}
        onDismiss={() => setSnack('')}
        duration={3000}
        style={styles.snackbar}
      >
        {snack}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8f9fa' 
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 16,
    color: '#666'
  },
  filterContainer: {
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 8
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  filterChip: {
    marginRight: 8,
    marginBottom: 8
  },
  listContainer: {
    padding: 16,
    paddingBottom: 32
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#fff'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: 12
  },
  testName: {
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4
  },
  patientName: {
    color: '#666',
    fontWeight: '500'
  },
  statusChip: {
    alignSelf: 'flex-start'
  },
  divider: {
    marginVertical: 12,
    backgroundColor: '#f0f0f0'
  },
  detailsContainer: {
    marginBottom: 16
  },
  detailItem: {
    marginBottom: 6,
    color: '#444'
  },
  actionContainer: {
    gap: 12
  },
  actionButton: {
    alignSelf: 'flex-start'
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap'
  },
  quickActionBtn: {
    minWidth: 100
  },
  assignSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap'
  },
  techInput: {
    flex: 1,
    minWidth: 200
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center'
  },
  emptyText: {
    color: '#666',
    textAlign: 'center'
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16
  },
  modalTitle: {
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center'
  },
  modalSubtitle: {
    color: '#666',
    textAlign: 'center',
    marginBottom: 24
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24
  },
  statusButton: {
    flex: 1,
    minWidth: '45%'
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'center'
  },
  modalButton: {
    minWidth: 120
  },
  snackbar: {
    backgroundColor: '#323232'
  }
});

export default TestsAdminScreen;