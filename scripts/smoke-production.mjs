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
    name: 'API health',
    url: 'https://apex-work-api.onrender.com/v1/health',
    expected: async (res) => res.status === 200 && (await res.json()).ok === true,
  },
  {
    name: 'Google OAuth start',
    url: 'https://apex-work-api.onrender.com/v1/auth/oauth/google/start?next=%2Fprofile',
    redirect: 'manual',
    expected: (res) => res.status >= 300 && res.status < 400 && res.headers.get('location')?.startsWith('https://accounts.google.com/'),
  },
  {
    name: 'GitHub OAuth start',
    url: 'https://apex-work-api.onrender.com/v1/auth/oauth/github/start?next=%2Fprofile',
    redirect: 'manual',
    expected: (res) => res.status >= 300 && res.status < 400 && res.headers.get('location')?.startsWith('https://github.com/login/oauth/authorize'),
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
    name: 'saved-gigs auth gate',
    url: 'https://apex-work-api.onrender.com/v1/me/saved-gigs',
    expected: (res) => res.status === 401,
  },
  {
    name: 'service worker version',
    url: 'https://apex-work-gold.vercel.app/sw.js',
    expected: async (res) => res.status === 200 && (await res.text()).includes("const VERSION = 'v6'"),
  },
];

let failed = 0;
for (const check of checks) {
  try {
    const response = await fetch(check.url, { redirect: check.redirect ?? 'follow' });
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
