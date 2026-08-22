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
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
        ],
      },
      // Permissive CORS for Next.js chunks so proxied hosts (Codespaces) can load them.
      {
        source: '/_next/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, HEAD, OPTIONS' },
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
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
        // Static assets emitted by Next are hashed → safe to cache forever.
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Public marketing/landing routes — safe to cache at Vercel edge with SWR.
        // Auth-gated routes below override this.
        source: '/((?!api|login|signup|onboarding|settings|profile|wallet|messages|notifications|orders).*)',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=300' },
          { key: 'Vary', value: 'Accept-Encoding, Accept-Language' },
        ],
      },
      {
        // Authed routes: never cache at the CDN — they're per-user.
        source: '/(login|signup|onboarding|settings/:path*|profile|wallet|messages/:path*|notifications|orders/:path*)',
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

export default nextConfig;
