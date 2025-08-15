import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';

// Import screens
import LoadingScreen from '../screens/common/LoadingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import OtpVerifyScreen from '../screens/auth/OtpVerifyScreen';

// Customer screens
import HomeScreen from '../screens/customer/HomeScreen';
import MedicinesScreen from '../screens/customer/MedicinesScreen';
import CartScreen from '../screens/customer/CartScreen';
// @ts-ignore
import MedicineDetailScreen from '../screens/customer/MedicineDetailScreen';
// @ts-ignore
import DoctorDetailScreen from '../screens/customer/DoctorDetailScreen';
import OrdersScreen from '../screens/customer/OrdersScreen';
import PrescriptionsScreen from '../screens/customer/PrescriptionsScreen';
import TestsScreen from '../screens/customer/TestsScreen';
import ProfileScreen from '../screens/customer/ProfileScreen';
import DoctorsScreen from '../screens/customer/DoctorsScreen';
import CustomerBookingsScreen from '../screens/customer/CustomerBookingsScreen';

// Pharmacist screens
import InventoryScreen from '../screens/pharmacist/InventoryScreen';
import PrescriptionReviewScreen from '../screens/pharmacist/PrescriptionReviewScreen';
import OrderManagementScreen from '../screens/pharmacist/OrderManagementScreen';
import TestsAdminScreen from '../screens/admin/TestsAdminScreen';
import { Button } from 'react-native-paper';
import DoctorOnboardingScreen from '../screens/doctor/DoctorOnboardingScreen';
import DoctorBookingsScreen from '../screens/doctor/DoctorBookingsScreen';
import UsersAdminScreen from '../screens/admin/UsersAdminScreen';
import CatalogAdminScreen from '../screens/admin/CatalogAdminScreen';
import DeliveryAgentDashboard from '../screens/delivery/DeliveryAgentDashboard';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Cart Button Component with Badge
const CartButton = ({ navigation }: { navigation: any }) => {
  const { items } = useCart();
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);

  const handlePress = () => {
    const parentNavigation = navigation.getParent();
    if (parentNavigation) {
      parentNavigation.navigate('Cart');
    }
  };

  return (
    <TouchableOpacity onPress={handlePress} style={cartButtonStyles.container}>
      <MaterialIcons name="shopping-cart" size={24} color="#fff" />
      {itemCount > 0 && (
        <View style={cartButtonStyles.badge}>
          <Text style={cartButtonStyles.badgeText}>
            {itemCount > 99 ? '99+' : itemCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const cartButtonStyles = StyleSheet.create({
  container: {
    marginRight: 12,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

// Auth Stack
const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
    <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
  </Stack.Navigator>
);

// Customer Stack Navigator (includes tabs + cart)
const CustomerStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="CustomerTabs" component={CustomerTabsComponent} />
    <Stack.Screen
      name="Cart"
      component={CartScreen}
      options={{
        headerShown: true,
        title: 'Cart',
        headerBackTitle: '',
        headerRight: () => null,
        headerTitleStyle: { fontWeight: '700' },
        headerLeftContainerStyle: { paddingLeft: 8 },
        headerRightContainerStyle: { paddingRight: 8 },
      }}
    />
    <Stack.Screen
      name="MedicineDetail"
      component={MedicineDetailScreen}
      options={{ headerShown: true, title: 'Medicine', headerBackTitle: '' }}
    />
    <Stack.Screen
      name="DoctorDetail"
      component={DoctorDetailScreen}
      options={{ headerShown: true, title: 'Doctor', headerBackTitle: '' }}
    />
  </Stack.Navigator>
);

// Customer Tab Navigator
const CustomerTabsComponent = () => (
  <Tab.Navigator
    screenOptions={({ route, navigation }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName: keyof typeof MaterialIcons.glyphMap = 'home';

        switch (route.name) {
          case 'Medicines':
            iconName = 'medication';
            break;
          case 'Bookings':
            iconName = 'event';
            break;
          case 'Orders':
            iconName = 'receipt';
            break;
          case 'Tests':
            iconName = 'biotech';
            break;
          case 'Profile':
            iconName = 'person';
            break;
          case 'Doctors':
            iconName = 'healing';
            break;
        }

        return <MaterialIcons name={iconName} size={22} color={color} />;
      },
      tabBarActiveTintColor: '#2196F3',
      tabBarInactiveTintColor: 'gray',
      headerStyle: {
        backgroundColor: '#2196F3',
      },
      headerTintColor: '#fff',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
      headerRight: () => <CartButton navigation={navigation} />,
      tabBarStyle: {
        paddingBottom: 5,
        paddingTop: 5,
        height: 60,
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
        backgroundColor: '#FFFFFF',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      tabBarItemStyle: { 
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      },
      tabBarLabelStyle: {
        fontSize: 10,
        marginTop: -2,
        fontWeight: '500',
        textAlign: 'center',
      }
    })}
  >
    <Tab.Screen 
      name="Medicines" 
      component={MedicinesScreen}
      options={{
        tabBarLabel: 'Meds',
        headerTitle: 'Medicines'
      }}
    />
    <Tab.Screen 
      name="Doctors" 
      component={DoctorsScreen}
      options={{
        tabBarLabel: 'Doctors'
      }}
    />
    <Tab.Screen 
      name="Tests" 
      component={TestsScreen}
      options={{
        tabBarLabel: 'Tests'
      }}
    />
    <Tab.Screen 
      name="Bookings" 
      component={CustomerBookingsScreen}
      options={{
        tabBarLabel: 'Bookings'
      }}
    />
    <Tab.Screen 
      name="Orders" 
      component={OrdersScreen}
      options={{
        tabBarLabel: 'Orders'
      }}
    />

    <Tab.Screen 
      name="Profile" 
      component={ProfileScreen}
      options={{
        tabBarLabel: 'Profile',
        headerTitle: 'My Profile'
      }}
    />

  </Tab.Navigator>
);

// Pharmacist Tab Navigator
const PharmacistTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName: keyof typeof MaterialIcons.glyphMap = 'dashboard';

        switch (route.name) {
          case 'Home':
            iconName = 'dashboard';
            break;
          case 'Inventory':
            iconName = 'inventory';
            break;
          case 'Reviews':
            iconName = 'assignment';
            break;
          case 'Orders':
            iconName = 'shopping-cart';
            break;
          case 'Profile':
            iconName = 'person';
            break;
          case 'TestBookings':
            iconName = 'biotech';
            break;
        }

        return <MaterialIcons name={iconName} size={size} color={color} />;
      },
      tabBarActiveTintColor: '#4CAF50',
      tabBarInactiveTintColor: 'gray',
      headerStyle: {
        backgroundColor: '#4CAF50',
      },
      headerTintColor: '#fff',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
      tabBarStyle: {
        paddingBottom: 5,
        paddingTop: 5,
        height: 60,
      },
      tabBarItemStyle: { 
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      },
      tabBarLabelStyle: {
        fontSize: 11,
        marginTop: -5,
      }
    })}
  >
    <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Dashboard' }} />
    <Tab.Screen name="Inventory" component={InventoryScreen} />
    <Tab.Screen name="Reviews" component={PrescriptionReviewScreen} />
    <Tab.Screen name="TestBookings" options={{ title: 'Test Bookings' }} component={TestsAdminScreen} />
    <Tab.Screen name="Orders" component={OrderManagementScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

// Doctor Tab Navigator
const DoctorTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ color, size }) => {
        let icon: keyof typeof MaterialIcons.glyphMap = 'schedule';
        if (route.name === 'Bookings') icon = 'event';
        if (route.name === 'Profile') icon = 'person';
        return <MaterialIcons name={icon} size={size} color={color} />;
      },
      tabBarActiveTintColor: '#673AB7',
      tabBarInactiveTintColor: 'gray',
      headerStyle: { backgroundColor: '#673AB7' },
      headerTintColor: '#fff',
      headerTitleStyle: { fontWeight: 'bold' },
      tabBarStyle: {
        paddingBottom: 5,
        paddingTop: 5,
        height: 60,
      },
      tabBarItemStyle: { 
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      },
      tabBarLabelStyle: {
        fontSize: 11,
        marginTop: -5,
      }
    })}
  >
    <Tab.Screen name="Schedule" component={DoctorOnboardingScreen} />
    <Tab.Screen name="Bookings" component={DoctorBookingsScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

// Delivery Agent Tab Navigator
const DeliveryAgentTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ color, size }) => {
        let icon: keyof typeof MaterialIcons.glyphMap = 'delivery-dining';
        if (route.name === 'Deliveries') icon = 'delivery-dining';
        if (route.name === 'Profile') icon = 'person';
        return <MaterialIcons name={icon} size={size} color={color} />;
      },
      tabBarActiveTintColor: '#FF9800',
      tabBarInactiveTintColor: 'gray',
      headerStyle: { backgroundColor: '#FF9800' },
      headerTintColor: '#fff',
      headerTitleStyle: { fontWeight: 'bold' },
      tabBarStyle: {
        paddingBottom: 5,
        paddingTop: 5,
        height: 60,
      },
      tabBarItemStyle: { 
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      },
      tabBarLabelStyle: {
        fontSize: 11,
        marginTop: -5,
      }
    })}
  >
    <Tab.Screen name="Deliveries" component={DeliveryAgentDashboard} options={{ title: 'My Deliveries' }} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

// Admin Tab Navigator
const AdminTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ color, size }) => {
        let name: keyof typeof MaterialIcons.glyphMap = 'supervisor-account';
        if (route.name === 'Users') name = 'supervisor-account';
        else if (route.name === 'Catalog') name = 'inventory';
        else if (route.name === 'TestsAdmin') name = 'biotech';
        else if (route.name === 'Profile') name = 'person';
        return <MaterialIcons name={name} size={size} color={color} />;
      },
      tabBarActiveTintColor: '#1E88E5',
      tabBarInactiveTintColor: 'gray',
      headerStyle: { backgroundColor: '#1E88E5' },
      headerTintColor: '#fff',
      headerTitleStyle: { fontWeight: 'bold' },
      tabBarStyle: {
        paddingBottom: 5,
        paddingTop: 5,
        height: 60,
      },
      tabBarItemStyle: { 
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      },
      tabBarLabelStyle: {
        fontSize: 11,
        marginTop: -5,
      }
    })}
  >
    <Tab.Screen name="Users" options={{ title: 'User Approvals' }} component={UsersAdminScreen} />
    <Tab.Screen name="Catalog" options={{ title: 'Catalog' }} component={CatalogAdminScreen} />
    <Tab.Screen name="TestsAdmin" options={{ title: 'Tests' }} component={TestsAdminScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

// Main App Navigator
const AppNavigator = () => {
  const { state, logout } = useAuth();

  if (state.isLoading) {
    return <LoadingScreen />;
  }

  const getRoleBasedNavigator = () => {
    const role = state.user?.role;
    const isApproved = (state.user as any)?.isApproved !== false; // customers default true, others may be false
    if (role && role !== 'customer' && !isApproved) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#f5f5f5' }}>
          <MaterialIcons name="hourglass-empty" size={64} color="#FFC107" />
          <Text style={{ fontSize: 20, fontWeight: '700', marginTop: 12 }}>Account pending approval</Text>
          <Text style={{ color: '#666', textAlign: 'center', marginTop: 8 }}>
            Your {role} account is awaiting admin approval. You will be notified once it is activated.
          </Text>
          <Button mode="contained" onPress={logout} style={{ marginTop: 16 }}>
            Logout
          </Button>
        </View>
      );
    }
    switch (role) {
      case 'pharmacist':
        return <PharmacistTabs />;
      case 'doctor':
        return <DoctorTabs />;
      case 'admin':
        return <AdminTabs />;
      case 'delivery_agent':
        return <DeliveryAgentTabs />;
      default:
        return <CustomerStack />;
    }
  };

  return (
    <NavigationContainer
      ref={(navRef) => {
        // Expose minimal global ref for imperative navigation from utility handlers
        if (navRef) {
          // @ts-ignore
          (global as any).navigation = navRef;
        }
      }}
    >
      {state.user ? getRoleBasedNavigator() : <AuthStack />}
    </NavigationContainer>
  );
};

export default AppNavigator; 