/**
 * dataService.js
 *
 * Smart abstraction layer over all data operations.
 * Strategy:
 *   1. Try the Express/SQLite backend API first.
 *   2. If it's unreachable (network error / timeout), fall back to
 *      direct Firebase Realtime Database SDK calls.
 *
 * Usage:
 *   import { dataService } from '../services/dataService';
 *   const menu = await dataService.getMenu();
 */

import api from './api';
import { db as firebaseDB } from '../firebase';
import {
  ref, get, push, update, remove
} from 'firebase/database';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Returns true if the error means the API is unreachable */
function isNetworkError(err) {
  return (
    !err.response ||                           // no HTTP response (timeout / ECONNREFUSED)
    err.code === 'ECONNABORTED' ||             // axios timeout
    err.code === 'ERR_NETWORK' ||
    err.message === 'Network Error'
  );
}

/**
 * Run `apiFn` first. If a network error occurs fall back to `firebaseFn`.
 * Non-network errors (4xx, 5xx) are re-thrown so callers can handle them.
 */
async function withFallback(apiFn, firebaseFn) {
  try {
    return await apiFn();
  } catch (err) {
    if (isNetworkError(err)) {
      console.warn('⚠️ Express API unreachable — falling back to Firebase:', err.message);
      return await firebaseFn();
    }
    throw err;
  }
}

/**
 * Like withFallback, but ALSO falls back to Firebase when the API returns
 * an empty array. This handles the case where SQLite has no data yet but
 * Firebase does (e.g. data was seeded directly to Firebase from the dashboard).
 */
async function withFallbackOrEmpty(apiFn, firebaseFn) {
  try {
    const result = await apiFn();
    if (Array.isArray(result) && result.length === 0) {
      console.warn('⚠️ API returned empty array — checking Firebase for data');
      try {
        const firebaseResult = await firebaseFn();
        if (firebaseResult && firebaseResult.length > 0) {
          return firebaseResult;
        }
      } catch {
        // Firebase also empty/errored — return the empty array from API
      }
    }
    return result;
  } catch (err) {
    if (isNetworkError(err)) {
      console.warn('⚠️ Express API unreachable — falling back to Firebase:', err.message);
      return await firebaseFn();
    }
    throw err;
  }
}

/** Convert a Firebase snapshot to an array of { id, ...data } objects */
function snapshotToArray(snapshot) {
  if (!snapshot.exists()) return [];
  const data = snapshot.val();
  return Object.entries(data).map(([id, val]) => ({ id, ...val }));
}

// ─── Menu ────────────────────────────────────────────────────────────────────

const getMenu = () =>
  withFallbackOrEmpty(
    async () => {
      const res = await api.get('/menu');
      return res.data;
    },
    async () => {
      const snap = await get(ref(firebaseDB, 'menu'));
      return snapshotToArray(snap);
    }
  );

const addMenuItem = (item) =>
  withFallback(
    async () => {
      const res = await api.post('/menu', item);
      return res.data;
    },
    async () => {
      const newRef = push(ref(firebaseDB, 'menu'));
      await update(newRef, { ...item, createdAt: Date.now() });
      return { id: newRef.key, ...item };
    }
  );

const updateMenuItem = (id, updates) =>
  withFallback(
    async () => {
      const res = await api.put(`/menu/${id}`, updates);
      return res.data;
    },
    async () => {
      await update(ref(firebaseDB, `menu/${id}`), { ...updates, updatedAt: Date.now() });
      return { id, ...updates };
    }
  );

const deleteMenuItem = (id) =>
  withFallback(
    async () => {
      const res = await api.delete(`/menu/${id}`);
      return res.data;
    },
    () => remove(ref(firebaseDB, `menu/${id}`))
  );

const bulkDeleteMenuItems = (ids) =>
  withFallback(
    async () => {
      const res = await api.delete('/menu/bulk', { data: { ids } });
      return res.data;
    },
    () => Promise.all(ids.map(id => remove(ref(firebaseDB, `menu/${id}`))))
  );

// Upload an image file — returns { fullUrl, thumbnailUrl }
const uploadMenuImage = async (file) => {
  // Try Express backend first (multipart upload)
  try {
    const formData = new FormData();
    formData.append('image', file);
    const res = await api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000 // uploads can take longer
    });
    return res.data; // { fullUrl, thumbnailUrl }
  } catch (err) {
    if (isNetworkError(err)) {
      console.warn('⚠️ Upload API unreachable — falling back to Firebase Storage');
      // Dynamic import to avoid loading Firebase Storage when not needed
      const { getStorage, ref: storageRef, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const { storage } = await import('../firebase');
      const imageCompression = (await import('browser-image-compression')).default;

      const fullOptions = { maxSizeMB: 0.2, maxWidthOrHeight: 800, useWebWorker: true, fileType: 'image/webp' };
      const fullCompressed = await imageCompression(file, fullOptions);
      const fRef = storageRef(storage, `menu-images/${Date.now()}_full.webp`);
      await uploadBytes(fRef, fullCompressed);
      const fullUrl = await getDownloadURL(fRef);

      const thumbOptions = { maxSizeMB: 0.05, maxWidthOrHeight: 300, useWebWorker: true, fileType: 'image/webp' };
      const thumbCompressed = await imageCompression(file, thumbOptions);
      const tRef = storageRef(storage, `menu-images/${Date.now()}_thumb.webp`);
      await uploadBytes(tRef, thumbCompressed);
      const thumbnailUrl = await getDownloadURL(tRef);

      return { fullUrl, thumbnailUrl };
    }
    throw err;
  }
};

// ─── Orders ──────────────────────────────────────────────────────────────────

const getOrders = (limit = 100) =>
  withFallbackOrEmpty(
    async () => {
      const res = await api.get('/orders', { params: { limit } });
      return res.data;
    },
    async () => {
      const snap = await get(ref(firebaseDB, 'orders'));
      return snapshotToArray(snap).reverse();
    }
  );

const createOrder = (orderData) =>
  withFallback(
    async () => {
      const res = await api.post('/orders', orderData);
      return res.data;
    },
    async () => {
      const newRef = await push(ref(firebaseDB, 'orders'), { ...orderData, createdAt: Date.now() });
      return { id: newRef.key, ...orderData };
    }
  );

const updateOrderStatus = (id, status, extra = {}) =>
  withFallback(
    async () => {
      const res = await api.put(`/orders/${id}/status`, { status, ...extra });
      return res.data;
    },
    () => update(ref(firebaseDB, `orders/${id}`), { status, ...extra, updatedAt: Date.now() })
  );

const deleteOrder = (id) =>
  withFallback(
    async () => {
      const res = await api.delete(`/orders/${id}`);
      return res.data;
    },
    () => remove(ref(firebaseDB, `orders/${id}`))
  );

const bulkDeleteOrders = (ids) =>
  withFallback(
    async () => {
      const res = await api.delete('/orders/bulk', { data: { ids } });
      return res.data;
    },
    () => Promise.all(ids.map(id => remove(ref(firebaseDB, `orders/${id}`))))
  );

// ─── Reservations ─────────────────────────────────────────────────────────────

const getReservations = (limit = 100) =>
  withFallbackOrEmpty(
    async () => {
      const res = await api.get('/reservations', { params: { limit } });
      return res.data;
    },
    async () => {
      const snap = await get(ref(firebaseDB, 'reservations'));
      return snapshotToArray(snap).reverse();
    }
  );

const createReservation = (data) =>
  withFallback(
    async () => {
      const res = await api.post('/reservations', data);
      return res.data;
    },
    async () => {
      const newRef = await push(ref(firebaseDB, 'reservations'), { ...data, createdAt: Date.now() });
      return { id: newRef.key, ...data };
    }
  );

const updateReservationStatus = (id, status) =>
  withFallback(
    async () => {
      const res = await api.put(`/reservations/${id}/status`, { status });
      return res.data;
    },
    () => update(ref(firebaseDB, `reservations/${id}`), { status, updatedAt: Date.now() })
  );

const deleteReservation = (id) =>
  withFallback(
    async () => {
      const res = await api.delete(`/reservations/${id}`);
      return res.data;
    },
    () => remove(ref(firebaseDB, `reservations/${id}`))
  );

const bulkDeleteReservations = (ids) =>
  withFallback(
    async () => {
      const res = await api.delete('/reservations/bulk', { data: { ids } });
      return res.data;
    },
    () => Promise.all(ids.map(id => remove(ref(firebaseDB, `reservations/${id}`))))
  );

// ─── Users / Customers ───────────────────────────────────────────────────────

const getUsers = () =>
  withFallbackOrEmpty(
    async () => {
      const res = await api.get('/users');
      return res.data;
    },
    async () => {
      const snap = await get(ref(firebaseDB, 'users'));
      return snapshotToArray(snap);
    }
  );

const addUser = (userData) =>
  withFallback(
    async () => {
      const res = await api.post('/users', userData);
      return res.data;
    },
    async () => {
      const newRef = await push(ref(firebaseDB, 'users'), { ...userData, createdAt: Date.now() });
      return { id: newRef.key, ...userData };
    }
  );

const updateUser = (id, updates) =>
  withFallback(
    async () => {
      const res = await api.put(`/users/${id}`, updates);
      return res.data;
    },
    () => update(ref(firebaseDB, `users/${id}`), { ...updates, updatedAt: Date.now() })
  );

const deleteUser = (id) =>
  withFallback(
    async () => {
      const res = await api.delete(`/users/${id}`);
      return res.data;
    },
    () => remove(ref(firebaseDB, `users/${id}`))
  );

const bulkDeleteUsers = (ids) =>
  withFallback(
    async () => {
      const res = await api.delete('/users/bulk', { data: { ids } });
      return res.data;
    },
    () => Promise.all(ids.map(id => remove(ref(firebaseDB, `users/${id}`))))
  );

// ─── Authorized Users (Admin) ─────────────────────────────────────────────────

const getAuthorizedUsers = () =>
  withFallbackOrEmpty(
    async () => {
      const res = await api.get('/authorized-users');
      return res.data;
    },
    async () => {
      const snap = await get(ref(firebaseDB, 'authorized_users'));
      return snapshotToArray(snap);
    }
  );

const addAuthorizedUser = (email) =>
  withFallback(
    async () => {
      // Support comma/space separated bulk input
      const emails = email.split(/[\s,]+/).filter(e => e.trim());
      const res = await api.post('/authorized-users', { emails });
      return res.data;
    },
    async () => {
      const emails = email.split(/[\s,]+/).filter(e => e.trim());
      const promises = emails.map(e =>
        push(ref(firebaseDB, 'authorized_users'), { email: e.toLowerCase(), addedAt: Date.now() })
      );
      await Promise.all(promises);
      return { inserted: emails.length };
    }
  );

const removeAuthorizedUser = (id) =>
  withFallback(
    async () => {
      const res = await api.delete(`/authorized-users/${id}`);
      return res.data;
    },
    () => remove(ref(firebaseDB, `authorized_users/${id}`))
  );

// ─── Health check — used internally ──────────────────────────────────────────

const checkApiHealth = async () => {
  try {
    const res = await api.get('/health', { timeout: 3000 });
    return res.status === 200;
  } catch {
    return false;
  }
};


/** Legacy: direct Firebase reset link (kept for potential future use) */
const sendForgotPasswordEmail = async (email) => {
  const res = await api.post('/users/forgot-password', { email });
  return res.data;
};

// ─── Export ───────────────────────────────────────────────────────────────────

export const dataService = {
  // Menu
  getMenu,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
  bulkDeleteMenuItems,
  uploadMenuImage,
  // Orders
  getOrders,
  createOrder,
  updateOrderStatus,
  deleteOrder,
  bulkDeleteOrders,
  // Reservations
  getReservations,
  createReservation,
  updateReservationStatus,
  deleteReservation,
  bulkDeleteReservations,
  // Users
  getUsers,
  addUser,
  updateUser,
  deleteUser,
  bulkDeleteUsers,
  sendForgotPasswordEmail,
  // Authorized Users
  getAuthorizedUsers,
  addAuthorizedUser,
  removeAuthorizedUser,
  // Utilities
  checkApiHealth,
};
