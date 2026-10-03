/**
 * Wie krijgt een melding, en waarover.
 *
 * Puur rekenwerk, los van Firebase, zodat het na te rekenen is in een test. De
 * regel die het meeste werk doet staat hieronder twee keer: wie de wijziging
 * zelf maakte, krijgt er geen melding van. Een telefoon die trilt omdat je net
 * zelf een taak naar jezelf zette, is hoe mensen meldingen uitzetten.
 */

import { taalVan } from './teksten.js'

const lijst = (v) => (Array.isArray(v) ? v.filter(Boolean) : [])

/** Wie er nieuw op de taak kwam te staan — de dader niet meegerekend. */
export function nieuweToegewezenen(voor, na, actor = null) {
  const oud = new Set(lijst(voor?.assignees))
  return lijst(na?.assignees).filter((uid) => !oud.has(uid) && uid !== actor)
}

/**
 * Aan wie er net een review gevraagd is.
 *
 * Alleen op de overgang naar "requested", en alleen wanneer er een naam bij
 * staat: een review die aan niemand in het bijzonder gevraagd is, hoort in de
 * kalender thuis en niet op iemands telefoon.
 */
export function nieuweReviewer(voor, na) {
  if (na?.reviewState !== 'requested') return null
  const opnieuw = voor?.reviewState === 'requested' && (voor?.reviewRound ?? 0) === (na?.reviewRound ?? 0)
  if (opnieuw) return null

  const reviewer = na.reviewerId ?? null
  if (!reviewer || reviewer === (na.reviewRequestedBy ?? null)) return null
  return reviewer
}

/** Eén zin, kort genoeg voor een vergrendelscherm. */
export function kort(tekst, max = 80) {
  const schoon = (tekst ?? '').toString().trim().replace(/\s+/g, ' ')
  return schoon.length > max ? `${schoon.slice(0, max - 1)}…` : schoon
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ Wie wil welk bericht, en langs welke weg                                 ║
// ╚══════════════════════════════════════════════════════════════════════════╝

/**
 * De soorten berichten die JE Plan stuurt.
 *
 * Ze staan hier als sleutel en niet als vrije tekst, want ze komen op drie
 * plaatsen terug: in de voorkeuren van een profiel, in de triggers hieronder,
 * en in het schermpje waar je ze aan- en uitzet. Een tikfout in één daarvan
 * zou stil betekenen "dit bericht wil niemand".
 */
export const SOORTEN = ['toewijzing', 'reactie', 'deadline', 'telaat', 'systeem', 'verhuur']

/**
 * Wat je krijgt zolang je niets instelt.
 *
 * Toewijzing en reactie staan aan: dat is werk dat op jou wacht en dat je
 * anders pas ziet wanneer je toevallig het juiste scherm opent. De ochtendmail
 * met de te-laat-lijst staat uit, met opzet — een mail die op de meeste dagen
 * niets nieuws vertelt, leert men wegklikken, en dan gaat ook de mail van de
 * dag dat het er wél toe doet mee de prullenbak in. Wie hem wil, zet hem aan.
 *
 * Beide kanalen staan aan waar het bericht aanstaat. Push is er nog niet: de
 * VAPID-sleutel ontbreekt, dus vandaag komt alleen de e-mail echt aan. Stond
 * e-mail standaard uit, dan zou er in de praktijk niets vertrekken.
 */
export const STANDAARD = {
  toewijzing: { push: true, email: true },
  reactie: { push: true, email: true },
  deadline: { push: true, email: true },
  telaat: { push: false, email: false },
  /*
    De tool die over zichzelf meldt. Staat aan, en gaat alleen naar
    beheerders — zie `controleerSysteem`. Uitzetten kan, maar wie hem uitzet,
    zet de enige manier uit waarop hij hoort dat de post stilviel; daarom is
    dit het enige soort dat standaard op allebei de kanalen staat zonder dat
    er iets tegenover staat.
  */
  systeem: { push: true, email: true },
  /*
    Een online huur of een aanvraag van de verhuursite. Staat aan op beide
    kanalen en gaat alleen naar beheerders — zie `functions/verhuur-orders.js`.
    Een order die 's nachts binnenkomt legt stukken vast die vrijdag klaar
    moeten staan, en de eerste die dat moet weten is wie de camion laadt.
  */
  verhuur: { push: true, email: true },
}

/**
 * De voorkeuren van één persoon, aangevuld met de standaard.
 *
 * Bewust veld per veld: een profiel dat alleen `{ telaat: { email: true } }`
 * bewaart, moet de rest van de standaard houden en niet ineens niets meer
 * krijgen. Onbekende soorten en waarden die geen ja/nee zijn, worden genegeerd.
 */
export function voorkeurenVan(profile) {
  const bewaard = profile?.prefs?.meldingen ?? {}
  const uit = {}
  for (const soort of SOORTEN) {
    const eigen = bewaard[soort] ?? {}
    uit[soort] = {
      push: typeof eigen.push === 'boolean' ? eigen.push : STANDAARD[soort].push,
      email: typeof eigen.email === 'boolean' ? eigen.email : STANDAARD[soort].email,
    }
  }
  return uit
}

export function wilBericht(profile, soort, kanaal) {
  return Boolean(voorkeurenVan(profile)[soort]?.[kanaal])
}

/**
 * Het rekenwerk waar alles op staat of valt: wie krijgt dit bericht.
 *
 * Eén plek, want de vier soorten berichten maken dezelfde fouten. Wat er
 * afvalt, en waarom:
 *
 *  - wie het zelf deed. Een telefoon die trilt van je eigen klik is hoe
 *    mensen meldingen uitzetten — en daarna missen ze ook de echte.
 *  - wie twee keer in de lijst staat (uitvoerder én eerdere reageerder);
 *    één gebeurtenis is één bericht.
 *  - wie geen profiel (meer) heeft, of wiens profiel gearchiveerd is. Een
 *    vertrokken collega blijft in `assignees` van oude taken staan; zijn
 *    adres mag daar geen post meer van krijgen.
 *  - personeel. Hun login geeft alleen de openings- en sluitingslijst; een
 *    melding over een taak stuurt ze naar een scherm dat de regels weigeren.
 *  - wie dit soort bericht op dit kanaal uitzette.
 *  - voor e-mail: wie geen adres heeft. Zonder adres is er niets te sturen.
 *
 * Geeft de twee kanalen apart terug, omdat de verzending dat ook is: push gaat
 * per persoon naar al zijn toestellen, e-mail naar één adres. De taal van de
 * ontvanger staat erbij: wie de tool op Engels zet en 's ochtends een
 * Nederlandse mail krijgt over zijn te-laat-lijst, heeft geen Engelse tool.
 */
export function bepaalOntvangers({ soort, kandidaten, profielen, behalve = null }) {
  const profielVan = new Map((profielen ?? []).map((p) => [p.id, p]))
  const push = []
  const email = []
  const gezien = new Set()

  for (const uid of lijst(kandidaten)) {
    if (uid === behalve || gezien.has(uid)) continue
    gezien.add(uid)

    const profiel = profielVan.get(uid)
    if (!profiel || profiel.active === false) continue
    if (profiel.role === 'staff') continue

    const taal = taalVan(profiel)
    if (wilBericht(profiel, soort, 'push')) push.push({ id: uid, taal })

    const adres = (profiel.email ?? '').trim()
    if (adres && wilBericht(profiel, soort, 'email')) email.push({ id: uid, adres, taal })
  }

  return { push, email }
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ Reacties                                                                 ║
// ╚══════════════════════════════════════════════════════════════════════════╝

/**
 * Wie een reactie op een taak moet zien.
 *
 * Wie vermeld is gaat voorop: die is persoonlijk aangesproken, en dat is
 * sterker dan op de lijst staan. Daarna de uitvoerders, want het gaat over hun
 * werk, en dan iedereen die er eerder al op reageerde — anders is een gesprek
 * van drie berichten een gesprek waar de eerste twee sprekers niets meer van
 * horen. De schrijver zelf valt af, ook als hij zichzelf vermeldt.
 *
 * Een vermelding bereikt iemand die niet op het event staat. Dat is precies
 * waarvoor je iemand vermeldt: "Elke, kun jij hier even naar kijken." Of ze
 * het dossier mag openen, beslissen de rules — een melding over iets wat op
 * slot zit is vervelend, maar stilte waar iemand op antwoord wacht is erger.
 *
 * De volgorde is vast: vermeld, uitvoerders, reageerders op volgorde van hun
 * reactie. Dat maakt de uitkomst na te rekenen in een test.
 */
export function wieBijReactie({ taak, eerdereReacties, auteur, vermeld }) {
  const uit = []
  const gezien = new Set(auteur ? [auteur] : [])

  const bij = (uid) => {
    if (!uid || gezien.has(uid)) return
    gezien.add(uid)
    uit.push(uid)
  }

  lijst(vermeld).forEach(bij)
  lijst(taak?.assignees).forEach(bij)
  lijst(eerdereReacties).forEach((reactie) => bij(reactie?.authorId ?? null))
  return uit
}

/**
 * De tekst van een notitie zoals een mens hem leest.
 *
 * In de database staat een vermelding als `@[Elke Vandeput](u-elke)`; in een
 * pushbericht of een e-mail hoort daar gewoon "@Elke Vandeput" te staan — daar
 * is geen scherm dat markering kan tekenen.
 *
 * Dezelfde regel als op het scherm (`src/lib/vermelding.js`), en bewust een
 * tweede keer opgeschreven: `functions/` wordt apart verpakt en uitgerold en
 * kan niets uit `src/` importeren.
 */
export function leesbaar(tekst) {
  return (tekst ?? '').replace(/@\[([^\]\n]{1,80})\]\(([A-Za-z0-9_-]{1,64})\)/g, (_, naam) => `@${naam}`)
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ Deadlines: morgen, en wat al te laat is                                  ║
// ╚══════════════════════════════════════════════════════════════════════════╝

const BRUSSEL = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Brussels',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * De dag waarop een tijdstip in Brussel valt, als "2026-09-30".
 *
 * Een geplande functie draait op UTC. Een deadline die met `fromDateInput()`
 * bewaard is staat op het midden van de dag, dus daar gaat het nog goed — maar
 * een taak die op 23u30 vervalt, valt in UTC al de dag ervoor. Wie op de
 * verkeerde dag een herinnering krijgt, vertrouwt de volgende niet meer.
 */
export function dagSleutel(waarde) {
  const d = alsDatum(waarde)
  return d ? BRUSSEL.format(d) : ''
}

/** Wat er ook binnenkomt — Date, Firestore-Timestamp, tekst — er komt een Date of niets uit. */
export function alsDatum(waarde) {
  if (waarde == null || waarde === '') return null
  if (waarde instanceof Date) return Number.isNaN(waarde.getTime()) ? null : waarde
  if (typeof waarde === 'object' && typeof waarde.toDate === 'function') {
    try {
      return alsDatum(waarde.toDate())
    } catch {
      return null
    }
  }
  const d = new Date(waarde)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * De stappen waarop het werk gedaan is.
 *
 * Dezelfde lijst als in `src/lib/laat.js`, en bewust een tweede keer
 * opgeschreven: `functions/` wordt apart verpakt en uitgerold en kan niets uit
 * `src/` importeren. Verandert het team de naam van een kolom, dan moet het op
 * beide plaatsen — daarom staat het hier met dezelfde woorden.
 */
export const UITGEVOERD = ['ready to invoice', 'invoiced', 'complete', 'closed', 'done']

export function isAfgerond(taak) {
  if (!taak) return false
  if (taak.open === false) return true
  const soort = String(taak.statusKind ?? '').toLowerCase()
  if (soort === 'closed' || soort === 'done') return true
  return UITGEVOERD.includes(String(taak.statusName ?? '').toLowerCase())
}

/** Taken die morgen vervallen — op de Brusselse dag, niet op 24 uur vanaf nu. */
export function vervaltMorgen(taken, nu = new Date()) {
  const morgen = dagSleutel(new Date(alsDatum(nu).getTime() + 86400000))
  return lijst(taken).filter(
    (t) => !t.archived && !isAfgerond(t) && dagSleutel(t.dueDate) === morgen
  )
}

/**
 * Wat er te laat staat.
 *
 * Te laat betekent hier hetzelfde als op het bord: er stond een datum, die is
 * voorbij, en er valt nog iets te doen. Een event dat op "ready to invoice"
 * staat is uitgevoerd — alleen de factuur loopt nog — en hoort dus niet in een
 * lijst die 's ochtends roept dat je te laat bent.
 */
export function isTeLaat(taak, nu = new Date()) {
  const vervalt = alsDatum(taak?.dueDate)
  if (!vervalt || taak.archived) return false
  if (isAfgerond(taak)) return false
  return vervalt.getTime() < alsDatum(nu).getTime()
}

export function teLaat(taken, nu = new Date()) {
  return lijst(taken).filter((t) => isTeLaat(t, nu))
}

/**
 * Van een hoop taken naar één lijstje per persoon.
 *
 * Eén bericht per persoon, niet één per taak: zes mails op een ochtend is geen
 * overzicht maar een opruimklus. Het oudste vervaldatum staat bovenaan, want
 * dat is wat het langst blijft liggen. Taken zonder uitvoerder vallen weg —
 * niet omdat ze niet tellen, maar omdat er niemand is om ze aan te sturen.
 */
export function perPersoon(taken) {
  const uit = new Map()
  for (const taak of lijst(taken)) {
    for (const uid of lijst(taak.assignees)) {
      if (!uit.has(uid)) uit.set(uid, [])
      uit.get(uid).push(taak)
    }
  }
  for (const rij of uit.values()) {
    rij.sort((a, b) => (alsDatum(a.dueDate)?.getTime() ?? 0) - (alsDatum(b.dueDate)?.getTime() ?? 0))
  }
  return uit
}
