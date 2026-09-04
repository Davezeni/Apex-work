'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export interface Review {
  id: string;
  subjectId: string;
  rating: number;
  comment: string | null;
  photoUrls?: string[];
  createdAt: string;
  sellerReply: string | null;
  sellerRepliedAt: string | null;
  sellerReplyEditedAt: string | null;
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

/** Post or edit the seller's rebuttal to a review about them. */
export function useUpsertReviewReply() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { reviewId: string; comment: string }) =>
      apiFetch<{ id: string; sellerReply: string | null }>(
        `/reviews/${input.reviewId}/reply`,
        { method: 'PUT', token, body: { comment: input.comment } },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/** Remove the seller's rebuttal. */
export function useDeleteReviewReply() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reviewId: string) =>
      apiFetch(`/reviews/${reviewId}/reply`, { method: 'DELETE', token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
