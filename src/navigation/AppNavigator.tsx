import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { useAuth } from '../contexts/AuthContext';

// Import screens
import LoadingScreen from '../screens/common/LoadingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Customer screens
import CustomerHomeScreen from '../screens/customer/HomeScreen';
import MedicinesScreen from '../screens/customer/MedicinesScreen';
import CartScreen from '../screens/customer/CartScreen';
import OrdersScreen from '../screens/customer/OrdersScreen';
import PrescriptionsScreen from '../screens/customer/PrescriptionsScreen';
import ProfileScreen from '../screens/customer/ProfileScreen';

// Pharmacist screens
import InventoryScreen from '../screens/pharmacist/InventoryScreen';
import PrescriptionReviewScreen from '../screens/pharmacist/PrescriptionReviewScreen';
import OrderManagementScreen from '../screens/pharmacist/OrderManagementScreen';

// Use HomeScreen as dashboard for pharmacists too
const PharmacistDashboardScreen = CustomerHomeScreen;
const AdminDashboardScreen = CustomerHomeScreen;

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
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName = '';

        switch (route.name) {
          case 'Home':
            iconName = 'home';
            break;
          case 'Medicines':
            iconName = 'local-pharmacy';
            break;
          case 'Cart':
            iconName = 'shopping-cart';
            break;
          case 'Orders':
            iconName = 'receipt';
            break;
          case 'Prescriptions':
            iconName = 'description';
            break;
          case 'Profile':
            iconName = 'person';
            break;
          default:
            iconName = 'home';
        }

        return <Icon name={iconName} size={size} color={color} />;
      },
      tabBarActiveTintColor: '#2196F3',
      tabBarInactiveTintColor: 'gray',
      headerShown: true,
      headerStyle: {
        backgroundColor: '#2196F3',
      },
      headerTintColor: '#fff',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    })}
  >
    <Tab.Screen name="Home" component={CustomerHomeScreen} />
    <Tab.Screen name="Medicines" component={MedicinesScreen} />
    <Tab.Screen name="Cart" component={CartScreen} />
    <Tab.Screen name="Orders" component={OrdersScreen} />
    <Tab.Screen name="Prescriptions" component={PrescriptionsScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

// Pharmacist Tab Navigator
const PharmacistTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName = '';

        switch (route.name) {
          case 'Dashboard':
            iconName = 'dashboard';
            break;
          case 'Inventory':
            iconName = 'inventory';
            break;
          case 'Prescriptions':
            iconName = 'assignment';
            break;
          case 'Orders':
            iconName = 'shopping-cart';
            break;
          case 'Profile':
            iconName = 'person';
            break;
          default:
            iconName = 'dashboard';
        }

        return <Icon name={iconName} size={size} color={color} />;
      },
      tabBarActiveTintColor: '#4CAF50',
      tabBarInactiveTintColor: 'gray',
      headerShown: true,
      headerStyle: {
        backgroundColor: '#4CAF50',
      },
      headerTintColor: '#fff',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    })}
  >
    <Tab.Screen 
      name="Dashboard" 
      component={PharmacistDashboardScreen}
      options={{ title: 'Pharmacist Dashboard' }}
    />
    <Tab.Screen 
      name="Inventory" 
      component={InventoryScreen}
      options={{ title: 'Inventory Management' }}
    />
    <Tab.Screen 
      name="Prescriptions" 
      component={PrescriptionReviewScreen}
      options={{ title: 'Prescription Reviews' }}
    />
    <Tab.Screen 
      name="Orders" 
      component={OrderManagementScreen}
      options={{ title: 'Order Management' }}
    />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

// Admin Tab Navigator
const AdminTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName = '';

        switch (route.name) {
          case 'Dashboard':
            iconName = 'admin-panel-settings';
            break;
          case 'Profile':
            iconName = 'person';
            break;
          default:
            iconName = 'dashboard';
        }

        return <Icon name={iconName} size={size} color={color} />;
      },
      tabBarActiveTintColor: '#FF9800',
      tabBarInactiveTintColor: 'gray',
      headerShown: true,
      headerStyle: {
        backgroundColor: '#FF9800',
      },
      headerTintColor: '#fff',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    })}
  >
    <Tab.Screen 
      name="Dashboard" 
      component={AdminDashboardScreen}
      options={{ title: 'Admin Dashboard' }}
    />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

// Main App Navigator
const AppNavigator = () => {
  const { state } = useAuth();

  if (state.isLoading) {
    return <LoadingScreen />;
  }

  if (!state.user) {
    return (
      <NavigationContainer>
        <AuthStack />
      </NavigationContainer>
    );
  }

  const getRoleBasedNavigator = () => {
    switch (state.user?.role) {
      case 'customer':
        return <CustomerTabs />;
      case 'pharmacist':
        return <PharmacistTabs />;
      case 'admin':
        return <AdminTabs />;
      default:
        return <CustomerTabs />;
    }
  };

  return (
    <NavigationContainer>
      {getRoleBasedNavigator()}
    </NavigationContainer>
  );
};

export default AppNavigator; 