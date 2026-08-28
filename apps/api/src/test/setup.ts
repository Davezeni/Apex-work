// Keep unit tests independent from developer machines and production secrets.
// The API environment loader runs when service modules are imported, so these
// values must be installed before the test modules load.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/apex_test';
process.env.JWT_SECRET = 'unit-test-jwt-secret-that-is-at-least-32-chars';
process.env.REDIS_URL = 'redis://127.0.0.1:6399';
process.env.CHAPA_SECRET_KEY = 'CHASECK_TEST-unit-test-secret';
process.env.CHAPA_WEBHOOK_SECRET = 'unit-test-webhook-secret';
process.env.GOOGLE_CLIENT_ID = 'google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
process.env.GITHUB_CLIENT_ID = 'github-client-id';
process.env.GITHUB_CLIENT_SECRET = 'github-client-secret';
process.env.CHAPA_TRANSFERS_ENABLED = 'false';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'unit-test-service-role-key';
