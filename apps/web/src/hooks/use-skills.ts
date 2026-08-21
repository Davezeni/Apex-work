'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface Skill {
  id: string;
  name: string;
  slug: string;
  category: string | null;
}

export function useSkills(q: string = '') {
  return useQuery<{ items: Skill[] }>({
    queryKey: ['skills', q],
    queryFn: () => apiFetch(`/skills${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    staleTime: 5 * 60 * 1000,
  });
}
