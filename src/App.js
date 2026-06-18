import React, { useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import CartPage from './pages/CartPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import PaymentStatusPage from './pages/PaymentStatusPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import { useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
function App() {
  const { user, isLoggedIn, popup, authLoading } = useAuth();
  const navigate = useNavigate();
  const currentPath = window.location.pathname;

  useEffect(() => {
    if (authLoading) return; // Wait until auth state is determined

    const publicPaths = ['/register', '/login', '/payment-status', '/forgot-password'];
    const isPublicPath = publicPaths.includes(currentPath);
    const isHome = currentPath === '/';
    
    // Allow public access to home, login, register
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
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/login" element={isLoggedIn ? <Navigate to="/" /> : <LoginPage />} />
        <Route path="/register" element={isLoggedIn ? <Navigate to="/" /> : <RegisterPage />} />
        <Route path="/forgot-password" element={isLoggedIn ? <Navigate to="/" /> : <ForgotPasswordPage />} />
        <Route path="/payment-status" element={<PaymentStatusPage />} />
        
        {/* Protected Admin Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/admin" element={<Dashboard />} />
        </Route>
      </Routes>
      
      {/* Global Popup Notification */}
      {popup && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: popup.isSuccess ? '#27ae60' : '#e74c3c',
          color: 'white',
          padding: '16px 24px',
          borderRadius: '8px',
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          fontWeight: '500'
        }}>
          {popup.message}
        </div>
      )}
    </CartProvider>
  );
}

export default App;