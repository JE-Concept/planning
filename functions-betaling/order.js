/**
 * Alles van een huurorder wat zonder Firestore en zonder Stripe te zeggen is.
 *
 * ── Waarom dit een eigen bestand is ───────────────────────────────────────
 * Omdat het de delen zijn die fout kunnen gaan zonder dat iemand het merkt:
 * wat er van een formulier geweigerd wordt, hoe de regels op de Stripe-pagina
 * komen te staan, en wat er in de mail aan de klant staat. Dat hoort getest
 * te worden, en CI heeft geen Cloud Functions-omgeving — dus nul imports
 * buiten de prijsmotor, die zelf ook nergens van afhangt. Dezelfde afspraak
 * als `functions/verhuur-aanbod.js` en `functions/archief-stand.js`.
 *
 * `index.js` doet wat hier niet kan: lezen, schrijven, betalen.
 */

import { dagenTussen } from './vrij.js'

/**
 * Het boekingsvenster — vraag 7 en 8 in `docs/vragen-productie.md`.
 *
 * Niet voor morgen: wie om 23u voor de volgende ochtend boekt, staat voor een
 * gesloten magazijn omdat niemand het zag. Niet verder dan een jaar: prijzen
 * veranderen, en een huur van over twee jaar is een gesprek. Dezelfde twee
 * getallen staan in `verhuur/src/lib/instellingen.js` voor het formulier; de
 * server beslist.
 */
const MIN_DAGEN_VOORAF = 2
const MAX_DAGEN_VOORAF = 365

/**
 * Wat er in de bevestigingsmail staat als "waar en wanneer".
 *
 * Vraag 10 in `docs/vragen-productie.md`. Dezelfde waarden als in
 * `verhuur/src/lib/instellingen.js`; lopen die uiteen, dan zegt de site iets
 * anders dan de mail.
 */
const CONTACT = {
  // Vraag 10 — beantwoord: het nummer komt later. Tot dan verwijst de mail
  // naar het mailadres, en noemt ze geen nummer dat niet bestaat.
  telefoon: null,
  email: 'info@jeconcept.be',
  afhaaluren: 'op afspraak, meestal tussen 9u en 17u',
}

export const euro = (n) => `€ ${Number(n ?? 0).toFixed(2).replace('.', ',')}`

const dagsleutel = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const centen = (euro) => Math.round(Number(euro) * 100)

const tekst = (waarde, max = 200) => String(waarde ?? '').trim().slice(0, max)

/**
 * Wat de browser stuurt, uitgepakt en nagekeken.
 *
 * Alles wat hier niet doorheen komt, krijgt een nette 400 in plaats van een
 * stacktrace: een formulier dat half ingevuld verstuurd wordt, is geen storing.
 */
export function leesAanvraag(body) {
  const regels = Array.isArray(body?.regels) ? body.regels : []
  const van = tekst(body?.van, 10)
  const tot = tekst(body?.tot, 10) || van

  if (regels.length === 0) return { fout: 'geen_regels' }
  if (regels.length > 40) return { fout: 'te_veel_regels' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(van) || !/^\d{4}-\d{2}-\d{2}$/.test(tot)) return { fout: 'geen_datum' }
  if (tot < van) return { fout: 'omgekeerde_datum' }

  const dagen = dagenTussen(van, tot)
  if (dagen.length === 0 || dagen.length > 180) return { fout: 'rare_periode' }

  const nu = new Date()
  const vroegst = new Date(nu)
  vroegst.setDate(vroegst.getDate() + MIN_DAGEN_VOORAF)
  const laatst = new Date(nu)
  laatst.setDate(laatst.getDate() + MAX_DAGEN_VOORAF)
  if (van < dagsleutel(vroegst)) return { fout: 'te_vroeg', minDagenVooraf: MIN_DAGEN_VOORAF }
  if (van > dagsleutel(laatst)) return { fout: 'te_ver_vooruit' }

  const gevraagd = []
  for (const regel of regels) {
    const materiaalId = tekst(regel?.materiaalId, 60)
    const aantal = Math.round(Number(regel?.aantal) || 0)
    if (!materiaalId || aantal <= 0 || aantal > 500) return { fout: 'rare_regel' }
    gevraagd.push({ materiaalId, aantal })
  }

  const email = tekst(body?.klant?.email, 160)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { fout: 'geen_email' }

  return {
    van,
    tot,
    dagen,
    regels: gevraagd,
    klant: {
      naam: tekst(body?.klant?.naam, 120),
      email,
      telefoon: tekst(body?.klant?.telefoon, 40),
      opmerking: tekst(body?.klant?.opmerking, 1000),
    },
  }
}

/**
 * De regels zoals Stripe ze toont.
 *
 * Btw en waarborg staan als aparte regel en zitten niet in de stukprijs
 * verwerkt. Dat is eerlijker op het scherm — een huurder ziet waarvoor hij
 * tekent — en het maakt de som exact: tel je de regels op, dan staat er wat
 * wij `teBetalen` noemen, zonder afrondingsverschil van een cent.
 */
export function stripeRegels(totaal) {
  const regels = totaal.regels.map((r) => ({
    quantity: 1,
    price_data: {
      currency: 'eur',
      unit_amount: centen(r.netto),
      product_data: {
        name: `${r.aantal}× ${r.naam}`,
        description: `${r.dagen} ${r.dagen === 1 ? 'dag' : 'dagen'} huur`,
      },
    },
  }))

  if (totaal.btw > 0) {
    regels.push({
      quantity: 1,
      price_data: { currency: 'eur', unit_amount: centen(totaal.btw), product_data: { name: 'Btw 21%' } },
    })
  }

  if (totaal.waarborg > 0) {
    regels.push({
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: centen(totaal.waarborg),
        product_data: {
          name: 'Waarborg',
          description: 'Wordt teruggestort bij onbeschadigde teruggave.',
        },
      },
    })
  }

  return regels
}


/**
 * De bevestiging aan de klant — vraag 14 in `docs/vragen-productie.md`.
 *
 * Platte tekst en geen opmaak: deze mail wordt gelezen op een telefoon in een
 * tuin, en wat erin moet staan is wát, wannéér en wáár — niet hoe mooi.
 */
export function bevestiging(order) {
  const regels = (order.regels ?? []).map((r) => `  ${r.aantal} × ${r.naam} — ${euro(r.netto)}`).join('\n')
  const periode = order.van === order.tot ? `op ${order.van}` : `van ${order.van} tot en met ${order.tot}`
  const nakijken = order.status === 'nakijken'

  const tekst = [
    `Beste ${order.klant?.naam?.trim() || 'klant'},`,
    '',
    nakijken
      ? 'We hebben je betaling ontvangen, maar het bedrag wijkt af van wat we berekend hadden. We kijken het na en nemen vandaag nog contact met je op. Er is intussen niets vastgelegd.'
      : `Bedankt — je betaling is ontvangen en het materiaal staat op jouw naam ${periode}.`,
    '',
    'Wat je huurt:',
    regels,
    '',
    `Huur excl. btw: ${euro(order.exclBtw)}`,
    `Btw 21%: ${euro(order.btw)}`,
    order.waarborg > 0 ? `Waarborg (krijg je terug bij onbeschadigde teruggave): ${euro(order.waarborg)}` : null,
    `Betaald: ${euro(order.teBetalen)}`,
    '',
    `Je kenmerk is ${order.id}. Zet het in je mail als je ons iets vraagt.`,
    '',
    nakijken ? null : `Afhalen en terugbrengen: ${CONTACT.afhaaluren}. We nemen vooraf contact op om een uur af te spreken.`,
    '',
    CONTACT.telefoon ? `Vragen? Bel ${CONTACT.telefoon} of mail ${CONTACT.email}.` : `Vragen? Mail ${CONTACT.email}.`,
    '',
    'Tot binnenkort,',
    'JE Concept',
  ]
    .filter((regel) => regel !== null)
    .join('\n')

  return {
    onderwerp: nakijken
      ? `Je huur bij JE Concept — we kijken iets na (${order.id})`
      : `Je huur bij JE Concept is bevestigd (${order.id})`,
    tekst,
  }
}

/**
 * De melding aan de beheerders — vraag 15.
 *
 * Kort en met het geld bovenaan: wie dit 's ochtends leest, wil weten of er
 * iets nagekeken moet worden vóór de camion vertrekt.
 */
export function melding(order, klantId = null) {
  const regels = (order.regels ?? []).map((r) => `  ${r.aantal} × ${r.naam}`).join('\n')
  const nakijken = order.status === 'nakijken'
  const kop = nakijken
    ? `NAKIJKEN — het betaalde bedrag wijkt af van ${euro(order.teBetalen)}.`
    : `Betaald: ${euro(order.teBetalen)} (waarvan ${euro(order.waarborg)} waarborg).`

  const tekst = [
    `Online huur ${order.id} — ${order.klant?.naam || order.klant?.email}`,
    '',
    kop,
    `Periode: ${order.van} tot en met ${order.tot}`,
    '',
    regels,
    '',
    `Klant: ${order.klant?.naam || '—'} · ${order.klant?.email} · ${order.klant?.telefoon || '—'}`,
    order.klant?.opmerking ? `Opmerking: ${order.klant.opmerking}` : null,
    klantId ? `Klantenfiche: /klanten/${klantId}` : null,
    '',
    'Zie Materiaal → Online afgerekend in JE Plan.',
  ]
    .filter((regel) => regel !== null)
    .join('\n')

  return {
    onderwerp: `${nakijken ? 'Nakijken: ' : ''}Online huur van ${order.klant?.naam || order.klant?.email}`,
    tekst,
  }
}
