import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Switch,
  TouchableOpacity
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Chip,
  Surface,
  IconButton,
  Avatar
} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

interface DeliveryAgent {
  _id: string;
  firstName: string;
  lastName: string;
  agentId: string;
  status: 'available' | 'busy' | 'offline' | 'on_break';
  vehicleType: string;
  vehicleNumber: string;
  totalDeliveries: number;
  successfulDeliveries: number;
  rating: {
    average: number;
    count: number;
  };
  currentLocation?: {
    coordinates: {
      latitude: number;
      longitude: number;
    };
    lastUpdated: string;
  };
}

interface PendingDelivery {
  _id: string;
  deliveryId: string;
  status: string;
  orderId: {
    orderNumber: string;
    total: number;
    paymentMethod: string;
  };
  customerId: {
    firstName: string;
    lastName: string;
    phone: string;
  };
  deliveryLocation: {
    address: {
      street: string;
      city: string;
    };
    contactPerson: string;
    contactPhone: string;
  };
  estimatedDeliveryTime: string;
  deliveryFee: {
    totalFee: number;
    agentEarning: number;
  };
  priority: string;
  paymentMethod: string;
  codAmount?: number;
}

const DeliveryAgentDashboard: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  // Fetch agent profile
  const { data: agent, isLoading: profileLoading } = useQuery<DeliveryAgent>({
    queryKey: ['delivery-agent-profile'],
    queryFn: async () => {
      const response = await api.get('/api/delivery-agents/profile');
      return response.data.data;
    }
  });

  // Fetch pending deliveries
  const { data: pendingDeliveries, isLoading: deliveriesLoading } = useQuery<PendingDelivery[]>({
    queryKey: ['pending-deliveries'],
    queryFn: async () => {
      const response = await api.get('/api/deliveries/agent/pending');
      return response.data.data;
    }
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const response = await api.put('/api/delivery-agents/status', { status });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-agent-profile'] });
      Alert.alert('Success', 'Status updated successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'Failed to update status');
    }
  });

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['delivery-agent-profile'] }),
      queryClient.invalidateQueries({ queryKey: ['pending-deliveries'] })
    ]).finally(() => setRefreshing(false));
  }, [queryClient]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return '#4CAF50';
      case 'busy': return '#FF9800';
      case 'on_break': return '#2196F3';
      case 'offline': return '#757575';
      default: return '#757575';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return 'check-circle';
      case 'busy': return 'truck-delivery';
      case 'on_break': return 'coffee';
      case 'offline': return 'circle-off-outline';
      default: return 'help-circle';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#FF5722';
      case 'emergency': return '#F44336';
      default: return '#757575';
    }
  };

  const toggleAvailability = () => {
    if (!agent) return;
    
    const newStatus = agent.status === 'available' ? 'offline' : 'available';
    updateStatusMutation.mutate(newStatus);
  };

  const handleStatusChange = (status: string) => {
    Alert.alert(
      'Change Status',
      `Are you sure you want to change your status to ${status}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          onPress: () => updateStatusMutation.mutate(status)
        }
      ]
    );
  };

  if (profileLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!agent) {
    return (
      <View style={styles.errorContainer}>
        <Text>Error loading profile</Text>
      </View>
    );
  }

  const successRate = agent.totalDeliveries > 0 
    ? Math.round((agent.successfulDeliveries / agent.totalDeliveries) * 100)
    : 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Agent Status Card */}
      <Card style={styles.statusCard}>
        <Card.Content>
          <View style={styles.agentHeader}>
            <Avatar.Text 
              size={60} 
              label={`${agent.firstName[0]}${agent.lastName[0]}`} 
              style={styles.avatar}
            />
            <View style={styles.agentInfo}>
              <Title style={styles.agentName}>
                {agent.firstName} {agent.lastName}
              </Title>
              <Paragraph style={styles.agentId}>ID: {agent.agentId}</Paragraph>
              <View style={styles.statusContainer}>
                <Icon
                  name={getStatusIcon(agent.status)}
                  size={16}
                  color={getStatusColor(agent.status)}
                />
                <Text style={[styles.statusText, { color: getStatusColor(agent.status) }]}>
                  {agent.status.toUpperCase()}
                </Text>
              </View>
            </View>
            <Switch
              value={agent.status === 'available'}
              onValueChange={toggleAvailability}
              disabled={updateStatusMutation.isPending}
            />
          </View>

          <View style={styles.vehicleInfo}>
            <Icon name="motorbike" size={20} color="#666" />
            <Text style={styles.vehicleText}>
              {agent.vehicleType.toUpperCase()} - {agent.vehicleNumber}
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <Surface style={styles.statCard}>
          <Text style={styles.statNumber}>{agent.totalDeliveries}</Text>
          <Text style={styles.statLabel}>Total Deliveries</Text>
        </Surface>
        <Surface style={styles.statCard}>
          <Text style={styles.statNumber}>{successRate}%</Text>
          <Text style={styles.statLabel}>Success Rate</Text>
        </Surface>
        <Surface style={styles.statCard}>
          <Text style={styles.statNumber}>{agent.rating.average.toFixed(1)}</Text>
          <Text style={styles.statLabel}>Rating</Text>
        </Surface>
      </View>

      {/* Status Actions */}
      <Card style={styles.actionCard}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Quick Actions</Title>
          <View style={styles.actionButtons}>
            <Button
              mode="outlined"
              onPress={() => handleStatusChange('on_break')}
              disabled={updateStatusMutation.isPending}
              style={styles.actionButton}
            >
              Take Break
            </Button>
            <Button
              mode="outlined"
              onPress={() => handleStatusChange('offline')}
              disabled={updateStatusMutation.isPending}
              style={styles.actionButton}
            >
              Go Offline
            </Button>
          </View>
        </Card.Content>
      </Card>

      {/* Pending Deliveries */}
      <Card style={styles.deliveriesCard}>
        <Card.Content>
          <View style={styles.sectionHeader}>
            <Title style={styles.sectionTitle}>Pending Deliveries</Title>
            <Chip mode="outlined">
              {pendingDeliveries?.length || 0}
            </Chip>
          </View>

          {deliveriesLoading ? (
            <Text style={styles.loadingText}>Loading deliveries...</Text>
          ) : pendingDeliveries && pendingDeliveries.length > 0 ? (
            pendingDeliveries.map((delivery) => (
              <Card key={delivery._id} style={styles.deliveryCard}>
                <Card.Content>
                  <View style={styles.deliveryHeader}>
                    <View>
                      <Text style={styles.orderNumber}>
                        {delivery.orderId.orderNumber}
                      </Text>
                      <Text style={styles.customerName}>
                        {delivery.customerId.firstName} {delivery.customerId.lastName}
                      </Text>
                    </View>
                    <View style={styles.deliveryActions}>
                      {delivery.priority !== 'normal' && (
                        <Chip
                          mode="flat"
                          textStyle={{ color: getPriorityColor(delivery.priority) }}
                          style={{ backgroundColor: `${getPriorityColor(delivery.priority)}20` }}
                        >
                          {delivery.priority.toUpperCase()}
                        </Chip>
                      )}
                      <Chip mode="outlined" style={styles.statusChip}>
                        {delivery.status}
                      </Chip>
                    </View>
                  </View>

                  <View style={styles.deliveryDetails}>
                    <View style={styles.detailRow}>
                      <Icon name="map-marker" size={16} color="#666" />
                      <Text style={styles.detailText}>
                        {delivery.deliveryLocation.address.street}, {delivery.deliveryLocation.address.city}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Icon name="phone" size={16} color="#666" />
                      <Text style={styles.detailText}>
                        {delivery.deliveryLocation.contactPhone}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Icon name="cash" size={16} color="#666" />
                      <Text style={styles.detailText}>
                        Earning: ₹{delivery.deliveryFee.agentEarning}
                        {delivery.paymentMethod === 'cod' && (
                          <Text style={styles.codText}> (COD: ₹{delivery.codAmount})</Text>
                        )}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.deliveryActions}>
                    <Button
                      mode="contained"
                      onPress={() => {
                        // Navigate to delivery details
                      }}
                      style={styles.viewButton}
                    >
                      View Details
                    </Button>
                  </View>
                </Card.Content>
              </Card>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Icon name="truck-delivery-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No pending deliveries</Text>
              <Text style={styles.emptySubtext}>
                You'll see new delivery assignments here
              </Text>
            </View>
          )}
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCard: {
    marginBottom: 16,
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    marginRight: 16,
  },
  agentInfo: {
    flex: 1,
  },
  agentName: {
    fontSize: 18,
    marginBottom: 4,
  },
  agentId: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  vehicleText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    borderRadius: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  actionCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  deliveriesCard: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingText: {
    textAlign: 'center',
    color: '#666',
    padding: 20,
  },
  deliveryCard: {
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  customerName: {
    fontSize: 14,
    color: '#666',
  },
  deliveryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusChip: {
    marginLeft: 8,
  },
  deliveryDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  codText: {
    color: '#FF9800',
    fontWeight: 'bold',
  },
  viewButton: {
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default DeliveryAgentDashboard;
