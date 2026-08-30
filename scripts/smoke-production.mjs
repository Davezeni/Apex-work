const checks = [
  {
    name: 'web home',
    url: 'https://apex-work-gold.vercel.app/',
    expected: (res) => res.status === 200,
  },
  {
    name: 'web saved-gigs page',
    url: 'https://apex-work-gold.vercel.app/saved',
    expected: (res) => res.status === 200,
  },
  {
    name: 'web payment page',
    url: 'https://apex-work-gold.vercel.app/settings/payment-methods',
    expected: (res) => res.status === 200,
  },
  {
    name: 'web connected-apps page',
    url: 'https://apex-work-gold.vercel.app/settings/connected',
    expected: (res) => res.status === 200,
  },
  {
    name: 'web phone-verification page',
    url: 'https://apex-work-gold.vercel.app/settings/phone',
    expected: (res) => res.status === 200,
  },
  {
    name: 'web Resume Studio page',
    url: 'https://apex-work-gold.vercel.app/resume',
    expected: (res) => res.status === 200,
  },
  {
    name: 'web Resume Studio templates page',
    url: 'https://apex-work-gold.vercel.app/resume/templates',
    expected: (res) => res.status === 200,
  },
  {
    name: 'web public CV page',
    url: 'https://apex-work-gold.vercel.app/u/demo/resume',
    expected: (res) => res.status === 200,
  },
  {
    name: 'web freelancer onboarding page',
    url: 'https://apex-work-gold.vercel.app/onboarding',
    expected: (res) => res.status === 200,
  },
  {
    name: 'web Pro page',
    url: 'https://apex-work-gold.vercel.app/pro',
    expected: (res) => res.status === 200,
  },
  {
    name: 'web teams page',
    url: 'https://apex-work-gold.vercel.app/teams',
    expected: (res) => res.status === 200,
  },
  {
    name: 'web skill moderation page',
    url: 'https://apex-work-gold.vercel.app/admin/skills',
    expected: (res) => res.status === 200,
  },
  {
    name: 'web project workspace page',
    url: 'https://apex-work-gold.vercel.app/orders/demo/workspace',
    expected: (res) => res.status === 200,
  },
  {
    name: 'API health',
    url: 'https://apex-work-api.onrender.com/v1/health',
    expected: async (res) => res.status === 200 && (await res.json()).ok === true,
  },
  {
    name: 'Google OAuth start',
    url: 'https://apex-work-api.onrender.com/v1/auth/oauth/google/start?next=%2Fprofile',
    redirect: 'manual',
    expected: (res) => {
      const location = res.headers.get('location');
      return (
        res.status >= 300 &&
        res.status < 400 &&
        !!location &&
        location.startsWith('https://accounts.google.com/') &&
        new URL(location).searchParams.get('redirect_uri') ===
          'https://apex-work-api.onrender.com/v1/auth/oauth/google/callback'
      );
    },
  },
  {
    name: 'GitHub OAuth start',
    url: 'https://apex-work-api.onrender.com/v1/auth/oauth/github/start?next=%2Fprofile',
    redirect: 'manual',
    expected: (res) => {
      const location = res.headers.get('location');
      return (
        res.status >= 300 &&
        res.status < 400 &&
        !!location &&
        location.startsWith('https://github.com/login/oauth/authorize') &&
        new URL(location).searchParams.get('redirect_uri') ===
          'https://apex-work-api.onrender.com/v1/auth/oauth/github/callback'
      );
    },
  },

  {
    name: 'Chapa config',
    url: 'https://apex-work-api.onrender.com/v1/payments/config',
    expected: async (res) => {
      const body = await res.json();
      return res.status === 200 && body.ok === true && typeof body.data?.enabled === 'boolean';
    },
  },
  {
    name: 'OAuth link auth gate',
    url: 'https://apex-work-api.onrender.com/v1/auth/oauth/google/link/start?next=%2Fsettings%2Fconnected',
    init: { method: 'POST' },
    expected: (res) => res.status === 401,
  },
  {
    name: 'Resume Studio auth gate',
    url: 'https://apex-work-api.onrender.com/v1/me/resume/templates',
    expected: (res) => res.status === 401,
  },
  {
    name: 'AI service status',
    url: 'https://apex-work-api.onrender.com/v1/ai/status',
    expected: async (res) => {
      const body = await res.json();
      return (
        res.status === 200 &&
        body.ok === true &&
        body.data?.fallbackAvailable === true &&
        body.data?.fallbackVersion === 'deterministic-v2' &&
        typeof body.data?.configured === 'boolean'
      );
    },
  },
  {
    name: 'Resume AI auth gate',
    url: 'https://apex-work-api.onrender.com/v1/ai/resume/review',
    init: { method: 'POST' },
    expected: (res) => res.status === 401,
  },
  {
    name: 'Resume tailor auth gate',
    url: 'https://apex-work-api.onrender.com/v1/ai/resume/tailor',
    init: { method: 'POST' },
    expected: (res) => res.status === 401,
  },
  {
    name: 'Resume versions auth gate',
    url: 'https://apex-work-api.onrender.com/v1/me/resume/versions',
    expected: (res) => res.status === 401,
  },
  {
    name: 'recommendations auth gate',
    url: 'https://apex-work-api.onrender.com/v1/recommendations',
    expected: (res) => res.status === 401,
  },
  {
    name: 'Pro subscription auth gate',
    url: 'https://apex-work-api.onrender.com/v1/me/subscription',
    expected: (res) => res.status === 401,
  },
  {
    name: 'teams auth gate',
    url: 'https://apex-work-api.onrender.com/v1/me/teams',
    expected: (res) => res.status === 401,
  },
  {
    name: 'skill moderation auth gate',
    url: 'https://apex-work-api.onrender.com/v1/admin/skills?pending=1',
    expected: (res) => res.status === 401,
  },
  {
    name: 'profile analytics auth gate',
    url: 'https://apex-work-api.onrender.com/v1/me/profile-analytics',
    expected: (res) => res.status === 401,
  },
  {
    name: 'custom-skill creation auth gate',
    url: 'https://apex-work-api.onrender.com/v1/skills',
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Custom QA Skill' }),
    },
    expected: (res) => res.status === 401,
  },
  {
    name: 'VAPID push configuration',
    url: 'https://apex-work-api.onrender.com/v1/push/vapid-key',
    expected: async (res) => {
      const body = await res.json();
      return (
        res.status === 200 &&
        body.ok === true &&
        body.data?.configured === true &&
        typeof body.data?.publicKey === 'string' &&
        body.data.publicKey.length > 20
      );
    },
  },
  {
    name: 'TURN ICE configuration',
    url: 'https://apex-work-api.onrender.com/v1/push/ice-servers',
    expected: async (res) => {
      const body = await res.json();
      const servers = body.data?.servers;
      return res.status === 200 && body.ok === true && Array.isArray(servers) && servers.length > 0;
    },
  },
  {
    name: 'saved-gigs auth gate',
    url: 'https://apex-work-api.onrender.com/v1/me/saved-gigs',
    expected: (res) => res.status === 401,
  },
  {
    name: 'service worker version',
    url: 'https://apex-work-gold.vercel.app/sw.js',
    expected: async (res) =>
      res.status === 200 && (await res.text()).includes("const VERSION = 'v6'"),
  },
];

let failed = 0;
for (const check of checks) {
  try {
    const response = await fetch(check.url, {
      redirect: check.redirect ?? 'follow',
      ...(check.init ?? {}),
    });
    const ok = await check.expected(response);
    console.log(`${ok ? 'PASS' : 'FAIL'} ${check.name} (${response.status})`);
    if (!ok) failed++;
  } catch (error) {
    failed++;
    console.log(`FAIL ${check.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} production smoke check(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} production smoke checks passed.`);
