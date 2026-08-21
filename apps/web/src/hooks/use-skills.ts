'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export interface Skill {
  id: string;
  name: string;
  slug: string;
  category: string | null;
}

/** Search / list skills (public). */
export function useSkills(q: string = '') {
  return useQuery<{ items: Skill[] }>({
    queryKey: ['skills', q],
    queryFn: () => apiFetch(`/skills${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    // 5 min stale — skill list changes rarely; typeahead reuse is important.
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Create a new user-contributed skill.
 * Deduped case-insensitively on the server — safe to call optimistically.
 * On success, invalidates the search cache so subsequent typeahead includes it.
 */
export function useCreateSkill() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<{ skill: Skill; created: boolean }>('/skills', {
        method: 'POST',
        token,
        body: { name },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['skills'] });
    },
  });
}
