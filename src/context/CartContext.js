import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const CartContext = createContext();

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('foodlover_cart');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('foodlover_cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(i => i.name === item.name);
      if (existing) {
        return prev.map(i => 
          i.name === item.name 
            ? { ...i, quantity: i.quantity + (item.quantity || 1) }
            : i
        );
      }
      return [...prev, { ...item, quantity: item.quantity || 1 }];
    });
  };

  const removeFromCart = (name) => {
    setCart(prev => prev.filter(i => i.name !== name));
  };

  const updateQuantity = (name, quantity) => {
    if (quantity <= 0) {
      removeFromCart(name);
    } else {
      setCart(prev => prev.map(i => 
        i.name === name ? { ...i, quantity } : i
      ));
    }
  };

  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const customerInfo = user ? {
    name: user.displayName || user.firstName || '',
    email: user.email || '',
    phone: user.phone || ''
  } : null;

  return (
    <CartContext.Provider value={{ 
      cart, addToCart, removeFromCart, updateQuantity, clearCart, cartTotal, cartCount, customerInfo
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);