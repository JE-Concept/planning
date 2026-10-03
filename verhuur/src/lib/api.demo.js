/**
 * De verhuursite zonder server: dezelfde vragen, beantwoord in de browser.
 *
 * ── Waarvoor dit is ────────────────────────────────────────────────────────
 * Een preview waar Jasper op kan commenten, met voorbeelddata en zonder
 * Stripe, Firestore of mail. Dezelfde bundel als live — alleen dit bestand
 * schuift in de plaats van `api.js` (zie `vite.verhuur.config.js`, modus
 * `demo`). Wat hier staat is dus niet "zoals het zou kunnen": het is de echte
 * site die tegen een nagebootste server praat.
 *
 * ── Wat er nagebootst wordt ────────────────────────────────────────────────
 * Het aanbod met zes artikelen; een bezetting zodat de beschikbaarheid per
 * datum verandert; een inloglink die altijd werkt (`/#/login/demo`); een
 * ingelogde klant met twee eerdere huren en 10% korting; en een afrekening
 * die niet naar Stripe gaat maar naar de bedankpagina.
 */

const wacht = (ms = 180) => new Promise((r) => setTimeout(r, ms))

/* Een stilleven in SVG, zodat ook de weg mét foto te zien is zonder iets van buiten te halen. */
const svg = (tekst, kleur) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="${kleur}"/><text x="200" y="158" font-family="Oswald, Arial" font-size="28" fill="#fff" text-anchor="middle" letter-spacing="2">${tekst}</text></svg>`
  )}`

const ARTIKELEN = [
  { id: 'm-statafel', naam: 'Statafel zwart Ø 80', omschrijving: 'Met zwarte stretchhoes. Past in elke bestelwagen.', categorie: 'Meubilair', prijsPerDag: 9, prijsWeekend: 14, prijsWeek: 32, waarborg: null, minDagen: 1, voorraad: 40, uitloopDagen: 1, foto: svg('STATAFEL', '#1B3A6B') },
  { id: 'm-stoel', naam: 'Klapstoel wit', omschrijving: 'Stapelbaar, per 10 op een kar.', categorie: 'Meubilair', prijsPerDag: 2.5, prijsWeekend: 4, prijsWeek: 9, waarborg: null, minDagen: 1, voorraad: 120, uitloopDagen: 1 },
  { id: 'm-koeling', naam: 'Koelkast glasdeur 380 l', omschrijving: 'Twee rolkarren drank. Stekker erin en klaar.', categorie: 'Koeling', prijsPerDag: 45, prijsWeekend: 70, prijsWeek: 180, waarborg: 50, minDagen: 2, voorraad: 9, uitloopDagen: 1, foto: svg('KOELKAST', '#2E5A8E') },
  { id: 'm-verwarmer', naam: 'Terrasverwarmer gas', omschrijving: 'Inclusief een volle fles. Lege fles omruilen kan bij ons.', categorie: 'Verwarming', prijsPerDag: 35, prijsWeekend: 55, prijsWeek: 140, waarborg: 40, minDagen: 1, voorraad: 6, uitloopDagen: 1 },
  { id: 'm-tap', naam: 'Tapinstallatie 1 kraan', omschrijving: 'Met CO₂ en koeling. Vat niet inbegrepen.', categorie: 'Bar en toog', prijsPerDag: 60, prijsWeekend: 95, prijsWeek: 240, waarborg: 100, minDagen: 1, voorraad: 3, uitloopDagen: 1 },
  { id: 'm-vuurkorf', naam: 'Vuurkorf cortenstaal', omschrijving: 'Met een zak hout voor één avond.', categorie: 'Verwarming', prijsPerDag: 25, prijsWeekend: 40, prijsWeek: 95, waarborg: 30, minDagen: 1, voorraad: 4, uitloopDagen: 1 },
]

/* Bezetting per artikel: vaste reeksen, zodat elke datum iets anders laat zien. */
const BEZET = {
  'm-koeling': [{ van: 12, tot: 14, aantal: 5 }, { van: 19, tot: 21, aantal: 9 }],
  'm-verwarmer': [{ van: 12, tot: 14, aantal: 6 }],
  'm-tap': [{ van: 5, tot: 5, aantal: 2 }, { van: 19, tot: 22, aantal: 3 }],
  'm-statafel': [{ van: 12, tot: 14, aantal: 28 }],
}

const dagVanMaand = (sleutel) => Number(String(sleutel).slice(8, 10))
const dagenTussen = (van, tot) => {
  const uit = []
  const d = new Date(`${van}T12:00:00`)
  const e = new Date(`${tot || van}T12:00:00`)
  while (d <= e && uit.length < 200) {
    uit.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    d.setDate(d.getDate() + 1)
  }
  return uit
}

const SESSIE = 'je-verhuur-sessie'
const leesSessie = () => {
  try {
    return localStorage.getItem(SESSIE)
  } catch {
    return null
  }
}
export const sessie = leesSessie
export function zetSessie(token) {
  try {
    if (token) localStorage.setItem(SESSIE, token)
    else localStorage.removeItem(SESSIE)
  } catch {
    /* privévenster */
  }
}

export async function aanbod() {
  await wacht()
  return {
    artikelen: ARTIKELEN,
    categorieen: [...new Set(ARTIKELEN.map((a) => a.categorie))].sort((a, b) => a.localeCompare(b)),
  }
}

export async function beschikbaar(van, tot) {
  await wacht(120)
  const dagen = dagenTussen(van, tot)
  return {
    van,
    tot,
    dagen: dagen.length,
    vrij: ARTIKELEN.map((a) => {
      let vrij = a.voorraad
      for (const dag of dagen) {
        const n = dagVanMaand(dag)
        const bezet = (BEZET[a.id] ?? []).filter((b) => n >= b.van && n <= b.tot + a.uitloopDagen).reduce((s, b) => s + b.aantal, 0)
        vrij = Math.min(vrij, a.voorraad - bezet)
      }
      return { id: a.id, vrij: Math.max(0, vrij), voorraad: a.voorraad }
    }),
  }
}

export async function afrekenen(bestelling) {
  await wacht(400)
  if (!bestelling?.regels?.length) throw Object.assign(new Error('geen_regels'), { code: 'geen_regels', uit: {} })
  // Geen Stripe in de preview: meteen naar de bedankpagina.
  return { url: `${location.origin}${location.pathname}#/gelukt?order=ho-demo-7f3a`, orderId: 'ho-demo-7f3a', teBetalen: 0 }
}

export async function aanvragen() {
  await wacht(300)
  return { ok: true }
}

export async function loginVragen() {
  await wacht(300)
  return { ok: true }
}

export async function loginGebruiken(token) {
  await wacht(300)
  if (token !== 'demo') throw Object.assign(new Error('verlopen'), { code: 'verlopen', status: 410, uit: {} })
  return { sessie: 'demo-sessie', email: 'lies.vandeputte@telenet.be', naam: 'Lies Vandeputte' }
}

export async function mijnHuren() {
  await wacht(200)
  if (leesSessie() !== 'demo-sessie') throw Object.assign(new Error('niet_ingelogd'), { code: 'niet_ingelogd', status: 401, uit: {} })
  return {
    email: 'lies.vandeputte@telenet.be',
    naam: 'Lies Vandeputte',
    kortingPercent: 10,
    huren: [
      { id: 'ho-2k9d1', van: '2026-06-12', tot: '2026-06-14', status: 'betaald', regels: [{ naam: 'Koelkast glasdeur 380 l', aantal: 2 }, { naam: 'Statafel zwart Ø 80', aantal: 8 }], teBetalen: 353.6, waarborg: 100, waarborgTerug: 100 },
      { id: 'ho-8m2xq', van: '2026-09-05', tot: '2026-09-05', status: 'betaald', regels: [{ naam: 'Tapinstallatie 1 kraan', aantal: 1 }], teBetalen: 172.6, waarborg: 100, waarborgTerug: null },
    ],
  }
}
