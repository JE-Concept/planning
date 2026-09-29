import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

const resolve = (p) => fileURLToPath(new URL(p, import.meta.url))

/**
 * Eén bestandje met het nummer van deze build ernaast.
 *
 * Een tabblad dat dagen openstaat vraagt na een uitrol bestanden op die niet
 * meer bestaan, en dat gaf een wit scherm. De app kan dat nu vóór zijn: ze
 * kijkt af en toe of dit bestand nog hetzelfde nummer heeft en zegt het als er
 * een nieuwe versie klaarstaat. Statisch bestand, geen index nodig.
 */
function versiebestand(demo) {
  return {
    name: 'je-plan-versie',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({
          build: process.env.BUILD_ID ?? String(Date.now()),
          demo: Boolean(demo),
        }),
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const demo = mode === 'demo'

  return {
  plugins: [react(), versiebestand(demo)],
  define: {
    // Welke build dit is. De app vergelijkt dit met wat er op de server staat en
    // kan zo zeggen dat er een nieuwe versie klaarstaat.
    __BUILD_ID__: JSON.stringify(process.env.BUILD_ID ?? String(Date.now())),
  },
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
