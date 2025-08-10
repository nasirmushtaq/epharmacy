import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { authApi } from '../services/api';
import { User, AuthState } from '../types/global';

// Action types
const actionTypes = {
  SET_LOADING: 'SET_LOADING',
  SET_USER: 'SET_USER',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  LOGOUT: 'LOGOUT',
} as const;

type AuthAction = 
  | { type: typeof actionTypes.SET_LOADING; payload: boolean }
  | { type: typeof actionTypes.SET_USER; payload: { user: User; token: string } }
  | { type: typeof actionTypes.SET_ERROR; payload: string }
  | { type: typeof actionTypes.CLEAR_ERROR }
  | { type: typeof actionTypes.LOGOUT };

const initialState: AuthState = {
  user: null,
  token: null,
  isLoading: true,
  error: null,
};

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case actionTypes.SET_LOADING:
      return { ...state, isLoading: action.payload };
    case actionTypes.SET_USER:
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isLoading: false,
        error: null,
      };
    case actionTypes.SET_ERROR:
      return { ...state, error: action.payload, isLoading: false };
    case actionTypes.CLEAR_ERROR:
      return { ...state, error: null };
    case actionTypes.LOGOUT:
      return { ...initialState, isLoading: false };
    default:
      return state;
  }
};

interface AuthContextType {
  state: AuthState;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (userData: any) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Load user from AsyncStorage on app start
  useEffect(() => {
    const loadUser = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          // Verify token with backend
          const response = await authApi.get('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (response.data.success) {
            dispatch({
              type: actionTypes.SET_USER,
              payload: { user: response.data.user, token }
            });
          } else {
            await AsyncStorage.removeItem('token');
            dispatch({ type: actionTypes.SET_LOADING, payload: false });
          }
        } else {
          dispatch({ type: actionTypes.SET_LOADING, payload: false });
        }
      } catch (error) {
        console.error('Load user error:', error);
        await AsyncStorage.removeItem('token');
        dispatch({ type: actionTypes.SET_LOADING, payload: false });
      }
    };

    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      dispatch({ type: actionTypes.SET_LOADING, payload: true });
      dispatch({ type: actionTypes.CLEAR_ERROR });

      const response = await authApi.post('/api/auth/login', {
        email,
        password,
      });

      const { success, token, user, message } = response.data;

      if (success && token && user) {
        await AsyncStorage.setItem('token', token);
        dispatch({
          type: actionTypes.SET_USER,
          payload: { user, token }
        });
        return { success: true };
      } else {
        dispatch({ type: actionTypes.SET_ERROR, payload: message || 'Login failed' });
        return { success: false, message: message || 'Login failed' };
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Login failed';
      dispatch({ type: actionTypes.SET_ERROR, payload: errorMessage });
      return { success: false, message: errorMessage };
    }
  };

  const register = async (userData: any) => {
    try {
      dispatch({ type: actionTypes.SET_LOADING, payload: true });
      dispatch({ type: actionTypes.CLEAR_ERROR });

      const response = await authApi.post('/api/auth/register', userData);

      const { success, token, user, message } = response.data;

      if (success && token && user) {
        await AsyncStorage.setItem('token', token);
        dispatch({
          type: actionTypes.SET_USER,
          payload: { user, token }
        });
        return { success: true };
      } else {
        dispatch({ type: actionTypes.SET_ERROR, payload: message || 'Registration failed' });
        return { success: false, message: message || 'Registration failed' };
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Registration failed';
      dispatch({ type: actionTypes.SET_ERROR, payload: errorMessage });
      return { success: false, message: errorMessage };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      dispatch({ type: actionTypes.LOGOUT });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const clearError = () => {
    dispatch({ type: actionTypes.CLEAR_ERROR });
  };

  const value: AuthContextType = {
    state,
    login,
    register,
    logout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 