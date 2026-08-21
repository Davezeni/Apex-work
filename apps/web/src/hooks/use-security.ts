'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

// ---------------- PIN ----------------

export function useSetPin() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pin: string) =>
      apiFetch<{ ok: true }>('/auth/pin', { method: 'POST', body: { pin }, token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}

export function useRemovePin() {
  const token = useAuthStore((s) => s.accessToken);
  return useMutation({
    mutationFn: () => apiFetch<{ ok: true }>('/auth/pin', { method: 'DELETE', token }),
  });
}

// ---------------- Devices ----------------

export interface TrustedDevice {
  id: string;
  label: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
}

export function useMyDevices() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<{ items: TrustedDevice[] }>({
    queryKey: ['my-devices'],
    queryFn: () => apiFetch('/me/devices', { token }),
    enabled: !!token,
    staleTime: 30_000,
  });
}

export function useRevokeDevice() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deviceId: string) =>
      apiFetch<{ ok: true }>(`/me/devices/${deviceId}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-devices'] }),
  });
}

export function useRevokeAllDevices() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ revoked: number }>('/me/devices/revoke-all', { method: 'POST', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-devices'] }),
  });
}

// ---------------- Passkeys ----------------

export interface PasskeyRecord {
  id: string;
  label: string | null;
  deviceType: 'singleDevice' | 'multiDevice' | null;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string;
}

export function useMyPasskeys() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<{ items: PasskeyRecord[] }>({
    queryKey: ['my-passkeys'],
    queryFn: () => apiFetch('/auth/passkey', { token }),
    enabled: !!token,
    staleTime: 60_000,
  });
}

export function useDeletePasskey() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/auth/passkey/${id}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-passkeys'] }),
  });
}
