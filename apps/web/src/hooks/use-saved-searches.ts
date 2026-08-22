'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { CreateSavedSearchInput, UpdateSavedSearchInput } from '@apex-work/shared';

export interface SavedSearch {
  id: string;
  name: string;
  type: 'GIGS' | 'JOBS' | 'USERS';
  query: string;
  category: string | null;
  emailEnabled: boolean;
  pushEnabled: boolean;
  lastCheckedAt: string;
  createdAt: string;
}

export function useSavedSearches() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<{ items: SavedSearch[] }>({
    queryKey: ['saved-searches'],
    queryFn: () => apiFetch('/me/saved-searches', { token }),
    enabled: !!token,
  });
}

export function useCreateSavedSearch() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<SavedSearch, Error, CreateSavedSearchInput>({
    mutationFn: (body) => apiFetch('/me/saved-searches', { method: 'POST', token, body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-searches'] }),
  });
}

export function useUpdateSavedSearch() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<SavedSearch, Error, { id: string } & UpdateSavedSearchInput>({
    mutationFn: ({ id, ...body }) => apiFetch(`/me/saved-searches/${id}`, { method: 'PATCH', token, body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-searches'] }),
  });
}

export function useDeleteSavedSearch() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: (id) => apiFetch(`/me/saved-searches/${id}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-searches'] }),
  });
}
