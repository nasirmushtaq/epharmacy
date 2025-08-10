import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { toast } from 'react-toastify';

// Initial state
const initialState = {
  items: JSON.parse(localStorage.getItem('cartItems')) || [],
  totalItems: 0,
  totalAmount: 0,
};

// Action types
const actionTypes = {
  ADD_ITEM: 'ADD_ITEM',
  REMOVE_ITEM: 'REMOVE_ITEM',
  UPDATE_QUANTITY: 'UPDATE_QUANTITY',
  CLEAR_CART: 'CLEAR_CART',
  CALCULATE_TOTALS: 'CALCULATE_TOTALS',
};

// Reducer
const cartReducer = (state, action) => {
  switch (action.type) {
    case actionTypes.ADD_ITEM: {
      const existingItem = state.items.find(item => item.medicineId === action.payload.medicineId);
      
      let newItems;
      if (existingItem) {
        newItems = state.items.map(item =>
          item.medicineId === action.payload.medicineId
            ? { ...item, quantity: item.quantity + action.payload.quantity }
            : item
        );
      } else {
        newItems = [...state.items, action.payload];
      }
      
      return { ...state, items: newItems };
    }
    
    case actionTypes.REMOVE_ITEM: {
      const newItems = state.items.filter(item => item.medicineId !== action.payload);
      return { ...state, items: newItems };
    }
    
    case actionTypes.UPDATE_QUANTITY: {
      const newItems = state.items.map(item =>
        item.medicineId === action.payload.medicineId
          ? { ...item, quantity: action.payload.quantity }
          : item
      ).filter(item => item.quantity > 0);
      
      return { ...state, items: newItems };
    }
    
    case actionTypes.CLEAR_CART:
      return { ...state, items: [] };
    
    case actionTypes.CALCULATE_TOTALS: {
      const totalItems = state.items.reduce((total, item) => {
        const quantity = parseInt(item.quantity) || 0;
        return total + quantity;
      }, 0);
      
      const totalAmount = state.items.reduce((total, item) => {
        const price = parseFloat(item.price) || 0;
        const quantity = parseInt(item.quantity) || 0;
        return total + (price * quantity);
      }, 0);
      
      return {
        ...state,
        totalItems,
        totalAmount: Math.round(totalAmount * 100) / 100, // Round to 2 decimal places
      };
    }
    
    default:
      return state;
  }
};

// Create context
const CartContext = createContext();

// Cart provider component
export const CartProvider = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  // Clean up cart items with invalid data
  const cleanupCartItems = () => {
    const validItems = state.items.filter(item => {
      // Remove items without valid medicineId
      const hasValidId = item.medicineId && typeof item.medicineId === 'string';
      const hasValidPrice = !isNaN(parseFloat(item.price));
      const hasValidQuantity = !isNaN(parseInt(item.quantity));
      
      if (!hasValidId) {
        console.warn('Removing cart item without valid medicineId:', item);
        return false;
      }
      
      return hasValidId && hasValidPrice && hasValidQuantity;
    });

    const cleanedItems = validItems.map(item => ({
      ...item,
      medicineId: item.medicineId, // Ensure medicineId is preserved
      price: parseFloat(item.price) || 0,
      mrp: parseFloat(item.mrp) || 0,
      quantity: parseInt(item.quantity) || 1,
      maxQuantity: item.maxQuantity || 10,
      isPrescriptionRequired: item.isPrescriptionRequired || item.prescriptionRequired || false,
    }));
    
    // Update items if any were removed or cleaned
    if (cleanedItems.length !== state.items.length || 
        cleanedItems.some((item, index) => 
          item.price !== state.items[index]?.price || 
          isNaN(state.items[index]?.price) ||
          item.quantity !== state.items[index]?.quantity ||
          isNaN(state.items[index]?.quantity)
        )) {
      
      console.log('Cleaning up cart items:', { 
        before: state.items.length, 
        after: cleanedItems.length 
      });
      
      dispatch({ type: actionTypes.CLEAR_CART });
      cleanedItems.forEach(item => {
        dispatch({ type: actionTypes.ADD_ITEM, payload: item });
      });
    }
  };

  // Clean up cart items on mount
  useEffect(() => {
    cleanupCartItems();
  }, []);

  // Calculate totals whenever items change
  useEffect(() => {
    dispatch({ type: actionTypes.CALCULATE_TOTALS });
  }, [state.items]);

  // Save to localStorage whenever cart changes
  useEffect(() => {
    localStorage.setItem('cartItems', JSON.stringify(state.items));
  }, [state.items]);

  // Add item to cart
  const addToCart = (medicine, quantity = 1) => {
    const cartItem = {
      medicineId: medicine._id,
      name: medicine.name,
      brand: medicine.brand,
      price: parseFloat(medicine.sellingPrice) || 0,
      mrp: parseFloat(medicine.mrp) || 0,
      image: medicine.images?.[0]?.url || null,
      isPrescriptionRequired: medicine.isPrescriptionRequired || false,
      maxQuantity: medicine.stockQuantity || 10,
      prescriptionRequired: medicine.isPrescriptionRequired || false,
      quantity: parseInt(quantity) || 1,
    };

    dispatch({
      type: actionTypes.ADD_ITEM,
      payload: cartItem,
    });
  };

  // Remove item from cart
  const removeFromCart = (medicineId) => {
    dispatch({
      type: actionTypes.REMOVE_ITEM,
      payload: medicineId,
    });
  };

  // Update item quantity
  const updateQuantity = (medicineId, quantity) => {
    dispatch({
      type: actionTypes.UPDATE_QUANTITY,
      payload: { medicineId, quantity },
    });
  };

  // Clear entire cart
  const clearCart = () => {
    dispatch({ type: actionTypes.CLEAR_CART });
  };

  // Manual cart cleanup function
  const cleanCart = () => {
    cleanupCartItems();
    toast.success('Cart cleaned up successfully!');
  };

  // Get item from cart
  const getItem = (medicineId) => {
    return state.items.find(item => item.medicineId === medicineId);
  };

  // Check if item is in cart
  const isInCart = (medicineId) => {
    return state.items.some(item => item.medicineId === medicineId);
  };

  // Get prescription items
  const getPrescriptionItems = () => {
    return state.items.filter(item => item.isPrescriptionRequired);
  };

  // Get non-prescription items
  const getNonPrescriptionItems = () => {
    return state.items.filter(item => !item.isPrescriptionRequired);
  };

  const value = {
    items: state.items,
    totalItems: state.totalItems,
    totalAmount: state.totalAmount,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    cleanCart,
    getItem,
    isInCart,
    getPrescriptionItems,
    getNonPrescriptionItems,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

// Hook to use cart context
export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export default CartContext; 