import type { Metadata } from 'next';
import { GigDetail } from './gig-detail';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === 'production'
    ? 'https://apex-work-api.onrender.com'
    : 'http://localhost:4000');

interface GigMeta {
  title: string;
  description: string;
  categoryId: string;
  coverImageUrl: string | null;
}

async function fetchGig(slug: string): Promise<GigMeta | null> {
  try {
    const res = await fetch(`${API_URL}/v1/gigs/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; data?: GigMeta };
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const gig = await fetchGig(slug);
  if (!gig) return { title: 'Gig' };
  const image = gig.coverImageUrl ?? `/demo/${gig.categoryId}.webp`;
  // descriptions are rich-text HTML — strip tags for a clean preview line
  const blurb = gig.description
    .replace(/<[^>]*>/g, ' ')
    .replace(/&\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
  return {
    title: gig.title,
    description: blurb,
    openGraph: {
      title: gig.title,
      description: blurb,
      images: [{ url: image }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: gig.title,
      images: [image],
    },
  };
}

export default function GigPage() {
  return <GigDetail />;
}
