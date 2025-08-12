import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { authApi } from '../../services/api';

export default function OtpVerifyScreen({ route, navigation }: any) {
  const email = route?.params?.email || '';
  const phone = route?.params?.phone || '';
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setMsg(null); setLoading(true);
    try {
      const res = await authApi.post('/api/auth/verify-otp', { email, phone, code });
      if (res.data?.success) {
        setMsg('Verified! You can now login.');
        navigation.navigate('Login');
      } else {
        setMsg(res.data?.message || 'Failed to verify');
      }
    } catch (e: any) {
      setMsg(e?.response?.data?.message || 'Failed to verify');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify OTP</Text>
      <Text style={{ marginBottom: 12 }}>{email || phone}</Text>
      <TextInput label="OTP Code" value={code} onChangeText={setCode} mode="outlined" keyboardType='number-pad' style={{ marginBottom: 12 }} />
      <Button mode="contained" onPress={submit} loading={loading}>Verify</Button>
      {msg ? <Text style={{ marginTop: 10, color: msg.includes('Failed')? '#F44336':'#4CAF50' }}>{msg}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
});


