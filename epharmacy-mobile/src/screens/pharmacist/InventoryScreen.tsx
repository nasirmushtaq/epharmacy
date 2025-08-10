import React, { useState } from 'react';
import { View, FlatList, StyleSheet, Alert, ScrollView } from 'react-native';
import { Card, Text, Button, IconButton, Surface, Divider, TextInput, Chip, FAB, Searchbar, ActivityIndicator } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

interface InventoryItem {
  _id: string;
  name: string;
  brand: string;
  category: string;
  stockQuantity: number;
  minStockLevel: number;
  sellingPrice: number;
  mrp: number;
  expiryDate?: string;
  isActive: boolean;
  isPrescriptionRequired: boolean;
}

const InventoryScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const queryClient = useQueryClient();

  const { data: inventory = [], isLoading, error, refetch } = useQuery({
    queryKey: ['inventory'],
    queryFn: async (): Promise<InventoryItem[]> => {
      const res = await api.get('/api/medicines');
      return res.data.data || [];
    },
  });

  const updateStockMutation = useMutation({
    mutationFn: async ({ id, quantity, operation }: { id: string; quantity: number; operation: 'add' | 'subtract' }) => {
      return api.patch(`/api/medicines/${id}/stock`, { quantity, operation });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return api.put(`/api/medicines/${id}`, { isActive });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/medicines/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
  });

  const filterOptions = ['all', 'low_stock', 'out_of_stock', 'inactive'];

  const getFilteredInventory = (): InventoryItem[] => {
    return (inventory as InventoryItem[]).filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.brand.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      switch (selectedFilter) {
        case 'low_stock': return item.stockQuantity <= item.minStockLevel && item.stockQuantity > 0;
        case 'out_of_stock': return item.stockQuantity === 0;
        case 'inactive': return !item.isActive;
        default: return true;
      }
    });
  };

  const handleUpdateStock = (item: InventoryItem) => {
    Alert.prompt('Update Stock', `Current: ${item.stockQuantity}\nEnter quantity to add (+) or subtract (-):`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Update',
        onPress: (value) => {
          const qty = parseInt(value || '0', 10);
          if (!isNaN(qty) && qty !== 0) {
            updateStockMutation.mutate({ id: item._id, quantity: Math.abs(qty), operation: qty > 0 ? 'add' : 'subtract' });
          }
        }
      }
    ], 'plain-text', '0');
  };

  const handleToggleActive = (item: InventoryItem) => {
    toggleActiveMutation.mutate({ id: item._id, isActive: !item.isActive });
  };

  const handleDeleteMedicine = (item: InventoryItem) => {
    Alert.alert('Delete Medicine', `Delete ${item.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(item._id) }
    ]);
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
        <Text>Loading inventory...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Error loading inventory</Text>
        <Button onPress={() => refetch()}>Retry</Button>
      </View>
    );
  }

  const filtered = getFilteredInventory();

  const renderItem = ({ item }: { item: InventoryItem }) => (
    <Card style={{ margin: 12 }}>
      <Card.Content>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <Text variant="titleMedium">{item.name}</Text>
            <Text variant="bodySmall">{item.brand}</Text>
            <Chip style={{ marginTop: 6 }} mode="outlined" selectedColor={item.isActive ? '#4CAF50' : '#F44336'}>
              {item.isActive ? 'Active' : 'Inactive'}
            </Chip>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="bodyMedium">Stock: {item.stockQuantity}</Text>
            <Text variant="bodyMedium">Price: ₹{item.sellingPrice}</Text>
          </View>
        </View>
        <Divider style={{ marginVertical: 10 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Button mode="outlined" onPress={() => handleUpdateStock(item)}>Update Stock</Button>
          <Button mode="outlined" onPress={() => handleToggleActive(item)}>{item.isActive ? 'Deactivate' : 'Activate'}</Button>
          <Button mode="text" textColor="#F44336" onPress={() => handleDeleteMedicine(item)}>Delete</Button>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={{ flex: 1 }}>
      <Surface style={{ padding: 12 }}>
        <Searchbar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search inventory" />
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          {filterOptions.map(f => (
            <Chip key={f} selected={selectedFilter === f} onPress={() => setSelectedFilter(f)} style={{ marginRight: 8 }}>
              {f}
            </Chip>
          ))}
        </View>
      </Surface>
      <FlatList data={filtered} renderItem={renderItem} keyExtractor={(it) => it._id} />
    </View>
  );
};

export default InventoryScreen; 