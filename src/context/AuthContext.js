import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { ref, get } from 'firebase/database';

const ADMIN_EMAIL = 'hamzaelsharkh@gmail.com';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [popup, setPopup] = useState(null);

  useEffect(() => {
    const checkAdminStatus = async (email) => {
      if (email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        return true;
      }
      try {
        const authSnap = await get(ref(db, 'authorized_users'));
        const data = authSnap.val();
        const authorizedEmails = data ? Object.values(data).map(item => item.email?.toLowerCase()) : [];
        return authorizedEmails.includes(email?.toLowerCase());
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