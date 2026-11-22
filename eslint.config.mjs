import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import vuePlugin from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      'pages/**',
      'components/**',
      'context*/**',
      'hooks/**',
      'lib/**',
      'utils/**',
      'next-env.d.ts',
      'next.config.js',
      '.babelrc',
      '.nuxt/**',
      '.output/**',
      '.data/**',
      'dist/**',
      'coverage/**',
      'benchmark/**',
      'screenshots/**',
      'yarn.lock',
      'package.json',
    ],
  },
  {
    files: ['**/*.vue'],
    plugins: { vue: vuePlugin },
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        parser: tseslint.parser,
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts', '**/*.vue'],
    ...tseslint.configs.recommended,
  },
  ...vuePlugin.configs['flat/essential'],
  ...vuePlugin.configs['flat/recommended'],
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.vue'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        definePageMeta: 'readonly',
        defineProps: 'readonly',
        defineEmits: 'readonly',
        useNuxtApp: 'readonly',
        useRoute: 'readonly',
        useRouter: 'readonly',
        useRuntimeConfig: 'readonly',
        useFetch: 'readonly',
        useAsyncData: 'readonly',
        ref: 'readonly',
        reactive: 'readonly',
        computed: 'readonly',
        watch: 'readonly',
      },
    },
  },
  {
    languageOptions: { globals: globals.node },
    rules: {
      'no-console': 'warn',
      'no-unused-vars': 'off',
    },
  },
  {
    files: ['*.config.ts', '*.config.mjs', '*.config.cjs'],
    languageOptions: { globals: globals.node },
  },
  prettierConfig,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
);
