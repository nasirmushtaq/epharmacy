import React, { useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, ScrollView, Pressable } from 'react-native';
import { Text, Card, TextInput, Button, Switch, Searchbar, Chip, ActivityIndicator, FAB, Portal, Modal, Menu } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

type Product = {
  _id: string;
  name: string;
  brand: string;
  manufacturer: string;
  genericName: string;
  category: string;
  dosageForm: string;
  strength: string;
  packSize: number;
  unit: string;
  mrp?: number;
  sellingPrice?: number;
  discount?: number;
  isActive?: boolean;
  isAvailable?: boolean;
  catalogStock?: number;
  description?: string;
  scheduleType?: string;
};

// Split row into its own component so hooks are not used inside renderItem
const ProductRow: React.FC<{ item: Product; onSave: (id: string, patch: Partial<Product>) => void; onAggregate: (id: string, onDone: (val: number) => void) => Promise<void>; isSaving: boolean; }> = ({ item, onSave, onAggregate, isSaving }) => {
  const [mrp, setMrp] = useState(String(item.mrp ?? ''));
  const [price, setPrice] = useState(String(item.sellingPrice ?? ''));
  const [stock, setStock] = useState(String(item.catalogStock ?? ''));
  const [available, setAvailable] = useState(!!item.isAvailable);

  return (
    <Card style={styles.card}>
      <Card.Content>
        <Text variant="titleMedium">{item.name}</Text>
        <Text variant="bodySmall" style={{ color: '#666' }}>{item.brand} • {item.genericName} • {item.dosageForm} • {item.strength}</Text>
        <View style={styles.row}>
          <TextInput label="MRP" mode="outlined" value={mrp} onChangeText={setMrp} keyboardType='numeric' style={styles.input} />
          <TextInput label="Price" mode="outlined" value={price} onChangeText={setPrice} keyboardType='numeric' style={styles.input} />
        </View>
        <View style={styles.row}>
          <TextInput label="Catalog Stock" mode="outlined" value={stock} onChangeText={setStock} keyboardType='numeric' style={styles.input} />
          <View style={[styles.input, styles.switchRow]}>
            <Text style={{ marginRight: 8 }}>Available</Text>
            <Switch value={available} onValueChange={setAvailable} />
          </View>
        </View>
        <View style={styles.actions}>
          <Button
            mode="outlined"
            onPress={async () => {
              await onAggregate(item._id, (total) => setStock(String(total)));
            }}
          >Aggregate Stock</Button>
          <Button
            mode="contained"
            loading={isSaving}
            onPress={() => onSave(item._id, {
              mrp: Number(mrp) || 0,
              sellingPrice: Number(price) || 0,
              catalogStock: Number(stock) || 0,
              isAvailable: available
            })}
          >Save</Button>
        </View>
      </Card.Content>
    </Card>
  );
};

const CatalogAdminScreen = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '',
    genericName: '',
    brand: '',
    manufacturer: '',
    category: '',
    dosageForm: '',
    strength: '',
    packSize: undefined,
    unit: '',
    mrp: undefined,
    sellingPrice: undefined,
    catalogStock: undefined,
    isAvailable: true
  });
  const [catMenuVisible, setCatMenuVisible] = useState(false);
  const [dosageMenuVisible, setDosageMenuVisible] = useState(false);
  const [unitMenuVisible, setUnitMenuVisible] = useState(false);
  const [scheduleMenuVisible, setScheduleMenuVisible] = useState(false);

  const categories = ['tablets', 'capsules', 'syrups', 'injections', 'ointments', 'drops', 'inhalers', 'supplements'];
  const dosageForms = ['tablet', 'capsule', 'syrup', 'injection', 'ointment', 'drop', 'inhaler', 'gel', 'lotion'];
  const units = ['strips', 'bottles', 'vials', 'packs', 'ml', 'mg'];
  const schedules = ['OTC', 'H', 'H1', 'X'];
  const brandSuggestions = ['Cipla', 'Sun Pharma', 'Dr Reddy', 'Abbott'];
  const genericSuggestions = ['Paracetamol', 'Azithromycin', 'Amoxicillin', 'Cetirizine'];

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['products-admin', search, category],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (category !== 'all') params.append('category', category);
      params.append('limit', '100');
      params.append('sortBy', 'name');
      params.append('sortOrder', 'asc');
      const res = await api.get(`/api/products?${params.toString()}`);
      return res.data?.data as Product[];
    }
  });

  const products = (data || []) as Product[];

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Product> }) => {
      const res = await api.put(`/api/products/${id}`, patch);
      return res.data?.data as Product;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products-admin'] })
  });

  const addMutation = useMutation({
    mutationFn: async (payload: Partial<Product>) => {
      const res = await api.post(`/api/products`, payload);
      return res.data?.data as Product;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products-admin'] });
      setAddOpen(false);
      setNewProduct({ name: '', genericName: '', brand: '', category: '', dosageForm: '', strength: '', unit: '', isAvailable: true });
    }
  });

  const aggregateStock = async (id: string, onDone: (val: number) => void) => {
    try {
      const res = await api.get(`/api/products/${id}/aggregate-stock`);
      const total = res.data?.data?.nonExpiredTotal ?? res.data?.data?.total ?? 0;
      onDone(total);
    } catch {}
  };

  const onSave = (id: string, patch: Partial<Product>) => {
    updateMutation.mutate({ id, patch });
  };

  return (
    <View style={styles.container}>
      <Searchbar placeholder="Search products" value={search} onChangeText={setSearch} style={{ margin: 12 }} />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text>Loading catalog...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text>Failed to load catalog</Text>
          <Button onPress={() => refetch()}>Retry</Button>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p._id}
          renderItem={({ item }) => (
            <ProductRow
              item={item}
              isSaving={updateMutation.isPending}
              onSave={onSave}
              onAggregate={aggregateStock}
            />
          )}
          contentContainerStyle={{ padding: 12 }}
          onRefresh={() => refetch()}
          refreshing={isFetching}
        />
      )}
      <FAB style={styles.fab} icon="plus" label="Add" onPress={() => setAddOpen(true)} />

      <Portal>
        <Modal visible={addOpen} onDismiss={() => setAddOpen(false)} contentContainerStyle={styles.modal}>
          <Text variant="titleMedium" style={{ marginBottom: 12 }}>Add Product</Text>
          <ScrollView>
            <TextInput label="Name (e.g., Dolo 650)" mode="outlined" value={String(newProduct.name || '')} onChangeText={(t) => setNewProduct({ ...newProduct, name: t })} style={{ marginBottom: 8 }} />
            <TextInput label="Generic Name" mode="outlined" value={String(newProduct.genericName || '')} onChangeText={(t) => setNewProduct({ ...newProduct, genericName: t })} style={{ marginBottom: 4 }} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
              {genericSuggestions.map(s => (
                <Chip key={s} style={{ marginRight: 6, marginTop: 6 }} onPress={() => setNewProduct({ ...newProduct, genericName: s })}>{s}</Chip>
              ))}
            </View>

            <TextInput label="Brand" mode="outlined" value={String(newProduct.brand || '')} onChangeText={(t) => setNewProduct({ ...newProduct, brand: t })} style={{ marginBottom: 4 }} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
              {brandSuggestions.map(s => (
                <Chip key={s} style={{ marginRight: 6, marginTop: 6 }} onPress={() => setNewProduct({ ...newProduct, brand: s })}>{s}</Chip>
              ))}
            </View>

            <TextInput label="Manufacturer" mode="outlined" value={String(newProduct.manufacturer || '')} onChangeText={(t) => setNewProduct({ ...newProduct, manufacturer: t })} style={{ marginBottom: 8 }} />

            <View style={{ marginBottom: 8 }}>
              <Text variant="bodyMedium" style={{ marginBottom: 6 }}>Category</Text>
              <Menu visible={catMenuVisible} onDismiss={() => setCatMenuVisible(false)} anchor={<Pressable onPress={() => setCatMenuVisible(true)}><Button mode="outlined">{newProduct.category || 'Select category'}</Button></Pressable>}>
                {categories.map(c => (<Menu.Item key={c} onPress={() => { setNewProduct({ ...newProduct, category: c }); setCatMenuVisible(false); }} title={c} />))}
              </Menu>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium" style={{ marginBottom: 6 }}>Dosage Form</Text>
                <Menu visible={dosageMenuVisible} onDismiss={() => setDosageMenuVisible(false)} anchor={<Pressable onPress={() => setDosageMenuVisible(true)}><Button mode="outlined">{newProduct.dosageForm || 'Select dosage form'}</Button></Pressable>}>
                  {dosageForms.map(d => (<Menu.Item key={d} onPress={() => { setNewProduct({ ...newProduct, dosageForm: d }); setDosageMenuVisible(false); }} title={d} />))}
                </Menu>
              </View>
              <TextInput label="Strength (e.g., 500mg)" mode="outlined" value={String(newProduct.strength || '')} onChangeText={(t) => setNewProduct({ ...newProduct, strength: t })} style={styles.input} />
            </View>

            <View style={styles.row}>
              <TextInput label="Pack Size" mode="outlined" keyboardType='numeric' value={newProduct.packSize ? String(newProduct.packSize) : ''} onChangeText={(t) => setNewProduct({ ...newProduct, packSize: Number(t) || undefined })} style={styles.input} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium" style={{ marginBottom: 6 }}>Unit</Text>
                <Menu visible={unitMenuVisible} onDismiss={() => setUnitMenuVisible(false)} anchor={<Pressable onPress={() => setUnitMenuVisible(true)}><Button mode="outlined">{newProduct.unit || 'Select unit'}</Button></Pressable>}>
                  {units.map(u => (<Menu.Item key={u} onPress={() => { setNewProduct({ ...newProduct, unit: u }); setUnitMenuVisible(false); }} title={u} />))}
                </Menu>
              </View>
            </View>

            <TextInput label="Description" mode="outlined" value={String(newProduct.description || '')} onChangeText={(t) => setNewProduct({ ...newProduct, description: t })} multiline numberOfLines={3} style={{ marginTop: 8 }} />

            <View style={styles.row}>
              <TextInput label="MRP" mode="outlined" keyboardType='numeric' value={newProduct.mrp ? String(newProduct.mrp) : ''} onChangeText={(t) => setNewProduct({ ...newProduct, mrp: Number(t) || undefined })} style={styles.input} />
              <TextInput label="Price" mode="outlined" keyboardType='numeric' value={newProduct.sellingPrice ? String(newProduct.sellingPrice) : ''} onChangeText={(t) => setNewProduct({ ...newProduct, sellingPrice: Number(t) || undefined })} style={styles.input} />
            </View>

            <View style={styles.row}>
              <TextInput label="Catalog Stock" mode="outlined" keyboardType='numeric' value={newProduct.catalogStock ? String(newProduct.catalogStock) : ''} onChangeText={(t) => setNewProduct({ ...newProduct, catalogStock: Number(t) || undefined })} style={styles.input} />
              <View style={[styles.input, styles.switchRow]}>
                <Text style={{ marginRight: 8 }}>Available</Text>
                <Switch value={!!newProduct.isAvailable} onValueChange={(v) => setNewProduct({ ...newProduct, isAvailable: v })} />
              </View>
            </View>

            <View style={{ marginTop: 8 }}>
              <Text variant="bodyMedium" style={{ marginBottom: 6 }}>Schedule Type</Text>
              <Menu visible={scheduleMenuVisible} onDismiss={() => setScheduleMenuVisible(false)} anchor={<Pressable onPress={() => setScheduleMenuVisible(true)}><Button mode="outlined">{newProduct.scheduleType || 'Select schedule'}</Button></Pressable>}>
                {schedules.map(s => (<Menu.Item key={s} onPress={() => { setNewProduct({ ...newProduct, scheduleType: s }); setScheduleMenuVisible(false); }} title={s} />))}
              </Menu>
            </View>

            <View style={styles.actions}>
              <Button mode="text" onPress={() => setAddOpen(false)}>Cancel</Button>
              <Button
                mode="contained"
                loading={addMutation.isPending}
                onPress={() => {
                  if (!newProduct.name || !newProduct.manufacturer) return;
                  addMutation.mutate({
                    ...newProduct,
                    mrp: newProduct.mrp ?? 0,
                    sellingPrice: newProduct.sellingPrice ?? 0,
                    catalogStock: newProduct.catalogStock ?? 0
                  });
                }}
              >Save</Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  card: { marginBottom: 12, borderRadius: 12 },
  row: { flexDirection: 'row', gap: 12, marginTop: 12 },
  input: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
  modal: { backgroundColor: 'white', margin: 16, padding: 16, borderRadius: 12 }
});

export default CatalogAdminScreen;


