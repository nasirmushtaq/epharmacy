import React, { useMemo, useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Card, Button, TextInput, Menu, Divider, Snackbar, Dialog, Portal, Switch, HelperText, IconButton, Chip } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

const ROLES = [
  { label: 'Pharmacists', value: 'pharmacist' },
  { label: 'Doctors', value: 'doctor' },
  { label: 'Delivery Agents', value: 'delivery_agent' },
  { label: 'Customers', value: 'customer' },
];

const UsersAdminScreen = () => {
  const qc = useQueryClient();
  const [snack, setSnack] = useState('');
  const [role, setRole] = useState<string>('pharmacist');
  const [search, setSearch] = useState('');
  const [pendingOnly, setPendingOnly] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogMode, setDialogMode] = useState<'approve' | 'reject'>('approve');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  const queryParams = useMemo(() => ({
    role,
    isApproved: pendingOnly ? 'false' : undefined,
    search: search || undefined,
    limit: 25,
    page: 1,
  }), [role, pendingOnly, search]);

  const { data, isFetching } = useQuery({
    queryKey: ['admin-users', queryParams],
    queryFn: async () => {
      const res = await api.get('/api/users', { params: queryParams });
      return res.data;
    }
  });

  const users = data?.data || [];

  const approvalMutation = useMutation({
    mutationFn: async ({ id, approve, reviewNotes: notes }: any) => {
      const res = await api.post(`/api/users/${id}/approval`, { approve, reviewNotes: notes || undefined });
      return res.data;
    },
    onSuccess: () => {
      setSnack('Decision saved');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setDialogVisible(false);
      setReviewNotes('');
      setSelectedUser(null);
    },
    onError: (e: any) => setSnack(e.response?.data?.message || 'Update failed')
  });

  const openDecision = (user: any, mode: 'approve' | 'reject') => {
    setSelectedUser(user);
    setDialogMode(mode);
    setDialogVisible(true);
  };

  const confirmDecision = () => {
    if (!selectedUser) return;
    approvalMutation.mutate({ id: selectedUser._id, approve: dialogMode === 'approve', reviewNotes });
  };

  const renderUser = ({ item }: any) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{item.firstName} {item.lastName}</Text>
          <Chip compact style={{ backgroundColor: item.isApproved ? '#E8F5E9' : '#FFF8E1' }} textStyle={{ color: item.isApproved ? '#2E7D32' : '#F9A825' }}>
            {item.isApproved ? 'Approved' : 'Pending'}
          </Chip>
        </View>
        <Text style={styles.meta}>{item.email} • {item.phone}</Text>
        <Text style={styles.meta}>Role: {item.role}</Text>
        {item.licenseNumber ? <Text style={styles.meta}>License: {item.licenseNumber} {item.licenseExpiry ? `• Exp: ${new Date(item.licenseExpiry).toLocaleDateString()}` : ''}</Text> : null}
        {item.pharmacyName ? <Text style={styles.meta}>Pharmacy: {item.pharmacyName}</Text> : null}
        <Divider style={{ marginVertical: 8 }} />
        <View style={styles.actionsRow}>
          <Button icon="check" compact mode="contained" style={[styles.btn, styles.btnWide]} onPress={() => openDecision(item, 'approve')} disabled={item.isApproved}>Approve</Button>
          <Button icon="close" compact mode="outlined" style={[styles.btn, styles.btnWide]} onPress={() => openDecision(item, 'reject')}>Reject</Button>
          <IconButton style={styles.inlineIcon} icon="account-details" onPress={() => setSnack('Details view coming soon')} />
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={<Button compact mode="outlined" onPress={() => setMenuVisible(true)}>{ROLES.find(r => r.value === role)?.label}</Button>}
        >
          {ROLES.map(r => (
            <Menu.Item key={r.value} onPress={() => { setRole(r.value); setMenuVisible(false); }} title={r.label} />
          ))}
        </Menu>
        <TextInput placeholder="Search name/email" value={search} onChangeText={setSearch} mode="outlined" style={styles.searchInput} />
        <View style={styles.pendingRow}>
          <Text style={{ marginRight: 6 }}>Pending only</Text>
          <Switch value={pendingOnly} onValueChange={setPendingOnly} />
        </View>
        <IconButton icon="refresh" onPress={() => qc.invalidateQueries({ queryKey: ['admin-users'] })} disabled={isFetching} />
      </View>
      <FlatList data={users} keyExtractor={(i:any) => i._id} renderItem={renderUser} contentContainerStyle={styles.listContent} />

      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>{dialogMode === 'approve' ? 'Approve user' : 'Reject user'}</Dialog.Title>
          <Dialog.Content>
            <HelperText type="info">Optional notes for this decision</HelperText>
            <TextInput
              value={reviewNotes}
              onChangeText={setReviewNotes}
              placeholder="Write notes..."
              multiline
              mode="outlined"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
            <Button onPress={confirmDecision} loading={approvalMutation.isPending}>{dialogMode === 'approve' ? 'Approve' : 'Reject'}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={!!snack} onDismiss={() => setSnack('')}>{snack}</Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  listContent: { padding: 12, alignItems: 'center' },
  filterRow: { flexDirection: 'row', alignItems: 'center', padding: 12, flexWrap: 'wrap' },
  searchInput: { flexGrow: 1, minWidth: 180, marginHorizontal: 8 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', marginRight: 8, marginTop: 8 },
  card: { marginBottom: 12, borderRadius: 12, width: '100%', maxWidth: 720 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontWeight: '700', fontSize: 16 },
  meta: { color: '#666', marginTop: 4 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, flexWrap: 'wrap' },
  btn: { marginRight: 6, marginBottom: 6 },
  btnWide: { flexBasis: '48%', flexGrow: 1 },
  inlineIcon: { marginLeft: 'auto' },
});

export default UsersAdminScreen; 