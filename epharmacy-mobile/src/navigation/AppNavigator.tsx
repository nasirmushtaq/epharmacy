import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';

import { useAuth } from '../contexts/AuthContext';

// Import screens
import LoadingScreen from '../screens/common/LoadingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Customer screens
import HomeScreen from '../screens/customer/HomeScreen';
import MedicinesScreen from '../screens/customer/MedicinesScreen';
import CartScreen from '../screens/customer/CartScreen';
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
import { View } from 'react-native';
import { Text, Button } from 'react-native-paper';
import DoctorOnboardingScreen from '../screens/doctor/DoctorOnboardingScreen';
import DoctorBookingsScreen from '../screens/doctor/DoctorBookingsScreen';
import UsersAdminScreen from '../screens/admin/UsersAdminScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Auth Stack
const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
  </Stack.Navigator>
);

// Customer Tab Navigator
const CustomerTabs = () => (
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

        return <MaterialIcons name={iconName} size={size} color={color} />;
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
      headerRight: () => (
        <MaterialIcons name="shopping-cart" size={24} color="#fff" style={{ marginRight: 12 }} onPress={() => navigation.navigate('Cart' as never)} />
      ),
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
    <Tab.Screen name="Medicines" component={MedicinesScreen} />
    <Tab.Screen name="Bookings" component={CustomerBookingsScreen} />
    <Tab.Screen name="Doctors" component={DoctorsScreen} />
    <Tab.Screen name="Tests" component={TestsScreen} />
    <Tab.Screen name="Orders" component={OrdersScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
    {/* Hidden Cart route for header button navigation */}
    <Tab.Screen name="Cart" component={CartScreen} options={{ tabBarButton: () => null, title: 'Cart' }} />
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

// Admin Tab Navigator
const AdminTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ color, size }) => {
        let name: keyof typeof MaterialIcons.glyphMap = 'supervisor-account';
        if (route.name === 'Users') name = 'supervisor-account';
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
      default:
        return <CustomerTabs />;
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