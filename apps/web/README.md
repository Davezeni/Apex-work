# @apex-work/web

Next.js 14 app for Apex-Work.

## Structure

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout + providers
│   ├── page.tsx            # Home (desktop landing OR mobile home)
│   ├── globals.css         # Tailwind + design tokens
│   ├── login/              # Phone + OTP login
│   ├── signup/             # Multi-step signup
│   ├── search/             # Search (mobile shell)
│   ├── messages/           # Inbox (mobile shell)
│   └── profile/            # Profile (mobile shell)
├── components/
│   ├── ui/                 # shadcn-style primitives (Button, Card, Avatar)
│   ├── providers.tsx       # ThemeProvider + QueryClient + Toaster
│   ├── landing/            # Desktop landing page components
│   └── mobile/             # Mobile shell + native-feeling screens
├── hooks/                  # useMediaQuery, useIsMobile
├── lib/                    # api client, utils
└── stores/                 # Zustand (auth-store)
```

## Rendering strategy

The root `/` route detects viewport and renders:
- **Desktop (≥ 768px)** → marketing landing page (`DesktopLanding`)
- **Mobile (< 768px)** → app home with bottom nav (`MobileShell + MobileHome`)

All sub-routes (`/search`, `/messages`, `/profile`, `/gigs/*`, `/messages/[id]`) use the
mobile shell on small screens and their own layout on desktop.

## Dev

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

Resize your browser to see the mobile / desktop switch.
