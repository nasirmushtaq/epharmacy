import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Linking,
  Platform
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Chip,
  Surface,
  ActivityIndicator
} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useQuery } from '@tanstack/react-query';
import { useRoute } from '@react-navigation/native';
import api from '../../services/api';

interface DeliveryTracking {
  deliveryId: string;
  status: string;
  estimatedDeliveryTime: string;
  deliveryAgent: {
    firstName: string;
    lastName: string;
    phone: string;
    agentId: string;
    vehicleType: string;
    vehicleNumber: string;
  };
  pickupLocation: {
    address: any;
    contactPerson: string;
  };
  deliveryLocation: {
    address: any;
    contactPerson: string;
  };
  currentLocation?: {
    coordinates: {
      latitude: number;
      longitude: number;
    };
    lastUpdated: string;
  };
  timeline: Array<{
    status: string;
    timestamp: string;
    notes?: string;
  }>;
}

const DeliveryTrackingScreen: React.FC = () => {
  const route = useRoute();
  const { deliveryId } = route.params as { deliveryId: string };
  const [refreshing, setRefreshing] = useState(false);

  // Fetch delivery tracking data
  const { data: tracking, isLoading, error, refetch } = useQuery<DeliveryTracking>({
    queryKey: ['delivery-tracking', deliveryId],
    queryFn: async () => {
      const response = await api.get(`/api/deliveries/${deliveryId}/track`);
      return response.data.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const getStatusProgress = (status: string): number => {
    const statusOrder = ['assigned', 'accepted', 'picked_up', 'in_transit', 'delivered'];
    const currentIndex = statusOrder.indexOf(status);
    return currentIndex >= 0 ? ((currentIndex + 1) / statusOrder.length) * 100 : 0;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'assigned': return '#FF9800';
      case 'accepted': return '#2196F3';
      case 'picked_up': return '#9C27B0';
      case 'in_transit': return '#FF5722';
      case 'delivered': return '#4CAF50';
      default: return '#757575';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'assigned': return 'account-check';
      case 'accepted': return 'check-circle';
      case 'picked_up': return 'package-variant-closed';
      case 'in_transit': return 'truck-delivery';
      case 'delivered': return 'check-all';
      default: return 'help-circle';
    }
  };

  const getStatusMessage = (status: string): string => {
    switch (status) {
      case 'assigned': return 'Delivery agent has been assigned to your order';
      case 'accepted': return 'Delivery agent has accepted your order';
      case 'picked_up': return 'Your order has been picked up from the pharmacy';
      case 'in_transit': return 'Your order is on the way to you';
      case 'delivered': return 'Your order has been delivered successfully';
      default: return 'Order is being processed';
    }
  };

  const openMaps = () => {
    if (!tracking?.currentLocation) return;

    const { latitude, longitude } = tracking.currentLocation.coordinates;
    const url = Platform.select({
      ios: `maps:${latitude},${longitude}?q=Delivery Agent`,
      android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(Delivery Agent)`
    });

    if (url) {
      Linking.openURL(url).catch(() => {
        console.warn('Unable to open maps');
      });
    }
  };

  const callDeliveryAgent = () => {
    if (!tracking?.deliveryAgent?.phone) return;

    const url = `tel:${tracking.deliveryAgent.phone}`;
    Linking.openURL(url).catch(() => {
      console.warn('Unable to make call');
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading delivery tracking...</Text>
      </View>
    );
  }

  if (error || !tracking) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="alert-circle" size={48} color="#F44336" />
        <Text style={styles.errorText}>Failed to load delivery tracking</Text>
        <Button mode="outlined" onPress={() => refetch()}>
          Retry
        </Button>
      </View>
    );
  }

  const progress = getStatusProgress(tracking.status);
  const statusColor = getStatusColor(tracking.status);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header Card */}
      <Card style={styles.headerCard}>
        <Card.Content>
          <View style={styles.headerRow}>
            <View>
              <Title style={styles.deliveryId}>Delivery #{tracking.deliveryId}</Title>
              <Paragraph style={styles.statusMessage}>
                {getStatusMessage(tracking.status)}
              </Paragraph>
            </View>
            <Chip
              mode="flat"
              icon={getStatusIcon(tracking.status)}
              style={[styles.statusChip, { backgroundColor: `${statusColor}20` }]}
              textStyle={{ color: statusColor }}
            >
              {tracking.status.toUpperCase()}
            </Chip>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${progress}%`,
                    backgroundColor: statusColor
                  }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>{Math.round(progress)}% Complete</Text>
          </View>

          {/* Estimated Delivery Time */}
          <View style={styles.estimatedTimeContainer}>
            <Icon name="clock-outline" size={20} color="#666" />
            <Text style={styles.estimatedTimeText}>
              Expected Delivery: {new Date(tracking.estimatedDeliveryTime).toLocaleString()}
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Delivery Agent Info */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Delivery Agent</Title>
          <View style={styles.agentRow}>
            <View style={styles.agentInfo}>
              <Text style={styles.agentName}>
                {tracking.deliveryAgent.firstName} {tracking.deliveryAgent.lastName}
              </Text>
              <Text style={styles.agentId}>ID: {tracking.deliveryAgent.agentId}</Text>
              <View style={styles.vehicleInfo}>
                <Icon name="motorbike" size={16} color="#666" />
                <Text style={styles.vehicleText}>
                  {tracking.deliveryAgent.vehicleType.toUpperCase()} - {tracking.deliveryAgent.vehicleNumber}
                </Text>
              </View>
            </View>
            <Button
              mode="contained"
              compact
              onPress={callDeliveryAgent}
              style={styles.callButton}
            >
              Call
            </Button>
          </View>
        </Card.Content>
      </Card>

      {/* Real-time Location */}
      {tracking.currentLocation && (
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.locationHeader}>
              <Title style={styles.sectionTitle}>Live Location</Title>
              <Text style={styles.lastUpdated}>
                Updated: {new Date(tracking.currentLocation.lastUpdated).toLocaleTimeString()}
              </Text>
            </View>
            <View style={styles.locationRow}>
              <Icon name="map-marker" size={24} color="#4CAF50" />
              <Text style={styles.locationText}>
                Delivery agent is currently on the way to you
              </Text>
            </View>
            <Button
              mode="outlined"
              onPress={openMaps}
              style={styles.mapButton}
              icon="map"
            >
              View on Map
            </Button>
          </Card.Content>
        </Card>
      )}

      {/* Delivery Locations */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Delivery Route</Title>
          
          {/* Pickup Location */}
          <View style={styles.routeItem}>
            <View style={styles.routeIndicator}>
              <Icon name="store" size={20} color="#FF9800" />
            </View>
            <View style={styles.routeContent}>
              <Text style={styles.routeTitle}>Pickup Location</Text>
              <Text style={styles.routeAddress}>
                {tracking.pickupLocation.address.street}, {tracking.pickupLocation.address.city}
              </Text>
              <Text style={styles.routeContact}>
                Contact: {tracking.pickupLocation.contactPerson}
              </Text>
            </View>
          </View>

          <View style={styles.routeConnector} />

          {/* Delivery Location */}
          <View style={styles.routeItem}>
            <View style={styles.routeIndicator}>
              <Icon name="home" size={20} color="#4CAF50" />
            </View>
            <View style={styles.routeContent}>
              <Text style={styles.routeTitle}>Delivery Location</Text>
              <Text style={styles.routeAddress}>
                {tracking.deliveryLocation.address.street}, {tracking.deliveryLocation.address.city}
              </Text>
              <Text style={styles.routeContact}>
                Contact: {tracking.deliveryLocation.contactPerson}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Status Timeline */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Delivery Timeline</Title>
          {tracking.timeline.map((event, index) => (
            <View key={index} style={styles.timelineEvent}>
              <View 
                style={[
                  styles.timelineIndicator,
                  { backgroundColor: getStatusColor(event.status) }
                ]} 
              />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineStatus}>
                  {event.status.replace('_', ' ').toUpperCase()}
                </Text>
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

      {/* Help Section */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Need Help?</Title>
          <Paragraph style={styles.helpText}>
            If you have any issues with your delivery, you can contact our support team.
          </Paragraph>
          <View style={styles.helpActions}>
            <Button mode="outlined" style={styles.helpButton}>
              Contact Support
            </Button>
            <Button mode="outlined" style={styles.helpButton}>
              Report Issue
            </Button>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
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
    marginBottom: 16,
  },
  deliveryId: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statusMessage: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  statusChip: {
    alignSelf: 'flex-start',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  estimatedTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  estimatedTimeText: {
    fontSize: 14,
    color: '#666',
  },
  card: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: 12,
  },
  agentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  agentInfo: {
    flex: 1,
  },
  agentName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  agentId: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  vehicleText: {
    fontSize: 12,
    color: '#666',
  },
  callButton: {
    paddingHorizontal: 16,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#666',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  mapButton: {
    alignSelf: 'flex-start',
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  routeContent: {
    flex: 1,
    paddingBottom: 16,
  },
  routeTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  routeAddress: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  routeContact: {
    fontSize: 12,
    color: '#666',
  },
  routeConnector: {
    width: 2,
    height: 20,
    backgroundColor: '#ddd',
    marginLeft: 19,
    marginVertical: 4,
  },
  timelineEvent: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 12,
  },
  timelineContent: {
    flex: 1,
  },
  timelineStatus: {
    fontSize: 14,
    fontWeight: 'bold',
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
  helpText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  helpActions: {
    flexDirection: 'row',
    gap: 8,
  },
  helpButton: {
    flex: 1,
  },
});

export default DeliveryTrackingScreen;
