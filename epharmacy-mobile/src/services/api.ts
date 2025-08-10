import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// API configuration
// Prefer explicit env (EXPO_PUBLIC_API_URL) → then LAN IP for device → fall back to localhost
const ENV_API = process.env.EXPO_PUBLIC_API_URL;
const LAN_API = 'http://192.168.0.4:8000'; // auto-detected during setup; change if your LAN IP changes
const LOCAL_API = 'http://localhost:8000';

const API_BASE_URL = __DEV__
  ? (Platform.select({ ios: LAN_API, android: LAN_API, default: LOCAL_API }))
  : (ENV_API || LAN_API);

// Create axios instance
const api = axios.create({
  baseURL: ENV_API || API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch (error) {
      console.error('Error getting token from AsyncStorage:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('token');
    }
    return Promise.reject(error);
  }
);

// Separate axios instance for auth operations (no auth header required)
export const authApi = axios.create({
  baseURL: ENV_API || API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

export default api; 