'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { ResumeTemplateId } from '@apex-work/shared';

export interface ResumeTemplate {
  id: ResumeTemplateId;
  name: string;
  description: string;
  tier: 'free' | 'pro';
  priceEtb: number;
  emoji: string;
  bestFor: string;
  features: string[];
  available: boolean;
  owned: boolean;
  active: boolean;
}

export function useResumeTemplates() {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery<{
    templates: ResumeTemplate[];
    activeTemplateId: ResumeTemplateId | string;
  }>({
    queryKey: ['resume-templates'],
    queryFn: () => apiFetch('/me/resume/templates', { token }),
    enabled: !!token,
    staleTime: 60_000,
  });
}

export function useSelectResumeTemplate() {
  const token = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();
  return useMutation<{ templateId: ResumeTemplateId }, Error, ResumeTemplateId>({
    mutationFn: (templateId) =>
      apiFetch('/me/resume/template', { method: 'PATCH', token, body: { templateId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume-templates'] });
      queryClient.invalidateQueries({ queryKey: ['me', 'resume'] });
    },
  });
}

export function useBuyResumeTemplate() {
  const token = useAuthStore((state) => state.accessToken);
  return useMutation<
    {
      owned: boolean;
      purchaseId?: string;
      templateId: ResumeTemplateId;
      checkoutUrl?: string | null;
    },
    Error,
    ResumeTemplateId
  >({
    mutationFn: (templateId) =>
      apiFetch(`/me/resume/templates/${templateId}/checkout`, { method: 'POST', token }),
  });
}

export function useVerifyResumeTemplate() {
  const token = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();
  return useMutation<
    {
      purchaseId: string;
      templateId: ResumeTemplateId;
      status: 'PENDING' | 'PAID' | 'FAILED';
      owned: boolean;
    },
    Error,
    { templateId: ResumeTemplateId; purchaseId: string }
  >({
    mutationFn: ({ templateId, purchaseId }) =>
      apiFetch(`/me/resume/templates/${templateId}/verify`, {
        method: 'POST',
        token,
        body: { purchaseId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume-templates'] });
      queryClient.invalidateQueries({ queryKey: ['me', 'resume'] });
    },
  });
}
