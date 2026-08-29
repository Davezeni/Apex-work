import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  {
    linterOptions: {
      // Keep the established repository baseline from failing on legacy
      // disable comments while the React Compiler rules are introduced.
      reportUnusedDisableDirectives: 'off',
    },
    rules: {
      '@next/next/no-img-element': 'off',
      '@next/next/no-location-assign-relative-destination': 'off',
      'import/no-anonymous-default-export': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  globalIgnores(['.next/**', 'node_modules/**']),
]);
