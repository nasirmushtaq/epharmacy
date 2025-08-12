import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import api from '../services/api';

export interface Address {
  _id: string;
  title: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  isDefault: boolean;
  addressType: 'home' | 'office' | 'other';
  landmark?: string;
  fullAddress: string;
  createdAt: string;
  updatedAt: string;
}

interface AddressState {
  addresses: Address[];
  selectedAddress: Address | null;
  loading: boolean;
  error: string | null;
}

type AddressAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_ADDRESSES'; payload: Address[] }
  | { type: 'ADD_ADDRESS'; payload: Address }
  | { type: 'UPDATE_ADDRESS'; payload: Address }
  | { type: 'DELETE_ADDRESS'; payload: string }
  | { type: 'SET_SELECTED_ADDRESS'; payload: Address | null }
  | { type: 'SET_DEFAULT_ADDRESS'; payload: string };

const initialState: AddressState = {
  addresses: [],
  selectedAddress: null,
  loading: false,
  error: null,
};

function addressReducer(state: AddressState, action: AddressAction): AddressState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    
    case 'SET_ADDRESSES':
      const defaultAddress = action.payload.find(addr => addr.isDefault) || action.payload[0] || null;
      console.log('📍 AddressReducer: Setting addresses, found default:', defaultAddress?.title);
      console.log('📍 AddressReducer: Current selected address:', state.selectedAddress?.title);
      
      return {
        ...state,
        addresses: action.payload,
        selectedAddress: state.selectedAddress || defaultAddress,
        loading: false,
        error: null,
      };
    
    case 'ADD_ADDRESS':
      const newAddresses = [...state.addresses, action.payload];
      return {
        ...state,
        addresses: newAddresses,
        selectedAddress: action.payload.isDefault ? action.payload : state.selectedAddress,
      };
    
    case 'UPDATE_ADDRESS':
      const updatedAddresses = state.addresses.map(addr =>
        addr._id === action.payload._id ? action.payload : addr
      );
      return {
        ...state,
        addresses: updatedAddresses,
        selectedAddress: state.selectedAddress?._id === action.payload._id ? action.payload : state.selectedAddress,
      };
    
    case 'DELETE_ADDRESS':
      const filteredAddresses = state.addresses.filter(addr => addr._id !== action.payload);
      const newSelectedAddress = state.selectedAddress?._id === action.payload
        ? (filteredAddresses.find(addr => addr.isDefault) || filteredAddresses[0] || null)
        : state.selectedAddress;
      return {
        ...state,
        addresses: filteredAddresses,
        selectedAddress: newSelectedAddress,
      };
    
    case 'SET_SELECTED_ADDRESS':
      return { ...state, selectedAddress: action.payload };
    
    case 'SET_DEFAULT_ADDRESS':
      const addressesWithNewDefault = state.addresses.map(addr => ({
        ...addr,
        isDefault: addr._id === action.payload
      }));
      const newDefaultAddress = addressesWithNewDefault.find(addr => addr._id === action.payload);
      return {
        ...state,
        addresses: addressesWithNewDefault,
        selectedAddress: newDefaultAddress || state.selectedAddress,
      };
    
    default:
      return state;
  }
}

interface AddressContextType {
  state: AddressState;
  fetchAddresses: () => Promise<void>;
  createAddress: (addressData: Partial<Address>) => Promise<Address>;
  updateAddress: (id: string, addressData: Partial<Address>) => Promise<Address>;
  deleteAddress: (id: string) => Promise<void>;
  setDefaultAddress: (id: string) => Promise<void>;
  selectAddress: (address: Address | null) => void;
  getDefaultAddress: () => Address | null;
}

const AddressContext = createContext<AddressContextType | undefined>(undefined);

export const AddressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(addressReducer, initialState);
  const { state: authState } = useAuth();

  const fetchAddresses = async () => {
    try {
      console.log('📍 AddressContext: Starting to fetch addresses...');
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await api.get('/api/addresses');
      
      console.log('📍 AddressContext: API response:', response.data);
      
      if (response.data.success) {
        console.log(`📍 AddressContext: Successfully fetched ${response.data.data.length} addresses`);
        dispatch({ type: 'SET_ADDRESSES', payload: response.data.data });
      } else {
        throw new Error(response.data.message || 'Failed to fetch addresses');
      }
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401) {
        console.warn('📍 AddressContext: Unauthorized, clearing token and skipping addresses fetch');
        try { await AsyncStorage.removeItem('token'); } catch {}
        dispatch({ type: 'SET_ERROR', payload: 'Please login to view addresses' });
      } else {
        console.error('📍 AddressContext: Error fetching addresses:', error);
        dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to fetch addresses' });
      }
    }
  };

  const createAddress = async (addressData: Partial<Address>): Promise<Address> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await api.post('/api/addresses', addressData);
      
      if (response.data.success) {
        const newAddress = response.data.data;
        dispatch({ type: 'ADD_ADDRESS', payload: newAddress });
        dispatch({ type: 'SET_LOADING', payload: false });
        return newAddress;
      } else {
        throw new Error(response.data.message || 'Failed to create address');
      }
    } catch (error: any) {
      console.error('Error creating address:', error);
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to create address' });
      throw error;
    }
  };

  const updateAddress = async (id: string, addressData: Partial<Address>): Promise<Address> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await api.put(`/api/addresses/${id}`, addressData);
      
      if (response.data.success) {
        const updatedAddress = response.data.data;
        dispatch({ type: 'UPDATE_ADDRESS', payload: updatedAddress });
        dispatch({ type: 'SET_LOADING', payload: false });
        return updatedAddress;
      } else {
        throw new Error(response.data.message || 'Failed to update address');
      }
    } catch (error: any) {
      console.error('Error updating address:', error);
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to update address' });
      throw error;
    }
  };

  const deleteAddress = async (id: string): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await api.delete(`/api/addresses/${id}`);
      
      if (response.data.success) {
        dispatch({ type: 'DELETE_ADDRESS', payload: id });
        dispatch({ type: 'SET_LOADING', payload: false });
      } else {
        throw new Error(response.data.message || 'Failed to delete address');
      }
    } catch (error: any) {
      console.error('Error deleting address:', error);
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to delete address' });
      throw error;
    }
  };

  const setDefaultAddress = async (id: string): Promise<void> => {
    try {
      const response = await api.put(`/api/addresses/${id}/set-default`);
      
      if (response.data.success) {
        dispatch({ type: 'SET_DEFAULT_ADDRESS', payload: id });
      } else {
        throw new Error(response.data.message || 'Failed to set default address');
      }
    } catch (error: any) {
      console.error('Error setting default address:', error);
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to set default address' });
      throw error;
    }
  };

  const selectAddress = (address: Address | null) => {
    dispatch({ type: 'SET_SELECTED_ADDRESS', payload: address });
  };

  const getDefaultAddress = (): Address | null => {
    return state.addresses.find(addr => addr.isDefault) || null;
  };

  // Auto-fetch addresses when component mounts and when user changes
  useEffect(() => {
    // Clear state to avoid showing previous user's addresses
    dispatch({ type: 'SET_ADDRESSES', payload: [] as any });
    fetchAddresses();
  }, [authState.user?._id]);

  const value: AddressContextType = {
    state,
    fetchAddresses,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    selectAddress,
    getDefaultAddress,
  };

  return (
    <AddressContext.Provider value={value}>
      {children}
    </AddressContext.Provider>
  );
};

export const useAddress = (): AddressContextType => {
  const context = useContext(AddressContext);
  if (context === undefined) {
    throw new Error('useAddress must be used within an AddressProvider');
  }
  return context;
};
