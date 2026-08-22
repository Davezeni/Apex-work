'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { AddUserSkillInput } from '@apex-work/shared';

export interface UserSkillRow {
  userId: string;
  skillId: string;
  level: number;
  skill: { id: string; name: string; slug: string; category: string };
}

export function useMySkills() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<{ items: UserSkillRow[] }>({
    queryKey: ['me', 'skills'],
    queryFn: () => apiFetch('/me/skills', { token }),
    enabled: !!token,
  });
}

export function useAddSkill() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<UserSkillRow, Error, AddUserSkillInput>({
    mutationFn: (body) => apiFetch('/me/skills', { method: 'POST', token, body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me', 'skills'] });
      qc.invalidateQueries({ queryKey: ['public-user'] });
    },
  });
}

export function useSetLevel() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<unknown, Error, { skillId: string; level: number }>({
    mutationFn: ({ skillId, level }) =>
      apiFetch(`/me/skills/${skillId}`, { method: 'PATCH', token, body: { level } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'skills'] }),
  });
}

export function useRemoveSkill() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: (skillId) => apiFetch(`/me/skills/${skillId}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'skills'] }),
  });
}
