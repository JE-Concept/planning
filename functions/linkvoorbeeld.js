import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'
import { lookup } from 'node:dns/promises'
import { createHash } from 'node:crypto'
import { absoluut, isPrivaatIp, leesVoorbeeld, mag } from './og.js'

/**
 * Het voorbeeldkaartje bij een link in een notitie.
 *
 * ── Waarom dit op de server gebeurt ───────────────────────────────────────
 * Een browser mag een vreemde site niet lezen; dat is wat CORS tegenhoudt, en
 * terecht. Dus haalt de server de pagina op, leest er vier velden uit en geeft
 * die terug. Hetzelfde wat Facebook, Slack en WhatsApp doen wanneer je een
 * link plakt.
 *
 * ── Waarom er zoveel bewaking omheen staat ────────────────────────────────
 * Omdat dit het enige stuk van de tool is waar een gebruiker de server een
 * adres laat opvragen. Draait dat binnen Google Cloud, dan is
 * `http://169.254.169.254/` de plek waar de inloggegevens van de machine
 * staan, en `http://10.0.0.5:8080` iets wat van buiten onbereikbaar hoort te
 * zijn. Dat heet SSRF.
 *
 * Vandaar, op volgorde:
 *
 *  1. Alleen http en https, geen inloggegevens in het adres (`og.js`).
 *  2. De naam wordt zelf opgezocht, en elk adres dat eruit komt moet van het
 *     internet zijn. Een lijst met verboden namen alleen is niet genoeg: een
 *     domein dat jij bezit mag naar 127.0.0.1 wijzen.
 *  3. Geen omleidingen volgen. Een omleiding is een tweede adres dat niemand
 *     gekeurd heeft — precies de omweg waarmee stap 2 omzeild wordt.
 *  4. Een tijdslimiet en een plafond op wat er binnenkomt.
 *
 * ── Waarom het antwoord bewaard wordt ─────────────────────────────────────
 * Een notitie met een link wordt door tien mensen gelezen. Zonder cache is dat
 * tien keer dezelfde pagina ophalen, en dan is deze functie een bezoeker die
 * de andere kant als storing ervaart.
 */

/** Hoe lang een kaartje meegaat voor het opnieuw opgehaald wordt. */
const HOUDBAAR_DAGEN = 14

/** Wat er hoogstens binnenkomt. Meta staat in de kop; de rest is overbodig. */
const MAX_BYTES = 512 * 1024

const TIJDSLIMIET_MS = 6000

const sleutelVan = (url) => createHash('sha256').update(url).digest('hex').slice(0, 32)

/**
 * Elk adres achter deze naam moet van het internet zijn.
 *
 * `all: true`, want één naam kan meerdere adressen hebben en het volstaat niet
 * dat het eerste goed is: welk adres er gebruikt wordt, beslist het
 * besturingssysteem.
 */
async function naamWijstNaarBuiten(host) {
  // Een adres dat al een IP is, is hierboven al nagekeken.
  if (isPrivaatIp(host)) return false
  let adressen
  try {
    adressen = await lookup(host, { all: true })
  } catch {
    return false
  }
  return adressen.length > 0 && adressen.every((a) => !isPrivaatIp(a.address))
}

/** De pagina ophalen, met alle grenzen eromheen. */
async function haalOp(url) {
  const antwoord = await fetch(url, {
    // Geen omleidingen: een omleiding wijst naar een adres dat de controle
    // hierboven niet gezien heeft.
    redirect: 'manual',
    signal: AbortSignal.timeout(TIJDSLIMIET_MS),
    headers: {
      // Eerlijk zeggen wie er aanbelt, en waarom. Een site die dit niet wil,
      // kan het weigeren — dat is zijn recht.
      'user-agent': 'JEPlanLinkVoorbeeld/1.0 (+https://planning.jeconcept.be)',
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'nl,en;q=0.8',
    },
  })

  if (antwoord.status >= 300 && antwoord.status < 400) {
    return { fout: `omleiding naar ${antwoord.headers.get('location') ?? 'onbekend'}` }
  }
  if (!antwoord.ok) return { fout: `status ${antwoord.status}` }

  const soort = antwoord.headers.get('content-type') ?? ''
  if (!/text\/html|application\/xhtml/i.test(soort)) return { fout: `geen pagina maar ${soort || 'onbekend'}` }

  // Stuk voor stuk lezen en stoppen zodra het plafond bereikt is: een
  // `content-length` die liegt, mag het geheugen niet opvreten.
  const lezer = antwoord.body?.getReader()
  if (!lezer) return { fout: 'geen inhoud' }

  const stukken = []
  let totaal = 0
  for (;;) {
    const { done, value } = await lezer.read()
    if (done) break
    totaal += value.length
    stukken.push(value)
    if (totaal >= MAX_BYTES) {
      await lezer.cancel()
      break
    }
  }

  return { html: new TextDecoder('utf-8').decode(Buffer.concat(stukken.map((s) => Buffer.from(s)))) }
}

export function maakLinkVoorbeeld({ db, region }) {
  const linkVoorbeeld = onCall({ region, cors: true }, async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Meld je eerst aan.')

    const keuring = mag(request.data?.url)
    if (!keuring.ok) return { url: request.data?.url ?? null, leeg: true, reden: keuring.reden }

    const { url } = keuring
    const doc = db.collection('linkVoorbeelden').doc(sleutelVan(url))

    const bestaand = await doc.get()
    if (bestaand.exists) {
      const rij = bestaand.data()
      const oud = Date.now() - (rij.opgehaald?.toDate?.()?.getTime() ?? 0)
      if (oud < HOUDBAAR_DAGEN * 86400 * 1000) return { ...rij, opgehaald: undefined, uitCache: true }
    }

    let kaartje = { url, leeg: true, reden: null }
    try {
      if (!(await naamWijstNaarBuiten(new URL(url).hostname))) {
        kaartje.reden = 'de naam wijst naar een intern adres'
      } else {
        const { html, fout } = await haalOp(url)
        if (fout) {
          kaartje.reden = fout
        } else {
          const gelezen = leesVoorbeeld(html)
          kaartje = {
            url,
            titel: gelezen.titel,
            omschrijving: gelezen.omschrijving,
            afbeelding: absoluut(url, gelezen.afbeelding),
            site: gelezen.site,
            // Een kaartje zonder titel is geen kaartje; dan toont het scherm
            // alleen de link zelf, en dat is eerlijker dan een leeg vlak.
            leeg: !gelezen.titel,
            reden: gelezen.titel ? null : 'geen titel gevonden',
          }
        }
      }
    } catch (err) {
      logger.warn('linkVoorbeeld mislukt', { url, fout: String(err?.message ?? err) })
      kaartje.reden = 'niet bereikbaar'
    }

    // Ook een mislukking wordt bewaard: anders probeert elke lezer van die
    // notitie het opnieuw, en blijft een kapotte link elke keer zes seconden
    // hangen.
    await doc.set({ ...kaartje, opgehaald: new Date() }).catch(() => {})
    return kaartje
  })

  return { linkVoorbeeld }
}
