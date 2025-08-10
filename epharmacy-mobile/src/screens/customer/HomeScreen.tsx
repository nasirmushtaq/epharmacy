import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions, FlatList } from 'react-native';
import { Text, Card, Button, Avatar, Surface, Divider, IconButton } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';

const { width } = Dimensions.get('window');

const HomeScreen = ({ navigation }: any) => {
  const { state, logout } = useAuth();

  const handleNavigation = (screen: string) => {
    console.log('Navigation attempt:', screen, 'Navigation prop:', !!navigation);
    
    // Navigate to the corresponding tab
    const screenMap: { [key: string]: string } = {
      'Medicines': 'Medicines',
      'Prescriptions': 'Prescriptions', 
      'Orders': 'Orders',
      'Cart': 'Cart',
      'Profile': 'Profile',
      'Inventory': 'Inventory',
      'PrescriptionReview': 'Reviews', // Map to Reviews tab for pharmacists
      'OrderManagement': 'Orders',
      'Analytics': 'Home' // For now, redirect to home
    };

    const targetScreen = screenMap[screen];
    console.log('Target screen:', targetScreen);
    
    if (targetScreen && navigation) {
      try {
        navigation.navigate(targetScreen);
        console.log('Navigation successful to:', targetScreen);
      } catch (error) {
        console.error('Navigation error:', error);
        alert(`Navigation error: ${error}`);
      }
    } else {
      // Debug info
      console.log('Navigation failed:', { targetScreen, hasNavigation: !!navigation });
      alert(`Debug: targetScreen=${targetScreen}, hasNavigation=${!!navigation}, screen=${screen}`);
    }
  };

  const quickActions = [
    {
      id: 1,
      title: 'Browse Medicines',
      subtitle: 'Find medicines you need',
      icon: 'local-pharmacy',
      color: '#4CAF50',
      action: () => handleNavigation('Medicines'),
      show: true
    },
    {
      id: 2,
      title: 'Upload Prescriptions',
      subtitle: 'Submit prescription for review',
      icon: 'file-upload',
      color: '#2196F3',
      action: () => handleNavigation('Prescriptions'),
      show: true
    },
    {
      id: 3,
      title: 'View Orders',
      subtitle: 'Track your orders',
      icon: 'receipt-long',
      color: '#FF9800',
      action: () => handleNavigation('Orders'),
      show: true
    },
    {
      id: 4,
      title: 'Shopping Cart',
      subtitle: 'Review items to purchase',
      icon: 'shopping-cart',
      color: '#9C27B0',
      action: () => handleNavigation('Cart'),
      show: true
    },
    {
      id: 5,
      title: 'Manage Inventory',
      subtitle: 'Update stock and medicines',
      icon: 'inventory',
      color: '#607D8B',
      action: () => handleNavigation('Inventory'),
      show: state.user?.role === 'pharmacist'
    },
    {
      id: 6,
      title: 'Review Prescriptions',
      subtitle: 'Approve or reject prescriptions',
      icon: 'assignment',
      color: '#795548',
      action: () => handleNavigation('PrescriptionReview'),
      show: state.user?.role === 'pharmacist'
    },
    {
      id: 7,
      title: 'Order Management',
      subtitle: 'Process and track orders',
      icon: 'manage-search',
      color: '#E91E63',
      action: () => handleNavigation('OrderManagement'),
      show: state.user?.role === 'pharmacist'
    },
    {
      id: 8,
      title: 'Analytics Dashboard',
      subtitle: 'View sales and statistics',
      icon: 'analytics',
      color: '#673AB7',
      action: () => handleNavigation('Analytics'),
      show: state.user?.role === 'pharmacist'
    }
  ];

  const filteredActions = quickActions.filter(action => action.show);

  const getRoleColor = () => {
    switch (state.user?.role) {
      case 'customer': return '#2196F3';
      case 'pharmacist': return '#4CAF50';
      case 'admin': return '#FF9800';
      default: return '#2196F3';
    }
  };

  const getRoleIcon = () => {
    switch (state.user?.role) {
      case 'customer': return 'person';
      case 'pharmacist': return 'medical-services';
      case 'admin': return 'admin-panel-settings';
      default: return 'person';
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Modern Header Section */}
      <View style={styles.headerSection}>
        <View style={styles.headerBackground} />
        <View style={styles.headerContent}>
          <View style={styles.userSection}>
            <View style={[styles.avatarContainer, { backgroundColor: getRoleColor() }]}>
              <MaterialIcons name={getRoleIcon()} size={32} color="#fff" />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.welcomeText}>Welcome back!</Text>
              <Text style={styles.userName}>
                {state.user?.firstName || 'User'} {state.user?.lastName || ''}
              </Text>
              <View style={[styles.roleBadge, { backgroundColor: getRoleColor() }]}>
                <Text style={styles.roleText}>
                  {state.user?.role ? state.user.role.charAt(0).toUpperCase() + state.user.role.slice(1) : 'User'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        {/* Quick Actions - Reliable 2-column grid using FlatList */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <FlatList
            data={filteredActions}
            keyExtractor={(item) => String(item.id)}
            numColumns={2}
            columnWrapperStyle={styles.actionRow}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={item.action}
                style={styles.actionTouchable}
                activeOpacity={0.8}
              >
                <Card style={styles.actionCard} elevation={4}>
                  <View style={styles.actionContent}>
                    <View style={[styles.actionIconContainer, { backgroundColor: item.color }]}>
                      <MaterialIcons name={item.icon as any} size={28} color="#fff" />
                    </View>
                    <Text style={styles.actionTitle}>{item.title}</Text>
                    <Text style={styles.actionSubtitle}>{item.subtitle}</Text>
                  </View>
                </Card>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Account Summary */}
        <Card style={styles.summaryCard} elevation={3}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Account Information</Text>
            <TouchableOpacity onPress={() => handleNavigation('Profile')}>
              <MaterialIcons name="edit" size={20} color="#666" />
            </TouchableOpacity>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.summaryContent}>
            <View style={styles.infoRow}>
              <MaterialIcons name="email" size={20} color="#666" />
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{state.user?.email}</Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialIcons name="phone" size={20} color="#666" />
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{state.user?.phone || 'Not provided'}</Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialIcons name="verified" size={20} color="#4CAF50" />
              <Text style={styles.infoLabel}>Status</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>Active</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Stats Section for Pharmacist */}
        {state.user?.role === 'pharmacist' && (
          <Card style={styles.statsCard} elevation={3}>
            <View style={styles.statsHeader}>
              <Text style={styles.summaryTitle}>Today's Overview</Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: '#FF9800' }]}>
                  <MaterialIcons name="pending" size={24} color="#fff" />
                </View>
                <Text style={styles.statNumber}>12</Text>
                <Text style={styles.statLabel}>Pending Orders</Text>
              </View>
              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: '#4CAF50' }]}>
                  <MaterialIcons name="check-circle" size={24} color="#fff" />
                </View>
                <Text style={styles.statNumber}>5</Text>
                <Text style={styles.statLabel}>Approved Rx</Text>
              </View>
              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: '#2196F3' }]}>
                  <MaterialIcons name="inventory" size={24} color="#fff" />
                </View>
                <Text style={styles.statNumber}>234</Text>
                <Text style={styles.statLabel}>In Stock</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Logout Button */}
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <MaterialIcons name="logout" size={20} color="#F44336" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  headerSection: {
    height: width * 0.4,
    position: 'relative',
    overflow: 'hidden',
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#2196F3',
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  headerContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 60,
    justifyContent: 'center',
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  userInfo: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
    fontWeight: '500',
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  roleBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  roleText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    marginTop: -20,
  },
  actionsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  actionsGrid: {},
  actionRow: {
    flex: 1,
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  actionTouchable: {
    flexBasis: '48%',
    maxWidth: '48%',
  },
  actionCard: {
    borderRadius: 20,
    backgroundColor: '#fff',
    height: 140, // Fixed height for consistency
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  actionContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    height: '100%',
  },
  actionIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 18,
  },
  actionSubtitle: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    lineHeight: 14,
    fontWeight: '500',
  },
  summaryCard: {
    marginBottom: 24,
    borderRadius: 20,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  divider: {
    marginHorizontal: 20,
    backgroundColor: '#f0f0f0',
  },
  summaryContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    fontWeight: '600',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '600',
    flex: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#4CAF50',
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  statsCard: {
    marginBottom: 24,
    borderRadius: 20,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  statsHeader: {
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F44336',
    backgroundColor: '#fff',
    marginTop: 16,
    marginBottom: 32,
    shadowColor: '#F44336',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#F44336',
    fontWeight: '700',
  },
});

export default HomeScreen;
