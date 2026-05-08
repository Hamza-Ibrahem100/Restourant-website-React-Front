import React, { useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import CartPage from './pages/CartPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import { useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { db } from './firebase';
import { ref, set } from 'firebase/database';

function App() {
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const currentPath = window.location.pathname;

  useEffect(() => {
    const testRef = ref(db, 'connection_test');
    set(testRef, {
      status: 'Connected!',
      developer: 'Hamza Ibrahim',
      timestamp: Date.now()
    }).then(() => console.log('✅ RTDB Connected Successfully!'))
      .catch((error) => console.error('❌ RTDB Error:', error));
  }, []);

  useEffect(() => {
    const publicPaths = ['/register', '/cart', '/login'];
    const isPublicPath = publicPaths.includes(currentPath);
    const isHome = currentPath === '/';
    
    // Allow public access to home, login, register, cart
    if (!isLoggedIn && !isPublicPath && !isHome) {
      navigate('/login');
    }
    if (isLoggedIn && (currentPath === '/login' || currentPath === '/register')) {
      navigate('/');
    }
  }, [isLoggedIn, navigate, currentPath]);

  const isAdmin = user?.isAdmin;

  return (
    <CartProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/login" element={isLoggedIn ? <Navigate to="/" /> : <LoginPage />} />
        <Route path="/register" element={isLoggedIn ? <Navigate to="/" /> : <RegisterPage />} />
        <Route path="/admin" element={isAdmin ? <Dashboard /> : <HomePage />} />
      </Routes>
    </CartProvider>
  );
}

export default App;