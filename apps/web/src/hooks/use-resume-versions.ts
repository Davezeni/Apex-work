'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export interface ResumeVersion {
  id: string;
  name: string;
  targetRole: string | null;
  templateId: string | null;
  createdAt: string;
}

export function useResumeVersions() {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery<{ items: ResumeVersion[] }>({
    queryKey: ['resume-versions'],
    queryFn: () => apiFetch('/me/resume/versions', { token }),
    enabled: !!token,
    staleTime: 15_000,
  });
}

export function useCreateResumeVersion() {
  const token = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();
  return useMutation<ResumeVersion, Error, { name: string }>({
    mutationFn: (body) => apiFetch('/me/resume/versions', { method: 'POST', token, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resume-versions'] }),
  });
}

export function useRestoreResumeVersion() {
  const token = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: (id) => apiFetch(`/me/resume/versions/${id}/restore`, { method: 'POST', token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume-versions'] });
      queryClient.invalidateQueries({ queryKey: ['me', 'resume'] });
    },
  });
}

export function useDeleteResumeVersion() {
  const token = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();
  return useMutation<{ ok: true }, Error, string>({
    mutationFn: (id) => apiFetch(`/me/resume/versions/${id}`, { method: 'DELETE', token }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resume-versions'] }),
  });
}
