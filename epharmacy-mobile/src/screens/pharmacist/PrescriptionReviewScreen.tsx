import React, { useState } from 'react';
import { View, FlatList, StyleSheet, Alert, ScrollView } from 'react-native';
import { Card, Text, Button, IconButton, Surface, Divider, TextInput, Chip, Searchbar, ActivityIndicator } from 'react-native-paper';
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
}

const PrescriptionReviewScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
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

  const renderItem = ({ item: p }: { item: ReviewPrescription }) => (
    <Card style={{ margin: 12 }}>
      <Card.Content>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <Text variant="titleMedium">{p.prescriptionNumber}</Text>
            <Text variant="bodySmall">Dr. {p.doctorInfo?.name || '-'}</Text>
            <Text variant="bodySmall">{p.customer?.firstName} {p.customer?.lastName}</Text>
          </View>
          <Chip>{p.status}</Chip>
        </View>
        <Divider style={{ marginVertical: 8 }} />
        <TextInput mode="outlined" label="Review Notes" value={reviewNotes} onChangeText={setReviewNotes} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
          <Button mode="contained" onPress={() => handleApprove(p)}>Approve</Button>
          <Button mode="outlined" onPress={() => handleReject(p)} textColor="#F44336">Reject</Button>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={{ flex: 1 }}>
      <Surface style={{ padding: 12 }}>
        <Searchbar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search prescriptions" />
      </Surface>
      <FlatList data={filtered} renderItem={renderItem} keyExtractor={(it) => it._id} />
    </View>
  );
};

export default PrescriptionReviewScreen; 