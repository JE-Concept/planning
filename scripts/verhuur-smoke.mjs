import { createReadStream, existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { cspVoor } from './lib/csp.mjs'
import { extname, join } from 'node:path'
import { chromium } from 'playwright'
import { nieuwePagina, rustig } from './lib/rust.mjs'

/**
 * De verhuursite, doorlopen zoals een klant hem doorloopt.
 *
 * ── Waarom dit een eigen script is en niet bij `smoke.mjs` ───────────────
 * Omdat het een andere applicatie is, met een andere bundel en een ander
 * antwoord van de server. `smoke.mjs` draait tegen de demo-build van de
 * backoffice, waar Firestore vervangen is door `demo/`. Hier is er geen
 * Firestore: de site stelt twee vragen aan `/api`, en die beantwoordt dit
 * script zelf — met precies de vorm die `functions/verhuur-aanbod.js`
 * teruggeeft, want die vorm is het contract.
 *
 * Dat is meteen de waarde: loopt het antwoord van de functie en wat de site
 * verwacht uit elkaar, dan valt dit om — en niet een bezoeker.
 */

const POORT = 4180
const MAP = new URL('../dist-verhuur/', import.meta.url).pathname

if (!existsSync(join(MAP, 'index.html'))) {
  console.error('Bouw eerst met `npm run build:verhuur`.')
  process.exit(1)
}

const SOORT = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json',
}

/*
  Het antwoord van de functie, nagebouwd. De bedragen zijn die van de demo, en
  met opzet zo gekozen dat de staffel zichtbaar wordt: 185 per dag en 650 per
  week betekent dat zes dagen op 650 uitkomen en niet op 1110.
*/
const AANBOD = {
  artikelen: [
    {
      id: 'm-statafel', naam: 'Statafel zwart Ø 80', omschrijving: 'Met hoes.',
      categorie: 'Meubilair', prijsPerDag: 9, prijsWeekend: 14, prijsWeek: 32,
      waarborg: null, minDagen: 1, voorraad: 40, uitloopDagen: 1,
    },
    {
      id: 'm-koeling', naam: 'Koelkast glasdeur 380 l', omschrijving: '',
      categorie: 'Koeling', prijsPerDag: 45, prijsWeekend: 70, prijsWeek: 180,
      waarborg: 50, minDagen: 2, voorraad: 9, uitloopDagen: 1,
      // Eén artikel mét foto, zodat beide wegen — foto en plaatshouder — lopen.
      foto: '/favicon.svg',
    },
    {
      id: 'm-verwarmer', naam: 'Terrasverwarmer gas', omschrijving: '',
      categorie: 'Verwarming', prijsPerDag: 185, prijsWeekend: 260, prijsWeek: 650,
      waarborg: 40, minDagen: 1, voorraad: 6, uitloopDagen: 1,
    },
  ],
  categorieen: ['Koeling', 'Meubilair', 'Verwarming'],
}

// De verwarmers zitten vol op de gekozen datum; de rest is vrij.
const VRIJ = { 'm-statafel': 40, 'm-koeling': 4, 'm-verwarmer': 0 }

const verzoeken = []

const CSP = cspVoor('verhuur')

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${POORT}`)
  verzoeken.push(`${req.method} ${url.pathname}`)

  if (url.pathname === '/api/verhuur/aanbod') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify(AANBOD))
  }

  if (url.pathname === '/api/verhuur/beschikbaar') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(
      JSON.stringify({
        van: url.searchParams.get('van'),
        tot: url.searchParams.get('tot'),
        vrij: AANBOD.artikelen.map((m) => ({ id: m.id, vrij: VRIJ[m.id], voorraad: m.voorraad })),
      })
    )
  }

  // Inloggen: het formulier zegt altijd ok; de link 'goed' werkt, 'oud' is verlopen.
  if (url.pathname === '/api/verhuur/login' && req.method === 'POST') {
    let body = ''
    req.on('data', (stuk) => (body += stuk))
    return req.on('end', () => {
      laatsteAfrekening = { pad: url.pathname, body: JSON.parse(body || '{}') }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
    })
  }
  if (url.pathname.startsWith('/api/verhuur/login/')) {
    const token = url.pathname.split('/').pop()
    res.writeHead(token === 'goedetoken-goedetoken-goed' ? 200 : 410, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify(token === 'goedetoken-goedetoken-goed' ? { sessie: 'sessie-sessie-sessie-sessie', email: 'lies@voorbeeld.be', naam: 'Lies' } : { fout: 'verlopen' }))
  }
  if (url.pathname === '/api/verhuur/mijn') {
    const kop = req.headers.authorization ?? ''
    if (kop !== 'Bearer sessie-sessie-sessie-sessie') {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ fout: 'niet_ingelogd' }))
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({
      email: 'lies@voorbeeld.be', naam: 'Lies', kortingPercent: 10,
      huren: [{ id: 'ho-1', van: '2027-02-12', tot: '2027-02-14', status: 'betaald', regels: [{ naam: 'Koelkast', aantal: 2 }], teBetalen: 213.35, waarborg: 100, waarborgTerug: 100 }],
    }))
  }

  if (url.pathname === '/api/afrekenen' || url.pathname === '/api/verhuur/aanvraag') {
    let body = ''
    req.on('data', (stuk) => (body += stuk))
    return req.on('end', () => {
      laatsteAfrekening = { pad: url.pathname, body: JSON.parse(body || '{}') }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, url: `http://localhost:${POORT}/nep-stripe`, orderId: 'ho-test' }))
    })
  }

  if (url.pathname === '/nep-stripe') {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    return res.end('<!doctype html><title>Stripe</title><h1>Betaalpagina</h1>')
  }

  const pad = url.pathname === '/' ? '/index.html' : url.pathname
  const bestand = join(MAP, pad)
  const doel = existsSync(bestand) && extname(bestand) ? bestand : join(MAP, 'index.html')
  res.writeHead(200, {
    'Content-Type': SOORT[extname(doel)] ?? 'application/octet-stream',
    // De policy uit firebase.json: zie scripts/lib/csp.mjs.
    ...(extname(doel) === '.html' ? { 'Content-Security-Policy': CSP } : {}),
  })
  createReadStream(doel).pipe(res)
})

let laatsteAfrekening = null
await new Promise((r) => server.listen(POORT, r))

const browser = await chromium.launch()
let geslaagd = 0
const mislukt = []

const zouden = (waar, waarom) => {
  if (!waar) throw new Error(waarom)
}

async function test(naam, fn) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } })

  /*
    Niets van buiten. De pagina haalt haar lettertypes bij Google op, en die
    verbinding is in een testomgeving onbetrouwbaar — een mislukte fontlading
    zou hier als "fout in de console" tellen en elke test rood maken om iets
    wat met de site niets te maken heeft. Afgekapt, zodat wat er overblijft
    werkelijk van ons is.
  */
  await context.route(/^https?:\/\/(?!localhost)/, (route) => route.abort())

  const page = await nieuwePagina(context)
  const fouten = []
  page.on('pageerror', (e) => fouten.push(String(e)))
  page.on('console', (m) => {
    // Het afkappen hierboven laat zelf een consolefout achter. Die is van ons
    // eigen testopzet en niet van de site; alles wat werkelijk misgaat, komt
    // als `pageerror` of als een andere boodschap binnen.
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) fouten.push(m.text())
  })
  try {
    await fn(page, fouten)
    zouden(fouten.length === 0, `fouten in de console: ${fouten[0]}`)
    console.log(`✓ ${naam}`)
    geslaagd += 1
  } catch (err) {
    console.log(`✗ ${naam}: ${err.message}`)
    mislukt.push(naam)
  }
  await context.close()
}

const ga = async (page, pad) => {
  await page.goto(`http://localhost:${POORT}${pad}`, { waitUntil: 'networkidle' })
}
/*
  De tekst zoals een mens ze ziet, kleingeschreven.

  `innerText` geeft terug wat er gerenderd staat, en `text-transform:
  uppercase` zit daarin verwerkt: "40 vrij" komt eruit als "40 VRIJ". Een
  vergelijking op de letterlijke tekst faalt dan op iets wat een bezoeker niet
  eens als verschil ziet.
*/
const tekst = async (page) => (await page.locator('body').innerText()).toLowerCase()
// Allebei de kanten klein, zodat het ook klopt voor tekst die niet via `tekst()` kwam.
const bevat = (t, stuk) => String(t).toLowerCase().includes(stuk.toLowerCase())

/* ── De etalage ──────────────────────────────────────────────────────── */

await test('de catalogus toont het aanbod met een prijs erbij', async (page) => {
  await ga(page, '/')
  const t = await tekst(page)
  zouden(bevat(t, 'Statafel zwart'), 'het aanbod staat er niet')
  zouden(bevat(t, 'Koelkast glasdeur'), 'niet alle artikelen staan er')
  // Zonder datum een vanafprijs, want een bedrag zonder periode is geen prijs.
  zouden(/vanaf/i.test(t), `er staat geen vanafprijs: ${t.slice(0, 300)}`)
  zouden(bevat(t, '€ 9,00'), 'de dagprijs staat er niet')
})

await test('een artikel met foto toont ze, een artikel zonder krijgt zijn categorie als plaatshouder', async (page) => {
  await ga(page, '/')
  const fotos = page.locator('img.vh__foto')
  zouden((await fotos.count()) === 1, `er horen één foto te zijn, er zijn er ${await fotos.count()}`)
  zouden((await fotos.first().getAttribute('alt')) === 'Koelkast glasdeur 380 l', 'de foto heeft de naam van het artikel niet als alt')
  zouden((await fotos.first().getAttribute('loading')) === 'lazy', 'de kaartfoto laadt niet lui')
  const lege = page.locator('.vh__foto--leeg')
  zouden((await lege.count()) === 2, 'de artikelen zonder foto hebben geen plaatshouder')
  const plaatshouders = await lege.allTextContents()
  zouden(
    plaatshouders.some((t) => bevat(t, 'meubilair')) && plaatshouders.some((t) => bevat(t, 'verwarming')),
    `de plaatshouder draagt de categorie niet: ${JSON.stringify(plaatshouders)}`
  )
})

await test('zonder gekozen datum staat er nergens een aantal vrije stuks', async (page) => {
  await ga(page, '/')
  const t = await tekst(page)
  zouden(!/\d+ vrij/.test(t), `er staat beschikbaarheid zonder datum: ${t.slice(0, 300)}`)
})

await test('een datum kiezen toont wat vrij is en wat volzet staat', async (page) => {
  await ga(page, '/')
  await page.fill('#van', '2027-03-12')
  await page.fill('#tot', '2027-03-14')
  await rustig(page)

  const t = await tekst(page)
  zouden(bevat(t, '40 vrij'), `de statafels staan niet als vrij: ${t.slice(0, 400)}`)
  zouden(bevat(t, '4 vrij'), 'de koelkasten staan niet met hun aantal')
  /*
    Volzet verdwijnt niet. Weg laten zou de bezoeker laten denken dat we het
    niet hébben, en dan belt hij niet eens.
  */
  zouden(bevat(t, 'Terrasverwarmer'), 'een volzet artikel is verdwenen uit de lijst')
  zouden(bevat(t, 'volzet op deze datum'), 'er staat niet bij dat het volzet is')
})

await test('met een datum staat de prijs voor die periode er, niet de dagprijs', async (page) => {
  await ga(page, '/')
  await page.fill('#van', '2027-03-16')
  await page.fill('#tot', '2027-03-18')
  await rustig(page)
  const t = await tekst(page)
  // Drie doordeweekse dagen statafel: 3 × 9 = 27.
  zouden(bevat(t, '€ 27,00'), `de periodeprijs klopt niet: ${t.slice(0, 400)}`)
  zouden(bevat(t, 'voor 3 dagen'), 'er staat niet bij waarvoor het bedrag geldt')
})

/* ── Het artikel ─────────────────────────────────────────────────────── */

await test('de artikelpagina toont de hele staffel', async (page) => {
  await ga(page, '/artikel/m-verwarmer')
  const t = await tekst(page)
  zouden(bevat(t, 'Per dag'), 'de staffel staat er niet')
  zouden(bevat(t, 'Weekend'), 'het weekendtarief staat er niet')
  zouden(bevat(t, '€ 650,00'), 'de weekprijs staat er niet')
  zouden(bevat(t, 'Waarborg'), 'de waarborg staat er niet')
  zouden(/nooit meer dan het eerstvolgende grotere tarief/.test(t), 'de staffelregel wordt niet uitgelegd')
})

/*
  De regel die het geheel geloofwaardig houdt, op het scherm waar een klant
  hem naleest: zes dagen tegen 185 per dag zou 1110 zijn, en dat is meer dan
  een week.
*/
await test('zes dagen zijn op het scherm niet duurder dan een week', async (page) => {
  await ga(page, '/artikel/m-verwarmer')
  await page.fill('#van', '2027-03-15')
  await page.fill('#tot', '2027-03-20')
  await rustig(page)
  const t = await tekst(page)
  zouden(bevat(t, '€ 650,00'), `zes dagen worden niet afgetopt: ${t.slice(0, 500)}`)
  zouden(!bevat(t, '1110'), 'de losse-dagenprijs staat er alsnog')
})

await test('een volzet artikel is niet in de mand te leggen', async (page) => {
  await ga(page, '/artikel/m-verwarmer')
  await page.fill('#van', '2027-03-12')
  await page.fill('#tot', '2027-03-14')
  await rustig(page)
  const knop = page.getByRole('button', { name: 'In de mand' })
  zouden(await knop.isDisabled(), 'een volzet artikel is toch in de mand te leggen')
})

/* ── De mand ─────────────────────────────────────────────────────────── */

await test('van catalogus naar mand, met btw en waarborg apart', async (page) => {
  await ga(page, '/')
  await page.fill('#van', '2027-03-16')
  await page.fill('#tot', '2027-03-18')
  await rustig(page)

  await page.locator('.vh__kaart', { hasText: 'Koelkast' }).getByRole('button', { name: 'In de mand' }).click()
  await page.getByRole('link', { name: /^Mand/ }).click()
  await rustig(page)

  const t = await tekst(page)
  zouden(bevat(t, 'Koelkast glasdeur'), `de mand is leeg: ${t.slice(0, 300)}`)
  // 3 × 45 = 135 huur, 21% btw = 28,35, waarborg 50 erbuiten.
  zouden(bevat(t, '€ 135,00'), `het huurbedrag klopt niet: ${t.slice(0, 500)}`)
  zouden(bevat(t, '€ 28,35'), 'de btw staat er niet of klopt niet')
  zouden(bevat(t, 'Waarborg'), 'de waarborg staat niet apart')
  zouden(bevat(t, '€ 213,35'), `het te betalen bedrag klopt niet: ${t.slice(0, 600)}`)
})

/*
  De waarborg hoort buiten de btw te blijven: het is geld dat je vasthoudt en
  teruggeeft, geen opbrengst. Btw erover heffen is een fout die pas bij de
  afsluiting opvalt.
*/
await test('de waarborg zit niet in de btw', async (page) => {
  await ga(page, '/')
  await page.fill('#van', '2027-03-16')
  await page.fill('#tot', '2027-03-18')
  await rustig(page)
  await page.locator('.vh__kaart', { hasText: 'Koelkast' }).getByRole('button', { name: 'In de mand' }).click()
  await ga(page, '/mand')
  const t = await tekst(page)
  // Zou de waarborg meetellen, dan was de btw 21% van 185 = 38,85.
  zouden(!bevat(t, '€ 38,85'), 'er wordt btw over de waarborg gerekend')
})

await test('een artikel met een minimum aantal dagen houdt het afrekenen tegen', async (page) => {
  await ga(page, '/')
  await page.fill('#van', '2027-03-16')
  await page.fill('#tot', '2027-03-16')
  await rustig(page)
  await page.locator('.vh__kaart', { hasText: 'Koelkast' }).getByRole('button', { name: 'In de mand' }).click()
  await ga(page, '/mand')

  const t = await tekst(page)
  zouden(/minstens 2 dagen/.test(t), `het minimum wordt niet gemeld: ${t.slice(0, 400)}`)
  zouden(
    await page.getByRole('button', { name: /^Betalen/ }).isDisabled(),
    'je kunt afrekenen met een te korte periode'
  )
})

/*
  Het hele punt van de kassa: de browser noemt geen bedragen. Zou hij dat wel
  doen, dan huurt iemand met een ontwikkelaarsconsole een tent voor één euro.
*/
await test('het afrekenen stuurt artikelnummers en geen bedragen', async (page) => {
  await ga(page, '/')
  await page.fill('#van', '2027-03-16')
  await page.fill('#tot', '2027-03-18')
  await rustig(page)
  await page.locator('.vh__kaart', { hasText: 'Statafel' }).getByRole('button', { name: 'In de mand' }).click()
  await ga(page, '/mand')

  await page.locator('input[type=email]').fill('lies@voorbeeld.be')
  await page.getByRole('button', { name: /^Betalen/ }).click()
  await page.waitForURL(/nep-stripe/, { timeout: 5000 })

  const verstuurd = JSON.stringify(laatsteAfrekening?.body ?? {})
  zouden(laatsteAfrekening?.pad === '/api/afrekenen', 'er is niet afgerekend')
  zouden(verstuurd.includes('m-statafel'), 'het artikelnummer ging niet mee')
  for (const woord of ['prijs', 'bedrag', 'netto', 'btw', 'teBetalen', 'totaal']) {
    zouden(!verstuurd.includes(woord), `de browser stuurt een bedrag mee: ${woord} in ${verstuurd}`)
  }
})

/* ── Na de betaling ──────────────────────────────────────────────────── */

await test('afbreken laat de mand staan, gelukt maakt hem leeg', async (page) => {
  await ga(page, '/')
  await page.fill('#van', '2027-03-16')
  await page.fill('#tot', '2027-03-18')
  await rustig(page)
  await page.locator('.vh__kaart', { hasText: 'Statafel' }).getByRole('button', { name: 'In de mand' }).click()

  await ga(page, '/afgebroken')
  zouden(bevat(await tekst(page), 'niets betaald'), 'de afbreekpagina zegt niet dat er niets gebeurd is')
  await ga(page, '/mand')
  zouden(bevat(await tekst(page), 'Statafel'), 'de mand is leeggelopen na afbreken')

  await ga(page, '/gelukt?order=ho-test')
  const t = await tekst(page)
  zouden(bevat(t, 'doorgegeven'), `de geluktpagina belooft meer dan ze weet: ${t.slice(0, 300)}`)
  zouden(bevat(t, 'ho-test'), 'het kenmerk staat er niet')

  await ga(page, '/mand')
  zouden(bevat(await tekst(page), 'mand is leeg'), 'de mand is niet leeggemaakt na een betaling')
})

/* ── De offerteaanvraag ──────────────────────────────────────────────── */

await test('een offerteaanvraag vertrekt, met het lokvakje leeg', async (page) => {
  await ga(page, '/offerte')
  await page.locator('input[type=email]').fill('tom@voorbeeld.be')
  await page.locator('textarea').fill('Tuinfeest voor zestig man, tent en statafels.')
  await page.getByRole('button', { name: /Verstuur/ }).click()
  await rustig(page)

  zouden(laatsteAfrekening?.pad === '/api/verhuur/aanvraag', 'de aanvraag is niet verstuurd')
  zouden(laatsteAfrekening.body.bedrijfsnaam === '', 'het lokvakje is niet leeg meegestuurd')
  zouden(bevat(await tekst(page), 'Bedankt'), `er komt geen bevestiging op het scherm: ${(await tekst(page)).slice(0, 300)}`)
})

/* ── De vorm van het antwoord ────────────────────────────────────────── */

await test('de site vraagt beschikbaarheid alleen op met een datum', async (page) => {
  verzoeken.length = 0
  await ga(page, '/')
  await rustig(page)
  const metDatum = verzoeken.filter((v) => v.includes('/api/verhuur/beschikbaar'))
  zouden(metDatum.length === 0, `er wordt beschikbaarheid opgevraagd zonder datum: ${metDatum[0]}`)
  zouden(verzoeken.some((v) => v.includes('/api/verhuur/aanbod')), 'het aanbod wordt niet opgehaald')
})

/* ── Inloggen ────────────────────────────────────────────────────────── */

await test('een inloglink vragen zegt "kijk in je mail", wat het adres ook is', async (page) => {
  await ga(page, '/login')
  await page.locator('input[type=email]').fill('iemand@voorbeeld.be')
  await page.getByRole('button', { name: /inloglink/ }).click()
  await rustig(page)
  zouden(bevat(await tekst(page), 'Kijk in je mail'), 'na het versturen staat er geen "kijk in je mail"')
  zouden(laatsteAfrekening?.pad === '/api/verhuur/login', 'de aanvraag is niet verstuurd')
  zouden(laatsteAfrekening.body.email === 'iemand@voorbeeld.be', 'het adres ging niet mee')
})

await test('een verlopen link zegt dat, en biedt een nieuwe aan', async (page) => {
  await ga(page, '/login/oudetoken-oudetoken-oud')
  await rustig(page)
  const t = await tekst(page)
  zouden(bevat(t, 'verlopen'), `de reden staat er niet: ${t.slice(0, 200)}`)
  zouden((await page.getByRole('link', { name: /Nieuwe link/ }).count()) === 1, 'er is geen weg naar een nieuwe link')
})

/*
  De link werkt, de sessie staat in de browser, en daarna: de eigen huren,
  het adres vast in de mand, en de korting in de som. Dat is wat het inloggen
  oplevert — en het sluit de rand uit vraag 11: korting alleen na een link
  die in de mailbox van déze klant aankwam.
*/
await test('de link gebruiken logt in: eigen huren, adres vast, korting in de mand', async (page) => {
  await ga(page, '/login/goedetoken-goedetoken-goed')
  await page.waitForURL(/\/mijn$/, { timeout: 5000 })
  await rustig(page)

  const mijn = await tekst(page)
  zouden(bevat(mijn, 'Mijn huren'), 'de pagina met eigen huren komt niet')
  zouden(bevat(mijn, 'lies@voorbeeld.be'), 'het adres van de sessie staat er niet')
  zouden(bevat(mijn, '2 × Koelkast'), 'de eigen huur staat er niet')
  zouden(bevat(mijn, 'waarborg € 100,00 terug'), 'de teruggestorte waarborg staat er niet')
  zouden(bevat(await page.locator('.vh__kop').innerText(), 'Mijn huren'), 'de kop zegt niet dat je ingelogd bent')

  // In de mand: adres vast en de korting zichtbaar.
  await ga(page, '/')
  await page.fill('#van', '2027-03-16')
  await page.fill('#tot', '2027-03-18')
  await rustig(page)
  await page.locator('.vh__kaart', { hasText: 'Koelkast' }).getByRole('button', { name: 'In de mand' }).click()
  await ga(page, '/mand')
  await rustig(page)
  const mand = await tekst(page)
  zouden((await page.locator('input[type=email]').inputValue()) === 'lies@voorbeeld.be', 'het adres staat niet vooraf ingevuld')
  zouden(await page.locator('input[type=email]').evaluate((el) => el.readOnly), 'het adres is nog te wijzigen terwijl je ingelogd bent')
  // 3 × 45 = 135, min 10% = 121,50; btw 25,52; waarborg 50; samen 197,02.
  zouden(bevat(mand, 'klantenkorting (10%)'), `de korting staat niet in de som: ${mand.slice(0, 400)}`)
  zouden(bevat(mand, '€ 197,02'), `het totaal met korting klopt niet: ${mand.slice(0, 600)}`)
})

await test('uitloggen haalt de sessie weg', async (page) => {
  await ga(page, '/login/goedetoken-goedetoken-goed')
  await page.waitForURL(/\/mijn$/, { timeout: 5000 })
  await page.getByRole('button', { name: 'uitloggen' }).click()
  await rustig(page)
  zouden((await page.evaluate(() => localStorage.getItem('je-verhuur-sessie'))) === null, 'de sessie staat nog in de browser')
  zouden(bevat(await page.locator('.vh__kop').innerText(), 'Inloggen'), 'de kop zegt nog dat je ingelogd bent')
})

/* ── Hoe snel ────────────────────────────────────────────────────────── */

/*
  Gemeten en niet beweerd. Dit is lokaal en dus sneller dan een telefoon aan
  de rand van een weiland, maar de verhouding klopt: wat hier boven de
  seconde uitkomt, is daar drie. De grens ligt ruim, zodat een trage
  testmachine niet rood wordt — hij is er om een plotse verdubbeling te zien,
  niet om op de milliseconde te sturen.
*/
await test('het eerste scherm staat er snel, zonder iets van buiten', async (page) => {
  await ga(page, '/')
  const maat = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const verf = performance.getEntriesByType('paint').find((p) => p.name === 'first-contentful-paint')
    const extern = performance
      .getEntriesByType('resource')
      .map((r) => r.name)
      .filter((n) => !n.startsWith(location.origin))
    const bytes = performance
      .getEntriesByType('resource')
      .reduce((s, r) => s + (r.transferSize || 0), 0)
    return {
      dom: Math.round(nav.domContentLoadedEventEnd),
      eersteVerf: Math.round(verf?.startTime ?? -1),
      klaar: Math.round(nav.loadEventEnd),
      extern,
      kB: Math.round(bytes / 1024),
    }
  })
  console.log(`    dom ${maat.dom} ms · eerste verf ${maat.eersteVerf} ms · klaar ${maat.klaar} ms · ${maat.kB} kB over de lijn`)
  zouden(maat.eersteVerf > 0 && maat.eersteVerf < 1500, `eerste verf na ${maat.eersteVerf} ms`)
  zouden(maat.extern.length === 0, `er wordt iets van buiten gehaald: ${maat.extern[0]}`)
})

/* ── Op een telefoon ─────────────────────────────────────────────────── */

/*
  De verhuursite wordt vaker op een telefoon geopend dan op een laptop: iemand
  staat in een tuin, kijkt rond en denkt "hoeveel statafels heb ik nodig". Een
  pagina die daar horizontaal schuift of knoppen heeft die je met een duim
  mist, is op dat moment onbruikbaar.

  Dezelfde twee controles als `scripts/mobiel.mjs` op de backoffice doet, en
  om dezelfde reden: dit is het soort fout dat je op een laptop nooit ziet.
*/
for (const pad of ['/', '/artikel/m-koeling', '/mand', '/offerte', '/gelukt']) {
  await test(`${pad} past op een telefoon`, async (page) => {
    await page.setViewportSize({ width: 390, height: 664 })
    await ga(page, '/')
    // Via de mand, zodat die pagina niet leeg is wanneer we hem bekijken.
    await page.fill('#van', '2027-03-16')
    await page.fill('#tot', '2027-03-18')
    await rustig(page)
    await page.locator('.vh__kaart', { hasText: 'Koelkast' }).getByRole('button', { name: 'In de mand' }).click()
    await ga(page, pad)
    await rustig(page)

    const uitslag = await page.evaluate(() => {
      const klein = []
      const gezien = new Set()
      for (const el of document.querySelectorAll('button, a, input, select, [role="button"]')) {
        // Het lokvakje van het offerteformulier staat buiten beeld en buiten
        // de tabvolgorde; een mens komt het nooit tegen en kan het dus ook
        // niet missen.
        if (el.closest('[aria-hidden="true"]')) continue
        const raakvlak = el.closest('label') ?? el
        if (gezien.has(raakvlak)) continue
        gezien.add(raakvlak)
        const doos = raakvlak.getBoundingClientRect()
        if (doos.width === 0 || doos.height === 0) continue
        if (doos.height >= 32 && doos.width >= 32) continue
        klein.push(`${raakvlak.className || raakvlak.tagName} ${Math.round(doos.width)}×${Math.round(doos.height)}`)
      }
      return { schuift: document.documentElement.scrollWidth > 391, breedte: document.documentElement.scrollWidth, klein }
    })

    zouden(!uitslag.schuift, `de pagina schuift horizontaal: ${uitslag.breedte}px breed`)
    zouden(uitslag.klein.length === 0, `te kleine raakvlakken: ${uitslag.klein.join(' · ')}`)
  })
}

await browser.close()
server.close()

console.log(`\n${geslaagd} geslaagd, ${mislukt.length} mislukt`)
if (mislukt.length) {
  console.log(`Mislukt: ${mislukt.join(', ')}`)
  process.exit(1)
}
