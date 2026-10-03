import { readFileSync, writeFileSync } from 'node:fs'

/**
 * De laatste hand aan de preview-build.
 *
 * De lettertypes staan live op `/fonts/…`, een absoluut pad — dat moet, want
 * met echte routes zou `./fonts/` vanaf /artikel/x naar /artikel/fonts/
 * wijzen. In de preview is er maar één pad (alles achter een hekje), en het
 * artifact staat niet op de wortel van een domein. Dus hier relatief.
 *
 * Vite heeft met `base: './'` de verwijzingen in index.html al relatief
 * gemaakt; alleen `fonts.css` komt onbewerkt uit `public/` en wijst vanuit
 * zijn eigen map, dus daar wordt `/fonts/` gewoon `./`.
 */
const MAP = new URL('../dist-verhuur-demo/', import.meta.url)

const html = new URL('index.html', MAP)
writeFileSync(html, readFileSync(html, 'utf8').replaceAll('href="/fonts/', 'href="./fonts/').replaceAll('href="/favicon.svg"', 'href="./favicon.svg"'))

const css = new URL('fonts/fonts.css', MAP)
writeFileSync(css, readFileSync(css, 'utf8').replaceAll("url('/fonts/", "url('./"))

console.log('Preview klaar in dist-verhuur-demo/.')
