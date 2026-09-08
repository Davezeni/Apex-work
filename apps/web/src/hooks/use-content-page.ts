'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export type ContentPage = {
  slug: string;
  title: string;
  markdown: string;
  updatedAt: string | null;
};

/** Fetch an admin-editable content page (privacy/terms/cookies/faq). */
export function useContentPage(slug: string, fallbackTitle = '') {
  return useQuery<ContentPage>({
    queryKey: ['content', slug],
    queryFn: () => apiFetch<ContentPage>(`/content/${slug}`),
    staleTime: 5 * 60 * 1000,
    // On network failure (or the page being unset) fall back to the fallback
    // title so the heading still renders; the Markdown body just stays empty.
    retry: 1,
    placeholderData: { slug, title: fallbackTitle, markdown: '', updatedAt: null },
  });
}
