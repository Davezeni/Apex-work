'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { ReactionEmoji } from '@apex-work/shared';

export function useToggleReaction(conversationId: string) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<
    { messageId: string; emoji: string; added: boolean },
    Error,
    { messageId: string; emoji: ReactionEmoji }
  >({
    mutationFn: ({ messageId, emoji }) =>
      apiFetch(`/messages/${messageId}/reactions`, { method: 'POST', token, body: { emoji } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages', conversationId] }),
  });
}
