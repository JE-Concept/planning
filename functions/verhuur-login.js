import { randomBytes, createHash } from 'node:crypto'

/**
 * Inloggen op de verhuursite met een link in je mail — vraag 11 en 12.
 *
 * ── Waarom een eigen magische link en geen Firebase Auth ──────────────────
 * Firebase Auth zou de Firebase-SDK in de publieke bundel zetten, met de
 * projectsleutel erbij, en dat is precies wat `tests/verhuur-bundel.test.js`
 * verbiedt. De site praat met één HTTP-adres. Dus doet de server wat Auth
 * anders deed: een token maken, dat mailen, en bij de klik een sessie
 * teruggeven. Minder dan Auth kan, maar alles wat hier nodig is — en geen
 * wachtwoord dat iemand hergebruikt van zijn webmail.
 *
 * ── Twee tokens, met opzet ────────────────────────────────────────────────
 * De link in de mail is kort geldig (een kwartier) en één keer bruikbaar:
 * een mail die rondgaat of in een log blijft hangen, mag geen deur blijven.
 * De sessie die eruit volgt is lang geldig (negentig dagen) en zit alleen in
 * de browser van de klant. In de database staat van allebei alleen de
 * **hash**: wie de database leest, kan er niet mee inloggen.
 *
 * Nul Firebase-imports, zodat CI dit kan testen; `verhuur.js` doet het
 * lezen, schrijven en mailen.
 */

export const LINK_MINUTEN = 15
export const SESSIE_DAGEN = 90

/** 32 willekeurige bytes, URL-veilig. Dezelfde vorm als de offertesleutels. */
export const nieuwToken = () => randomBytes(32).toString('base64url')

/** Wat er van een token in de database staat. Niet omkeerbaar. */
export const hashVan = (token) => createHash('sha256').update(String(token)).digest('hex')

export const isEmail = (waarde) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(waarde ?? '').trim())

/** Het adres uit het formulier, klein en zonder spaties — of niets. */
export function leesEmail(body) {
  const email = String(body?.email ?? '').trim().toLowerCase().slice(0, 160)
  return isEmail(email) ? email : null
}

/**
 * Is deze link nog bruikbaar?
 *
 * Drie redenen van nee, en ze krijgen elk hun eigen woord — want "link
 * ongeldig" helpt niemand, en "deze link is al gebruikt" wel: dan weet de
 * klant dat hij gewoon een nieuwe moet vragen.
 */
export function beoordeelLink(sessie, nu = new Date()) {
  if (!sessie) return { ok: false, reden: 'onbekend' }
  if (sessie.gebruiktOp) return { ok: false, reden: 'al_gebruikt' }
  const vervalt = sessie.linkVervalt?.toDate?.() ?? (sessie.linkVervalt ? new Date(sessie.linkVervalt) : null)
  if (!vervalt || Number.isNaN(vervalt.getTime()) || vervalt <= nu) return { ok: false, reden: 'verlopen' }
  return { ok: true }
}

/** Loopt deze sessie nog? */
export function sessieGeldig(sessie, nu = new Date()) {
  if (!sessie || !sessie.gebruiktOp) return false
  const vervalt = sessie.sessieVervalt?.toDate?.() ?? (sessie.sessieVervalt ? new Date(sessie.sessieVervalt) : null)
  return Boolean(vervalt) && !Number.isNaN(vervalt.getTime()) && vervalt > nu
}

/** Het token uit `Authorization: Bearer …`, of niets. */
export function bearerVan(kop) {
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,})$/.exec(String(kop ?? '').trim())
  return m ? m[1] : null
}

/**
 * De mail met de link.
 *
 * Kort, en met het adres van de site erin zodat de klant ziet waar hij
 * terechtkomt. De link staat op een eigen regel: een link midden in een zin
 * wordt in sommige mailprogramma's op een spatie afgebroken.
 */
export function loginMail({ link, minuten = LINK_MINUTEN }) {
  return {
    onderwerp: 'Je inloglink voor de verhuur van JE Concept',
    tekst: [
      'Dag,',
      '',
      `Klik op deze link om in te loggen op rental.jeconcept.be. Ze werkt ${minuten} minuten en één keer:`,
      '',
      link,
      '',
      'Vroeg je dit niet aan? Dan kun je deze mail negeren; er gebeurt niets.',
      '',
      'JE Concept',
    ].join('\n'),
  }
}
