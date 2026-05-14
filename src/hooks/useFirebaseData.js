import { useQuery } from '@tanstack/react-query';
import { dataService } from '../services/dataService';

// ─── Menu ─────────────────────────────────────────────────────────────────────

/**
 * Fetches menu items — tries Express API first, falls back to Firebase.
 */
export const useMenu = (limit) => {
  return useQuery({
    queryKey: ['menu'],
    queryFn: () => dataService.getMenu(),
    staleTime: 0 // Fetch immediately so updates from dashboard show up right away
  });
};

// ─── Reservations ─────────────────────────────────────────────────────────────

export const useReservations = (limit = 100) => {
  return useQuery({
    queryKey: ['reservations', limit],
    queryFn: () => dataService.getReservations(limit)
  });
};

// ─── Orders ───────────────────────────────────────────────────────────────────

export const useOrders = (limit = 100) => {
  return useQuery({
    queryKey: ['orders', limit],
    queryFn: () => dataService.getOrders(limit)
  });
};

// ─── Users / Customers ────────────────────────────────────────────────────────

export const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => dataService.getUsers()
  });
};
