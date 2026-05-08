import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../firebase';
import { ref, get, query, limitToLast, orderByChild, update, remove, push } from 'firebase/database';

// Fetch reservations with pagination
export const useReservations = (limit = 20) => {
  return useQuery({
    queryKey: ['reservations', limit],
    queryFn: async () => {
      const q = query(ref(db, 'reservations'), orderByChild('createdAt'), limitToLast(limit));
      const snapshot = await get(q);
      if (snapshot.exists()) {
        const data = snapshot.val();
        return Object.entries(data).map(([id, val]) => ({ id, ...val })).reverse();
      }
      return [];
    }
  });
};

// Fetch orders with pagination
export const useOrders = (limit = 20) => {
  return useQuery({
    queryKey: ['orders', limit],
    queryFn: async () => {
      const q = query(ref(db, 'orders'), orderByChild('createdAt'), limitToLast(limit));
      const snapshot = await get(q);
      if (snapshot.exists()) {
        const data = snapshot.val();
        return Object.entries(data).map(([id, val]) => ({ id, ...val })).reverse();
      }
      return [];
    }
  });
};

// Fetch menu
export const useMenu = () => {
  return useQuery({
    queryKey: ['menu'],
    queryFn: async () => {
      const snapshot = await get(ref(db, 'menu'));
      if (snapshot.exists()) {
        const data = snapshot.val();
        return Object.entries(data).map(([id, val]) => ({ id, ...val }));
      }
      return [];
    }
  });
};

// Fetch users/customers
export const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const snapshot = await get(ref(db, 'users'));
      if (snapshot.exists()) {
        const data = snapshot.val();
        return Object.entries(data).map(([id, val]) => ({ id, ...val }));
      }
      return [];
    }
  });
};
