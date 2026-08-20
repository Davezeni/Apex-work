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

## Troubleshooting

### `ChunkLoadError` in GitHub Codespaces / behind a reverse proxy

If you see `Loading chunk app/layout failed`, the browser is loading the app
via a proxied hostname (e.g. `xxxx-3000.app.github.dev`), but the chunk request
is being rejected — usually because the port is **private** and the request
returns an HTML auth page instead of JavaScript.

**Fix in Codespaces:**

1. Open the **Ports** tab in VS Code (bottom panel).
2. Right-click port `3000` → **Port Visibility** → **Public**.
3. Hard-refresh the browser tab (Cmd/Ctrl + Shift + R).

**Additional dev-env tuning** — copy `.env.development.example` to
`.env.development`:

```bash
cp apps/web/.env.development.example apps/web/.env.development
```

This enables poll-based file watching (fixes broken HMR on Codespaces /
Docker mounts / WSL), and lets you set `NEXT_PUBLIC_APP_URL` to your public
preview host for correct absolute URL generation.

**Still broken?**

- Kill the dev server and delete `.next/`, then restart: `rm -rf apps/web/.next && npm run dev:web`
- Check the browser Network tab — the failing chunk request should return
  200 with `application/javascript`. If it returns 401 or HTML, the port is
  still private.
