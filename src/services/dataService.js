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
    if (isNetworkError(err) || (err.response && err.response.status >= 500)) {
      console.warn('⚠️ Express API unreachable or server error — falling back to Firebase:', err.message);
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
      return Array.isArray(res.data) ? res.data : (res.data.data || []);
    },
    async () => {
      const snap = await get(ref(firebaseDB, 'menu'));
      return snapshotToArray(snap);
    }
  );

const addMenuItem = async (item) => {
  try {
    const res = await api.post('/menu', item);
    // Sync with Firebase to keep real-time listeners happy
    try {
      if (res.data && res.data.id) {
        const itemRef = ref(firebaseDB, `menu/${res.data.id}`);
        await update(itemRef, { ...item, id: res.data.id, createdAt: Date.now() });
      }
    } catch(e) { console.warn('Firebase sync failed', e); }
    return res.data;
  } catch (err) {
    if (isNetworkError(err) || (err.response && err.response.status >= 500)) {
      console.warn('⚠️ Express API unreachable or server error — falling back to Firebase:', err.message);
      const newRef = push(ref(firebaseDB, 'menu'));
      await update(newRef, { ...item, createdAt: Date.now() });
      return { id: newRef.key, ...item };
    }
    throw err;
  }
};

const updateMenuItem = async (id, updates) => {
  try {
    const res = await api.put(`/menu/${id}`, updates);
    try {
      await update(ref(firebaseDB, `menu/${id}`), { ...updates, updatedAt: Date.now() });
    } catch(e) { console.warn('Firebase sync failed', e); }
    return res.data;
  } catch (err) {
    if (isNetworkError(err) || (err.response && err.response.status >= 500)) {
      await update(ref(firebaseDB, `menu/${id}`), { ...updates, updatedAt: Date.now() });
      return { id, ...updates };
    }
    throw err;
  }
};

const deleteMenuItem = async (id) => {
  try {
    const res = await api.delete(`/menu/${id}`);
    try { await remove(ref(firebaseDB, `menu/${id}`)); } catch(e) {}
    return res.data;
  } catch (err) {
    if (isNetworkError(err) || (err.response && err.response.status >= 500)) {
      return remove(ref(firebaseDB, `menu/${id}`));
    }
    throw err;
  }
};

const bulkDeleteMenuItems = async (ids) => {
  try {
    const res = await api.delete('/menu/bulk', { data: { ids } });
    try {
      await Promise.all(ids.map(id => remove(ref(firebaseDB, `menu/${id}`))));
    } catch(e) { console.warn('Firebase sync failed', e); }
    return res.data;
  } catch (err) {
    if (isNetworkError(err) || (err.response && err.response.status >= 500)) {
      await Promise.all(ids.map(id => remove(ref(firebaseDB, `menu/${id}`))));
      return { deleted: ids.length };
    }
    throw err;
  }
};

// Upload an image file — returns { fullUrl, thumbnailUrl }
const uploadMenuImage = async (file) => {
  try {
    const formData = new FormData();
    formData.append('image', file);
    const res = await api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000
    });
    return res.data;
  } catch (err) {
    if (isNetworkError(err) || (err.response && err.response.status >= 500)) {
      console.warn('⚠️ Upload API unreachable — falling back to Firebase Storage');
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

const createOrder = async (orderData) => {
  try {
    const res = await api.post('/orders', orderData);
    try {
      if (res.data && res.data.id) {
        await update(ref(firebaseDB, `orders/${res.data.id}`), { ...orderData, id: res.data.id, createdAt: Date.now() });
      }
    } catch(e) { console.warn('Firebase sync failed', e); }
    return res.data;
  } catch (err) {
    if (isNetworkError(err) || (err.response && err.response.status >= 500)) {
      const newRef = push(ref(firebaseDB, 'orders'));
      await update(newRef, { ...orderData, createdAt: Date.now() });
      return { id: newRef.key, ...orderData };
    }
    throw err;
  }
};

const updateOrderStatus = async (id, status, extra = {}) => {
  try {
    const res = await api.put(`/orders/${id}/status`, { status, ...extra });
    try {
      await update(ref(firebaseDB, `orders/${id}`), { status, ...extra, updatedAt: Date.now() });
    } catch(e) { console.warn('Firebase sync failed', e); }
    return res.data;
  } catch (err) {
    if (isNetworkError(err) || (err.response && err.response.status >= 500)) {
      await update(ref(firebaseDB, `orders/${id}`), { status, ...extra, updatedAt: Date.now() });
      return { id, status, ...extra };
    }
    throw err;
  }
};

const deleteOrder = async (id) => {
  try {
    const res = await api.delete(`/orders/${id}`);
    try {
      await remove(ref(firebaseDB, `orders/${id}`));
    } catch(e) { console.warn('Firebase sync failed', e); }
    return res.data;
  } catch (err) {
    if (isNetworkError(err) || (err.response && err.response.status >= 500)) {
      await remove(ref(firebaseDB, `orders/${id}`));
      return { deleted: id };
    }
    throw err;
  }
};

const bulkDeleteOrders = async (ids) => {
  try {
    const res = await api.delete('/orders/bulk', { data: { ids } });
    try {
      await Promise.all(ids.map(id => remove(ref(firebaseDB, `orders/${id}`))));
    } catch(e) { console.warn('Firebase sync failed', e); }
    return res.data;
  } catch (err) {
    if (isNetworkError(err) || (err.response && err.response.status >= 500)) {
      await Promise.all(ids.map(id => remove(ref(firebaseDB, `orders/${id}`))));
      return { deleted: ids.length };
    }
    throw err;
  }
};

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

const createReservation = async (data) => {
  try {
    const res = await api.post('/reservations', data);
    try {
      if (res.data && res.data.id) {
        await update(ref(firebaseDB, `reservations/${res.data.id}`), { ...data, id: res.data.id, createdAt: Date.now() });
      }
    } catch(e) { console.warn('Firebase sync failed', e); }
    return res.data;
  } catch (err) {
    if (isNetworkError(err) || (err.response && err.response.status >= 500)) {
      const newRef = push(ref(firebaseDB, 'reservations'));
      await update(newRef, { ...data, createdAt: Date.now() });
      return { id: newRef.key, ...data };
    }
    throw err;
  }
};

const updateReservationStatus = async (id, status) => {
  try {
    const res = await api.put(`/reservations/${id}/status`, { status });
    try {
      await update(ref(firebaseDB, `reservations/${id}`), { status, updatedAt: Date.now() });
    } catch(e) { console.warn('Firebase sync failed', e); }
    return res.data;
  } catch (err) {
    if (isNetworkError(err) || (err.response && err.response.status >= 500)) {
      await update(ref(firebaseDB, `reservations/${id}`), { status, updatedAt: Date.now() });
      return { id, status };
    }
    throw err;
  }
};

const deleteReservation = async (id) => {
  try {
    const res = await api.delete(`/reservations/${id}`);
    try {
      await remove(ref(firebaseDB, `reservations/${id}`));
    } catch(e) { console.warn('Firebase sync failed', e); }
    return res.data;
  } catch (err) {
    if (isNetworkError(err) || (err.response && err.response.status >= 500)) {
      await remove(ref(firebaseDB, `reservations/${id}`));
      return { deleted: id };
    }
    throw err;
  }
};

const bulkDeleteReservations = async (ids) => {
  try {
    const res = await api.delete('/reservations/bulk', { data: { ids } });
    try {
      await Promise.all(ids.map(id => remove(ref(firebaseDB, `reservations/${id}`))));
    } catch(e) { console.warn('Firebase sync failed', e); }
    return res.data;
  } catch (err) {
    if (isNetworkError(err) || (err.response && err.response.status >= 500)) {
      await Promise.all(ids.map(id => remove(ref(firebaseDB, `reservations/${id}`))));
      return { deleted: ids.length };
    }
    throw err;
  }
};

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

const addUser = async (userData) => {
  try {
    const res = await api.post('/users', userData);
    try {
      if (res.data && res.data.id) {
        await update(ref(firebaseDB, `users/${res.data.id}`), { ...userData, id: res.data.id, createdAt: Date.now() });
      }
    } catch(e) { console.warn('Firebase sync failed', e); }
    return res.data;
  } catch (err) {
    if (isNetworkError(err) || (err.response && err.response.status >= 500)) {
      const newRef = push(ref(firebaseDB, 'users'));
      await update(newRef, { ...userData, createdAt: Date.now() });
      return { id: newRef.key, ...userData };
    }
    throw err;
  }
};

const updateUser = async (id, updates) => {
  try {
    const res = await api.put(`/users/${id}`, updates);
    try {
      await update(ref(firebaseDB, `users/${id}`), { ...updates, updatedAt: Date.now() });
    } catch(e) { console.warn('Firebase sync failed', e); }
    return res.data;
  } catch (err) {
    if (isNetworkError(err) || (err.response && err.response.status >= 500)) {
      await update(ref(firebaseDB, `users/${id}`), { ...updates, updatedAt: Date.now() });
      return { id, ...updates };
    }
    throw err;
  }
};

const deleteUser = async (id) => {
  try {
    const res = await api.delete(`/users/${id}`);
    try {
      await remove(ref(firebaseDB, `users/${id}`));
    } catch(e) { console.warn('Firebase sync failed', e); }
    return res.data;
  } catch (err) {
    if (isNetworkError(err) || (err.response && err.response.status >= 500)) {
      await remove(ref(firebaseDB, `users/${id}`));
      return { deleted: id };
    }
    throw err;
  }
};

const bulkDeleteUsers = async (ids) => {
  try {
    const res = await api.delete('/users/bulk', { data: { ids } });
    try {
      await Promise.all(ids.map(id => remove(ref(firebaseDB, `users/${id}`))));
    } catch(e) { console.warn('Firebase sync failed', e); }
    return res.data;
  } catch (err) {
    if (isNetworkError(err) || (err.response && err.response.status >= 500)) {
      await Promise.all(ids.map(id => remove(ref(firebaseDB, `users/${id}`))));
      return { deleted: ids.length };
    }
    throw err;
  }
};

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

const addAuthorizedUser = async (email) => {
  try {
    const emails = email.split(/[\s,]+/).filter(e => e.trim());
    const res = await api.post('/authorized-users', { emails });
    try {
      const promises = emails.map(e =>
        push(ref(firebaseDB, 'authorized_users'), { email: e.toLowerCase(), addedAt: Date.now() })
      );
      await Promise.all(promises);
    } catch(e) { console.warn('Firebase sync failed', e); }
    return res.data;
  } catch (err) {
    if (isNetworkError(err) || (err.response && err.response.status >= 500)) {
      const emails = email.split(/[\s,]+/).filter(e => e.trim());
      const promises = emails.map(e =>
        push(ref(firebaseDB, 'authorized_users'), { email: e.toLowerCase(), addedAt: Date.now() })
      );
      await Promise.all(promises);
      return { inserted: emails.length };
    }
    throw err;
  }
};

const removeAuthorizedUser = async (id) => {
  try {
    const res = await api.delete(`/authorized-users/${id}`);
    try {
      await remove(ref(firebaseDB, `authorized_users/${id}`));
    } catch(e) { console.warn('Firebase sync failed', e); }
    return res.data;
  } catch (err) {
    if (isNetworkError(err) || (err.response && err.response.status >= 500)) {
      await remove(ref(firebaseDB, `authorized_users/${id}`));
      return { deleted: id };
    }
    throw err;
  }
};

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
