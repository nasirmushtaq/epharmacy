import { useState, useEffect, useRef } from 'react';
import { Platform, Alert, AppState } from 'react-native';
import * as Location from 'expo-location';
import { useMutation } from '@tanstack/react-query';
import api from '../services/api';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

interface UseLocationTrackingOptions {
  deliveryId?: string; // If provided, will update delivery location
  updateInterval?: number; // In milliseconds, default 30 seconds
  enableTracking?: boolean; // Whether to start tracking automatically
  enableAgentLocation?: boolean; // Whether to update agent's current location
}

export const useLocationTracking = (options: UseLocationTrackingOptions = {}) => {
  const {
    deliveryId,
    updateInterval = 30000, // 30 seconds
    enableTracking = false,
    enableAgentLocation = false
  } = options;

  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');

  const watchIdRef = useRef<Location.LocationSubscription | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);

  // Mutation for updating delivery location
  const updateDeliveryLocationMutation = useMutation({
    mutationFn: async (location: LocationData) => {
      if (!deliveryId) return;
      const response = await api.put(`/api/deliveries/${deliveryId}/location`, {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy
      });
      return response.data;
    },
    onError: (error: any) => {
      console.warn('Failed to update delivery location:', error.response?.data?.message || error.message);
    }
  });

  // Mutation for updating agent location
  const updateAgentLocationMutation = useMutation({
    mutationFn: async (location: LocationData) => {
      const response = await api.put('/api/delivery-agents/location', {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy
      });
      return response.data;
    },
    onError: (error: any) => {
      console.warn('Failed to update agent location:', error.response?.data?.message || error.message);
    }
  });

  // Request location permissions
  const requestPermissions = async (): Promise<boolean> => {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        setLocationError('Location permission not granted');
        setPermissionStatus('denied');
        return false;
      }

      // Request background permissions for continuous tracking
      if (Platform.OS === 'android') {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus !== 'granted') {
          console.warn('Background location permission not granted');
        }
      }

      setPermissionStatus('granted');
      setLocationError(null);
      return true;
    } catch (error) {
      setLocationError('Failed to request location permissions');
      setPermissionStatus('denied');
      return false;
    }
  };

  // Get current location once
  const getCurrentLocation = async (): Promise<LocationData | null> => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return null;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        maximumAge: 10000, // Accept cached location if less than 10 seconds old
      });

      const locationData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        timestamp: location.timestamp
      };

      setCurrentLocation(locationData);
      return locationData;
    } catch (error: any) {
      setLocationError(`Failed to get location: ${error.message}`);
      return null;
    }
  };

  // Start continuous location tracking
  const startTracking = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      // Stop any existing tracking
      await stopTracking();

      setIsTracking(true);
      setLocationError(null);

      // Start watching position
      watchIdRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: Math.min(updateInterval, 10000), // Update at least every 10 seconds for smooth tracking
          distanceInterval: 10, // Update every 10 meters
        },
        (location) => {
          const locationData: LocationData = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || undefined,
            timestamp: location.timestamp
          };

          setCurrentLocation(locationData);

          // Update server location if enough time has passed
          const now = Date.now();
          if (now - lastUpdateRef.current >= updateInterval) {
            lastUpdateRef.current = now;

            // Update delivery location if tracking a delivery
            if (deliveryId) {
              updateDeliveryLocationMutation.mutate(locationData);
            }

            // Update agent location if enabled
            if (enableAgentLocation) {
              updateAgentLocationMutation.mutate(locationData);
            }
          }
        }
      );

      // Set up periodic server updates
      updateIntervalRef.current = setInterval(() => {
        if (currentLocation) {
          if (deliveryId) {
            updateDeliveryLocationMutation.mutate(currentLocation);
          }
          if (enableAgentLocation) {
            updateAgentLocationMutation.mutate(currentLocation);
          }
        }
      }, updateInterval);

    } catch (error: any) {
      setLocationError(`Failed to start tracking: ${error.message}`);
      setIsTracking(false);
    }
  };

  // Stop location tracking
  const stopTracking = async () => {
    if (watchIdRef.current) {
      watchIdRef.current.remove();
      watchIdRef.current = null;
    }

    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }

    setIsTracking(false);
  };

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' && isTracking) {
        // Continue tracking in background if permissions allow
        console.log('App moved to background, continuing location tracking');
      } else if (nextAppState === 'active' && enableTracking && !isTracking) {
        // Restart tracking when app becomes active
        startTracking();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isTracking, enableTracking]);

  // Auto-start tracking if enabled
  useEffect(() => {
    if (enableTracking && !isTracking) {
      startTracking();
    }

    return () => {
      stopTracking();
    };
  }, [enableTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, []);

  return {
    currentLocation,
    isTracking,
    locationError,
    permissionStatus,
    startTracking,
    stopTracking,
    getCurrentLocation,
    requestPermissions,
    isUpdatingDeliveryLocation: updateDeliveryLocationMutation.isPending,
    isUpdatingAgentLocation: updateAgentLocationMutation.isPending
  };
};
