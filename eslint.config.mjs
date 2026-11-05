import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import playwright from 'eslint-plugin-playwright';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/', 'playwright-report/', 'test-results/'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      eqeqeq: 'error',
      'no-console': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      curly: 'error',
    },
  },
  {
    files: ['tests/**/*.mjs'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      // Several tests loop over pages and check each one
      'playwright/no-conditional-in-test': 'off',
      'playwright/expect-expect': ['error', { assertFunctionNames: ['expectLoadedImages', 'loginWithSecret'] }],
      'playwright/no-skipped-test': ['error', { allowConditional: true }],
      'playwright/prefer-web-first-assertions': 'error',
      'playwright/no-wait-for-timeout': 'error',
      'playwright/no-force-option': 'error',
    },
  },
  {
    // The mock site runs scripts in the browser
    files: ['selftest/**/*.mjs'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
  prettier,
];
