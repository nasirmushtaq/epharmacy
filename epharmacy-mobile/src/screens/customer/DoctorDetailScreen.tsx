import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Image } from 'react-native';
import { Text, Chip, Divider, Button, ActivityIndicator } from 'react-native-paper';
import { useRoute, useNavigation } from '@react-navigation/native';
import api from '../../services/api';

export default function DoctorDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { id } = route.params || {};
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/api/doctors/${id}`);
        setData(res.data.data || res.data);
      } catch (e) {
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return (
    <View style={styles.centered}><ActivityIndicator /><Text>Loading doctor...</Text></View>
  );
  if (!data) return (
    <View style={styles.centered}><Text>Doctor not found</Text></View>
  );

  const user = data.user || {};

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.avatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>Dr. {user.firstName} {user.lastName}</Text>
          <Text style={styles.subtle}>{(data.specialties || []).join(', ')}</Text>
        </View>
      </View>
      <Divider style={{ marginVertical: 12 }} />
      <Text style={styles.sectionTitle}>About</Text>
      <Text style={styles.paragraph}>{data.bio || 'No bio available'}</Text>
      <Divider style={{ marginVertical: 12 }} />
      <Text style={styles.sectionTitle}>Clinics</Text>
      {(data.clinics || []).map((c: any, i: number) => (
        <View key={i} style={styles.rowBetween}>
          <Text>{c.name || 'Clinic'}</Text>
          <Text style={styles.subtle}>{c.city || ''}</Text>
        </View>
      ))}
      <Divider style={{ marginVertical: 12 }} />
      <Text style={styles.sectionTitle}>Experience</Text>
      <Text style={styles.paragraph}>{data.experienceYears || 0} years</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#e5e7eb', marginRight: 12 },
  name: { fontSize: 20, fontWeight: '700' },
  subtle: { color: '#6b7280' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  paragraph: { color: '#111827' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
});


