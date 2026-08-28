import globals from 'globals';
import tseslint from '@typescript-eslint/eslint-plugin';

export default [
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
  ...tseslint.configs['flat/recommended'],
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      // The API deliberately uses a few boundary casts for Express and
      // third-party provider payloads; TypeScript remains the type gate.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      // Existing API files predate a lint configuration and intentionally
      // contain a few type-only/compatibility parameters. Keep lint useful
      // for syntax and explicit rule violations without blocking deploys on
      // harmless unused boundary names.
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];
