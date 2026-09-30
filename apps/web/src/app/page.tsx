import { DesktopLanding } from '@/components/landing/desktop-landing';
import { MobileHome } from '@/components/mobile/mobile-home';
import { MobileShell } from '@/components/mobile/mobile-shell';
import { MobileOnly } from '@/components/mobile/mobile-only';
import { AuthHomeGate } from '@/components/auth-home-gate';

/**
 * Server-rendered home: BOTH home variants are present in the server HTML,
 * switched purely with CSS — the marketing landing on md+, the feed on
 * phones. This is what makes the hero (the LCP element) paint from the
 * server HTML instead of waiting for client JS to decide which variant to
 * mount. Signed-in desktop users are redirected by the tiny client island
 * in <AuthHomeGate />, exactly as before.
 */
export default function HomePage() {
  return (
    <>
      <AuthHomeGate />
      {/* Desktop marketing landing — the server-rendered first paint. */}
      <div className="max-md:hidden">
        <DesktopLanding />
      </div>
      {/* Mobile in-app home — hydration-gated (keeps desktop visits from
          firing feed queries and avoids a double first paint). */}
      <MobileOnly>
        <div className="md:hidden">
          <MobileShell activeTab="home">
            <MobileHome />
          </MobileShell>
        </div>
      </MobileOnly>
    </>
  );
}
