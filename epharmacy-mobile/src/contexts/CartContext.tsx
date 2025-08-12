import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

export interface CartLineItem {
  medicineId: string;
  name: string;
  price: number;
  quantity: number;
  isPrescriptionRequired?: boolean;
}

interface CartState {
  items: CartLineItem[];
}

type Action =
  | { type: 'LOAD'; payload: CartLineItem[] }
  | { type: 'ADD'; payload: CartLineItem }
  | { type: 'UPDATE_QTY'; payload: { medicineId: string; quantity: number } }
  | { type: 'REMOVE'; payload: { medicineId: string } }
  | { type: 'CLEAR' };

const initialState: CartState = { items: [] };

function reducer(state: CartState, action: Action): CartState {
  switch (action.type) {
    case 'LOAD':
      return { items: action.payload };
    case 'ADD': {
      const existing = state.items.find(i => i.medicineId === action.payload.medicineId);
      if (existing) {
        return {
          items: state.items.map(i => i.medicineId === existing.medicineId ? { ...i, quantity: i.quantity + action.payload.quantity } : i)
        };
      }
      return { items: [...state.items, action.payload] };
    }
    case 'UPDATE_QTY':
      return { items: state.items.map(i => i.medicineId === action.payload.medicineId ? { ...i, quantity: action.payload.quantity } : i) };
    case 'REMOVE':
      return { items: state.items.filter(i => i.medicineId !== action.payload.medicineId) };
    case 'CLEAR':
      return { items: [] };
    default:
      return state;
  }
}

interface CartContextValue extends CartState {
  addItem: (item: CartLineItem) => Promise<void>;
  updateQuantity: (medicineId: string, quantity: number) => Promise<void>;
  removeItem: (medicineId: string) => Promise<void>;
  clear: () => Promise<void>;
  subtotal: number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { state: authState } = useAuth();
  const storageKeyRef = useRef<string>('cart:guest');

  const computeStorageKey = () => {
    const userId = authState.user?._id || authState.user?.id;
    return userId ? `cart:${userId}` : 'cart:guest';
  };

  useEffect(() => {
    // On mount and whenever user changes, switch storage key and load user-scoped cart
    (async () => {
      try {
        const newKey = computeStorageKey();
        // Migrate legacy key 'cart' to user-scoped on first run for this user
        const legacy = await AsyncStorage.getItem('cart');
        const existingUserCart = await AsyncStorage.getItem(newKey);
        if (legacy && !existingUserCart) {
          await AsyncStorage.setItem(newKey, legacy);
          await AsyncStorage.removeItem('cart');
        }
        storageKeyRef.current = newKey;
        // Clear in-memory to avoid showing previous user's items briefly
        dispatch({ type: 'CLEAR' });
        const raw = await AsyncStorage.getItem(newKey);
        if (raw) dispatch({ type: 'LOAD', payload: JSON.parse(raw) });
      } catch {}
    })();
  }, [authState.user?._id]);

  useEffect(() => {
    AsyncStorage.setItem(storageKeyRef.current, JSON.stringify(state.items)).catch(() => {});
  }, [state.items]);

  const subtotal = useMemo(() => state.items.reduce((sum, i) => sum + i.price * i.quantity, 0), [state.items]);

  const addItem = async (item: CartLineItem) => {
    dispatch({ type: 'ADD', payload: item });
  };
  const updateQuantity = async (medicineId: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QTY', payload: { medicineId, quantity } });
  };
  const removeItem = async (medicineId: string) => {
    dispatch({ type: 'REMOVE', payload: { medicineId } });
  };
  const clear = async () => {
    dispatch({ type: 'CLEAR' });
  };

  const value: CartContextValue = { ...state, addItem, updateQuantity, removeItem, clear, subtotal };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}; 