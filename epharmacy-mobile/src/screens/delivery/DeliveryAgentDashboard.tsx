import React, { useState, useEffect } from 'react';
import { View, FlatList, RefreshControl, StyleSheet, Alert, Linking } from 'react-native';
import { Text, Button, Card, ActivityIndicator, Chip, Surface, SegmentedButtons, Modal, Portal } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import api from '../../services/api';

interface AvailableOrder {
  _id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  customer: {
    firstName: string;
    lastName: string;
    phone: string;
  };
  pharmacy: {
    firstName: string;
    lastName: string;
  };
  deliveryAddress: {
    street: string;
    city: string;
    phone: string;
    name?: string;
  };
  distanceFromAgent?: number;
}

interface DeliveryOrder {
  _id: string;
  orderId: {
    orderNumber: string;
    total: number;
  };
  status: 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
  pickupLocation: {
    address: string;
    contactName: string;
    contactPhone: string;
  };
  deliveryLocation: {
    address: string;
    contactName: string;
    contactPhone: string;
  };
  distance: number;
  estimatedTime: number;
  deliveryFee: number;
  assignedAt: string;
  pickedUpAt?: string;
  deliveredAt?: string;
}

const DeliveryAgentDashboard = () => {
  const [activeTab, setActiveTab] = useState('available');
  const [location, setLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryOrder | null>(null);
  const queryClient = useQueryClient();

  // Get current location on component mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          setLocation(loc.coords);
        }
      } catch (error) {
        console.log('Location error:', error);
      }
    })();
  }, []);

  // Available orders query
  const { data: availableOrders, isLoading: loadingAvailable, refetch: refetchAvailable, isRefetching: isRefreshingAvailable } = useQuery({
    queryKey: ['availableOrders', location?.latitude, location?.longitude],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (location) {
        params.append('lat', location.latitude.toString());
        params.append('lng', location.longitude.toString());
      }
      const res = await api.get(`/api/deliveries/available?${params.toString()}`);
      return res.data?.data?.orders || [];
    },
    enabled: activeTab === 'available'
  });

  // Assigned deliveries query
  const { data: myDeliveries, isLoading: loadingDeliveries, refetch: refetchDeliveries, isRefetching: isRefreshingDeliveries } = useQuery({
    queryKey: ['assignedDeliveries'],
    queryFn: async () => {
      const res = await api.get('/api/deliveries');
      return res.data?.data?.deliveries || [];
    },
    enabled: activeTab === 'assigned'
  });

  // Update delivery status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ deliveryId, status }: { deliveryId: string; status: string }) => {
      const res = await api.put(`/api/deliveries/${deliveryId}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignedDeliveries'] });
      setShowStatusModal(false);
      setSelectedDelivery(null);
      Alert.alert('Success', 'Delivery status updated successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'Failed to update status');
    }
  });

  // Self-assignment mutation
  const assignSelfMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await api.post('/api/deliveries/assign-self', { orderId });
      return res.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Order assigned successfully!');
      queryClient.invalidateQueries({ queryKey: ['availableOrders'] });
      queryClient.invalidateQueries({ queryKey: ['assignedDeliveries'] });
      setActiveTab('assigned'); // Switch to assigned tab
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'Failed to assign order');
    }
  });

  const handleAssignSelf = (orderId: string, orderNumber: string) => {
    Alert.alert(
      'Assign Order',
      `Do you want to assign order ${orderNumber} to yourself?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Assign', 
          onPress: () => assignSelfMutation.mutate(orderId)
        }
      ]
    );
  };

  const renderAvailableOrderCard = ({ item: order }: { item: AvailableOrder }) => {
    return (
      <Card style={styles.card} mode="outlined">
        <Card.Content>
          <View style={styles.cardHeader}>
            <Text style={styles.orderNumber}>{order.orderNumber}</Text>
            <Chip mode="outlined" textStyle={styles.chipText}>
              {order.status}
            </Chip>
          </View>
          
          <View style={styles.infoRow}>
            <Icon name="person" size={16} color="#666" />
            <Text style={styles.infoText}>
              {order.customer?.firstName} {order.customer?.lastName}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <Icon name="phone" size={16} color="#666" />
            <Text style={styles.infoText}>{order.customer?.phone}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Icon name="location-on" size={16} color="#666" />
            <Text style={styles.infoText} numberOfLines={2}>
              {order.deliveryAddress?.street}, {order.deliveryAddress?.city}
            </Text>
          </View>
          
          {order.distanceFromAgent && (
            <View style={styles.infoRow}>
              <Icon name="near-me" size={16} color="#4CAF50" />
              <Text style={[styles.infoText, { color: '#4CAF50', fontWeight: 'bold' }]}>
                {order.distanceFromAgent} km away
              </Text>
            </View>
          )}
          
          <View style={styles.infoRow}>
            <Icon name="local-pharmacy" size={16} color="#666" />
            <Text style={styles.infoText}>
              {order.pharmacy?.firstName} {order.pharmacy?.lastName}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <Icon name="attach-money" size={16} color="#666" />
            <Text style={styles.infoText}>₹{order.totalAmount}</Text>
          </View>
        </Card.Content>
        
        <Card.Actions>
          <Button 
            mode="contained" 
            onPress={() => handleAssignSelf(order._id, order.orderNumber)}
            loading={assignSelfMutation.isPending}
            disabled={assignSelfMutation.isPending}
            style={styles.assignButton}
          >
            Assign to Me
          </Button>
        </Card.Actions>
      </Card>
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned': return '#2196F3';
      case 'picked_up': return '#FF9800';
      case 'in_transit': return '#9C27B0';
      case 'delivered': return '#4CAF50';
      case 'cancelled': return '#F44336';
      default: return '#999';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'assigned': return 'assignment';
      case 'picked_up': return 'local-shipping';
      case 'in_transit': return 'directions-car';
      case 'delivered': return 'check-circle';
      case 'cancelled': return 'cancel';
      default: return 'info';
    }
  };

  const renderDeliveryCard = ({ item: delivery }: { item: DeliveryOrder }) => {
    return (
      <Card style={styles.card}>
        <Card.Title 
          title={`Order #${delivery.orderId?.orderNumber || 'N/A'}`}
          subtitle={`₹${delivery.orderId?.total || 0} • ${delivery.distance?.toFixed(1)}km • ${delivery.estimatedTime}min`}
          left={() => (
            <Icon 
              name={getStatusIcon(delivery.status)} 
              size={24} 
              color={getStatusColor(delivery.status)} 
            />
          )}
          right={() => (
            <Chip 
              mode="flat" 
              textStyle={{ color: getStatusColor(delivery.status) }}
              style={{ backgroundColor: `${getStatusColor(delivery.status)}20` }}
            >
              {delivery.status.replace('_', ' ')}
            </Chip>
          )}
        />
        
        <Card.Content>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pickup</Text>
            <View style={styles.locationInfo}>
              <Icon name="store" size={16} color="#666" />
              <View style={styles.locationText}>
                <Text style={styles.locationAddress}>{delivery.pickupLocation?.address}</Text>
                <Text style={styles.locationContact}>
                  {delivery.pickupLocation?.contactName} • {delivery.pickupLocation?.contactPhone}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery</Text>
            <View style={styles.locationInfo}>
              <Icon name="home" size={16} color="#666" />
              <View style={styles.locationText}>
                <Text style={styles.locationAddress}>{delivery.deliveryLocation?.address}</Text>
                <Text style={styles.locationContact}>
                  {delivery.deliveryLocation?.contactName} • {delivery.deliveryLocation?.contactPhone}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Icon name="schedule" size={20} color="#FF9800" />
              <Text style={styles.statText}>{delivery.estimatedTime} min</Text>
            </View>
            <View style={styles.stat}>
              <Icon name="straighten" size={20} color="#2196F3" />
              <Text style={styles.statText}>{delivery.distance} km</Text>
            </View>
            <View style={styles.stat}>
              <Icon name="payment" size={20} color="#4CAF50" />
              <Text style={styles.statText}>₹{delivery.deliveryFee}</Text>
            </View>
          </View>
        </Card.Content>

        <Card.Actions>
          <Button 
            mode="outlined" 
            style={styles.actionButton}
            onPress={() => {
              const phoneUrl = `tel:${delivery.deliveryLocation.contactPhone}`;
              Linking.openURL(phoneUrl).catch(() => 
                Alert.alert('Error', 'Could not open phone app')
              );
            }}
          >
            Call Customer
          </Button>
          <Button 
            mode="contained" 
            style={styles.actionButton}
            onPress={() => {
              setSelectedDelivery(delivery);
              setShowStatusModal(true);
            }}
            loading={updateStatusMutation.isPending && selectedDelivery?._id === delivery._id}
          >
            Update Status
          </Button>
        </Card.Actions>
      </Card>
    );
  };

  const isLoading = activeTab === 'available' ? loadingAvailable : loadingDeliveries;
  const isRefreshing = activeTab === 'available' ? isRefreshingAvailable : isRefreshingDeliveries;
  const onRefresh = activeTab === 'available' ? refetchAvailable : refetchDeliveries;
  const data = activeTab === 'available' ? availableOrders : myDeliveries;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF9800" />
        <Text style={styles.loadingText}>
          {activeTab === 'available' ? 'Loading available orders...' : 'Loading deliveries...'}
        </Text>
      </View>
    );
  }

  const statusOptions = [
    { label: 'Picked Up', value: 'picked_up', color: '#2196F3' },
    { label: 'In Transit', value: 'in_transit', color: '#FF9800' },
    { label: 'Delivered', value: 'delivered', color: '#4CAF50' },
    { label: 'Failed', value: 'failed', color: '#F44336' }
  ];

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={activeTab}
        onValueChange={setActiveTab}
        buttons={[
          {
            value: 'available',
            label: 'Available Orders',
            icon: 'shopping-outline',
          },
          {
            value: 'assigned',
            label: 'My Deliveries',
            icon: 'delivery-dining',
          },
        ]}
        style={styles.segmentedButtons}
      />

      <FlatList
        data={data}
        renderItem={({ item }) => activeTab === 'available' ? renderAvailableOrderCard({ item: item as AvailableOrder }) : renderDeliveryCard({ item: item as DeliveryOrder })}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={['#FF9800']}
          />
        }
        ListEmptyComponent={
          <Surface style={styles.emptyContainer}>
            <Icon 
              name={activeTab === 'available' ? 'shopping-cart' : 'delivery-dining'} 
              size={64} 
              color="#ccc" 
            />
            <Text style={styles.emptyText}>
              {activeTab === 'available' ? 'No orders available' : 'No deliveries assigned yet'}
            </Text>
            <Text style={styles.emptySubText}>
              {activeTab === 'available' 
                ? 'Check back later for new delivery opportunities'
                : 'Assigned deliveries will appear here'
              }
            </Text>
          </Surface>
        }
      />

      {/* Status Update Modal */}
      <Portal>
        <Modal
          visible={showStatusModal}
          onDismiss={() => setShowStatusModal(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>Update Delivery Status</Text>
          <Text style={styles.modalSubtitle}>
            Order: {selectedDelivery?.orderId?.orderNumber}
          </Text>
          
          <View style={styles.statusButtonsContainer}>
            {statusOptions.map((option) => (
              <Button
                key={option.value}
                mode="contained"
                style={[styles.statusButton, { backgroundColor: option.color }]}
                onPress={() => {
                  if (selectedDelivery) {
                    updateStatusMutation.mutate({
                      deliveryId: selectedDelivery._id,
                      status: option.value
                    });
                  }
                }}
                loading={updateStatusMutation.isPending}
              >
                {option.label}
              </Button>
            ))}
          </View>

          <Button
            mode="outlined"
            onPress={() => setShowStatusModal(false)}
            style={styles.modalCancelButton}
          >
            Cancel
          </Button>
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  segmentedButtons: {
    margin: 16,
    marginBottom: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  listContainer: {
    padding: 16,
    paddingTop: 8,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  chipText: {
    fontSize: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  assignButton: {
    backgroundColor: '#4CAF50',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationText: {
    marginLeft: 8,
    flex: 1,
  },
  locationAddress: {
    fontSize: 14,
    color: '#333',
    marginBottom: 2,
  },
  locationContact: {
    fontSize: 12,
    color: '#666',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  stat: {
    alignItems: 'center',
  },
  statText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  actionButton: {
    marginLeft: 8,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    elevation: 1,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
  },
  statusButtonsContainer: {
    marginBottom: 20,
  },
  statusButton: {
    marginVertical: 4,
  },
  modalCancelButton: {
    marginTop: 10,
  },
});

export default DeliveryAgentDashboard;