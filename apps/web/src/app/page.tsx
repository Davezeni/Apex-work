import { DesktopLanding } from '@/components/landing/desktop-landing';
import { MobileHome } from '@/components/mobile/mobile-home';
import { MobileShell } from '@/components/mobile/mobile-shell';
import { MobileOnly } from '@/components/mobile/mobile-only';
import { AuthHomeGate } from '@/components/auth-home-gate';
import type { GigListItem } from '@/hooks/use-gigs';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === 'production'
    ? 'https://apex-work-api.onrender.com'
    : 'http://localhost:4000');

/**
 * Server-fetches the mobile feed's first page so gig cards (and their images
 * — the mobile LCP element) are discoverable in the initial HTML instead of
 * appearing only after hydration + a client API round-trip. Mirrors the
 * gig-metadata page's cold-start strategy: fail fast, retry once longer,
 * degrade gracefully (the client refetch path is unchanged).
 */
async function fetchInitialFeed(): Promise<GigListItem[] | undefined> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${API_URL}/v1/gigs?limit=20`, {
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(attempt === 0 ? 5_000 : 12_000),
      });
      if (!res.ok) return undefined;
      const json = (await res.json()) as {
        ok?: boolean;
        data?: { items?: GigListItem[] };
      };
      return json.data?.items ?? undefined;
    } catch {
      if (attempt === 1) return undefined;
    }
  }
  return undefined;
}

// ISR: the prerendered page (feed included) refreshes at most every minute.
export const revalidate = 60;

/**
 * Server-rendered home: BOTH home variants are present in the server HTML,
 * switched purely with CSS — the marketing landing on md+, the feed on
 * phones. This is what makes the hero (the LCP element) paint from the
 * server HTML instead of waiting for client JS to decide which variant to
 * mount. Signed-in desktop users are redirected by the tiny client island
 * in <AuthHomeGate />, exactly as before.
 */
export default async function HomePage() {
  const initialFeed = await fetchInitialFeed();

  return (
    <>
      <AuthHomeGate />
      {/* Desktop marketing landing — the server-rendered first paint. */}
      <div className="max-md:hidden">
        <DesktopLanding />
      </div>
      {/* Mobile in-app home — hydration-gated (keeps desktop visits from
          firing feed queries and avoids a double first paint), but now
          seeded with server-fetched data so cards render in the HTML. */}
      <MobileOnly>
        <div className="md:hidden">
          <MobileShell activeTab="home">
            <MobileHome initialItems={initialFeed} />
          </MobileShell>
        </div>
      </MobileOnly>
    </>
  );
}
