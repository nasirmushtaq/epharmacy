import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import {
  Card,
  Text,
  Button,
  IconButton,
  Surface,
  Divider,
  TextInput,
  Switch,
  Avatar,
  List,
} from 'react-native-paper';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

const ProfileScreen = () => {
  const { state, logout } = useAuth();
  const user = state.user;

  // Profile editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: {
      street: user?.address?.street || '',
      city: user?.address?.city || '',
      state: user?.address?.state || '',
      zipCode: user?.address?.zipCode || '',
    }
  });

  // Settings state
  const [notifications, setNotifications] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [prescriptionReminders, setPrescriptionReminders] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Places Autocomplete for coordinates
  const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY;
  const [placeQuery, setPlaceQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ id: string; description: string }>>([]);
  const initialLat = (user as any)?.address?.coordinates?.latitude as number | undefined;
  const initialLng = (user as any)?.address?.coordinates?.longitude as number | undefined;
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>((initialLat != null && initialLng != null) ? { lat: initialLat, lng: initialLng } : null);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!GOOGLE_KEY) return;
      const q = placeQuery.trim();
      if (!q || q.length < 3) { if (active) setSuggestions([]); return; }
      try {
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&key=${GOOGLE_KEY}`;
        const res = await fetch(url);
        const json = await res.json();
        if (active && json?.predictions) {
          setSuggestions(json.predictions.map((p: any) => ({ id: p.place_id, description: p.description })));
        }
      } catch (e) {}
    };
    run();
    return () => { active = false; };
  }, [placeQuery, GOOGLE_KEY]);

  const pickPlace = async (placeId: string, description: string) => {
    try {
      if (!GOOGLE_KEY) return;
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_address,geometry/location&key=${GOOGLE_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      const loc = json?.result?.geometry?.location;
      if (loc?.lat && loc?.lng) {
        setCoords({ lat: loc.lat, lng: loc.lng });
        setEditedProfile(prev => ({ ...prev, address: { ...prev.address, street: json?.result?.formatted_address || description } }));
        setPlaceQuery(description);
        setSuggestions([]);
      }
    } catch (e) {}
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const payload: any = {
        firstName: editedProfile.firstName,
        lastName: editedProfile.lastName,
        phone: editedProfile.phone,
        address: {
          street: editedProfile.address.street,
          city: editedProfile.address.city,
          state: editedProfile.address.state,
          zipCode: editedProfile.address.zipCode,
          coordinates: coords ? { latitude: coords.lat, longitude: coords.lng } : undefined,
        },
      };

      const userId = (user as any)?.id || (user as any)?._id;
      const response = await api.put(`/api/users/${userId}`, payload);
      if (response.data?.success) {
        setSaveMsg('Profile updated successfully!');
      } else {
        setSaveMsg(response.data?.message || 'Update completed');
      }
    } catch (error) {
      setSaveMsg('Failed to update profile. Please try again.');
      console.error('Error updating profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = () => {
    Alert.alert(
      'Change Password',
      'Password change functionality will be implemented',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => {} }
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            Alert.alert('Account Deleted', 'Your account has been scheduled for deletion.');
          }
        }
      ]
    );
  };

  const handleLogout = () => {
    logout();
  };

  const handleContactSupport = () => {
    Alert.alert('Contact Support', 'Support contact functionality will be implemented');
  };

  const handlePrivacyPolicy = () => {
    Alert.alert('Privacy Policy', 'Privacy policy will be displayed here');
  };

  const handleTermsOfService = () => {
    Alert.alert('Terms of Service', 'Terms of service will be displayed here');
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text>No user data available</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView style={styles.container} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
          {/* Profile Header */}
          <Card style={styles.headerCard}>
            <Card.Content style={styles.headerContent}>
              <Avatar.Text 
                size={80} 
                label={`${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`}
                style={styles.avatar}
              />
              <View style={styles.headerInfo}>
                <Text style={styles.userName}>
                  {user.firstName} {user.lastName}
                </Text>
                <Text style={styles.userEmail}>{user.email}</Text>
                <Text style={styles.userRole}>
                  {user.role === 'customer' ? 'Customer' : 
                   user.role === 'pharmacist' ? 'Pharmacist' : 
                   user.role === 'admin' ? 'Administrator' : 'User'}
                </Text>
              </View>
              <IconButton
                icon={isEditing ? "close" : "pencil"}
                onPress={() => setIsEditing(!isEditing)}
                mode="outlined"
              />
            </Card.Content>
          </Card>

          {/* Profile Information */}
          <Card style={styles.section}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Personal Information</Text>
              
              {isEditing ? (
                <View style={styles.editForm}>
                  <View style={styles.nameRow}>
                    <TextInput
                      label="First Name"
                      value={editedProfile.firstName}
                      onChangeText={(text) => setEditedProfile(prev => ({ ...prev, firstName: text }))}
                      style={[styles.input, styles.halfInput]}
                      mode="outlined"
                    />
                    <TextInput
                      label="Last Name"
                      value={editedProfile.lastName}
                      onChangeText={(text) => setEditedProfile(prev => ({ ...prev, lastName: text }))}
                      style={[styles.input, styles.halfInput]}
                      mode="outlined"
                    />
                  </View>
                  
                  <TextInput
                    label="Email"
                    value={editedProfile.email}
                    onChangeText={(text) => setEditedProfile(prev => ({ ...prev, email: text }))}
                    style={styles.input}
                    mode="outlined"
                    keyboardType="email-address"
                  />
                  
                  <TextInput
                    label="Phone"
                    value={editedProfile.phone}
                    onChangeText={(text) => setEditedProfile(prev => ({ ...prev, phone: text }))}
                    style={styles.input}
                    mode="outlined"
                    keyboardType="phone-pad"
                  />
                  
                  <Text style={styles.subSectionTitle}>Address</Text>

                  {!!GOOGLE_KEY && (
                    <>
                      <TextInput
                        label="Search address / place"
                        value={placeQuery}
                        onChangeText={setPlaceQuery}
                        style={styles.input}
                        mode="outlined"
                        right={<TextInput.Icon icon="magnify" />}
                      />
                      {suggestions.length > 0 && (
                        <View style={{ backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#eee', marginBottom: 8 }}>
                          {suggestions.slice(0,5).map(s => (
                            <Button key={s.id} onPress={()=>pickPlace(s.id, s.description)} style={{ justifyContent: 'flex-start' }}>
                              {s.description}
                            </Button>
                          ))}
                        </View>
                      )}
                    </>
                  )}
                  
                  <View style={styles.addressRow}>
                    <TextInput
                      label="City"
                      value={editedProfile.address.city}
                      onChangeText={(text) => setEditedProfile(prev => ({ 
                        ...prev, 
                        address: { ...prev.address, city: text }
                      }))}
                      style={[styles.input, styles.halfInput]}
                      mode="outlined"
                    />
                    <TextInput
                      label="State"
                      value={editedProfile.address.state}
                      onChangeText={(text) => setEditedProfile(prev => ({ 
                        ...prev, 
                        address: { ...prev.address, state: text }
                      }))}
                      style={[styles.input, styles.halfInput]}
                      mode="outlined"
                    />
                  </View>
                  
                  <TextInput
                    label="ZIP Code"
                    value={editedProfile.address.zipCode}
                    onChangeText={(text) => setEditedProfile(prev => ({ 
                      ...prev, 
                      address: { ...prev.address, zipCode: text }
                    }))}
                    style={styles.input}
                    mode="outlined"
                    keyboardType="numeric"
                  />

                  {coords ? (
                    <Text style={{ color: '#666', marginBottom: 10 }}>Location set: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</Text>
                  ) : null}

                  <View style={styles.editActions}>
                    <Button
                      mode="outlined"
                      onPress={() => setIsEditing(false)}
                      style={styles.actionButton}
                    >
                      Cancel
                    </Button>
                    <Button 
                      mode="contained"
                      onPress={handleSaveProfile}
                      loading={saving}
                      style={styles.actionButton}
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                    {saveMsg ? <Text style={{ marginTop: 8, color: saveMsg.includes('failed') ? '#F44336' : '#4CAF50' }}>{saveMsg}</Text> : null}
                  </View>
                </View>
              ) : (
                <View style={styles.infoDisplay}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Name:</Text>
                    <Text style={styles.infoValue}>{user.firstName} {user.lastName}</Text>
                  </View>
                  
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Email:</Text>
                    <Text style={styles.infoValue}>{user.email}</Text>
                  </View>
                  
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Phone:</Text>
                    <Text style={styles.infoValue}>{user.phone || 'Not provided'}</Text>
                  </View>
                  
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Address:</Text>
                    <Text style={styles.infoValue}>
                      {user.address ? 
                        `${user.address.street || ''}\n${user.address.city || ''}, ${user.address.state || ''} ${user.address.zipCode || ''}`.trim() 
                        : 'Not provided'
                      }
                    </Text>
                  </View>
                </View>
              )}
            </Card.Content>
          </Card>

          {/* Settings */}
          <Card style={styles.section}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Notification Settings</Text>
              
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Push Notifications</Text>
                  <Text style={styles.settingDescription}>Receive order updates and reminders</Text>
                </View>
                <Switch
                  value={notifications}
                  onValueChange={setNotifications}
                />
              </View>
              
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Email Updates</Text>
                  <Text style={styles.settingDescription}>Get promotional offers and news</Text>
                </View>
                <Switch
                  value={emailUpdates}
                  onValueChange={setEmailUpdates}
                />
              </View>
              
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Prescription Reminders</Text>
                  <Text style={styles.settingDescription}>Reminders for prescription refills</Text>
                </View>
                <Switch
                  value={prescriptionReminders}
                  onValueChange={setPrescriptionReminders}
                />
              </View>
            </Card.Content>
          </Card>

          {/* Account Actions */}
          <Card style={styles.section}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Account</Text>
              
              <List.Item
                title="Change Password"
                description="Update your account password"
                left={(props) => <List.Icon {...props} icon="lock" />}
                right={(props) => <List.Icon {...props} icon="chevron-right" />}
                onPress={handleChangePassword}
                style={styles.listItem}
              />
              
              <Divider />
              
              <List.Item
                title="Contact Support"
                description="Get help with your account"
                left={(props) => <List.Icon {...props} icon="help-circle" />}
                right={(props) => <List.Icon {...props} icon="chevron-right" />}
                onPress={handleContactSupport}
                style={styles.listItem}
              />
              
              <Divider />
              
              <List.Item
                title="Privacy Policy"
                description="View our privacy policy"
                left={(props) => <List.Icon {...props} icon="shield-check" />}
                right={(props) => <List.Icon {...props} icon="chevron-right" />}
                onPress={handlePrivacyPolicy}
                style={styles.listItem}
              />
              
              <Divider />
              
              <List.Item
                title="Terms of Service"
                description="Read our terms and conditions"
                left={(props) => <List.Icon {...props} icon="file-document" />}
                right={(props) => <List.Icon {...props} icon="chevron-right" />}
                onPress={handleTermsOfService}
                style={styles.listItem}
              />
            </Card.Content>
          </Card>

          {/* Danger Zone */}
          <Card style={[styles.section, styles.dangerSection]}>
            <Card.Content>
              <Text style={styles.dangerTitle}>Danger Zone</Text>
              
              <Button
                mode="outlined"
                onPress={handleDeleteAccount}
                style={[styles.dangerButton, { borderColor: '#F44336' }]}
                textColor="#F44336"
              >
                Delete Account
              </Button>
            </Card.Content>
          </Card>

          {/* Logout Button */}
          <View style={styles.logoutSection}>
            <Button mode="contained" onPress={handleLogout} style={styles.logoutButton} contentStyle={styles.logoutButtonContent}>
              Logout
            </Button>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerCard: {
    margin: 16,
    borderRadius: 12,
    elevation: 3,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: '#2196F3',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 16,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  userRole: {
    fontSize: 12,
    color: '#2196F3',
    marginTop: 2,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  section: {
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  subSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  editForm: {
    gap: 12,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addressRow: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    backgroundColor: 'transparent',
  },
  halfInput: {
    flex: 1,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
  },
  infoDisplay: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    width: 80,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    lineHeight: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  listItem: {
    paddingHorizontal: 0,
  },
  dangerSection: {
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  dangerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F44336',
    marginBottom: 16,
  },
  dangerButton: {
    borderWidth: 1,
  },
  logoutSection: {
    margin: 16,
    marginTop: 0,
    marginBottom: 32,
  },
  logoutButton: {
    borderRadius: 12,
    backgroundColor: '#F44336',
  },
  logoutButtonContent: {
    paddingVertical: 12,
  },
});

export default ProfileScreen; 