'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export interface SavedJob {
  id: string;
  createdAt: string;
  job: {
    id: string;
    title: string;
    budgetMinEtb: number | null;
    budgetMaxEtb: number | null;
    isRemote: boolean;
    isOpen: boolean;
    createdAt: string;
    client: {
      id: string;
      username: string;
      fullName: string;
      avatarUrl: string | null;
    };
    _count: { bids: number };
    attachments: { url: string; contentType: string }[];
  };
}

export function useSavedJobs() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<{ items: SavedJob[] }>({
    queryKey: ['saved-jobs'],
    queryFn: () => apiFetch('/me/saved-jobs', { token }),
    enabled: !!token,
    staleTime: 30_000,
  });
}

/** Set of saved job ids — one fetch powers every bookmark on the board. */
export function useSavedJobIds() {
  const { data } = useSavedJobs();
  return new Set((data?.items ?? []).map((item) => item.job.id));
}

export function useSaveJob() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<{ saved: true }, Error, string>({
    mutationFn: (jobId) =>
      apiFetch(`/me/saved-jobs/${encodeURIComponent(jobId)}`, { method: 'PUT', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-jobs'] }),
  });
}

export function useUnsaveJob() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<{ saved: false }, Error, string>({
    mutationFn: (jobId) =>
      apiFetch(`/me/saved-jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-jobs'] }),
  });
}
