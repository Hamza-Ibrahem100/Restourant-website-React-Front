import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { ref, get } from 'firebase/database';
import api from '../services/api';

const ADMIN_EMAIL = 'hamzaelsharkh@gmail.com';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [popup, setPopup] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async (email) => {
      console.log('Checking admin status for:', email);
      if (email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        console.log('✓ Admin email matched');
        return true;
      }
      if (process.env.REACT_APP_DEMO_EMAIL && email?.toLowerCase() === process.env.REACT_APP_DEMO_EMAIL.toLowerCase()) {
        console.log('✓ Demo email matched (Admin access)');
        return true;
      }
      try {
        // Check settings in Firebase
        const settingsSnap = await get(ref(db, 'settings'));
        const settings = settingsSnap.val() || {};
        console.log('Settings:', settings);
        if (settings.publicDashboardAccess) {
          console.log('✓ Public dashboard access enabled');
          return true;
        }

        // Check authorized_users in Firebase
        const authSnap = await get(ref(db, 'authorized_users'));
        const data = authSnap.val();
        console.log('Firebase authorized_users:', data);
        const authorizedEmails = data ? Object.values(data).map(item => item.email?.toLowerCase()) : [];
        console.log('Firebase authorized emails:', authorizedEmails);
        
        if (authorizedEmails.includes(email?.toLowerCase())) {
          console.log('✓ Found in Firebase');
          return true;
        }

        // Fallback: Check via backend API (handles SQLite data)
        try {
          const res = await api.get(`/authorized-users/check?email=${encodeURIComponent(email)}`, { timeout: 5000 });
          console.log('API check result:', res.data);
          if (res.data?.authorized) {
            console.log('✓ Authorized via API');
            return true;
          }
        } catch (apiErr) {
          console.log('API check failed (expected if backend unavailable):', apiErr.message);
        }

        return false;
      } catch (error) {
        console.error('Error checking auth:', error);
        return false;
      }
    };

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const email = firebaseUser.email;
        const isAdmin = await checkAdminStatus(email);
        setUser({
          provider: firebaseUser.providerData[0]?.providerId || 'email',
          email: email,
          firstName: firebaseUser.displayName?.split(' ')[0] || 'User',
          lastName: firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
          uid: firebaseUser.uid,
          isAdmin: isAdmin
        });
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const showPopup = (message, isSuccess = true) => {
    setPopup({ message, isSuccess });
    setTimeout(() => setPopup(null), 1500);
  };

  const saveUser = (provider, userData = {}) => {
    const data = {
      provider,
      email: userData.email || `${provider.toLowerCase()}@user.com`,
      firstName: userData.firstName || 'User',
      lastName: userData.lastName || 'Name'
    };
    setUser(data);
    return data;
  };

  const logout = () => {
    setUser(null);
    showPopup('Signed out successfully.', true);
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
  };

  const value = {
    user,
    popup,
    authLoading,
    showPopup,
    saveUser,
    logout,
    isLoggedIn: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}