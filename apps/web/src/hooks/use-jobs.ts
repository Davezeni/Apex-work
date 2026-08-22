'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { CreateJobInput, CreateBidInput } from '@apex-work/shared';

export interface JobSummary {
  id: string;
  title: string;
  categoryId: string;
  budgetMinEtb: number | null;
  budgetMaxEtb: number | null;
  requiredSkills: string[];
  isRemote: boolean;
  isOpen: boolean;
  createdAt: string;
  closedAt: string | null;
  client: { id: string; username: string; fullName: string; avatarUrl: string | null };
  _count: { bids: number };
}

export interface JobDetail extends JobSummary {
  description: string;
  bidCount: number;
  bids: {
    id: string;
    message: string;
    priceEtb: number;
    deliveryDays: number;
    createdAt: string;
    freelancer: {
      id: string;
      username: string;
      fullName: string;
      avatarUrl: string | null;
      title: string | null;
      city: string | null;
      rating: number;
      ratingCount: number;
    };
  }[];
}

export function useJobs(params: { category?: string; q?: string; limit?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.category) qs.set('category', params.category);
  if (params.q) qs.set('q', params.q);
  if (params.limit) qs.set('limit', String(params.limit));
  const s = qs.toString();
  return useQuery<{ items: JobSummary[]; nextCursor: string | null; hasMore: boolean }>({
    queryKey: ['jobs', params],
    queryFn: () => apiFetch(`/jobs${s ? `?${s}` : ''}`),
    staleTime: 30_000,
    // Keep old page visible while a new filter/search fetches → no skeleton flash.
    placeholderData: keepPreviousData,
  });
}

export function useJob(id: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<JobDetail>({
    queryKey: ['job', id],
    queryFn: () => apiFetch(`/jobs/${id}`, { token }),
    enabled: !!id,
    staleTime: 15_000,
  });
}

export function useCreateJob() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateJobInput) =>
      apiFetch<JobDetail>('/jobs', { method: 'POST', token, body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  });
}

export function useCloseJob() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<JobDetail>(`/jobs/${id}/close`, { method: 'POST', token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['job'] });
    },
  });
}

export function useCreateBid(jobId: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBidInput) =>
      apiFetch(`/jobs/${jobId}/bids`, { method: 'POST', token, body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job', jobId] }),
  });
}

export function useAcceptBid(jobId: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bidId: string) =>
      apiFetch<{
        order: { id: string };
        checkoutUrl: string | null;
        devSkipped?: boolean;
      }>(`/jobs/${jobId}/bids/${bidId}/accept`, { method: 'POST', token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job', jobId] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
