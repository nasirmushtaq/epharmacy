import React, { useMemo, useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Card, TextInput, Button, Chip, Divider, Snackbar, Menu } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import DatePickerField from '../../components/DatePickerField';

const CustomerBookingsScreen = () => {
  const qc = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [statusMenuVisible, setStatusMenuVisible] = useState(false);
  const [filterDate, setFilterDate] = useState<string>('');
  const [snack, setSnack] = useState('');

  const { data: bookings = [], isLoading, error, refetch } = useQuery({
    queryKey: ['customer-doctor-bookings', selectedStatus, filterDate],
    queryFn: async () => {
      const params: any = { orderType: 'doctor_booking' };
      if (selectedStatus !== 'all') {
        params.status = selectedStatus;
      }
      if (filterDate) {
        params.date = filterDate;
      }
      
      const response = await api.get('/api/orders/my-orders', { params });
      return response.data.data || [];
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => (await api.post(`/api/doctors/bookings/${id}/cancel`)).data,
    onSuccess: () => { setSnack('Booking cancelled'); qc.invalidateQueries({ queryKey: ['customer-doctor-bookings'] }); },
    onError: (e:any) => setSnack(e.response?.data?.message || 'Cancel failed')
  });

  const canCancel = (b:any) => b.status === 'pending' || b.status === 'confirmed';

  const renderItem = ({ item }: any) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">#{item.bookingNumber}</Text>
          <Chip compact style={[styles.statusChip, { backgroundColor: item.status === 'confirmed' ? '#E8F5E9' : item.status === 'completed' ? '#E3F2FD' : item.status === 'cancelled' ? '#FFEBEE' : '#FFF8E1' }]} textStyle={{ color: '#555' }}>{item.status}</Chip>
        </View>
        <Text style={styles.meta}>Date: {new Date(item.date).toLocaleDateString()} • {item.from} - {item.to}</Text>
        <Text style={styles.meta}>Doctor: {item.doctor?.user?.firstName} {item.doctor?.user?.lastName}</Text>
        <Divider style={{ marginVertical: 8 }} />
        <View style={styles.actionsRow}>
          <Button mode="outlined" onPress={() => cancelMutation.mutate(item._id)} disabled={!canCancel(item)} style={styles.btn}>Cancel</Button>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <View style={styles.filterRow}>
          <Menu
            visible={statusMenuVisible}
            onDismiss={() => setStatusMenuVisible(false)}
            anchor={
              <TextInput
                mode="outlined"
                label="Status"
                value={selectedStatus ? (selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)) : 'All'}
                editable={false}
                right={<TextInput.Icon icon="menu-down" onPress={() => setStatusMenuVisible(true)} />}
                style={styles.statusInput}
              />
            }
          >
            {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map((s) => (
              <Menu.Item key={s} onPress={() => { setSelectedStatus(s); setStatusMenuVisible(false); }} title={s.charAt(0).toUpperCase() + s.slice(1)} />
            ))}
          </Menu>
          <DatePickerField label="Date" value={filterDate} onChange={setFilterDate} style={styles.dateSmall} />
        </View>
      </View>
      <FlatList data={bookings} keyExtractor={(i:any)=>i._id} renderItem={renderItem} contentContainerStyle={{ padding: 12 }} />
      <Snackbar visible={!!snack} onDismiss={()=>setSnack('')}>{snack}</Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  filters: { padding: 12 },
  filterRow: { flexDirection: 'row', alignItems: 'center' },
  statusInput: { flexGrow: 1, marginRight: 8 },
  dateSmall: { width: 140 },
  card: { marginBottom: 12, borderRadius: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  title: { fontWeight: '700', flexGrow: 1, flexShrink: 1, minWidth: 0, marginRight: 8 },
  statusChip: { alignSelf: 'center', marginTop: 4 },
  meta: { color: '#666', marginTop: 4 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, flexWrap: 'wrap' },
  btn: { marginRight: 6, marginBottom: 6 },
});

export default CustomerBookingsScreen; 