import js from '@eslint/js';
import playwright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';

// Lints the test code only. The site's own code in src/ is checked by `astro check`.
const testCode = [
  'tests/**/*.ts',
  'pages/**/*.ts',
  'fixtures/**/*.ts',
  'helpers/**/*.ts',
  'enums/**/*.ts',
  'config/**/*.ts',
  'test-data/**/*.ts',
  'playwright.config.ts',
];

export default tseslint.config(
  {
    ignores: [
      'src/',
      'dist/',
      '.astro/',
      'public/',
      'source/',
      'test-results/',
      'playwright-report/',
      'blob-report/',
    ],
  },
  {
    files: testCode,
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'error',
      'prefer-const': 'error',
    },
  },
  {
    files: ['tests/**/*.ts'],
    extends: [playwright.configs['flat/recommended']],
    rules: {
      'playwright/expect-expect': ['error', { assertFunctionNames: ['expectHighlights'] }],
      'playwright/missing-playwright-await': 'error',
      'playwright/no-conditional-in-test': 'warn',
      'playwright/no-eval': 'error',
      'playwright/no-focused-test': 'error',
      'playwright/no-force-option': 'warn',
      'playwright/no-nth-methods': 'warn',
      'playwright/no-page-pause': 'error',
      'playwright/no-raw-locators': 'warn',
      'playwright/no-skipped-test': 'off',
      'playwright/no-standalone-expect': 'error',
      'playwright/no-useless-await': 'error',
      'playwright/no-useless-not': 'error',
      'playwright/no-wait-for-timeout': 'error',
      'playwright/prefer-lowercase-title': ['warn', { ignore: ['test.describe'] }],
      'playwright/prefer-to-be': 'error',
      'playwright/prefer-to-have-length': 'error',
      'playwright/prefer-web-first-assertions': 'error',
      'playwright/require-tags': 'error',
      'playwright/require-top-level-describe': 'error',
      'playwright/valid-expect': 'error',
      'playwright/valid-test-tags': ['error', { allowedTags: ['@smoke', '@regression'] }],
    },
  },
);
