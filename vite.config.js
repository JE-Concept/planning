import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

const resolve = (p) => fileURLToPath(new URL(p, import.meta.url))

/**
 * Het nummer van déze build, één keer bepaald.
 *
 * Dit stond eerder twee keer als `process.env.BUILD_ID ?? String(Date.now())`:
 * één keer in `define` en één keer in het versiebestand. Zonder BUILD_ID in de
 * omgeving — en dat is precies wat `npm run deploy` doet — werden dat twee
 * verschillende nummers, een paar seconden uit elkaar. De app vergelijkt die
 * twee en concludeerde dan bij elke uitrol, bij iedereen, voor altijd dat er
 * een nieuwe versie klaarstond. Een melding die altijd staat, leest niemand nog
 * op de dag dat ze klopt.
 */
const BUILD_ID = process.env.BUILD_ID ?? String(Date.now())

/**
 * Wat er altijd mee moet naar de cache van de service worker.
 *
 * Niet álles: elke pagina is een eigen bestand, en bij elke uitrol de hele
 * applicatie opnieuw laten binnenhalen kost iedereen data voor schermen die ze
 * die dag misschien niet openen. Wat hier staat is de schil — de pagina, de
 * stijlen, de bibliotheken — plus het ene scherm dat zonder verbinding móét
 * openen: de dagelijkse lijsten, die in de keuken en de koelcel afgevinkt
 * worden. De rest komt vanzelf in de cache zodra iemand er één keer geweest is.
 */
const ALTIJD_MEE = ['vendor', 'firebase', 'Checklists']

/**
 * Eén bestandje met het nummer van deze build ernaast, en wat erbij hoort.
 *
 * Een tabblad dat dagen openstaat vraagt na een uitrol bestanden op die niet
 * meer bestaan, en dat gaf een wit scherm. De app kan dat nu vóór zijn: ze
 * kijkt af en toe of dit bestand nog hetzelfde nummer heeft en zegt het als er
 * een nieuwe versie klaarstaat. Statisch bestand, geen index nodig.
 *
 * Sinds de service worker de app ook zonder verbinding moet kunnen openen,
 * staan de bestandsnamen van de schil er ook in. Die dragen een hash en
 * veranderen dus bij elke uitrol; de worker kan ze niet raden, want hij staat
 * als los bestand in `public/` en gaat ongewijzigd door de build. Hij leest ze
 * hier. Bewust hetzelfde bestand als waar de versiemelding al naar kijkt: twee
 * bestanden die allebei moeten weten welke build er draait, lopen uit elkaar.
 */
function versiebestand(demo) {
  return {
    name: 'je-plan-versie',
    generateBundle(_opties, bundel) {
      const bestanden = Object.values(bundel)

      /*
        Een scherm is meer dan zijn eigen bestand.

        `Checklists` staat hierboven bij naam in de lijst, maar het bestand van
        dat scherm haalt zelf nog twee bestanden op — de herhaalregels en de
        paginakop. Die stonden niet in de schil, en dus opende "Openen &
        sluiten" zonder verbinding alleen bij wie dat scherm toevallig al eens
        geopend had. Precies het scherm dat het wél moest kunnen.

        Daarom wordt de lijst hier dichtgerekend: vanaf de bestanden die
        meemoeten, telkens ook wat die zelf statisch binnenhalen. Dynamische
        imports blijven erbuiten — dat is wat een scherm pas ophaalt als je iets
        doet, en dat hoeft niet vooraf mee.
      */
      const nodig = new Set()
      const wachtrij = bestanden
        .filter((b) => b.type === 'chunk' && (b.isEntry || ALTIJD_MEE.includes(b.name)))
        .map((b) => b.fileName)

      while (wachtrij.length) {
        const naam = wachtrij.pop()
        if (nodig.has(naam)) continue
        nodig.add(naam)
        for (const erbij of bundel[naam]?.imports ?? []) wachtrij.push(erbij)
      }

      const schil = [
        'index.html',
        'manifest.webmanifest',
        'favicon.svg',
        'icons/icon-192.png',
        ...bestanden
          .filter((b) => b.type === 'asset' && b.fileName.endsWith('.css'))
          .map((b) => b.fileName),
        ...nodig,
      ]

      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({
          build: BUILD_ID,
          demo: Boolean(demo),
          // Paden zonder schuine streep ervoor: de worker plakt ze aan zijn
          // eigen scope, zodat het ook klopt als de app ooit onder een submap
          // staat.
          schil,
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
    __BUILD_ID__: JSON.stringify(BUILD_ID),
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
            'firebase/app-check': resolve('./demo/stubs.js'),
            'firebase/functions': resolve('./demo/stubs.js'),
            'firebase/storage': resolve('./demo/stubs.js'),
            // De klantenpagina's praten met een Cloud Function; die draait
            // in de demo niet. Zelfde naad, één module verder.
            '@data/portaal': resolve('./demo/portaal.js'),
          }
        : {}),
      '@': resolve('./src'),
      '@lib': resolve('./src/lib'),
      '@data': resolve('./src/data'),
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
