import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  experimental: {
    // Tree-shake down deep imports; ~30-40% smaller JS on pages that touch
    // these libs (basically every page).
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      '@tanstack/react-query',
      'sonner',
      'vaul',
    ],
    // Slightly smaller runtime + faster hydrate on modern engines.
    optimizeServerReact: true,
  },

  // Prefer smaller modern formats and cap DPR variants.
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days at the CDN
    deviceSizes: [360, 414, 640, 768, 1024, 1280, 1600],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: '**.onrender.com' },
    ],
  },

  // Skip source maps in prod client bundles → ~30% smaller uploads to Vercel + faster page loads.
  productionBrowserSourceMaps: false,

  transpilePackages: ['@apex-work/shared'],

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // SAMEORIGIN so the Codespaces preview iframe can render the app.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Force HTTPS on the main domain (Vercel serves over TLS).
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          // Allow same-origin usage of camera, mic, geolocation, and
          // display-capture (screen-share) so WebRTC calls, voice notes,
          // "Nearby" location search, and Fullscreen mode all work.
          // Empty parens `camera=()` DISABLE the feature entirely — the
          // browser then won't even prompt the user for permission, and
          // there's no way to grant it from device settings. We want
          // `camera=(self)` which allows same-origin scripts to request it.
          {
            key: 'Permissions-Policy',
            value:
              'camera=(self), microphone=(self), geolocation=(self), display-capture=(self), fullscreen=(self)',
          },
        ],
      },
      // Permissive CORS for Next.js chunks so proxied hosts (Codespaces) can load them.
      {
        source: '/_next/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, HEAD, OPTIONS' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [{ key: 'Content-Type', value: 'application/manifest+json' }],
      },
      {
        // Service worker: never cache — must always fetch fresh so we can
        // ship SW updates instantly. Scope is /, so the file lives at root.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        // Public marketing/landing routes — safe to cache at Vercel edge with SWR.
        // Auth-gated routes + sw.js/manifest below override this.
        source:
          '/((?!api|sw\\.js|manifest\\.webmanifest|login|signup|onboarding|settings|profile|wallet|messages|notifications|orders).*)',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=300' },
          { key: 'Vary', value: 'Accept-Encoding, Accept-Language' },
        ],
      },
      {
        // Authed routes: never cache at the CDN — they're per-user.
        source:
          '/(login|signup|onboarding|settings/:path*|profile|wallet|messages/:path*|notifications|orders/:path*)',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
    ];
  },

  // Webpack fine-tuning for reverse-proxied dev environments (Codespaces, Gitpod, ngrok).
  webpack: (config, { dev }) => {
    if (dev) {
      // Poll instead of fs-events when watching over proxied FS.
      config.watchOptions = {
        ...(config.watchOptions ?? {}),
        poll: 1000,
        aggregateTimeout: 300,
        ignored: /node_modules/,
      };
    }
    return config;
  },
};

// Wrap with Sentry. When no DSN is configured it still builds (Sentry no-ops),
// so local/dev and the free-tier deploy both work — a DSN just unlocks capture.
export default withSentryConfig(nextConfig, {
  org: 'apex-work',
  project: 'apex-work-web',
  silent: true, // don't spam build logs
  telemetry: false,
  // sourcemap source-generation is the memory-heavy step that pushed the
  // previous build to OOM (exit 137) on the free tier. We skip it; sourcemaps
  // still work for stack traces via the built .map files Vercel produces.
  sourcemaps: { disable: true },
});
