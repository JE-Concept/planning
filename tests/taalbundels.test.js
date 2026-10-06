import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Elk scherm haalt zijn eigen teksten op — en rekent na dat het niets vergeet.
 *
 * ── Waarom dit bestaat ────────────────────────────────────────────────────
 * De woordenlijsten in `src/lib/taal/` zaten allemaal in de eerste download:
 * honderddertig kilobyte tekst over elk scherm van de tool, opgehaald door
 * iedereen die de app opent en door elke klant die op een offertelink klikt.
 * Nu zit alleen de kern erin en komt de rest mee met zijn eigen scherm, via de
 * routetabel in `AppPrive.jsx` (`pagina(() => import(…), 'events', …)`).
 *
 * Die tabel is met de hand bijgehouden, en de fout die ze maakt is stil: een
 * vergeten woordenlijst geeft geen foutmelding maar een scherm vol
 * `events.archief.titel`. Niemand ziet dat in code review; iedereen ziet het
 * live.
 *
 * ── Hoe dit nareken ───────────────────────────────────────────────────────
 * Per scherm wordt de hele boom van statische imports gevolgd, en in elk
 * bestand wordt gezocht naar sleutels: letterlijke (`t('events.nieuw')`) én
 * samengestelde (`` t(`pijplijn.${key}`) ``, waarbij elke sleutel met dat
 * voorvoegsel meetelt). Wat een scherm opzoekt, moet in de kern staan of in
 * zijn eigen rijtje — en wat in zijn rijtje staat, moet het ook echt
 * gebruiken, zodat de tabel niet stilletjes terug naar "alles" groeit.
 *
 * Het is met opzet een overschatting: een samengestelde sleutel waarvan de
 * staart pas tijdens het draaien bekend is, telt in zijn geheel mee. Liever
 * een woordenlijst te veel in een brok dan een scherm vol sleutels.
 */

const WORTEL = new URL('../', import.meta.url).pathname.replace(/\/$/, '')
const TAALMAP = `${WORTEL}/src/lib/taal`

const ALIAS = {
  '@lib': `${WORTEL}/src/lib`,
  '@data': `${WORTEL}/src/data`,
  '@components': `${WORTEL}/src/components`,
  '@pages': `${WORTEL}/src/pages`,
  '@context': `${WORTEL}/src/context`,
  '@': `${WORTEL}/src`,
}

/** Dezelfde aliassen als `vite.config.js`; de test leest de bestanden zelf. */
function zoekBestand(spec, vanaf) {
  let pad = null
  for (const [naam, doel] of Object.entries(ALIAS)) {
    if (spec === naam || spec.startsWith(`${naam}/`)) {
      pad = doel + spec.slice(naam.length)
      break
    }
  }
  if (!pad && spec.startsWith('.')) pad = resolve(dirname(vanaf), spec)
  if (!pad) return null
  for (const staart of ['', '.js', '.jsx', '/index.js', '/index.jsx']) {
    const kandidaat = pad + staart
    if (extname(kandidaat) && existsSync(kandidaat)) return kandidaat
  }
  return null
}

/**
 * Welke sleutel in welk bestand staat.
 *
 * Ook onder zijn kale naam: `vertaal` plakt er `_een` of `_meer` achter
 * wanneer er een aantal bij staat, dus in de code staat `t('lijst.wachtend')`
 * terwijl de catalogus `lijst.wachtend_een` kent. Zonder die regel ziet deze
 * test precies de sleutels niet die over aantallen gaan.
 */
const bestandVanSleutel = new Map()
for (const naam of readdirSync(TAALMAP)) {
  const lijst = naam.replace(/\.js$/, '')
  for (const m of readFileSync(`${TAALMAP}/${naam}`, 'utf8').matchAll(/^\s*'([^']+)':\s*\{/gm)) {
    bestandVanSleutel.set(m[1], lijst)
    const kaal = m[1].replace(/_(een|meer)$/, '')
    if (!bestandVanSleutel.has(kaal)) bestandVanSleutel.set(kaal, lijst)
  }
}

const IMPORT = /^\s*import\s+(?:[^'"]*?from\s*)?['"]([^'"]+)['"]/gm

/** De hele boom van statische imports onder één bestand. `import()` telt niet mee: dat is een eigen brok. */
function boom(start) {
  const gezien = new Set()
  const nog = [start]
  while (nog.length) {
    const bestand = nog.pop()
    if (gezien.has(bestand)) continue
    gezien.add(bestand)
    for (const m of readFileSync(bestand, 'utf8').matchAll(IMPORT)) {
      const volgende = zoekBestand(m[1], bestand)
      if (volgende) nog.push(volgende)
    }
  }
  return gezien
}

/** Welke woordenlijsten deze bestanden nodig hebben. */
function lijstenVoor(bestanden) {
  const nodig = new Set()
  for (const bestand of bestanden) {
    if (bestand.startsWith(TAALMAP)) continue
    const src = readFileSync(bestand, 'utf8')
    for (const m of src.matchAll(/['"`]([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)['"`]/gi)) {
      const lijst = bestandVanSleutel.get(m[1])
      if (lijst) nodig.add(lijst)
    }
    // `t(`pijplijn.${key}`)`: de staart is pas tijdens het draaien bekend, dus
    // telt elke sleutel met dat voorvoegsel mee.
    for (const m of src.matchAll(/`([a-z][a-z0-9_.]*[._])\$\{/gi)) {
      for (const [sleutel, lijst] of bestandVanSleutel) if (sleutel.startsWith(m[1])) nodig.add(lijst)
    }
  }
  return nodig
}

/**
 * De woordenlijsten die `i18n.js` zelf meteen inlaadt.
 *
 * Uit de eager-glob gelezen en niet hier overgetypt: een lijst die hier naast
 * de echte staat, keurt stilletjes goed wat er niet meer is.
 */
const KERN = (() => {
  const src = readFileSync(`${WORTEL}/src/lib/i18n.js`, 'utf8')
  const begin = src.indexOf('import.meta.glob(')
  const eind = src.indexOf('{ eager: true }', begin)
  expect(begin, 'de eager-glob in i18n.js').toBeGreaterThan(-1)
  expect(eind, 'de eager-glob in i18n.js').toBeGreaterThan(begin)
  return new Set([...src.slice(begin, eind).matchAll(/'\.\/taal\/([a-z-]+)\.js'/g)].map((m) => m[1]))
})()

/** De routetabel: `pagina(() => import('@pages/Events'), 'events', …)`. */
function routetabel() {
  const uit = []
  for (const bron of ['src/App.jsx', 'src/AppPrive.jsx']) {
    const src = readFileSync(`${WORTEL}/${bron}`, 'utf8')
    for (const m of src.matchAll(/pagina\(\(\) => import\('([^']+)'\)([^)]*)\)/g)) {
      const bestand = zoekBestand(m[1], `${WORTEL}/${bron}`)
      const lijsten = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1])
      if (bestand) uit.push({ naam: m[1], bestand, lijsten })
    }
  }
  return uit
}

const ROUTES = routetabel()

describe('de woordenlijsten per scherm', () => {
  it('kent elk scherm uit de routetabel', () => {
    // Blijft er een `lazy(() => import('@pages/…'))` staan, dan draagt dat
    // scherm geen teksten mee en toont het sleutels.
    for (const bron of ['src/App.jsx', 'src/AppPrive.jsx']) {
      const src = readFileSync(`${WORTEL}/${bron}`, 'utf8')
      expect({ bron, los: [...src.matchAll(/lazy\(\(\) => import\('(@pages[^']+)'\)\)/g)].map((m) => m[1]) })
        .toEqual({ bron, los: [] })
    }
    expect(ROUTES.length).toBeGreaterThan(20)
  })

  for (const route of ROUTES) {
    it(`mist niets op ${route.naam}`, () => {
      const nodig = lijstenVoor(boom(route.bestand))
      const ontbreekt = [...nodig].filter((l) => !KERN.has(l) && !route.lijsten.includes(l)).sort()
      expect({ scherm: route.naam, ontbreekt }).toEqual({ scherm: route.naam, ontbreekt: [] })
    })

    it(`vraagt niets te veel op ${route.naam}`, () => {
      const nodig = lijstenVoor(boom(route.bestand))
      const teveel = route.lijsten.filter((l) => KERN.has(l) || !nodig.has(l)).sort()
      expect({ scherm: route.naam, teveel }).toEqual({ scherm: route.naam, teveel: [] })
    })
  }

  it('houdt de kern bij wat op elk scherm staat', () => {
    // Wat de app buiten de schermen om opzoekt — de zijbalk, de zoekbalk, de
    // timer, `activiteit.js`, `pipeline.js` — moet in de kern zitten. Anders
    // staat er een sleutel op het scherm voordat er één pagina geladen is.
    const schil = new Set([...boom(`${WORTEL}/src/main.jsx`), ...boom(`${WORTEL}/src/AppPrive.jsx`)])
    const ontbreekt = [...lijstenVoor(schil)].filter((l) => !KERN.has(l)).sort()
    expect(ontbreekt).toEqual([])
  })
})
