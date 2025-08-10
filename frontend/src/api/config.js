import axios from 'axios';

// Create axios instance with base URL
const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production' 
    ? 'https://your-production-api.com'  // Replace with your production URL
    : 'http://localhost:8000',  // Development backend URL
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Separate axios instance for auth operations (no auth header required)
export const authApi = axios.create({
  baseURL: process.env.NODE_ENV === 'production' 
    ? 'https://your-production-api.com'  // Replace with your production URL
    : 'http://localhost:8000',  // Development backend URL
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api; 