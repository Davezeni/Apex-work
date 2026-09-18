'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export interface AgencyMember {
  role: string;
  createdAt: string;
  user: { id: string; username: string; fullName: string; avatarUrl: string | null; role: string };
}
export interface Agency {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  website: string | null;
  ownerId: string;
  defaultAssigneeSharePct: number;
  members: AgencyMember[];
}

export function useAgencies() {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery<{ items: Agency[] }>({
    queryKey: ['agencies'],
    queryFn: () => apiFetch('/me/teams', { token }),
    enabled: !!token,
    staleTime: 30_000,
  });
}
export function useCreateAgency() {
  const token = useAuthStore((state) => state.accessToken);
  const qc = useQueryClient();
  return useMutation<Agency, Error, { name: string; bio?: string; website?: string }>({
    mutationFn: (body) => apiFetch('/me/teams', { method: 'POST', token, body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agencies'] }),
  });
}
export function useInviteAgencyMember() {
  const token = useAuthStore((state) => state.accessToken);
  const qc = useQueryClient();
  return useMutation<
    AgencyMember,
    Error,
    { agencyId: string; username: string; role: 'MEMBER' | 'MANAGER' }
  >({
    mutationFn: ({ agencyId, username, role }) =>
      apiFetch(`/me/teams/${agencyId}/members`, {
        method: 'POST',
        token,
        body: { username, role },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agencies'] }),
  });
}
/** Owner settings: default payout share for assigned members. */
export function useUpdateTeam() {
  const token = useAuthStore((state) => state.accessToken);
  const qc = useQueryClient();
  return useMutation<
    { id: string; name: string; defaultAssigneeSharePct: number },
    Error,
    { agencyId: string; defaultAssigneeSharePct: number }
  >({
    mutationFn: ({ agencyId, defaultAssigneeSharePct }) =>
      apiFetch(`/me/teams/${agencyId}`, {
        method: 'PATCH',
        token,
        body: { defaultAssigneeSharePct },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agencies'] }),
  });
}

/** Open (or create) the team's shared group chat; returns the conversation. */
export function useTeamChat() {
  const token = useAuthStore((state) => state.accessToken);
  return useMutation<{ id: string }, Error, { agencyId: string }>({
    mutationFn: ({ agencyId }) => apiFetch(`/me/teams/${agencyId}/chat`, { method: 'POST', token }),
  });
}
export function useRemoveAgencyMember() {
  const token = useAuthStore((state) => state.accessToken);
  const qc = useQueryClient();
  return useMutation<{ ok: true }, Error, { agencyId: string; memberId: string }>({
    mutationFn: ({ agencyId, memberId }) =>
      apiFetch(`/me/teams/${agencyId}/members/${memberId}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agencies'] }),
  });
}
