import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Image } from 'react-native';
import { Text, Chip, Divider, Button, ActivityIndicator } from 'react-native-paper';
import { useRoute } from '@react-navigation/native';
import api from '../../services/api';
import { useCart } from '../../contexts/CartContext';

export default function MedicineDetailScreen() {
  const route = useRoute<any>();
  const { id } = route.params || {};
  const [med, setMed] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/api/medicines/${id}`);
        setMed(res.data.data || res.data);
      } catch (e) {
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return (<View style={styles.centered}><ActivityIndicator /><Text>Loading medicine...</Text></View>);
  if (!med) return (<View style={styles.centered}><Text>Medicine not found</Text></View>);

  const addToCart = async () => {
    await addItem({ medicineId: med._id, name: med.name, price: med.sellingPrice || 0, quantity: 1, isPrescriptionRequired: med.isPrescriptionRequired });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.imageBox} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{med.name}</Text>
          <Text style={styles.subtle}>{med.brand}</Text>
          {med.isPrescriptionRequired && <Chip mode="outlined" compact style={styles.rxChip}>Rx Required</Chip>}
        </View>
      </View>
      <Divider style={{ marginVertical: 12 }} />
      <Text style={styles.sectionTitle}>Composition</Text>
      {(med.composition || []).map((c: any, i: number) => (
        <View style={styles.rowBetween} key={i}><Text>{c.ingredient}</Text><Text style={styles.subtle}>{c.strength}</Text></View>
      ))}
      <Divider style={{ marginVertical: 12 }} />
      <Text style={styles.sectionTitle}>Description</Text>
      <Text style={styles.paragraph}>{med.description || 'No description'}</Text>
      <Divider style={{ marginVertical: 12 }} />
      <Text style={styles.sectionTitle}>Pricing</Text>
      <Text>MRP: ₹{med.mrp}   Selling: ₹{med.sellingPrice}</Text>
      <Divider style={{ marginVertical: 12 }} />
      <Text style={styles.sectionTitle}>Stock</Text>
      <Text>{med.stockQuantity > 0 ? `${med.stockQuantity} available` : 'Out of stock'}</Text>
      <Divider style={{ marginVertical: 12 }} />
      <Text style={styles.sectionTitle}>Side Effects</Text>
      <Text style={styles.paragraph}>{(med.sideEffects || []).join(', ') || 'Not available'}</Text>
      <Divider style={{ marginVertical: 12 }} />
      <Button mode="contained" onPress={addToCart} disabled={med.stockQuantity <= 0}>Add to Cart</Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  imageBox: { width: 84, height: 84, borderRadius: 8, backgroundColor: '#e5e7eb', marginRight: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  subtle: { color: '#6b7280' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  paragraph: { color: '#111827' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rxChip: { alignSelf: 'flex-start', marginTop: 6 },
});


