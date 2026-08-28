'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { NotificationPreferences } from '@apex-work/shared';

export function useNotificationPreferences() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<NotificationPreferences>({
    queryKey: ['notification-preferences'],
    queryFn: () => apiFetch('/me/notification-preferences', { token }),
    enabled: !!token,
    staleTime: 60_000,
  });
}

export function useUpdateNotificationPreferences() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<NotificationPreferences, Error, NotificationPreferences>({
    mutationFn: (body) =>
      apiFetch('/me/notification-preferences', { method: 'PATCH', token, body }),
    onSuccess: (data) => {
      qc.setQueryData(['notification-preferences'], data);
    },
  });
}
