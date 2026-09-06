'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export function useAIStatus(enabled = true) {
  return useQuery<{
    configured: boolean;
    fallbackAvailable: boolean;
    fallbackVersion: string;
    model: string | null;
    providerReachable: boolean | null;
    lastProviderError: string | null;
  }>({
    queryKey: ['ai-status'],
    queryFn: () => apiFetch('/ai/status'),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useAIProposal() {
  const token = useAuthStore((s) => s.accessToken);
  return useMutation<
    { text: string; source: 'ai' | 'fallback' },
    Error,
    {
      jobDescription: string;
      name?: string;
      skills?: string;
      tone: 'friendly' | 'professional' | 'confident';
    }
  >({
    mutationFn: (body) => apiFetch('/ai/proposal', { method: 'POST', token, body }),
  });
}

export function useAIBrief() {
  const token = useAuthStore((s) => s.accessToken);
  return useMutation<
    {
      title: string;
      description: string;
      skills: string[];
      budgetMinEtb: number;
      budgetMaxEtb: number;
      source: 'ai' | 'fallback';
    },
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

export function useAIResumeReview() {
  const token = useAuthStore((s) => s.accessToken);
  return useMutation<
    {
      score: number;
      strengths: string[];
      improvements: string[];
      missingSections: string[];
      keywords: string[];
      source: 'ai' | 'fallback';
    },
    Error,
    {
      targetRole?: string;
      headline?: string;
      summary?: string;
      skills: string[];
      experience: { role: string; company: string; description?: string }[];
      projects: { title: string; description?: string }[];
    }
  >({
    mutationFn: (body) => apiFetch('/ai/resume/review', { method: 'POST', token, body }),
  });
}

export function useAIResumeSkills() {
  const token = useAuthStore((s) => s.accessToken);
  return useMutation<
    { skills: string[]; keywords: string[]; rationale: string; source: 'ai' | 'fallback' },
    Error,
    { targetRole: string; existingSkills: string[]; summary?: string }
  >({
    mutationFn: (body) => apiFetch('/ai/resume/suggest-skills', { method: 'POST', token, body }),
  });
}

export function useAIResumeTailor() {
  const token = useAuthStore((s) => s.accessToken);
  return useMutation<
    {
      matchScore: number;
      tailoredHeadline: string;
      tailoredSummary: string;
      experienceBullets: { role: string; company: string; bullets: string[] }[];
      keywordGaps: string[];
      recommendations: string[];
      source: 'ai' | 'fallback';
    },
    Error,
    {
      jobDescription: string;
      targetRole?: string;
      resume: {
        headline?: string;
        summary?: string;
        skills: string[];
        experience: { role: string; company: string; description?: string }[];
        projects: { title: string; description?: string }[];
      };
    }
  >({
    mutationFn: (body) => apiFetch('/ai/resume/tailor', { method: 'POST', token, body }),
  });
}

export function useAIPortfolioCaseStudy() {
  const token = useAuthStore((s) => s.accessToken);
  return useMutation<
    { description: string; highlights: string[]; outcome: string; source: 'ai' | 'fallback' },
    Error,
    {
      title: string;
      role?: string;
      tools: string[];
      roughDescription: string;
      outcome?: string;
    }
  >({
    mutationFn: (body) => apiFetch('/ai/portfolio/case-study', { method: 'POST', token, body }),
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

export function useAIChat() {
  const token = useAuthStore((s) => s.accessToken);
  return useMutation<
    { text: string; source: 'ai' | 'fallback' },
    Error,
    { messages: { role: 'user' | 'assistant'; content: string }[] }
  >({
    mutationFn: (body) => apiFetch('/ai/chat', { method: 'POST', token, body }),
  });
}

export function useAISuggestReplies() {
  const token = useAuthStore((s) => s.accessToken);
  return useMutation<
    { replies: string[]; source: 'ai' | 'fallback' },
    Error,
    { history: { role: 'user' | 'assistant'; content: string }[] }
  >({
    mutationFn: (body) => apiFetch('/ai/replies', { method: 'POST', token, body }),
    retry: 1,
  });
}
