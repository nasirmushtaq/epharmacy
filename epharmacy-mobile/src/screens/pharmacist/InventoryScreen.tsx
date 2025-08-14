import React, { useMemo, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, ScrollView, Pressable } from 'react-native';
import { Card, Text, Button, IconButton, Surface, Divider, TextInput, Chip, FAB, Searchbar, ActivityIndicator, Modal, Portal, Menu, List } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useDebouncedValue } from '../../hooks/useDebounce';

interface InventoryItem {
  _id: string;
  productId: string;
  pharmacistId: string;
  stockQuantity: number;
  minStockLevel: number;
  sellingPrice: number;
  mrp: number;
  batchNumber?: string;
  expiryDate?: string;
  isActive: boolean;
  product?: ProductSummary;
}

type ProductSummary = {
  _id: string;
  name: string;
  brand: string;
  genericName: string;
  category: string;
  dosageForm: string;
  strength: string;
  unit: string;
};

const InventoryScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  // Minimal inventory state; product attributes come from catalog
  const [newMedicine, setNewMedicine] = useState<{ selectedProductId?: string; sellingPrice?: string; mrp?: string; stockQuantity?: string; minStockLevel?: string; expiryDate?: string; batchNumber?: string }>({});
  const queryClient = useQueryClient();

  // Catalog search for adding inventory (hooks must be declared before any early returns)
  const [catalogQuery, setCatalogQuery] = useState('');
  const [selectedProductDisplay, setSelectedProductDisplay] = useState('');
  const debouncedCatalogQuery = useDebouncedValue(catalogQuery, 300);
  const { data: catalog = [], isFetching: searchingCatalog } = useQuery({
    queryKey: ['products', debouncedCatalogQuery],
    queryFn: async (): Promise<ProductSummary[]> => {
      const params = new URLSearchParams();
      params.append('limit', '20');
      if (debouncedCatalogQuery.trim()) params.append('search', debouncedCatalogQuery.trim());
      const res = await api.get(`/api/products?${params.toString()}`);
      return (res.data?.data || []) as ProductSummary[];
    }
  });

  const categories = ['tablets', 'capsules', 'syrups', 'injections', 'ointments', 'drops', 'inhalers', 'supplements'];
  const dosageForms = ['tablet', 'capsule', 'syrup', 'injection', 'ointment', 'drop', 'inhaler'];

  const { data: inventory = [], isLoading, error, refetch } = useQuery({
    queryKey: ['inventory'],
    queryFn: async (): Promise<InventoryItem[]> => {
      const res = await api.get('/api/inventory');
      return res.data.data || [];
    },
  });

  const updateStockMutation = useMutation({
    mutationFn: async ({ id, quantity, operation }: { id: string; quantity: number; operation: 'add' | 'subtract' }) => {
      return api.patch(`/api/inventory/${id}/stock`, { quantity, operation });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/api/inventory/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/inventory/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
  });

  const addInventoryMutation = useMutation({
    mutationFn: async (payload: any) => api.post('/api/inventory', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setShowAddModal(false);
      resetForm();
      Alert.alert('Success', 'Inventory item added');
    },
    onError: (error: any) => Alert.alert('Error', error.response?.data?.message || 'Failed to add inventory')
  });

  const resetForm = () => setNewMedicine({});

  const filterOptions = ['all', 'low_stock', 'out_of_stock', 'inactive'];

  const getFilteredInventory = (): InventoryItem[] => {
    return (inventory as InventoryItem[]).filter(item => {
      const name = (item as any).name || item.product?.name || '';
      const brand = (item as any).brand || item.product?.brand || '';
      const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            brand.toLowerCase().includes(searchQuery.toLowerCase());
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
            <Text variant="titleMedium">{(item as any).name || item.product?.name}</Text>
            <Text variant="bodySmall">{(item as any).brand || item.product?.brand}</Text>
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

  const schedules = ['OTC', 'H', 'H1', 'X'];

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
      
      {/* Floating Action Button */}
      <FAB
        style={{ position: 'absolute', margin: 16, right: 0, bottom: 0 }}
        icon="plus"
        onPress={() => setShowAddModal(true)}
        label="Add Inventory"
      />

      {/* Add Medicine Modal */}
      <Portal>
        <Modal
          visible={showAddModal}
          onDismiss={() => setShowAddModal(false)}
          contentContainerStyle={{ backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 12, maxHeight: '90%' }}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text variant="headlineSmall" style={{ marginBottom: 16, textAlign: 'center', fontWeight: 'bold' }}>
              Add Inventory
            </Text>

            {/* Catalog product picker */}
            <TextInput
              mode="outlined"
              label="Search Product"
              value={catalogQuery}
              onChangeText={setCatalogQuery}
              placeholder="Type name, brand or generic"
              style={{ marginBottom: 8 }}
            />
            {(newMedicine as any).selectedProductId ? (
              <Chip icon="check" onClose={() => { setNewMedicine({ ...newMedicine, selectedProductId: undefined } as any); setCatalogQuery(''); setSelectedProductDisplay(''); }} style={{ marginBottom: 8 }}>
                {selectedProductDisplay || 'Product selected'}
              </Chip>
            ) : null}
            {/* Catalog results */}
            {(!(newMedicine as any).selectedProductId) && (searchingCatalog ? (
              <ActivityIndicator />
            ) : (
              <View style={{ maxHeight: 200 }}>
                {(catalog || []).map((p) => (
                  <List.Item
                    key={p._id}
                    title={p.name}
                    description={`${p.brand} • ${p.genericName} • ${p.dosageForm} • ${p.strength}`}
                    onPress={() => { setNewMedicine({ ...newMedicine, name: p.name, brand: p.brand, genericName: p.genericName, dosageForm: p.dosageForm, strength: p.strength, unit: p.unit, selectedProductId: p._id } as any); setCatalogQuery(p.name); setSelectedProductDisplay(`${p.name} • ${p.brand}`); }}
                  />
                ))}
              </View>
            ))}

            {/* Only inventory specific fields below */}
            
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
              <TextInput mode="outlined" label="MRP *" value={newMedicine.mrp || ''} onChangeText={(text) => setNewMedicine({ ...newMedicine, mrp: text })} keyboardType="numeric" style={{ flex: 1 }} />
              <TextInput mode="outlined" label="Selling Price *" value={newMedicine.sellingPrice || ''} onChangeText={(text) => setNewMedicine({ ...newMedicine, sellingPrice: text })} keyboardType="numeric" style={{ flex: 1 }} />
            </View>
            
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
              <TextInput mode="outlined" label="Stock Quantity *" value={newMedicine.stockQuantity || ''} onChangeText={(text) => setNewMedicine({ ...newMedicine, stockQuantity: text })} keyboardType="numeric" style={{ flex: 1 }} />
              <TextInput mode="outlined" label="Min Stock Level *" value={newMedicine.minStockLevel || ''} onChangeText={(text) => setNewMedicine({ ...newMedicine, minStockLevel: text })} keyboardType="numeric" style={{ flex: 1 }} />
            </View>
            
            <TextInput mode="outlined" label="Batch Number" value={newMedicine.batchNumber || ''} onChangeText={(text) => setNewMedicine({ ...newMedicine, batchNumber: text })} style={{ marginBottom: 12 }} />
            
            <TextInput
              mode="outlined"
              label="Manufacturing Date (YYYY-MM-DD) *"
              value={newMedicine.manufacturingDate}
              onChangeText={(text) => setNewMedicine({ ...newMedicine, manufacturingDate: text })}
              placeholder="2025-01-01"
              style={{ marginBottom: 12 }}
            />

            <TextInput mode="outlined" label="Expiry Date (YYYY-MM-DD)" value={newMedicine.expiryDate || ''} onChangeText={(text) => setNewMedicine({ ...newMedicine, expiryDate: text })} placeholder="2026-12-31" style={{ marginBottom: 12 }} />

            {/* Removed catalog attributes (dosage form, unit, usage/storage, schedule) — managed in Product */}
            
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Button
                mode="outlined"
                onPress={() => setShowAddModal(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={() => {
                  const payload: any = {
                    product: (newMedicine as any).selectedProductId,
                    stockQuantity: Number(newMedicine.stockQuantity),
                    minStockLevel: Number(newMedicine.minStockLevel),
                    sellingPrice: Number(newMedicine.sellingPrice),
                    mrp: Number(newMedicine.mrp)
                  };
                  if (newMedicine.batchNumber) payload.batchNumber = newMedicine.batchNumber.trim();
                  if (newMedicine.expiryDate) payload.expiryDate = new Date(newMedicine.expiryDate).toISOString();
                  addInventoryMutation.mutate(payload);
                }}
                loading={addInventoryMutation.isPending}
                disabled={!(newMedicine as any).selectedProductId || !newMedicine.mrp || !newMedicine.sellingPrice || !newMedicine.stockQuantity || !newMedicine.minStockLevel}
                style={{ flex: 1 }}
              >
                Add Inventory
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
};

export default InventoryScreen; 