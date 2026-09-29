import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

const resolve = (p) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig(({ mode }) => {
  const demo = mode === 'demo'

  return {
  plugins: [react()],
  // Relatieve paden, zodat de demobuild ook onder een submap gepubliceerd kan worden.
  base: demo ? './' : '/',
  resolve: {
    alias: {
      // De enige naad van de demomodus: de Firebase-SDK wordt vervangen door een
      // in-memory versie. Geen enkele regel applicatiecode verandert daardoor.
      ...(demo
        ? {
            'firebase/firestore': resolve('./demo/firestore.js'),
            'firebase/auth': resolve('./demo/auth.js'),
            'firebase/app': resolve('./demo/stubs.js'),
            'firebase/functions': resolve('./demo/stubs.js'),
            'firebase/storage': resolve('./demo/stubs.js'),
          }
        : {}),
      '@': resolve('./src'),
      '@lib': resolve('./src/lib'),
      '@data': resolve('./src/data'),
      '@ui': resolve('./src/components/ui'),
      '@components': resolve('./src/components'),
      '@pages': resolve('./src/pages'),
      '@context': resolve('./src/context'),
    },
  },
  build: {
    outDir: demo ? 'dist-demo' : 'dist',
    sourcemap: false,
    rollupOptions: demo
      ? {}
      : {
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom', 'react-router-dom'],
              // Storage zit er bewust niet bij: er wordt nergens een bestand
              // geüpload, en de SDK meeleveren kost iedereen laadtijd voor niets.
              firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            },
          },
        },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
  }
})
