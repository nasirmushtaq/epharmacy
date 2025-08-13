import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// API configuration
// Prefer explicit env (EXPO_PUBLIC_API_URL) → then LAN IP for device → fall back to localhost
const ENV_API = process.env.EXPO_PUBLIC_API_URL || (typeof (global as any).expo !== 'undefined' ? undefined : undefined);
const LAN_API = 'http://192.168.0.5:8000'; // auto-detected during setup; change if your LAN IP changes
const NGROK_API = 'https://d64c6a733747.ngrok-free.app'; // ngrok tunnel for external access
const LOCAL_API = 'http://localhost:8000';

// Prefer explicit env; else app.json extra.apiBaseUrl; else LAN/local
// eslint-disable-next-line @typescript-eslint/no-var-requires
let APP_JSON_API: string | undefined;
try {
  // @ts-ignore dynamic require for config
  const appConfig = require('../../../app.json');
  APP_JSON_API = appConfig?.expo?.extra?.apiBaseUrl as string | undefined;
} catch {}

const API_BASE_URL = (ENV_API || APP_JSON_API) || (__DEV__
  ? (Platform.select({ ios: LAN_API, android: LAN_API, default: LOCAL_API }))
  : LAN_API);

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
  baseURL: ENV_API || API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

export default api; 