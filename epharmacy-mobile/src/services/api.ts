import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// API configuration
// Prefer explicit env (EXPO_PUBLIC_API_URL) → app.json extra.apiBaseUrl (via expo-constants) → last-resort LAN/localhost
const ENV_API = process.env.EXPO_PUBLIC_API_URL;

// Read from app config at runtime
const EXTRA: any = (Constants?.expoConfig?.extra || (Constants as any)?.manifest?.extra) || {};
const EXTRA_API: string | undefined = EXTRA.apiBaseUrl;

const LOCAL_API = 'http://localhost:8000';
const LOCAL_API_ANDROID = 'http://10.0.2.2:8000';

// Compile-time fallback by reading app.json (packaged string)
let APP_JSON_API: string | undefined;
try {
  // @ts-ignore
  const appCfg = require('../../../app.json');
  APP_JSON_API = appCfg?.expo?.extra?.apiBaseUrl as string | undefined;
} catch {}

// Final base URL resolution
const API_BASE_URL = (ENV_API || EXTRA_API || APP_JSON_API) || (__DEV__
  ? (Platform.select({ ios: LOCAL_API, android: LOCAL_API_ANDROID, default: LOCAL_API }))
  : LOCAL_API);

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

try { console.log('🌐 API Base URL:', api.defaults.baseURL); } catch {}

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log(`🔑 API Request: ${config.method?.toUpperCase()} ${config.url} - Token present: ${token.substring(0, 20)}...`);
      } else {
        console.log(`🔑 API Request: ${config.method?.toUpperCase()} ${config.url} - No token found`);
      }
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
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

export default api; 