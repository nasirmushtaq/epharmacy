import React, { useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, Platform, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, ScrollView } from 'react-native';
import { Text, Card, Button, TextInput, Chip, Divider, IconButton, Snackbar } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

const DoctorBookingsScreen = () => {
  const qc = useQueryClient();
  const [snack, setSnack] = useState('');
  const [date, setDate] = useState(''); // YYYY-MM-DD optional filter client-side
  const [status, setStatus] = useState(''); // pending/confirmed/cancelled

  const { data: list = [], isFetching } = useQuery({
    queryKey: ['doctor-bookings', date, status],
    queryFn: async () => {
      const params: any = {};
      if (date) params.date = date;
      if (status) params.status = status;
      const res = await api.get('/api/doctors/doctor/bookings', { params });
      return (res.data?.data || []).sort((a: any, b: any) => (new Date(b.date).getTime() - new Date(a.date).getTime()));
    }
  });

  const filtered = useMemo(() => {
    return (list as any[]).filter(b => {
      const okDate = date ? (new Date(b.date).toISOString().slice(0,10) === date) : true;
      const okStatus = status ? (b.status === status) : true;
      return okDate && okStatus;
    });
  }, [list, date, status]);

  const confirmMutation = useMutation({
    mutationFn: async (id: string) => (await api.post(`/api/doctors/bookings/${id}/confirm`)).data,
    onSuccess: () => { setSnack('Consultation confirmed'); qc.invalidateQueries({ queryKey: ['doctor-bookings'] }); },
    onError: (e:any) => setSnack(e.response?.data?.message || 'Confirm failed')
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ id, file }: any) => {
      const fd = new FormData();
      fd.append('prescription', file);
      const res = await api.post(`/api/doctors/bookings/${id}/prescriptions`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      return res.data;
    },
    onSuccess: () => { setSnack('Prescription uploaded'); qc.invalidateQueries({ queryKey: ['doctor-bookings'] }); },
    onError: (e:any) => setSnack(e.response?.data?.message || 'Upload failed')
  });

  const pickFile = (id: string) => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf,image/*';
      input.onchange = () => {
        const file = (input.files && input.files[0]) as any;
        if (file) uploadMutation.mutate({ id, file });
      };
      input.click();
    } else {
      setSnack('Please upload from web for now; mobile file upload coming next');
    }
  };

  const renderItem = ({ item }: any) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">#{item.bookingNumber}</Text>
          <Chip compact style={[styles.statusChip, { backgroundColor: item.status === 'confirmed' ? '#E8F5E9' : '#FFF8E1' }]} textStyle={{ color: item.status === 'confirmed' ? '#2E7D32' : '#F9A825' }}>{item.status}</Chip>
        </View>
        <Text style={styles.meta}>Date: {new Date(item.date).toLocaleDateString()} • {item.from} - {item.to}</Text>
        <Text style={styles.meta}>Patient: {item.patient?.firstName} {item.patient?.lastName} • {item.patient?.email}</Text>
        <Divider style={{ marginVertical: 8 }} />
        <View style={styles.actionsRow}>
          <Button mode="contained" onPress={() => confirmMutation.mutate(item._id)} disabled={item.status === 'confirmed'} style={styles.btn}>Confirm</Button>
          <Button mode="outlined" onPress={() => pickFile(item._id)} style={styles.btn}>Upload Prescription</Button>
        </View>
        {item.prescriptionFiles?.length ? <Text style={styles.meta}>Prescriptions: {item.prescriptionFiles.length}</Text> : null}
      </Card.Content>
    </Card>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 12 }}>
          <View style={styles.filters}>
            <TextInput mode="outlined" label="Filter by date (YYYY-MM-DD)" value={date} onChangeText={setDate} style={styles.filterInput} />
            <TextInput mode="outlined" label="Status (pending/confirmed)" value={status} onChangeText={setStatus} style={styles.filterInput} />
            <IconButton icon="refresh" onPress={() => qc.invalidateQueries({ queryKey: ['doctor-bookings'] })} disabled={isFetching} />
          </View>
          <FlatList data={filtered} keyExtractor={(i:any)=>i._id} renderItem={renderItem} scrollEnabled={false} />
          <Snackbar visible={!!snack} onDismiss={()=>setSnack('')}>{snack}</Snackbar>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  card: { marginBottom: 12, borderRadius: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  title: { fontWeight: '700', flexGrow: 1, flexShrink: 1, minWidth: 0, marginRight: 8 },
  statusChip: { alignSelf: 'center', marginTop: 4 },
  meta: { color: '#666', marginTop: 4 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, flexWrap: 'wrap' },
  btn: { marginRight: 6, marginBottom: 6 },
  filters: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 },
  filterInput: { flexGrow: 1, minWidth: 180, marginRight: 8, marginBottom: 8 },
});

export default DoctorBookingsScreen; 