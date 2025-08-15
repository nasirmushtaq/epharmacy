import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  Platform
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Chip,
  TextInput,
  Modal,
  Portal,
  ActivityIndicator
} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useNavigation } from '@react-navigation/native';
import api from '../../services/api';

interface DeliveryDetail {
  _id: string;
  deliveryId: string;
  status: string;
  orderId: {
    _id: string;
    orderNumber: string;
    items: Array<{
      product: any;
      quantity: number;
      price: number;
    }>;
    total: number;
    paymentMethod: string;
  };
  customerId: {
    firstName: string;
    lastName: string;
    phone: string;
  };
  pharmacyId: {
    firstName: string;
    lastName: string;
    phone: string;
  };
  pickupLocation: {
    address: any;
    coordinates: {
      latitude: number;
      longitude: number;
    };
    contactPerson: string;
    contactPhone: string;
  };
  deliveryLocation: {
    address: any;
    coordinates: {
      latitude: number;
      longitude: number;
    };
    contactPerson: string;
    contactPhone: string;
    specialInstructions?: string;
  };
  distanceDetails: {
    totalDistance: number;
    estimatedTime: number;
  };
  deliveryFee: {
    totalFee: number;
    agentEarning: number;
  };
  estimatedDeliveryTime: string;
  timeline: Array<{
    status: string;
    timestamp: string;
    notes?: string;
  }>;
  paymentMethod: string;
  codAmount?: number;
  deliveryOTP?: {
    code: string;
    expiresAt: string;
  };
}

const DeliveryDetailScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { deliveryId } = route.params as { deliveryId: string };

  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionType, setActionType] = useState<'accept' | 'pickup' | 'transit' | 'deliver'>('accept');
  const [notes, setNotes] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Fetch delivery details
  const { data: delivery, isLoading, error } = useQuery<DeliveryDetail>({
    queryKey: ['delivery-detail', deliveryId],
    queryFn: async () => {
      const response = await api.get(`/api/deliveries/${deliveryId}`);
      return response.data.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Action mutations
  const acceptDeliveryMutation = useMutation({
    mutationFn: async () => {
      const response = await api.put(`/api/deliveries/${deliveryId}/accept`);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['delivery-detail', deliveryId] });
      queryClient.invalidateQueries({ queryKey: ['pending-deliveries'] });
      Alert.alert('Success', 'Delivery accepted successfully');
      setActionModalVisible(false);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'Failed to accept delivery');
    }
  });

  const pickupDeliveryMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.put(`/api/deliveries/${deliveryId}/pickup`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-detail', deliveryId] });
      Alert.alert('Success', 'Order marked as picked up');
      setActionModalVisible(false);
      setNotes('');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'Failed to mark as picked up');
    }
  });

  const transitDeliveryMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.put(`/api/deliveries/${deliveryId}/in-transit`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-detail', deliveryId] });
      Alert.alert('Success', 'Delivery marked as in transit');
      setActionModalVisible(false);
      setNotes('');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'Failed to mark as in transit');
    }
  });

  const completeDeliveryMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.put(`/api/deliveries/${deliveryId}/deliver`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-detail', deliveryId] });
      queryClient.invalidateQueries({ queryKey: ['pending-deliveries'] });
      Alert.alert('Success', 'Delivery completed successfully');
      setActionModalVisible(false);
      setNotes('');
      setOtpInput('');
      navigation.goBack();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'Failed to complete delivery');
    }
  });

  useEffect(() => {
    // Get current location
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.warn('Location error:', error);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    }
  }, []);

  const handleAction = () => {
    if (!currentLocation) {
      Alert.alert('Error', 'Location is required for this action');
      return;
    }

    const actionData = {
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      notes: notes || undefined
    };

    switch (actionType) {
      case 'accept':
        acceptDeliveryMutation.mutate();
        break;
      case 'pickup':
        pickupDeliveryMutation.mutate(actionData);
        break;
      case 'transit':
        transitDeliveryMutation.mutate(actionData);
        break;
      case 'deliver':
        if (delivery?.deliveryOTP && !otpInput) {
          Alert.alert('Error', 'OTP is required for delivery completion');
          return;
        }
        completeDeliveryMutation.mutate({
          ...actionData,
          otp: otpInput || undefined
        });
        break;
    }
  };

  const openMaps = (location: any, label: string) => {
    const { latitude, longitude } = location.coordinates;
    const url = Platform.select({
      ios: `maps:${latitude},${longitude}?q=${label}`,
      android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`
    });

    if (url) {
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Unable to open maps');
      });
    }
  };

  const callContact = (phone: string) => {
    const url = `tel:${phone}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to make call');
    });
  };

  const getActionButton = () => {
    if (!delivery) return null;

    switch (delivery.status) {
      case 'assigned':
        return (
          <Button
            mode="contained"
            onPress={() => {
              setActionType('accept');
              setActionModalVisible(true);
            }}
            style={styles.actionButton}
          >
            Accept Delivery
          </Button>
        );
      case 'accepted':
        return (
          <Button
            mode="contained"
            onPress={() => {
              setActionType('pickup');
              setActionModalVisible(true);
            }}
            style={styles.actionButton}
          >
            Mark as Picked Up
          </Button>
        );
      case 'picked_up':
        return (
          <Button
            mode="contained"
            onPress={() => {
              setActionType('transit');
              setActionModalVisible(true);
            }}
            style={styles.actionButton}
          >
            Start Delivery
          </Button>
        );
      case 'in_transit':
        return (
          <Button
            mode="contained"
            onPress={() => {
              setActionType('deliver');
              setActionModalVisible(true);
            }}
            style={styles.actionButton}
          >
            Complete Delivery
          </Button>
        );
      default:
        return null;
    }
  };

  const getActionTitle = () => {
    switch (actionType) {
      case 'accept': return 'Accept Delivery';
      case 'pickup': return 'Mark as Picked Up';
      case 'transit': return 'Start Delivery';
      case 'deliver': return 'Complete Delivery';
      default: return 'Action';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading delivery details...</Text>
      </View>
    );
  }

  if (error || !delivery) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="alert-circle" size={48} color="#F44336" />
        <Text style={styles.errorText}>Failed to load delivery details</Text>
        <Button mode="outlined" onPress={() => navigation.goBack()}>
          Go Back
        </Button>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container}>
        {/* Delivery Header */}
        <Card style={styles.headerCard}>
          <Card.Content>
            <View style={styles.headerRow}>
              <View>
                <Title style={styles.deliveryId}>{delivery.deliveryId}</Title>
                <Paragraph style={styles.orderNumber}>
                  Order: {delivery.orderId.orderNumber}
                </Paragraph>
              </View>
              <Chip mode="outlined" style={styles.statusChip}>
                {delivery.status.toUpperCase()}
              </Chip>
            </View>
            
            <View style={styles.earningsRow}>
              <Icon name="cash" size={20} color="#4CAF50" />
              <Text style={styles.earningsText}>
                Your Earning: ₹{delivery.deliveryFee.agentEarning}
              </Text>
              {delivery.paymentMethod === 'cod' && (
                <Chip mode="flat" style={styles.codChip}>
                  COD: ₹{delivery.codAmount}
                </Chip>
              )}
            </View>
          </Card.Content>
        </Card>

        {/* Customer Info */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Customer Details</Title>
            <View style={styles.contactRow}>
              <Icon name="account" size={24} color="#2196F3" />
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>
                  {delivery.customerId.firstName} {delivery.customerId.lastName}
                </Text>
                <Text style={styles.contactPhone}>{delivery.customerId.phone}</Text>
              </View>
              <Button
                mode="outlined"
                compact
                onPress={() => callContact(delivery.customerId.phone)}
              >
                Call
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Pickup Location */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Pickup Location</Title>
            <View style={styles.locationRow}>
              <Icon name="store" size={24} color="#FF9800" />
              <View style={styles.locationInfo}>
                <Text style={styles.locationTitle}>
                  {delivery.pickupLocation.contactPerson}
                </Text>
                <Text style={styles.locationAddress}>
                  {delivery.pickupLocation.address.street}, {delivery.pickupLocation.address.city}
                </Text>
                <Text style={styles.locationPhone}>
                  {delivery.pickupLocation.contactPhone}
                </Text>
              </View>
            </View>
            <View style={styles.locationActions}>
              <Button
                mode="outlined"
                compact
                onPress={() => openMaps(delivery.pickupLocation, 'Pickup Location')}
                style={styles.locationButton}
              >
                Navigate
              </Button>
              <Button
                mode="outlined"
                compact
                onPress={() => callContact(delivery.pickupLocation.contactPhone)}
                style={styles.locationButton}
              >
                Call
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Delivery Location */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Delivery Location</Title>
            <View style={styles.locationRow}>
              <Icon name="home" size={24} color="#4CAF50" />
              <View style={styles.locationInfo}>
                <Text style={styles.locationTitle}>
                  {delivery.deliveryLocation.contactPerson}
                </Text>
                <Text style={styles.locationAddress}>
                  {delivery.deliveryLocation.address.street}, {delivery.deliveryLocation.address.city}
                </Text>
                <Text style={styles.locationPhone}>
                  {delivery.deliveryLocation.contactPhone}
                </Text>
                {delivery.deliveryLocation.specialInstructions && (
                  <Text style={styles.specialInstructions}>
                    Note: {delivery.deliveryLocation.specialInstructions}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.locationActions}>
              <Button
                mode="outlined"
                compact
                onPress={() => openMaps(delivery.deliveryLocation, 'Delivery Location')}
                style={styles.locationButton}
              >
                Navigate
              </Button>
              <Button
                mode="outlined"
                compact
                onPress={() => callContact(delivery.deliveryLocation.contactPhone)}
                style={styles.locationButton}
              >
                Call
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Order Items */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Order Items</Title>
            {delivery.orderId.items.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <Text style={styles.itemName}>
                  {item.product?.name || 'Unknown Item'}
                </Text>
                <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                <Text style={styles.itemPrice}>₹{item.price}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount:</Text>
              <Text style={styles.totalAmount}>₹{delivery.orderId.total}</Text>
            </View>
          </Card.Content>
        </Card>

        {/* Delivery Info */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Delivery Information</Title>
            <View style={styles.infoRow}>
              <Icon name="map-marker-distance" size={20} color="#666" />
              <Text style={styles.infoText}>
                Distance: {delivery.distanceDetails.totalDistance} km
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Icon name="clock" size={20} color="#666" />
              <Text style={styles.infoText}>
                Estimated Time: {delivery.distanceDetails.estimatedTime} mins
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Icon name="calendar-clock" size={20} color="#666" />
              <Text style={styles.infoText}>
                Expected Delivery: {new Date(delivery.estimatedDeliveryTime).toLocaleString()}
              </Text>
            </View>
            {delivery.deliveryOTP && (
              <View style={styles.otpContainer}>
                <Icon name="lock" size={20} color="#FF9800" />
                <Text style={styles.otpText}>
                  Delivery OTP: {delivery.deliveryOTP.code}
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Timeline */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Status Timeline</Title>
            {delivery.timeline.map((event, index) => (
              <View key={index} style={styles.timelineEvent}>
                <View style={styles.timelineIndicator} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineStatus}>{event.status}</Text>
                  <Text style={styles.timelineTime}>
                    {new Date(event.timestamp).toLocaleString()}
                  </Text>
                  {event.notes && (
                    <Text style={styles.timelineNotes}>{event.notes}</Text>
                  )}
                </View>
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Action Button */}
        <View style={styles.actionContainer}>
          {getActionButton()}
        </View>
      </ScrollView>

      {/* Action Modal */}
      <Portal>
        <Modal
          visible={actionModalVisible}
          onDismiss={() => setActionModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Title style={styles.modalTitle}>{getActionTitle()}</Title>
          
          {actionType !== 'accept' && (
            <TextInput
              label="Notes (Optional)"
              value={notes}
              onChangeText={setNotes}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.notesInput}
            />
          )}

          {actionType === 'deliver' && delivery?.deliveryOTP && (
            <TextInput
              label="Delivery OTP"
              value={otpInput}
              onChangeText={setOtpInput}
              mode="outlined"
              keyboardType="numeric"
              style={styles.otpInput}
              placeholder="Enter 6-digit OTP"
            />
          )}

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setActionModalVisible(false)}
              style={styles.modalButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleAction}
              loading={
                acceptDeliveryMutation.isPending ||
                pickupDeliveryMutation.isPending ||
                transitDeliveryMutation.isPending ||
                completeDeliveryMutation.isPending
              }
              style={styles.modalButton}
            >
              Confirm
            </Button>
          </View>
        </Modal>
      </Portal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    marginVertical: 16,
    textAlign: 'center',
  },
  headerCard: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  deliveryId: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  orderNumber: {
    fontSize: 14,
    color: '#666',
  },
  statusChip: {
    alignSelf: 'flex-start',
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  earningsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    flex: 1,
  },
  codChip: {
    backgroundColor: '#FF980020',
  },
  card: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: 12,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  contactPhone: {
    fontSize: 14,
    color: '#666',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  locationInfo: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  locationPhone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  specialInstructions: {
    fontSize: 14,
    color: '#FF9800',
    fontStyle: 'italic',
  },
  locationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  locationButton: {
    flex: 1,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemName: {
    flex: 1,
    fontSize: 14,
  },
  itemQuantity: {
    fontSize: 14,
    color: '#666',
    marginHorizontal: 8,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#ddd',
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
  },
  otpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FFF3E0',
    borderRadius: 4,
    gap: 8,
  },
  otpText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF9800',
  },
  timelineEvent: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2196F3',
    marginTop: 4,
    marginRight: 12,
  },
  timelineContent: {
    flex: 1,
  },
  timelineStatus: {
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  timelineTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  timelineNotes: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  actionContainer: {
    paddingBottom: 20,
  },
  actionButton: {
    paddingVertical: 8,
  },
  modalContainer: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  modalTitle: {
    fontSize: 18,
    marginBottom: 16,
  },
  notesInput: {
    marginBottom: 16,
  },
  otpInput: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
  },
});

export default DeliveryDetailScreen;
