import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Only lint the TypeScript sources; legacy per-extension .js bundles and
    // not-yet-migrated extensions are left alone until they move to TS.
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.d.ts', // declaration files (incl. vendored Spicetify typings)
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        Spicetify: 'readonly',
        document: 'readonly',
        window: 'readonly',
        localStorage: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        structuredClone: 'readonly',
        MutationObserver: 'readonly',
        Element: 'readonly',
        Node: 'readonly',
        HTMLElement: 'readonly',
      },
    },
  },
);
