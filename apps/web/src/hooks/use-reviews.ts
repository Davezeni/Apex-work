'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  photoUrls?: string[];
  createdAt: string;
  author: { id: string; username: string; fullName: string; avatarUrl: string | null };
  order?: { id: string; title: string };
}

export function useUserReviews(userId: string | undefined) {
  return useQuery<{ items: Review[]; nextCursor: string | null; hasMore: boolean }>({
    queryKey: ['reviews', userId],
    queryFn: () => apiFetch(`/reviews?userId=${userId}&limit=30`),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useMyReviewForOrder(orderId: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<{ review: Pick<Review, 'id' | 'rating' | 'comment' | 'createdAt'> | null }>({
    queryKey: ['review', 'for-order', orderId],
    queryFn: () => apiFetch(`/reviews/for-order/${orderId}`, { token }),
    enabled: !!token && !!orderId,
  });
}

export function useCreateReview() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { orderId: string; rating: number; comment?: string; photoUrls?: string[] }) =>
      apiFetch<Review>('/reviews', { method: 'POST', token, body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews'] });
      qc.invalidateQueries({ queryKey: ['review', 'for-order'] });
      qc.invalidateQueries({ queryKey: ['public-user'] });
      qc.invalidateQueries({ queryKey: ['order'] });
    },
  });
}
