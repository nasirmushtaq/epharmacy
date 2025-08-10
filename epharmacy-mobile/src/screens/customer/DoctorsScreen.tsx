import React, { useState, useMemo } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import { Text, Button, Card, Surface, TextInput, Dialog, Portal, Snackbar } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DatePickerField from '../../components/DatePickerField';
import PaymentModal from '../../components/PaymentModal';
import api from '../../services/api';
import { useNavigation } from '@react-navigation/native';

interface Doctor { _id: string; user: any; specialties: string[]; clinics: any[]; fee: number; }

const DoctorsScreen = () => {
  const qc = useQueryClient();
  const navigation = useNavigation();
  const [specialty, setSpecialty] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [snack, setSnack] = useState('');
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingSlot, setPendingSlot] = useState<{ from: string; to: string } | null>(null);
  const [date, setDate] = useState<string>(''); // ISO
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [paymentContext, setPaymentContext] = useState<{ 
    bookingId: string; 
    sessionId: string; 
    appId: string; 
    env: string; 
    amount: number; 
    orderId: string; 
  } | null>(null);

  const { data: doctors = [], isFetching } = useQuery({
    queryKey: ['doctors', specialty],
    queryFn: async () => {
      const res = await api.get('/api/doctors', { params: specialty ? { specialty } : {} });
      return res.data.data as Doctor[];
    }
  });

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
      
      // Navigate to bookings page
      setTimeout(() => {
        navigation.navigate('Bookings' as never);
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
          <DatePickerField label="Date" value={date} onChange={setDate} style={styles.dateInput} />
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
      <TextInput mode="outlined" placeholder="Search by specialty" value={specialty} onChangeText={setSpecialty} style={styles.search} right={<TextInput.Icon icon="magnify" />} />
      <FlatList data={doctors} keyExtractor={(i) => i._id} renderItem={renderDoctor} contentContainerStyle={styles.list} />
      
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
  search: { margin: 12, marginBottom: 0 },
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