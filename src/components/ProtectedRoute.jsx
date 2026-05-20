import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = () => {
  const { user, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#111', color: '#d4a574' }}>
        <h2>Loading...</h2>
      </div>
    );
  }

  // If user is admin, render the Outlet (child components)
  // Otherwise, redirect to the home page or login page
  return user?.isAdmin ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
