import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import {
  Card,
  Text,
  Button,
  IconButton,
  Surface,
  Divider,
  Chip,
  Searchbar,
  ActivityIndicator,
} from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  orderNumber: string;
  date: string;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  total: number;
  items: OrderItem[];
  deliveryAddress: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
}

const OrdersScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [detailsData, setDetailsData] = useState<any>(null);

  // Fetch orders from API
  const { data: orders = [], isLoading, error, refetch } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const response = await api.get('/api/orders/my-orders');
      console.log('📦 Orders API response:', response.data);
      const ordersData = response.data.data || [];
      console.log('📦 Orders data:', ordersData);
      console.log('📦 Number of orders:', ordersData.length);
      if (ordersData.length > 0) {
        console.log('📦 First order structure:', ordersData[0]);
      }
      return ordersData;
    }
  });

  const statusColors: Record<string, string> = {
    pending: '#FF9800',
    confirmed: '#2196F3',
    processing: '#9C27B0',
    out_for_delivery: '#3F51B5',
    delivered: '#4CAF50',
    cancelled: '#F44336'
  };

  // Use any where backend returns dynamic shapes
  const filteredOrders = (orders as any[]).filter((order: any) => {
    const matchesSearch = order.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         order.items?.some((item: any) => 
                           item.medicine?.name?.toLowerCase().includes(searchQuery.toLowerCase())
                         );
    const matchesStatus = selectedStatus === 'all' || order.status === selectedStatus;
    console.log(`📦 Order ${order.orderNumber}: search=${matchesSearch}, status=${matchesStatus}`);
    return matchesSearch && matchesStatus;
  });

  console.log('📦 Total orders:', orders.length);
  console.log('📦 Filtered orders:', filteredOrders.length);

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Order Placed';
      case 'confirmed': return 'Confirmed';
      case 'processing': return 'Processing';
      case 'shipped': return 'Shipped';
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const handleTrackOrder = async (order: any) => {
    try {
      const orderId = order._id || order.id;
      if (!orderId) {
        Alert.alert('Error', 'Order ID not found');
        return;
      }
      const response = await api.get(`/api/orders/${orderId}`);
      const od = response.data.order || response.data.data || response.data;
      setDetailsData(od);
      setDetailsVisible(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch order details');
    }
  };

  const handleReorder = async (order: any) => {
    Alert.alert(
      'Reorder Items',
      `Add all items from order ${order.orderNumber} to cart?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add to Cart', onPress: async () => {
          try {
            await api.post(`/api/orders/${order._id}/reorder`);
            Alert.alert('Success', 'Items added to cart!');
          } catch (error) {
            Alert.alert('Error', 'Failed to add items to cart');
          }
        }}
      ]
    );
  };

  const handleCancelOrder = async (order: any) => {
    if (order.status === 'pending') {
      Alert.alert(
        'Cancel Order',
        `Are you sure you want to cancel order ${order.orderNumber}?`,
        [
          { text: 'No', style: 'cancel' },
          { text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
            try {
              const response = await api.patch(`/api/orders/${order._id}/cancel`, { reason: 'Cancelled by customer' });
              if (response.data.success) {
                Alert.alert('Order Cancelled', 'Your order has been cancelled successfully.');
                refetch(); // Refresh the orders list
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel order');
            }
          }}
        ]
      );
    } else {
      Alert.alert('Not Allowed', 'You can only cancel orders that are just placed (pending).');
    }
  };

  const renderOrderCard = ({ item: order }: { item: any }) => (
    <Card style={styles.orderCard}>
      <Card.Content>
        {/* Order Header */}
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderNumber}>{order.orderNumber}</Text>
            <Text style={styles.orderDate}>{new Date(order.createdAt).toLocaleDateString()}</Text>
          </View>
          {(() => { const c = statusColors[order.status] || '#607D8B'; return (
          <Chip 
            mode="flat"
            style={[styles.statusChip, { backgroundColor: ((statusColors[order.status] || '#607D8B') + '20') }]}
            textStyle={[styles.statusText, { color: statusColors[order.status] || '#607D8B' }]}
          >
            {getStatusText(order.status)}
          </Chip>
          ); })()}
        </View>

        <Divider style={styles.divider} />

        {/* Order Items */}
        <View style={styles.itemsSection}>
          <Text style={styles.sectionTitle}>Items ({order.items?.length || 0})</Text>
          {order.items?.slice(0, 2).map((item: any, index: number) => (
            <View key={item.medicine?._id || index} style={styles.itemRow}>
              <Text style={styles.itemName}>{item.medicine?.name || 'Medicine'}</Text>
              <Text style={styles.itemDetails}>Qty: {item.quantity} × ₹{item.price}</Text>
            </View>
          ))}
          {order.items?.length > 2 && (
            <Text style={styles.moreItems}>+{order.items.length - 2} more items</Text>
          )}
        </View>

        <Divider style={styles.divider} />

        {/* Order Total */}
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>Total Amount:</Text>
          <Text style={styles.totalAmount}>₹{order.totalAmount}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <Button
            mode="outlined"
            onPress={() => handleTrackOrder(order)}
            style={styles.actionButton}
            compact
          >
            Track Order
          </Button>
          <Button
            mode="outlined"
            onPress={() => handleReorder(order)}
            style={styles.actionButton}
            compact
          >
            Reorder
          </Button>
          {(order.status === 'pending' || order.status === 'confirmed') && (
            <Button
              mode="text"
              onPress={() => handleCancelOrder(order)}
              style={styles.cancelButton}
              compact
              textColor="#F44336"
            >
              Cancel
            </Button>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  const statusFilters = ['all', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading orders...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Failed to load orders</Text>
        <Button mode="contained" onPress={() => refetch()}>
          Retry
        </Button>
      </View>
    );
  }

  if (orders.length === 0) {
    return (
      <View style={styles.emptyState}>
        <IconButton icon="package-variant-closed" size={80} iconColor="#ccc" />
        <Text style={styles.emptyTitle}>No Orders Yet</Text>
        <Text style={styles.emptySubtitle}>Your order history will appear here</Text>
        <Button mode="contained" onPress={() => {}} style={styles.shopButton}>
          Start Shopping
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <Surface style={styles.searchContainer}>
        <Searchbar
          placeholder="Search orders..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />
      </Surface>

      {/* Status Filters */}
      <View style={styles.filtersContainer}>
        <FlatList
          horizontal
          data={statusFilters}
          renderItem={({ item }) => (
            <Chip
              key={item}
              mode={selectedStatus === item ? 'flat' : 'outlined'}
              selected={selectedStatus === item}
              onPress={() => setSelectedStatus(item)}
              style={styles.filterChip}
            >
              {item === 'all' ? 'All' : getStatusText(item)}
            </Chip>
          )}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
        />
      </View>

      {/* Orders List */}
      <FlatList
        data={filteredOrders}
        renderItem={renderOrderCard}
        keyExtractor={(item: any) => item._id || item.id}
        contentContainerStyle={styles.ordersList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyResults}>
            <IconButton icon="magnify" size={64} iconColor="#ccc" />
            <Text style={styles.emptyResultsText}>No orders found</Text>
            <Text style={styles.emptyResultsSubtext}>Try adjusting your search or filters</Text>
          </View>
        }
      />
      <Modal visible={detailsVisible} transparent animationType="slide" onRequestClose={() => setDetailsVisible(false)}>
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.3)', justifyContent:'flex-end' }}>
          <View style={{ backgroundColor:'#fff', borderTopLeftRadius:16, borderTopRightRadius:16, padding:16, maxHeight:'70%' }}>
            <Text variant="titleMedium">{detailsData?.orderNumber}</Text>
            <Text>Status: {getStatusText(detailsData?.status)}</Text>
            <Divider style={{ marginVertical:8 }} />
            <Text variant="titleSmall">Items</Text>
            {detailsData?.items?.map((it: any, idx: number) => (
              <View key={idx} style={{ flexDirection:'row', justifyContent:'space-between' }}>
                <Text>{it.medicine?.name || 'Medicine'}</Text>
                <Text>Qty {it.quantity} · ₹{it.price}</Text>
              </View>
            ))}
            <Divider style={{ marginVertical:8 }} />
            <Text>Total: ₹{detailsData?.totalAmount}</Text>
            <View style={{ flexDirection:'row', justifyContent:'flex-end', marginTop:12 }}>
              <Button onPress={() => setDetailsVisible(false)}>Close</Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  shopButton: {
    paddingHorizontal: 30,
  },
  searchContainer: {
    margin: 16,
    borderRadius: 12,
    elevation: 2,
  },
  searchBar: {
    backgroundColor: 'transparent',
  },
  filtersContainer: {
    marginBottom: 8,
  },
  filtersContent: {
    paddingHorizontal: 16,
  },
  filterChip: {
    marginRight: 8,
  },
  ordersList: {
    padding: 16,
  },
  orderCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  orderDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  statusChip: {
    marginLeft: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    marginVertical: 12,
  },
  itemsSection: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemName: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  itemDetails: {
    fontSize: 14,
    color: '#666',
  },
  moreItems: {
    fontSize: 12,
    color: '#2196F3',
    fontStyle: 'italic',
    marginTop: 4,
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  actionSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  actionButton: {
    minWidth: 100,
  },
  cancelButton: {
    borderColor: '#F44336',
  },
  deliveryInfo: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  deliveryText: {
    fontSize: 14,
    color: '#1976D2',
    textAlign: 'center',
  },
  emptyResults: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyResultsText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  emptyResultsSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default OrdersScreen; 