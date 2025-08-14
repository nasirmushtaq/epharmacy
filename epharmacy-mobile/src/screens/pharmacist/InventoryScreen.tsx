import React, { useState } from 'react';
import { View, FlatList, StyleSheet, Alert, ScrollView } from 'react-native';
import { Card, Text, Button, IconButton, Surface, Divider, TextInput, Chip, FAB, Searchbar, ActivityIndicator, Modal, Portal, Menu } from 'react-native-paper';
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMedicine, setNewMedicine] = useState({
    name: '',
    genericName: '',
    brand: '',
    manufacturer: '',
    description: '',
    category: 'tablets',
    dosageForm: 'tablet',
    strength: '',
    packSize: '',
    sellingPrice: '',
    mrp: '',
    stockQuantity: '',
    minStockLevel: '',
    manufacturingDate: '',
    expiryDate: '',
    unit: 'strips',
    usageInstructions: '',
    storageInstructions: '',
    batchNumber: '',
    scheduleType: 'OTC',
    isPrescriptionRequired: false
  });
  const [categoryMenuVisible, setCategoryMenuVisible] = useState(false);
  const [dosageMenuVisible, setDosageMenuVisible] = useState(false);
  const [scheduleMenuVisible, setScheduleMenuVisible] = useState(false);
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

  const addMedicineMutation = useMutation({
    mutationFn: async (medicineData: any) => {
      const formData = {
        ...medicineData,
        sellingPrice: parseFloat(medicineData.sellingPrice),
        mrp: parseFloat(medicineData.mrp),
        stockQuantity: parseInt(medicineData.stockQuantity),
        minStockLevel: parseInt(medicineData.minStockLevel),
        packSize: parseInt(medicineData.packSize),
        manufacturingDate: new Date(medicineData.manufacturingDate).toISOString(),
        expiryDate: new Date(medicineData.expiryDate).toISOString(),
        dosageForm: medicineData.dosageForm,
        strength: medicineData.strength,
        scheduleType: medicineData.scheduleType,
        unit: medicineData.unit,
        usageInstructions: medicineData.usageInstructions,
        storageInstructions: medicineData.storageInstructions
      };
      return api.post('/api/medicines', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setShowAddModal(false);
      resetForm();
      Alert.alert('Success', 'Medicine added successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'Failed to add medicine');
    }
  });

  const resetForm = () => {
    setNewMedicine({
      name: '',
      genericName: '',
      brand: '',
      manufacturer: '',
      description: '',
      category: 'tablets',
      dosageForm: 'tablet',
      strength: '',
      packSize: '',
      sellingPrice: '',
      mrp: '',
      stockQuantity: '',
      minStockLevel: '',
      manufacturingDate: '',
      expiryDate: '',
      unit: 'strips',
      usageInstructions: '',
      storageInstructions: '',
      batchNumber: '',
      scheduleType: 'OTC',
      isPrescriptionRequired: false
    });
  };

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

  const categories = ['tablets', 'capsules', 'syrups', 'injections', 'ointments', 'drops', 'inhalers', 'supplements', 'antibiotics', 'painkillers'];
  const dosageForms = ['tablet', 'capsule', 'syrup', 'injection', 'ointment', 'drop', 'inhaler'];
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
        label="Add Medicine"
      />

      {/* Add Medicine Modal */}
      <Portal>
        <Modal
          visible={showAddModal}
          onDismiss={() => setShowAddModal(false)}
          contentContainerStyle={{ backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 12, maxHeight: '90%' }}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text variant="headlineSmall" style={{ marginBottom: 20, textAlign: 'center', fontWeight: 'bold' }}>
              Add New Medicine
            </Text>
            
            <TextInput
              mode="outlined"
              label="Medicine Name *"
              value={newMedicine.name}
              onChangeText={(text) => setNewMedicine({ ...newMedicine, name: text })}
              style={{ marginBottom: 12 }}
            />
            
            <TextInput
              mode="outlined"
              label="Generic Name *"
              value={newMedicine.genericName}
              onChangeText={(text) => setNewMedicine({ ...newMedicine, genericName: text })}
              style={{ marginBottom: 12 }}
            />
            
            <TextInput
              mode="outlined"
              label="Brand *"
              value={newMedicine.brand}
              onChangeText={(text) => setNewMedicine({ ...newMedicine, brand: text })}
              style={{ marginBottom: 12 }}
            />
            
            <TextInput
              mode="outlined"
              label="Manufacturer *"
              value={newMedicine.manufacturer}
              onChangeText={(text) => setNewMedicine({ ...newMedicine, manufacturer: text })}
              style={{ marginBottom: 12 }}
            />

            <View style={{ marginBottom: 12 }}>
              <Text variant="bodyMedium" style={{ marginBottom: 8 }}>Category *</Text>
              <Menu
                visible={categoryMenuVisible}
                onDismiss={() => setCategoryMenuVisible(false)}
                anchor={<Button mode="outlined" onPress={() => setCategoryMenuVisible(true)}>{newMedicine.category || 'Select category'}</Button>}
              >
                {categories.map((cat) => (
                  <Menu.Item key={cat} onPress={() => { setNewMedicine({ ...newMedicine, category: cat }); setCategoryMenuVisible(false); }} title={cat} />
                ))}
              </Menu>
            </View>
            
            <TextInput
              mode="outlined"
              label="Description *"
              value={newMedicine.description}
              onChangeText={(text) => setNewMedicine({ ...newMedicine, description: text })}
              multiline
              numberOfLines={3}
              style={{ marginBottom: 12 }}
            />

            {/* Dosage Form */}
            <View style={{ marginBottom: 12 }}>
              <Text variant="bodyMedium" style={{ marginBottom: 8 }}>Dosage Form *</Text>
              <Menu
                visible={dosageMenuVisible}
                onDismiss={() => setDosageMenuVisible(false)}
                anchor={<Button mode="outlined" onPress={() => setDosageMenuVisible(true)}>{newMedicine.dosageForm || 'Select dosage form'}</Button>}
              >
                {dosageForms.map((df) => (
                  <Menu.Item key={df} onPress={() => { setNewMedicine({ ...newMedicine, dosageForm: df }); setDosageMenuVisible(false); }} title={df} />
                ))}
              </Menu>
            </View>

            {/* Strength and Pack Size */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
              <TextInput
                mode="outlined"
                label="Strength (e.g., 500mg) *"
                value={newMedicine.strength}
                onChangeText={(text) => setNewMedicine({ ...newMedicine, strength: text })}
                style={{ flex: 1 }}
              />
              <TextInput
                mode="outlined"
                label="Pack Size *"
                value={newMedicine.packSize}
                onChangeText={(text) => setNewMedicine({ ...newMedicine, packSize: text })}
                keyboardType="numeric"
                style={{ flex: 1 }}
              />
            </View>
            
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
              <TextInput
                mode="outlined"
                label="MRP *"
                value={newMedicine.mrp}
                onChangeText={(text) => setNewMedicine({ ...newMedicine, mrp: text })}
                keyboardType="numeric"
                style={{ flex: 1 }}
              />
              <TextInput
                mode="outlined"
                label="Selling Price *"
                value={newMedicine.sellingPrice}
                onChangeText={(text) => setNewMedicine({ ...newMedicine, sellingPrice: text })}
                keyboardType="numeric"
                style={{ flex: 1 }}
              />
            </View>
            
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
              <TextInput
                mode="outlined"
                label="Stock Quantity *"
                value={newMedicine.stockQuantity}
                onChangeText={(text) => setNewMedicine({ ...newMedicine, stockQuantity: text })}
                keyboardType="numeric"
                style={{ flex: 1 }}
              />
              <TextInput
                mode="outlined"
                label="Min Stock Level *"
                value={newMedicine.minStockLevel}
                onChangeText={(text) => setNewMedicine({ ...newMedicine, minStockLevel: text })}
                keyboardType="numeric"
                style={{ flex: 1 }}
              />
            </View>
            
            <TextInput
              mode="outlined"
              label="Batch Number *"
              value={newMedicine.batchNumber}
              onChangeText={(text) => setNewMedicine({ ...newMedicine, batchNumber: text })}
              style={{ marginBottom: 12 }}
            />
            
            <TextInput
              mode="outlined"
              label="Manufacturing Date (YYYY-MM-DD) *"
              value={newMedicine.manufacturingDate}
              onChangeText={(text) => setNewMedicine({ ...newMedicine, manufacturingDate: text })}
              placeholder="2025-01-01"
              style={{ marginBottom: 12 }}
            />

            <TextInput
              mode="outlined"
              label="Expiry Date (YYYY-MM-DD) *"
              value={newMedicine.expiryDate}
              onChangeText={(text) => setNewMedicine({ ...newMedicine, expiryDate: text })}
              placeholder="2025-12-31"
              style={{ marginBottom: 12 }}
            />

            {/* Unit */}
            <TextInput
              mode="outlined"
              label="Unit (e.g., strips, bottles) *"
              value={newMedicine.unit}
              onChangeText={(text) => setNewMedicine({ ...newMedicine, unit: text })}
              style={{ marginBottom: 12 }}
            />

            {/* Usage & Storage Instructions */}
            <TextInput
              mode="outlined"
              label="Usage Instructions *"
              value={newMedicine.usageInstructions}
              onChangeText={(text) => setNewMedicine({ ...newMedicine, usageInstructions: text })}
              multiline
              numberOfLines={2}
              style={{ marginBottom: 12 }}
            />
            <TextInput
              mode="outlined"
              label="Storage Instructions *"
              value={newMedicine.storageInstructions}
              onChangeText={(text) => setNewMedicine({ ...newMedicine, storageInstructions: text })}
              multiline
              numberOfLines={2}
              style={{ marginBottom: 12 }}
            />

            {/* Schedule Type */}
            <View style={{ marginBottom: 20 }}>
              <Text variant="bodyMedium" style={{ marginBottom: 8 }}>Schedule Type *</Text>
              <Menu
                visible={scheduleMenuVisible}
                onDismiss={() => setScheduleMenuVisible(false)}
                anchor={<Button mode="outlined" onPress={() => setScheduleMenuVisible(true)}>{newMedicine.scheduleType || 'Select schedule'}</Button>}
              >
                {schedules.map((sc) => (
                  <Menu.Item key={sc} onPress={() => { setNewMedicine({ ...newMedicine, scheduleType: sc }); setScheduleMenuVisible(false); }} title={sc} />
                ))}
              </Menu>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <Chip
                selected={newMedicine.isPrescriptionRequired}
                onPress={() => setNewMedicine({ ...newMedicine, isPrescriptionRequired: !newMedicine.isPrescriptionRequired })}
                icon={newMedicine.isPrescriptionRequired ? "check" : "plus"}
              >
                Prescription Required
              </Chip>
            </View>
            
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
                onPress={() => addMedicineMutation.mutate(newMedicine)}
                loading={addMedicineMutation.isPending}
                disabled={!newMedicine.name || !newMedicine.genericName || !newMedicine.brand || !newMedicine.manufacturer || !newMedicine.description || !newMedicine.strength || !newMedicine.packSize || !newMedicine.batchNumber || !newMedicine.manufacturingDate || !newMedicine.expiryDate || !newMedicine.mrp || !newMedicine.sellingPrice || !newMedicine.stockQuantity || !newMedicine.minStockLevel || !newMedicine.unit || !newMedicine.usageInstructions || !newMedicine.storageInstructions}
                style={{ flex: 1 }}
              >
                Add Medicine
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
};

export default InventoryScreen; 