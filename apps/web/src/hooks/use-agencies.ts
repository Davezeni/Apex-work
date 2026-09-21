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
  logoUrl: string | null;
  verifiedAt: string | null;
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
    {
      agencyId: string;
      defaultAssigneeSharePct?: number;
      bio?: string | null;
      website?: string | null;
      logoUrl?: string | null;
    }
  >({
    mutationFn: ({ agencyId, ...body }) =>
      apiFetch(`/me/teams/${agencyId}`, { method: 'PATCH', token, body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agencies'] }),
  });
}

export function useSetMemberRole() {
  const token = useAuthStore((state) => state.accessToken);
  const qc = useQueryClient();
  return useMutation<
    { userId: string; role: 'MEMBER' | 'MANAGER' },
    Error,
    {
      agencyId: string;
      userId: string;
      role: 'MEMBER' | 'MANAGER';
    }
  >({
    mutationFn: ({ agencyId, userId, role }) =>
      apiFetch(`/me/teams/${agencyId}/members/${userId}/role`, {
        method: 'PATCH',
        token,
        body: { role },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agencies'] }),
  });
}

export function useAddAgencyProject() {
  const token = useAuthStore((state) => state.accessToken);
  const qc = useQueryClient();
  return useMutation<
    { id: string; title: string },
    Error,
    {
      agencyId: string;
      title: string;
      description?: string;
      url?: string;
      imageUrl?: string;
    }
  >({
    mutationFn: ({ agencyId, ...body }) =>
      apiFetch(`/me/teams/${agencyId}/projects`, { method: 'POST', token, body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agencies'] });
      qc.invalidateQueries({ queryKey: ['agency-storefront'] });
    },
  });
}

export function useRemoveAgencyProject() {
  const token = useAuthStore((state) => state.accessToken);
  const qc = useQueryClient();
  return useMutation<{ removed: true }, Error, { agencyId: string; projectId: string }>({
    mutationFn: ({ agencyId, projectId }) =>
      apiFetch(`/me/teams/${agencyId}/projects/${projectId}`, { method: 'DELETE', token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agencies'] });
      qc.invalidateQueries({ queryKey: ['agency-storefront'] });
    },
  });
}

export function useAgencyInvites(agencyId: string | undefined, enabled = true) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery<{
    items: {
      id: string;
      createdAt: string;
      message: string | null;
      job: {
        id: string;
        title: string;
        isOpen: boolean;
        budgetMinEtb: number | null;
        budgetMaxEtb: number | null;
      };
      invitedBy: { fullName: string };
    }[];
  }>({
    queryKey: ['agency-invites', agencyId],
    queryFn: () => apiFetch(`/me/teams/${agencyId}/invites`, { token }),
    enabled: enabled && !!agencyId,
  });
}

export interface AgencyDashboard {
  openBids: number;
  activeOrders: number;
  completedOrders: number;
  avgRating: number;
  onTimePct: number;
  repeatClientPct: number;
  badge: 'NONE' | 'RISING' | 'TOP';
}

export function useAgencyDashboard(agencyId: string | undefined, enabled = true) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery<AgencyDashboard>({
    queryKey: ['agency-dashboard', agencyId],
    queryFn: () => apiFetch(`/me/teams/${agencyId}/dashboard`, { token }),
    enabled: enabled && !!agencyId,
  });
}

/** A signed-in client invites this team to bid on one of their open jobs. */
export function useInviteAgencyToJob() {
  const token = useAuthStore((state) => state.accessToken);
  return useMutation<
    { invited: true },
    Error,
    { jobId: string; agencyId: string; message?: string }
  >({
    mutationFn: ({ jobId, ...body }) =>
      apiFetch(`/jobs/${jobId}/agency-invites`, { method: 'POST', token, body }),
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
