'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { CreateGroupInput, UpdateGroupInput } from '@apex-work/shared';

export function useCreateGroup() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<{ id: string }, Error, CreateGroupInput>({
    mutationFn: (body) => apiFetch('/groups', { method: 'POST', token, body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });
}

export function useUpdateGroup(id: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<unknown, Error, UpdateGroupInput>({
    mutationFn: (body) => apiFetch(`/groups/${id}`, { method: 'PATCH', token, body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });
}

export function useAddMember(id: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: (userId) =>
      apiFetch(`/groups/${id}/members`, { method: 'POST', token, body: { userId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });
}

export function useRemoveMember(id: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: (userId) =>
      apiFetch(`/groups/${id}/members/${userId}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });
}
