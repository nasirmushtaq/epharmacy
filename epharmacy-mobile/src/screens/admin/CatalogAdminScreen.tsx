import React, { useMemo, useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Card, TextInput, Button, Switch, Searchbar, Chip, ActivityIndicator } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

type Product = {
  _id: string;
  name: string;
  brand: string;
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
};

const CatalogAdminScreen = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

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

  const aggregateStock = async (id: string, onDone: (val: number) => void) => {
    try {
      const res = await api.get(`/api/products/${id}/aggregate-stock`);
      const total = res.data?.data?.nonExpiredTotal ?? res.data?.data?.total ?? 0;
      onDone(total);
    } catch {}
  };

  const renderItem = ({ item }: { item: Product }) => {
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
                await aggregateStock(item._id, (total) => setStock(String(total)));
              }}
            >Aggregate Stock</Button>
            <Button
              mode="contained"
              loading={updateMutation.isPending}
              onPress={() => updateMutation.mutate({
                id: item._id,
                patch: {
                  mrp: Number(mrp) || 0,
                  sellingPrice: Number(price) || 0,
                  catalogStock: Number(stock) || 0,
                  isAvailable: available
                }
              })}
            >Save</Button>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Searchbar placeholder="Search products" value={search} onChangeText={setSearch} style={{ margin: 12 }} />
      {isLoading ? (
        <View style={styles.center}> <ActivityIndicator /> <Text>Loading catalog...</Text> </View>
      ) : error ? (
        <View style={styles.center}> <Text>Failed to load catalog</Text> <Button onPress={() => refetch()}>Retry</Button> </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p._id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12 }}
          onRefresh={() => refetch()}
          refreshing={isFetching}
        />
      )}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 }
});

export default CatalogAdminScreen;


