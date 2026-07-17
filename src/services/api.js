/**
 * api.js
 * Axios instance pointing at the Express backend.
 * Automatically attaches the Firebase Auth ID token to every request.
 */
import axios from 'axios';
import { auth } from '../firebase';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLocal 
  ? 'http://localhost:5000/api'
  : (process.env.REACT_APP_API_URL || 'https://restaurant-website-react-back-5k53kprwm.vercel.app/api');

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000, // 8s timeout — if backend is down, fallback kicks in quickly
  headers: { 'Content-Type': 'application/json' }
});

// Attach Firebase ID token to every outgoing request
api.interceptors.request.use(async (config) => {
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const token = await currentUser.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (err) {
    // If we can't get a token, continue without auth header
    console.warn('Could not get Firebase ID token:', err.message);
  }
  return config;
});

export default api;
