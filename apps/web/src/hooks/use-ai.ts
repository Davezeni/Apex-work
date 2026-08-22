'use client';

import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export function useAIProposal() {
  const token = useAuthStore((s) => s.accessToken);
  return useMutation<
    { text: string; source: 'ai' | 'fallback' },
    Error,
    { jobDescription: string; name?: string; skills?: string; tone: 'friendly' | 'professional' | 'confident' }
  >({
    mutationFn: (body) => apiFetch('/ai/proposal', { method: 'POST', token, body }),
  });
}

export function useAIBrief() {
  const token = useAuthStore((s) => s.accessToken);
  return useMutation<
    { title: string; description: string; skills: string[]; budgetMinEtb: number; budgetMaxEtb: number; source: 'ai' | 'fallback' },
    Error,
    { idea: string }
  >({
    mutationFn: (body) => apiFetch('/ai/brief', { method: 'POST', token, body }),
  });
}

export function useAIResumeEnhance() {
  const token = useAuthStore((s) => s.accessToken);
  return useMutation<
    { text: string; source: 'ai' | 'fallback' },
    Error,
    { section: 'summary' | 'experience' | 'education'; text: string }
  >({
    mutationFn: (body) => apiFetch('/ai/resume/enhance', { method: 'POST', token, body }),
  });
}

export function useAITranscribe() {
  const token = useAuthStore((s) => s.accessToken);
  return useMutation<
    { text: string; source: 'ai' | 'fallback' },
    Error,
    { audioUrl: string; language?: string }
  >({
    mutationFn: (body) => apiFetch('/ai/transcribe', { method: 'POST', token, body }),
  });
}
