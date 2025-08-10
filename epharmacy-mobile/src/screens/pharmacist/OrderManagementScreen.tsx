import React, { useState } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import { Card, Text, Button, IconButton, Surface, Divider, TextInput, Chip, Searchbar, ActivityIndicator } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

interface OrderItem { medicine?: { _id: string; name: string }; quantity: number; price: number }
interface Order { _id: string; orderNumber: string; status: string; items: OrderItem[]; totalAmount: number; createdAt: string }

const OrderManagementScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'pending' | 'confirmed' | 'processing' | 'out_for_delivery' | 'delivered' | 'cancelled'>('pending');
  const [statusNotes, setStatusNotes] = useState('');
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading, error, refetch } = useQuery({
    queryKey: ['pharmOrders', selectedStatus],
    queryFn: async (): Promise<Order[]> => {
      if (selectedStatus === 'pending') {
        const res = await api.get('/api/orders/status/pending');
        return res.data.data || [];
      }
      // Fallback to my-orders for simplicity
      const res = await api.get('/api/orders/my-orders');
      return res.data.data || [];
    }
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => api.patch(`/api/orders/${id}/status`, { status, notes: statusNotes || '' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pharmOrders'] }),
  });

  const renderItem = ({ item: order }: { item: Order }) => (
    <Card style={{ margin: 12 }}>
      <Card.Content>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <Text variant="titleMedium">{order.orderNumber}</Text>
            <Text variant="bodySmall">{new Date(order.createdAt).toLocaleDateString()}</Text>
          </View>
          <Chip>{order.status}</Chip>
        </View>
        <Divider style={{ marginVertical: 8 }} />
        <Text variant="bodyMedium">Items: {order.items?.length || 0}</Text>
        <Text variant="bodyMedium">Total: ₹{order.totalAmount}</Text>
        <TextInput mode="outlined" label="Status Notes" value={statusNotes} onChangeText={setStatusNotes} style={{ marginTop: 8 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
          <Button onPress={() => updateStatus.mutate({ id: order._id, status: 'confirmed' })}>Confirm</Button>
          <Button onPress={() => updateStatus.mutate({ id: order._id, status: 'processing' })}>Process</Button>
          <Button onPress={() => updateStatus.mutate({ id: order._id, status: 'out_for_delivery' })}>Out for Delivery</Button>
          <Button onPress={() => updateStatus.mutate({ id: order._id, status: 'delivered' })}>Delivered</Button>
        </View>
      </Card.Content>
    </Card>
  );

  if (isLoading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator /><Text>Loading...</Text></View>;
  if (error) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>Error loading</Text><Button onPress={() => refetch()}>Retry</Button></View>;

  const filtered = (orders as Order[]).filter(o => (o.orderNumber || '').toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <View style={{ flex: 1 }}>
      <Surface style={{ padding: 12 }}>
        <Searchbar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search orders" />
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          {(['pending','confirmed','processing','out_for_delivery','delivered','cancelled'] as const).map(s => (
            <Chip key={s} selected={selectedStatus === s} onPress={() => setSelectedStatus(s)} style={{ marginRight: 8 }}>{s}</Chip>
          ))}
        </View>
      </Surface>
      <FlatList data={filtered} renderItem={renderItem} keyExtractor={(it) => it._id} />
    </View>
  );
};

export default OrderManagementScreen; 