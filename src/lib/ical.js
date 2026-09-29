/**
 * De eventdatums als agenda-abonnement.
 *
 * ── Waarom een .ics-feed en niet de Google Calendar API ───────────────────
 * De API kan meer: ze schrijft rechtstreeks in een agenda en een wijziging
 * staat er binnen de seconde in. Maar ze vraagt ook een Google Cloud-project
 * met OAuth-toestemming, een instemmingsscherm dat Google moet keuren, en
 * tokens per persoon die vernieuwd en bewaard moeten worden — inclusief een
 * plek waar die tokens dan staan en wat er gebeurt als iemand vertrekt.
 *
 * Een .ics-feed is één adres dat je in Google Calendar, Apple Agenda of
 * Outlook plakt. Geen account koppelen, geen toestemming, geen tokens van
 * iemand anders in onze database. Het werkt in elke agenda en vandaag.
 *
 * Wat het kost: Google haalt een externe feed op wanneer het Google uitkomt,
 * en dat kan uren duren. Voor eventdatums die maanden vooruit staan is dat
 * prima; voor "we hebben net van zaal gewisseld, kijk vanmiddag in je agenda"
 * niet. Dat staat ook zo in de uitleg in de app, want een agenda waarvan je
 * denkt dat ze actueel is terwijl ze dat niet is, is erger dan geen agenda.
 *
 * ── Wat erin staat ────────────────────────────────────────────────────────
 * De events met een datum: naam, locatie, klant, en de link terug naar het
 * event in JE Plan. Eén dag per event, als dagvullend item — JE Plan bewaart
 * bij de meeste events geen begin- en einduur, en een event dat om 12u00
 * begint omdat het zo bewaard is, staat in je agenda te liegen.
 *
 * Deze module rekent alleen; het ophalen en versturen staat in `functions/`.
 */

const SOORT = { PRODID: '-//JE Concept//JE Plan//NL' }

/** Tekst zoals RFC 5545 die wil: puntkomma, komma, backslash en regeleinde ontsnapt. */
export function ontsnap(waarde) {
  return String(waarde ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * Een regel vouwen op 75 tekens.
 *
 * Staat er letterlijk zo in de norm, en agenda's die het níét verwachten
 * bestaan niet — maar agenda's die een te lange regel weigeren wel. Vouwen
 * gebeurt met een regeleinde plus één spatie; die spatie hoort bij de
 * volgende regel en telt mee in de 75.
 */
export function vouw(regel) {
  const uit = []
  let rest = String(regel)
  uit.push(rest.slice(0, 75))
  rest = rest.slice(75)
  while (rest.length) {
    uit.push(` ${rest.slice(0, 74)}`)
    rest = rest.slice(74)
  }
  return uit.join('\r\n')
}

/** "2026-09-30" uit wat er ook binnenkomt: Date, Timestamp of tekst. */
export function dagVan(waarde) {
  if (waarde == null || waarde === '') return null
  if (typeof waarde === 'object' && typeof waarde.toDate === 'function') return dagVan(waarde.toDate())
  const d = waarde instanceof Date ? waarde : new Date(waarde)
  if (Number.isNaN(d.getTime())) return null
  // Lokale datumdelen, niet UTC: een event dat op het midden van de dag
  // bewaard staat, hoort op die dag en niet op de dag ervoor.
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const zonderStreepjes = (dag) => dag.replace(/-/g, '')

/** De dag erna, want DTEND van een dagvullend item is exclusief. */
export function dagErna(dag) {
  const d = new Date(`${dag}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

const stempel = (nu) => `${nu.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`

/**
 * Eén event als VEVENT.
 *
 * `UID` is het id van het event plus het domein: zo herkent een agenda bij de
 * volgende ophaalbeurt dat het om hetzelfde item gaat en maakt ze er geen
 * tweede naast. Verandert de datum, dan verhuist het item in plaats van dat
 * er een dubbele bijkomt.
 */
export function eventRegels(event, { nu = new Date(), basis = '' } = {}) {
  const dag = dagVan(event?.date ?? event?.eventDate ?? null)
  if (!dag) return null

  const naam = (event?.name ?? '').trim() || 'Event zonder naam'
  const omschrijving = [
    event?.customerName ? `Klant: ${event.customerName}` : null,
    event?.statusName ? `Status: ${event.statusName}` : null,
    event?.guests ? `${event.guests} personen` : null,
    basis ? `${basis}/#/events/${event.id}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  return [
    'BEGIN:VEVENT',
    `UID:${event.id}@jeplan.jeconcept.be`,
    `DTSTAMP:${stempel(nu)}`,
    `DTSTART;VALUE=DATE:${zonderStreepjes(dag)}`,
    `DTEND;VALUE=DATE:${zonderStreepjes(dagErna(dag))}`,
    `SUMMARY:${ontsnap(naam)}`,
    event?.location ? `LOCATION:${ontsnap(event.location)}` : null,
    omschrijving ? `DESCRIPTION:${ontsnap(omschrijving)}` : null,
    basis ? `URL:${basis}/#/events/${event.id}` : null,
    'END:VEVENT',
  ].filter(Boolean)
}

/**
 * De hele agenda.
 *
 * `X-WR-CALNAME` is geen norm maar wel wat Google, Apple en Outlook lezen om
 * de agenda een naam te geven. Zonder die regel heet het abonnement naar het
 * adres, en dan staat er een URL in iemands agendalijst.
 *
 * `REFRESH-INTERVAL` en `X-PUBLISHED-TTL` vragen om een ophaalbeurt per uur.
 * Het is een verzoek en geen belofte — Google houdt zich aan zijn eigen tempo —
 * maar wie het wel volgt (Apple, Outlook) haalt daardoor sneller op.
 */
export function agendaVan(events, { naam = 'JE Plan', nu = new Date(), basis = '' } = {}) {
  const regels = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${SOORT.PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${ontsnap(naam)}`,
    'X-WR-TIMEZONE:Europe/Brussels',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    ...(Array.isArray(events) ? events : []).flatMap((e) => eventRegels(e, { nu, basis }) ?? []),
    'END:VCALENDAR',
  ]

  // Regeleindes zijn CRLF, ook dat staat zo in de norm; sommige agenda's
  // weigeren een bestand met gewone regeleindes.
  return `${regels.map(vouw).join('\r\n')}\r\n`
}
