import { allDocs } from './firestore.js'

/** Alle documenten van één collectie, met hun id erbij. */
const lees = (collectie) =>
  [...allDocs().entries()]
    .filter(([sleutel]) => sleutel.startsWith(`${collectie}/`))
    .map(([sleutel, data]) => ({ id: sleutel.slice(collectie.length + 1), ...data }))

/**
 * Het klantenportaal in de demo.
 *
 * De echte pagina's praten met een Cloud Function (`functions/portaal.js`), en
 * die draait hier niet. Dit is dezelfde naad als bij Firebase zelf: de
 * demobuild vervangt één module en geen enkele regel schermcode verandert
 * daardoor. Wat hier gebeurt is wat de functie doet — per veld kiezen wat de
 * klant te zien krijgt — alleen dan uit de voorbeeldgegevens.
 */

const alsTekst = (d) => (d ? new Date(d).toISOString() : null)

export async function haalPortaal(pad) {
  const [soort, token] = pad.split('/')

  if (soort === 'offerte') {
    const offerte = lees('offertes').find((o) => o.token === token && o.status !== 'concept')
    if (!offerte) throw new Error('portaal 404')
    const event = lees('tasks').find((t) => t.id === offerte.eventId) ?? null
    const klant = lees('customers').find((k) => k.id === offerte.klantId) ?? null
    return {
      offerte: {
        ...offerte,
        datum: alsTekst(offerte.datum),
        geldigTot: alsTekst(offerte.geldigTot),
        eventDatum: alsTekst(offerte.eventDatum),
      },
      contact: contactVan(klant),
      aanspreekpunt: aanspreekpuntVan(event),
      aanleiding: (event?.description ?? '').slice(0, 600),
      portaal: klant?.portalToken ? `klant/${klant.portalToken}` : null,
    }
  }

  if (soort === 'klant') {
    const klant = lees('customers').find((k) => k.portalToken === token)
    if (!klant) throw new Error('portaal 404')
    const events = lees('tasks').filter((t) => t.customerId === klant.id && !t.parentId && !t.archived)
    const offertes = lees('offertes').filter((o) => o.status !== 'concept')
    return {
      klant: { naam: klant.name },
      contact: contactVan(klant),
      events: events.map((e) => {
        const offerte = offertes.find((o) => o.eventId === e.id) ?? null
        return {
          id: e.id,
          title: e.title,
          eventDate: alsTekst(e.eventDate ?? e.dueDate),
          eventEndDate: alsTekst(e.eventEndDate),
          location: e.location,
          pax: e.pax,
          stand: standVoorKlant(e.statusName),
          offerte: offerte ? { token: offerte.token, nummer: offerte.nummer, status: offerte.status } : null,
        }
      }),
    }
  }

  throw new Error('portaal 404')
}

export async function stuurAntwoord(token, body) {
  const offerte = lees('offertes').find((o) => o.token === token)
  if (!offerte) throw new Error('portaal 404')
  const status = body.akkoord ? 'goedgekeurd' : 'feedback'
  offerte.status = status
  return { status }
}

function contactVan(klant) {
  const hoofd = (klant?.contacts ?? []).find((c) => c?.primary) ?? (klant?.contacts ?? [])[0] ?? null
  const naam = hoofd?.name || klant?.name || ''
  return { naam, voornaam: naam.split(' ')[0] ?? '' }
}

function aanspreekpuntVan(event) {
  const uid = (event?.assignees ?? [])[0]
  const profiel = lees('profiles').find((p) => p.id === uid)
  return profiel ? { naam: profiel.fullName, email: profiel.email } : null
}

function standVoorKlant(statusName) {
  if (statusName === 'offer send') return 'bij_jou'
  if (['offer accepted', 'planning ongoing', 'planning ready'].includes(statusName)) return 'bevestigd'
  if (['ready to invoice', 'invoiced', 'complete'].includes(statusName)) return 'afgerond'
  return 'in_behandeling'
}
