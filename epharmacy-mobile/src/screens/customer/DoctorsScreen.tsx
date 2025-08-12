import React, { useState, useMemo, useEffect } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import { Text, Button, Card, Surface, TextInput, Dialog, Portal, Snackbar } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DatePickerField from '../../components/DatePickerField';
import PaymentModal from '../../components/PaymentModal';
import api from '../../services/api';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';

interface Doctor { _id: string; user: any; specialties: string[]; clinics: any[]; fee: number; }

const DoctorsScreen = () => {
  const qc = useQueryClient();
  const navigation = useNavigation();
  const [specialty, setSpecialty] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [snack, setSnack] = useState('');
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingSlot, setPendingSlot] = useState<{ from: string; to: string } | null>(null);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0,10)); // ISO, default today
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [paymentContext, setPaymentContext] = useState<{ 
    bookingId: string; 
    sessionId: string; 
    appId: string; 
    env: string; 
    amount: number; 
    orderId: string; 
  } | null>(null);

  const { state: authState } = useAuth();

  const { data: doctors = [], isFetching, refetch: refetchDoctors } = useQuery<Doctor[]>({
    queryKey: ['doctors', specialty, !!authState.token],
    enabled: !!authState.token,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: async () => {
      const res = await api.get('/api/doctors', { params: specialty ? { specialty } : {} });
      return res.data.data as Doctor[];
    }
  });

  // Build availability map for the selected date to filter doctors shown
  const { data: availabilityMap = {}, isFetching: isFetchingAvail, refetch: refetchAvail } = useQuery<Record<string, boolean>>({
    queryKey: ['doctor-availability', (doctors as any[]).map(d=>d._id).join(','), date, !!authState.token],
    enabled: !!authState.token && !!date && (doctors as any[]).length > 0,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: async () => {
      const entries = await Promise.all((doctors as any[]).map(async (d:any) => {
        try {
          const res = await api.get(`/api/doctors/${d._id}/slots`, { params: { date, _t: Date.now() } });
          const has = Array.isArray(res.data?.data) && res.data.data.length > 0;
          return [d._id, has] as const;
        } catch {
          return [d._id, false] as const;
        }
      }));
      return Object.fromEntries(entries) as Record<string, boolean>;
    }
  });

  const visibleDoctors = useMemo<Doctor[]>(() => {
    if (!(doctors as any[]).length) return [] as Doctor[];
    if (!date) return doctors as Doctor[];
    const map = (availabilityMap as Record<string, boolean>) || {};
    const keys = Object.keys(map);
    if (keys.length === 0) return doctors as Doctor[]; // before availability loads
    const anyAvailable = Object.values(map).some(Boolean);
    if (!anyAvailable) return doctors as Doctor[]; // fallback: show all, mark no slots later
    return (doctors as any[]).filter((d:any) => map[d._id]);
  }, [doctors, availabilityMap, date]);

  const { data: slots = [] } = useQuery({
    queryKey: ['doctor-slots', selectedDoctor?._id, date],
    enabled: !!selectedDoctor && !!date,
    queryFn: async () => {
      const res = await api.get(`/api/doctors/${selectedDoctor?._id}/slots`, { params: { date } });
      return res.data.data as Array<{ from: string; to: string }>;
    }
  });

  const bookMutation = useMutation({
    mutationFn: async ({ clinicIndex, from, to }: any) => {
      const orderData = {
        orderType: 'doctor_booking',
        totalAmount: selectedDoctor?.fee || 500,
        payment: {
          method: 'online',
          gateway: 'cashfree'
        },
        doctorBooking: {
          doctor: selectedDoctor?._id,
          date,
          from,
          to,
          clinicIndex,
          fee: selectedDoctor?.fee || 500
        }
      };
      
      const res = await api.post('/api/orders', orderData);
      return res.data;
    },
    onSuccess: async (data) => {
      try {
        // Create payment session for the booking order
        const order = data.data;
        const amount = selectedDoctor?.fee || 500;
        
        const cfRes = await api.post('/api/payments/cashfree/create', {
          amount,
          orderId: order.orderNumber,
          currency: 'INR'
        });

        const { sessionId, appId, env } = cfRes.data?.data || {};
        
        if (!sessionId || !appId) {
          throw new Error('Payment initialization failed');
        }

        setPaymentContext({
          bookingId: order._id,
          sessionId,
          appId,
          env: env || 'SANDBOX',
          amount,
          orderId: order.orderNumber
        });

        setConfirmVisible(false);
        setPendingSlot(null);
        setPaymentVisible(true);
        
      } catch (error: any) {
        setSnack('Booking created but payment failed. Please contact support.');
        qc.invalidateQueries({ queryKey: ['doctor-slots'] });
        qc.invalidateQueries({ queryKey: ['my-doctor-bookings'] });
        setConfirmVisible(false);
        setPendingSlot(null);
      }
    },
    onError: (e: any) => setSnack(e.response?.data?.message || 'Booking failed')
  });

  const handlePaymentSuccess = async ({ orderId, paymentId, signature }: any) => {
    try {
      // Verify payment if needed
      if (signature) {
        await api.post('/api/payments/verify', {
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature
        });
      }

      setSnack('Booking confirmed and payment successful!');
      setPaymentVisible(false);
      setPaymentContext(null);
      
      // Refresh data
      qc.invalidateQueries({ queryKey: ['doctor-slots'] });
      qc.invalidateQueries({ queryKey: ['my-doctor-bookings'] });
      
      // Navigate to Bookings tab
      setTimeout(() => {
        const globalNav = (global as any)?.navigation;
        if (globalNav && globalNav.navigate) {
          globalNav.navigate('CustomerTabs', { screen: 'Bookings' });
        } else {
          navigation.navigate('Bookings' as never);
        }
      }, 1500);
      
    } catch (error: any) {
      setSnack('Payment successful but verification failed');
      setPaymentVisible(false);
      setPaymentContext(null);
    }
  };

  const handlePaymentFailure = (message: string) => {
    setSnack(`Payment failed: ${message}`);
    setPaymentVisible(false);
    setPaymentContext(null);
  };

  const renderDoctor = ({ item }: { item: Doctor }) =>
    <Card style={styles.card}>
      <Card.Content>
        <Text style={styles.name}>{item.user?.firstName} {item.user?.lastName}</Text>
        <Text style={styles.meta}>{item.specialties?.join(', ') || 'General'} • Fee ₹{item.fee || 500}</Text>
        <View style={styles.row}>
          <Button mode="contained" onPress={() => setSelectedDoctor(selectedDoctor?._id === item._id ? null : item)} disabled={!date}>
            {selectedDoctor?._id === item._id ? 'Hide Slots' : 'View Slots'}
          </Button>
        </View>
        {selectedDoctor?._id === item._id && date ? (
          <View style={{ marginTop: 8 }}>
            {slots.length === 0 ? <Text>No free slots</Text> : (
              <View style={styles.slotWrap}>
                {slots.map((s, idx) => (
                  <Button key={idx} mode="outlined" style={styles.slotBtn} onPress={()=>{ setPendingSlot({ from: s.from, to: s.to }); setConfirmVisible(true); }}>
                    {s.from} - {s.to}
                  </Button>
                ))}
              </View>
            )}
          </View>
        ) : null}
      </Card.Content>
    </Card>;

  return (
    <View style={styles.container}>
      <View style={{ paddingHorizontal: 12, paddingTop: 12 }}>
        <DatePickerField label="Select Date" value={date} onChange={setDate} />
        <TextInput mode="outlined" placeholder="Specialty (leave blank for All)" value={specialty} onChangeText={setSpecialty} style={styles.search} right={<TextInput.Icon icon="magnify" />} />
      </View>
      <FlatList data={visibleDoctors as any[]} keyExtractor={(i:any) => i._id} renderItem={renderDoctor} contentContainerStyle={styles.list} />
      
      <Portal>
        <Dialog visible={confirmVisible} onDismiss={() => setConfirmVisible(false)}>
          <Dialog.Title>Confirm Booking</Dialog.Title>
          <Dialog.Content>
            <Text>Book {selectedDoctor?.user?.firstName} {selectedDoctor?.user?.lastName} on {date} from {pendingSlot?.from} - {pendingSlot?.to}?</Text>
            <Text style={{ marginTop: 8, fontWeight: 'bold' }}>Fee: ₹{selectedDoctor?.fee || 500}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmVisible(false)}>Cancel</Button>
            <Button mode="contained" onPress={() => bookMutation.mutate({ clinicIndex: 0, from: pendingSlot?.from, to: pendingSlot?.to })} loading={bookMutation.isPending}>
              Proceed to Payment
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {paymentVisible && paymentContext && (
        <PaymentModal
          visible={paymentVisible}
          onClose={() => {
            setPaymentVisible(false);
            setPaymentContext(null);
          }}
          mode="cashfree"
          apiBaseUrl={(api.defaults.baseURL || '').replace(/\/$/, '')}
          appId={paymentContext.appId}
          sessionId={paymentContext.sessionId}
          env={paymentContext.env as any}
          amount={paymentContext.amount}
          orderId={paymentContext.orderId}
          title="Doctor Booking Payment"
          onSuccess={handlePaymentSuccess}
          onFailure={handlePaymentFailure}
        />
      )}

      <Snackbar visible={!!snack} onDismiss={() => setSnack('')} duration={3000}>
        {snack}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  search: { marginTop: 12 },
  list: { padding: 12 },
  card: { marginBottom: 12, borderRadius: 12 },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { color: '#666', marginTop: 2, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  dateInput: { flex: 1, marginRight: 8 },
  slotWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  slotBtn: { marginRight: 6, marginBottom: 6 }
});

export default DoctorsScreen; 