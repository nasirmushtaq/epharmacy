import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider as PaperProvider, DefaultTheme } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Alert } from 'react-native';
import 'react-native-gesture-handler';

import { AuthProvider } from './src/contexts/AuthContext';
import { CartProvider } from './src/contexts/CartContext';
import { AddressProvider } from './src/contexts/AddressContext';
import AppNavigator from './src/navigation/AppNavigator';

// Global error logging
const originalConsoleError = console.error;
console.error = (...args) => {
  console.log('🚨 GLOBAL ERROR CAUGHT:', ...args);
  originalConsoleError(...args);
};

// Catch unhandled promise rejections
const originalRejection = console.warn;
process.on?.('unhandledRejection', (reason, promise) => {
  console.log('🚨 UNHANDLED PROMISE REJECTION:', reason);
});

// React Error Boundary fallback
const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = React.useState(false);
  
  if (hasError) {
    console.log('🚨 REACT ERROR BOUNDARY TRIGGERED');
    return null; // Or some error UI
  }
  
  return <>{children}</>;
};

// Ensure Alert dialogs are enabled for confirmations

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Custom theme for React Native Paper
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#2196F3',
    accent: '#4CAF50',
    background: '#f5f5f5',
    surface: '#ffffff',
  },
};

export default function App() {
  console.log('🚀 App component rendering...');
  
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <CartProvider>
              <AddressProvider>
                <StatusBar style="light" backgroundColor="#2196F3" />
                <AppNavigator />
              </AddressProvider>
            </CartProvider>
          </AuthProvider>
        </QueryClientProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
