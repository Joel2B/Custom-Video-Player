import { readFileSync } from 'node:fs';
import babelParser from '@babel/eslint-parser';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import';
import nPlugin from 'eslint-plugin-n';
import promisePlugin from 'eslint-plugin-promise';

const { browser, node, es2021 } = globals;

const standardRules = JSON.parse(
  readFileSync(new URL('./eslint-standard-rules.json', import.meta.url), 'utf8'),
);

export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...browser,
        ...node,
        ...es2021,
        FP_BUILD_VERSION: 'readonly',
        FP_HOMEPAGE: 'readonly',
        FP_ENV: 'readonly',
        FP_DEBUG: 'readonly',
      },
    },
    plugins: {
      import: importPlugin,
      n: nPlugin,
      promise: promisePlugin,
    },
    rules: {
      ...standardRules,
      semi: [2, 'always'],
      'comma-dangle': [2, 'always-multiline'],
      indent: ['warn', 2, { SwitchCase: 1 }],
      eqeqeq: ['warn', 'always'],
      'no-undef': 'warn',
      'no-throw-literal': 'warn',
      'no-prototype-builtins': 'warn',
      'prefer-const': ['warn', { destructuring: 'all' }],
      'no-unused-vars': [
        'warn',
        {
          args: 'none',
          caughtErrors: 'none',
          ignoreRestSiblings: true,
          vars: 'all',
        },
      ],
      'max-len': ['warn', { code: 120 }],
      'space-before-function-paren': [
        'error',
        {
          anonymous: 'never',
          named: 'never',
          asyncArrow: 'always',
        },
      ],
    },
  },
  {
    files: ['src/js/streaming/hls.js'],
    languageOptions: {
      globals: {
        Hls: 'readonly',
      },
    },
  },
  {
    files: ['src/js/streaming/dash.js'],
    languageOptions: {
      globals: {
        dashjs: 'readonly',
      },
    },
  },
];
