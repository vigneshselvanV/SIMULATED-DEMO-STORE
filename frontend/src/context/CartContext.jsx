import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState({
    items: [],
    itemsCount: 0,
    subtotalPaise: 0,
    shippingPaise: 0,
    totalPaise: 0,
    freeShippingThresholdPaise: 50000,
    hasOutOfStock: false
  });
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 3500);
  };

  const fetchCart = async () => {
    try {
      setLoading(true);
      const res = await api.getCart();
      if (res.success && res.data) {
        setCart(res.data);
      }
    } catch (err) {
      console.error('Error fetching cart:', err);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch cart when user logs in/out to ensure synced guest vs account cart
  useEffect(() => {
    fetchCart();
  }, [user]);

  const addToCart = async (productId, quantity = 1) => {
    try {
      const res = await api.addToCart(productId, quantity);
      if (res.success && res.data) {
        setCart(res.data);
        showNotification(res.message || 'Added to cart!', 'success');
        return { success: true };
      }
    } catch (err) {
      showNotification(err.message || 'Could not add to cart', 'error');
      return { success: false, message: err.message };
    }
  };

  const updateQuantity = async (itemId, quantity) => {
    try {
      const res = await api.updateCartItem(itemId, quantity);
      if (res.success && res.data) {
        setCart(res.data);
        return { success: true };
      }
    } catch (err) {
      showNotification(err.message || 'Failed to update quantity', 'error');
      return { success: false, message: err.message };
    }
  };

  const removeFromCart = async (itemId) => {
    try {
      const res = await api.removeCartItem(itemId);
      if (res.success && res.data) {
        setCart(res.data);
        showNotification('Item removed from cart', 'info');
        return { success: true };
      }
    } catch (err) {
      showNotification(err.message || 'Failed to remove item', 'error');
      return { success: false, message: err.message };
    }
  };

  const clearCart = async () => {
    try {
      const res = await api.clearCart();
      if (res.success && res.data) {
        setCart(res.data);
        return { success: true };
      }
    } catch (err) {
      showNotification(err.message || 'Failed to clear cart', 'error');
      return { success: false, message: err.message };
    }
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        loading,
        notification,
        fetchCart,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        showNotification
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
