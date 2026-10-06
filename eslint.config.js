import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsx from './eslint/jsx-gebruikt.js'

export default [
  { ignores: ['dist', 'dist-demo', 'dist-verhuur', 'dist-verhuur-demo', 'node_modules', 'coverage'] },
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      // Wordt door Vite ingevuld met het nummer van deze build.
      globals: { ...globals.browser, ...globals.node, __BUILD_ID__: 'readonly' },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      jsx,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'jsx/jsx-gebruikt': 'error',
      // Alleen `_` vooraan: een hoofdletter is geen vrijbrief meer, zie eslint/jsx-gebruikt.js.
      'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // De service worker draait niet in een pagina: geen window, wel self,
    // caches en importScripts.
    files: ['public/sw.js'],
    languageOptions: {
      globals: { ...globals.serviceworker, firebase: 'readonly' },
    },
  },
]
