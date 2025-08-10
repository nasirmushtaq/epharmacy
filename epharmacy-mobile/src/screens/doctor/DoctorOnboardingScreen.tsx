import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, KeyboardAvoidingView, Platform, ScrollView, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Card, Text, TextInput, Button, Divider } from 'react-native-paper';
import DatePickerField from '../../components/DatePickerField';
import { useMutation } from '@tanstack/react-query';
import api from '../../services/api';

const DoctorOnboardingScreen = () => {
  const [specialties, setSpecialties] = useState('General Medicine');
  const [clinicName, setClinicName] = useState('My Clinic');
  const [clinicAddress, setClinicAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [fee, setFee] = useState('500');
  const [bio, setBio] = useState('');
  const [experienceYears, setExperienceYears] = useState('5');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // quick schedule builder: support multiple ranges per date and multiple dates
  const [date, setDate] = useState('');
  const [from, setFrom] = useState('10:00');
  const [to, setTo] = useState('10:15');
  const [slots, setSlots] = useState<Array<{ from: string; to: string }>>([]);
  const [schedule, setSchedule] = useState<Array<{ date: string; slots: Array<{ from: string; to: string }> }>>([]);

  const addSlot = () => {
    if (!from || !to) return;
    setSlots(prev => [...prev, { from, to }]);
  };

  const addDateToSchedule = () => {
    if (!date || slots.length === 0) return;
    setSchedule(prev => [...prev, { date, slots }]);
    setDate(''); setFrom('10:00'); setTo('10:15'); setSlots([]);
  };

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      const specialtiesArr = specialties.split(',').map(s => s.trim()).filter(Boolean);
      const clinics = [{ name: clinicName, address: clinicAddress, coordinates: (lat && lng) ? { latitude: Number(lat), longitude: Number(lng) } : undefined }];
      const payload = { specialties: specialtiesArr, clinics, fee: Number(fee || 0), bio, experienceYears: Number(experienceYears || 0) };
      const res = await api.post('/api/doctors/profile', payload);
      return res.data;
    },
    onSuccess: () => setMsg('Profile saved'),
    onError: (e: any) => setMsg(e.response?.data?.message || 'Save failed')
  });

  const saveScheduleMutation = useMutation({
    mutationFn: async () => {
      const hasPendingList = schedule.length > 0;
      const hasInline = !!date && slots.length > 0;
      if (!hasPendingList && !hasInline) return { success: true };
      const payload = { schedule: hasPendingList ? schedule : [{ date, slots }] };
      const res = await api.post('/api/doctors/schedule', payload);
      return res.data;
    },
    onSuccess: () => setMsg('Schedule saved'),
    onError: (e: any) => setMsg(e.response?.data?.message || 'Schedule save failed')
  });

  const handleSaveAll = async () => {
    setSaving(true); setMsg(null);
    try {
      await saveProfileMutation.mutateAsync();
      await saveScheduleMutation.mutateAsync();
      setMsg('Doctor registration completed');
    } finally { setSaving(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
      <Card style={styles.card}><Card.Content>
        <Text style={styles.title}>Doctor Registration</Text>
        <TextInput label="Specialties (comma separated)" value={specialties} onChangeText={setSpecialties} mode="outlined" style={styles.input} />
        <Divider style={styles.divider} />
        <Text style={styles.subtitle}>Clinic</Text>
        <TextInput label="Clinic Name" value={clinicName} onChangeText={setClinicName} mode="outlined" style={styles.input} />
        <TextInput label="Clinic Address" value={clinicAddress} onChangeText={setClinicAddress} mode="outlined" style={styles.input} />
        <View style={styles.row}>
          <TextInput label="Latitude" value={lat} onChangeText={setLat} keyboardType="numeric" mode="outlined" style={[styles.input, styles.half]} />
          <TextInput label="Longitude" value={lng} onChangeText={setLng} keyboardType="numeric" mode="outlined" style={[styles.input, styles.half]} />
        </View>
        <View style={styles.row}>
          <TextInput label="Consultation Fee (₹)" value={fee} onChangeText={setFee} keyboardType="numeric" mode="outlined" style={[styles.input, styles.half]} />
          <TextInput label="Experience (years)" value={experienceYears} onChangeText={setExperienceYears} keyboardType="numeric" mode="outlined" style={[styles.input, styles.half]} />
        </View>
        <TextInput label="Bio" value={bio} onChangeText={setBio} mode="outlined" multiline style={styles.input} />
      </Card.Content></Card>

      <Card style={styles.card}><Card.Content>
        <Text style={styles.subtitle}>Quick Schedule</Text>
        <DatePickerField label="Date" value={date} onChange={setDate} style={styles.input} />
        <View style={styles.row}>
          <TextInput label="From (HH:MM)" value={from} onChangeText={setFrom} mode="outlined" style={[styles.input, styles.half]} />
          <TextInput label="To (HH:MM)" value={to} onChangeText={setTo} mode="outlined" style={[styles.input, styles.half]} />
        </View>
        <View style={styles.row}>
          <Button mode="outlined" onPress={addSlot} style={{ marginBottom: 10, marginRight: 8 }}>Add Time Range</Button>
          <Button mode="contained" onPress={addDateToSchedule} disabled={!date || slots.length === 0} style={{ marginBottom: 10 }}>Add Date</Button>
        </View>
        {slots.length > 0 ? (
          <View>
            {slots.map((s, idx) => (<Text key={idx} style={{ color: '#555' }}>{s.from} - {s.to}</Text>))}
          </View>
        ) : <Text style={{ color: '#777' }}>No slots added</Text>}

        {schedule.length > 0 ? (
          <View style={{ marginTop: 10 }}>
            <Text style={{ fontWeight: '600', marginBottom: 6 }}>Pending Dates:</Text>
            {schedule.map((d, idx) => (
              <Text key={idx} style={{ color: '#555' }}>{d.date}: {d.slots.map(s=>`${s.from}-${s.to}`).join(', ')}</Text>
            ))}
          </View>
        ) : null}
      </Card.Content></Card>

      <Button mode="contained" onPress={handleSaveAll} loading={saving} style={{ margin: 12 }}>{saving ? 'Saving...' : 'Save & Finish'}</Button>
      {msg ? <Text style={{ textAlign: 'center', color: msg.includes('failed') ? '#F44336' : '#4CAF50' }}>{msg}</Text> : null}
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  card: { margin: 12, borderRadius: 12 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 15, fontWeight: '600', marginTop: 4, marginBottom: 6 },
  input: { marginBottom: 10 },
  divider: { marginVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  half: { flex: 1, marginHorizontal: 4 }
});

export default DoctorOnboardingScreen; 