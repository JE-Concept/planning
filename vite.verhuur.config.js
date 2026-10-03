import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

const resolve = (p) => fileURLToPath(new URL(p, import.meta.url))

/**
 * De bouw van de verhuursite.
 *
 * ── Waarom een tweede config en niet een tweede ingang in de eerste ──────
 * Omdat de scheiding het punt is. Eén build met twee ingangen deelt een
 * afhankelijkheidsgraaf, en dan is het een kwestie van tijd tot er via een
 * gedeelde `vendor`-brok iets van de backoffice in de publieke bundel
 * terechtkomt. Twee builds kunnen dat niet: wat hier niet geïmporteerd wordt,
 * staat er niet in. `tests/verhuur-bundel.test.js` houdt dat na.
 *
 * ── Wat wél gedeeld wordt ────────────────────────────────────────────────
 * `@styles` en `@lib` wijzen naar `src/`. Het design system en de prijsmotor
 * horen op beide plekken hetzelfde te zijn, en een kopie die verloopt is
 * precies wat we bij `functions-betaling/` met een spiegeltest moeten
 * afdwingen omdat het daar niet anders kan. Hier kan het wél anders, dus doen
 * we het zo.
 *
 * Firebase staat met opzet niet in deze bundel. Deze site praat met één
 * HTTP-adres en kent geen projectsleutel — zie `verhuur/src/lib/api.js`.
 */
export default defineConfig(({ mode }) => ({
  root: resolve('./verhuur'),
  plugins: [react()],
  /*
    Modus `demo`: de preview die als artifact gepubliceerd wordt. Relatieve
    paden (het artifact staat niet op de wortel van een domein), en
    `api.js` wordt vervangen door `api.demo.js` — dezelfde bundel, met een
    nagebootste server in de browser. Zie dat bestand.
  */
  base: mode === 'demo' ? './' : '/',
  resolve: {
    alias: [
      { find: '@styles', replacement: resolve('./src/styles') },
      { find: '@lib', replacement: resolve('./src/lib') },
      ...(mode === 'demo' ? [{ find: /^(\.\.?\/)+lib\/api$/, replacement: resolve('./verhuur/src/lib/api.demo.js') }] : []),
    ],
  },
  build: {
    outDir: resolve(mode === 'demo' ? './dist-verhuur-demo' : './dist-verhuur'),
    emptyOutDir: true,
    // Een etalage hoort snel te zijn op een telefoon aan de rand van een
    // weiland. Alles in één brok is hier sneller dan slim splitsen: de site is
    // klein genoeg dat een tweede verzoek meer kost dan het bespaart.
    chunkSizeWarningLimit: 300,
  },
  server: { port: 5174 },
}))
