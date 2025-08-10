import React, { useState, useMemo } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Text, Card, TextInput, Button, Snackbar } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DatePickerField from '../../components/DatePickerField';
import PaymentModal from '../../components/PaymentModal';
import api from '../../services/api';

interface TestItem { _id: string; name: string; description: string; instructions?: string; price: number; category: string; isActive: boolean; }
interface BookingItem {
  _id: string;
  test: TestItem;
  scheduledAt: string;
  status: string;
  address: any;
  assignedTechnician?: any;
  resultFiles?: Array<{ url: string; originalName: string }>;
}

const TestsScreen = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'tests' | 'bookings'>('tests');
  const [search, setSearch] = useState('');
  const [address, setAddress] = useState({ line1: '', city: '', state: '', zip: '', phone: '' });
  const [scheduledAt, setScheduledAt] = useState('');
  const [selectedTest, setSelectedTest] = useState<TestItem | null>(null);
  const [snack, setSnack] = useState<string>('');
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [paymentContext, setPaymentContext] = useState<{
    bookingId: string;
    sessionId: string;
    appId: string;
    env: string;
    amount: number;
    orderId: string;
  } | null>(null);

  const { data: tests = [], isFetching } = useQuery({
    queryKey: ['tests', search],
    queryFn: async () => {
      const res = await api.get('/api/tests', { params: search ? { q: search } : {} });
      return res.data.data as TestItem[];
    }
  });

  const { data: myBookings = [], isFetching: loadingBookings } = useQuery({
    queryKey: ['test-bookings'],
    queryFn: async () => {
      const response = await api.get('/api/orders/my-orders', { 
        params: { orderType: 'test_booking' } 
      });
      return response.data.data || [];
    }
  });

  const bookMutation = useMutation({
    mutationFn: async (payload: any) => {
      const orderData = {
        orderType: 'test_booking',
        totalAmount: selectedTest?.price || 500,
        payment: {
          method: 'online',
          gateway: 'cashfree'
        },
        testBooking: {
          test: payload.testId,
          scheduledAt: payload.scheduledAt,
          address: payload.address
        }
      };
      
      const res = await api.post('/api/orders', orderData);
      return res.data;
    },
    onSuccess: async (data) => {
      try {
        // Create payment session for the test booking order
        const order = data.data;
        const amount = selectedTest?.price || 500;
        
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

        setSelectedTest(null);
        setPaymentVisible(true);
        
      } catch (error: any) {
        setSnack('Test booked but payment failed. Please contact support.');
        qc.invalidateQueries({ queryKey: ['test-bookings'] });
        setSelectedTest(null);
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

      setSnack('Test booked and payment successful!');
      setPaymentVisible(false);
      setPaymentContext(null);
      
      // Refresh bookings
      qc.invalidateQueries({ queryKey: ['test-bookings'] });
      
      // Switch to bookings tab to show the new booking
      setTimeout(() => {
        setTab('bookings');
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

  const canBook = useMemo(() => selectedTest && address.line1 && address.city && address.state && address.zip && address.phone && scheduledAt, [selectedTest, address, scheduledAt]);

  const renderTest = ({ item }: { item: TestItem }) => (
    <Card style={styles.card}>
      <Card.Content>
        <Text style={styles.testName}>{item.name}</Text>
        <Text style={styles.price}>₹{item.price}</Text>
        <Text>{item.description}</Text>
        <Button mode="contained" style={styles.bookBtn} onPress={() => setSelectedTest(item)}>
          Book Test
        </Button>
      </Card.Content>
    </Card>
  );

  const renderBooking = ({ item }: { item: BookingItem }) => (
    <Card style={styles.card}>
      <Card.Content>
        <Text style={styles.testName}>{item.test?.name}</Text>
        <Text>Status: {item.status}</Text>
        <Text>Scheduled: {new Date(item.scheduledAt).toLocaleString()}</Text>
        <Text>Address: {item.address?.line1}, {item.address?.city}</Text>
        {item.assignedTechnician && <Text>Technician: {item.assignedTechnician.firstName} {item.assignedTechnician.lastName}</Text>}
        {item.resultFiles && item.resultFiles.length > 0 && (
          <Text style={{ color: 'green', fontWeight: 'bold', marginTop: 8 }}>
            Results Available ({item.resultFiles.length} file{item.resultFiles.length > 1 ? 's' : ''})
          </Text>
        )}
      </Card.Content>
    </Card>
  );

  const handleBook = () => {
    if (!canBook) return;
    
    bookMutation.mutate({
      testId: selectedTest?._id,
      scheduledAt,
      address,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        <Button mode={tab === 'tests' ? 'contained' : 'outlined'} style={styles.tabBtn} onPress={() => setTab('tests')}>Tests</Button>
        <Button mode={tab === 'bookings' ? 'contained' : 'outlined'} style={styles.tabBtn} onPress={() => setTab('bookings')}>My Bookings</Button>
      </View>

      {tab === 'tests' ? (
        <>
          <TextInput mode="outlined" placeholder="Search tests (e.g., CBC, RTPCR)" value={search} onChangeText={setSearch} style={styles.search} right={<TextInput.Icon icon="magnify" />} />
          <FlatList data={tests} keyExtractor={(i) => i._id} renderItem={renderTest} contentContainerStyle={styles.listPad} />
        </>
      ) : (
        <FlatList data={myBookings} keyExtractor={(i) => i._id} renderItem={renderBooking} contentContainerStyle={styles.listPad} />
      )}

      {selectedTest && (
        <Card style={styles.sheet}>
          <Card.Content>
            <Text style={styles.sheetTitle}>Book {selectedTest.name}</Text>
            <Text style={styles.sheetPrice}>Price: ₹{selectedTest.price}</Text>
            
            <DatePickerField 
              label="Preferred Date & Time" 
              value={scheduledAt} 
              onChange={setScheduledAt} 
              mode="datetime"
              style={styles.input}
            />
            
            <TextInput 
              mode="outlined" 
              label="Address Line 1" 
              value={address.line1} 
              onChangeText={(line1) => setAddress(prev => ({ ...prev, line1 }))} 
              style={styles.input} 
            />
            <TextInput 
              mode="outlined" 
              label="City" 
              value={address.city} 
              onChangeText={(city) => setAddress(prev => ({ ...prev, city }))} 
              style={styles.input} 
            />
            <TextInput 
              mode="outlined" 
              label="State" 
              value={address.state} 
              onChangeText={(state) => setAddress(prev => ({ ...prev, state }))} 
              style={styles.input} 
            />
            <TextInput 
              mode="outlined" 
              label="ZIP Code" 
              value={address.zip} 
              onChangeText={(zip) => setAddress(prev => ({ ...prev, zip }))} 
              style={styles.input} 
            />
            <TextInput 
              mode="outlined" 
              label="Phone" 
              value={address.phone} 
              onChangeText={(phone) => setAddress(prev => ({ ...prev, phone }))} 
              style={styles.input} 
            />
            
            <View style={styles.sheetActions}>
              <Button onPress={() => setSelectedTest(null)}>Cancel</Button>
              <Button 
                mode="contained" 
                onPress={handleBook} 
                disabled={!canBook || bookMutation.isPending}
                loading={bookMutation.isPending}
              >
                Proceed to Payment
              </Button>
            </View>
          </Card.Content>
        </Card>
      )}

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
          title="Test Booking Payment"
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
  tabRow: { flexDirection: 'row', justifyContent: 'space-around', padding: 12 },
  tabBtn: { flex: 1, marginHorizontal: 6 },
  search: { marginHorizontal: 12, marginBottom: 8 },
  listPad: { padding: 12 },
  card: { marginBottom: 12, borderRadius: 14 },
  testName: { fontWeight: '700', fontSize: 16, marginBottom: 2 },
  price: { fontWeight: '600', fontSize: 18, color: '#2196F3', marginBottom: 6 },
  bookBtn: { marginTop: 10 },
  sheet: { position: 'absolute', left: 12, right: 12, bottom: 12, borderRadius: 16, elevation: 6 },
  sheetTitle: { fontWeight: '800', fontSize: 16 },
  sheetPrice: { fontWeight: '600', fontSize: 18, color: '#2196F3', marginTop: 10, marginBottom: 10 },
  input: { marginBottom: 10 },
  sheetActions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
});

export default TestsScreen; 