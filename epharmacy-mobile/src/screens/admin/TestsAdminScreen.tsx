import React, { useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, Platform } from 'react-native';
import { Text, Card, Button, TextInput, IconButton, Divider, Snackbar } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

const TestsAdminScreen = () => {
  const qc = useQueryClient();
  const [snack, setSnack] = useState('');
  const [filter, setFilter] = useState('pending_review');
  const [assignTechId, setAssignTechId] = useState('');

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

  const renderBooking = ({ item }: any) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{item.test?.name} • {item.bookingNumber}</Text>
          <Text style={styles.badge}>{item.status}</Text>
        </View>
        <Text style={styles.meta}>Customer: {item.customer?.firstName} {item.customer?.lastName} • {item.customer?.email}</Text>
        <Text style={styles.meta}>Address: {item.address?.line1}, {item.address?.city}, {item.address?.state} {item.address?.zip}</Text>
        <Divider style={{ marginVertical: 8 }} />
        <View style={styles.actionsRow}>
          <Button mode="outlined" onPress={()=>reviewMutation.mutate({ id: item._id, status: 'approved' })} style={styles.btn}>Approve</Button>
          <Button mode="outlined" onPress={()=>reviewMutation.mutate({ id: item._id, status: 'rejected' })} style={styles.btn}>Reject</Button>
          <TextInput placeholder="Technician ID" value={assignTechId} onChangeText={setAssignTechId} style={[styles.techInput]} />
          <Button mode="contained" onPress={()=>assignMutation.mutate({ id: item._id, technicianId: assignTechId })} disabled={!assignTechId}>Assign</Button>
          <Button mode="outlined" onPress={()=>pickFile(item._id)} style={styles.btn}>Upload Result</Button>
        </View>
        {item.resultFiles?.length ? <Text style={styles.meta}>Results: {item.resultFiles.length} file(s)</Text> : null}
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        <TextInput placeholder="Filter status (e.g., pending_review/approved/assigned)" value={filter} onChangeText={setFilter} mode="outlined" style={{ flex: 1, marginRight: 8 }} />
        <Button mode="contained" onPress={()=>qc.invalidateQueries({ queryKey: ['tests-admin'] })}>Refresh</Button>
      </View>
      <FlatList data={bookings} keyExtractor={(i)=>i._id} renderItem={renderBooking} contentContainerStyle={{ padding: 12 }} />
      <Snackbar visible={!!snack} onDismiss={()=>setSnack('')}>{snack}</Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  filterRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  card: { marginBottom: 12, borderRadius: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontWeight: '700', fontSize: 16 },
  badge: { color: '#666' },
  meta: { color: '#666', marginTop: 4 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, flexWrap: 'wrap' },
  btn: { marginRight: 6, marginBottom: 6 },
  techInput: { width: 200, marginRight: 6, marginBottom: 6 },
});

export default TestsAdminScreen; 