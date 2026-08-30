import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
    // Coverage report (open-source, v8). Thresholds guard against silent
    // regressions on the critical domain logic.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', '**/*.test.ts', 'src/config/logger.ts'],
      // Realistic floor given the current unit-test scope; raise as coverage
      // of services grows. Guards against a regression to near-zero coverage.
      thresholds: {
        functions: 10,
        lines: 10,
        statements: 10,
      },
    },
  },
});
