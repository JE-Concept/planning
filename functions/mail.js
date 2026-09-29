/**
 * De teksten van de e-mails, en waarom er überhaupt e-mail is.
 *
 * ── Waarom e-mail naast push ──────────────────────────────────────────────
 * Push is het snelste kanaal maar ook het broosste: het werkt pas als de
 * VAPID-sleutel gezet is, alleen op toestellen waar iemand de melding ooit
 * toeliet, en het verdwijnt zodra iemand zijn browsergegevens wist. E-mail
 * komt aan bij iedereen die een adres heeft, ook bij wie JE Plan niet op zijn
 * telefoon zette — en die mensen zijn er.
 *
 * ── Welk kanaal, en waarom dat ────────────────────────────────────────────
 * SMTP van de eigen Google Workspace, met nodemailer. Niet SendGrid, Mailgun
 * of Postmark: dat is telkens een nieuwe leverancier, een nieuw account, een
 * verwerkersovereenkomst erbij, en een gratis niveau dat kan verdwijnen.
 * JE Concept heeft al Google Workspace op jeconcept.be. Daar een adres voor
 * de tool en een app-wachtwoord bij maken kost niets extra, de mail vertrekt
 * van een adres dat het team zelf bezit, en SPF en DKIM staan voor dat domein
 * al goed — dus geen domeinverificatie en geen post die in de spam belandt.
 *
 * De Firebase-extensie "Trigger Email from Firestore" doet precies hetzelfde,
 * en heeft óók een SMTP-server nodig. Deze code heeft dezelfde vorm als die
 * extensie — schrijven naar een collectie, een verzender die erop luistert —
 * zodat ze later te vervangen is door de extensie zonder één trigger aan te
 * raken.
 *
 * ── Waarom er een wachtrij tussen zit ─────────────────────────────────────
 * De sleutel mag ontbreken. Een functions-uitrol faalt in zijn geheel op een
 * ontbrekend geheim, en dat heeft hier ooit `ensureProfile` meegesleept: toen
 * kon niemand meer inloggen. Daarom staat de verzender in een eigen codebase
 * (`functions-mail/`), net als de overlegfuncties, en schrijven de triggers
 * hier alleen een rij in `mailQueue`. Zonder sleutel wordt die codebase niet
 * uitgerold: de rijen blijven op "wachtend" staan, het logboek zegt dat, en er
 * gaat niets stuk.
 *
 * ── Waarom platte tekst ───────────────────────────────────────────────────
 * Wat je moet doen, staat in één regel; de rest staat in de tool, achter de
 * link. Een opgemaakte mail zou dat niet duidelijker maken en wel per
 * mailprogramma anders vallen.
 *
 * ── In welke taal ─────────────────────────────────────────────────────────
 * In die van de ontvanger. Elke functie hier krijgt daarom `taal` mee; wie
 * niets meegeeft, krijgt Nederlands, zodat een aanroep die dit vergeet nog
 * altijd een leesbare mail maakt in plaats van geen mail.
 */

import { alsDatum, dagSleutel } from './notify.js'
import { STANDAARDTAAL, zeg } from './teksten.js'

const lijst = (v) => (Array.isArray(v) ? v.filter(Boolean) : [])

/** De naam waarmee de tool tekent. Staat hier één keer, niet in vier teksten. */
export const AFZENDERNAAM = 'JE Plan'

/**
 * Eén taak als regel in een lijstje.
 *
 * De datum staat erbij als dagelijkse taal ("3 dagen te laat") en niet als
 * 30/09/2026: wie 's ochtends zes regels leest, telt niet graag dagen.
 */
export function taakregel(taak, { nu = new Date(), toon = 'telaat', taal = STANDAARDTAAL } = {}) {
  const titel = (taak?.title ?? '').trim() || zeg(taal, 'mail.geen_titel')
  const waar = taak?.customerName || taak?.listName || null
  const dagen = dagenVerschil(taak?.dueDate, nu)

  const wanneer =
    toon === 'telaat' && dagen !== null
      ? ` — ${zeg(taal, 'mail.telaat', { aantal: Math.abs(dagen) })}`
      : ''

  return `• ${titel}${waar ? ` (${waar})` : ''}${wanneer}`
}

/**
 * Hoeveel dagen ertussen zitten, geteld op de Brusselse kalender.
 *
 * Niet op 24-uursblokken: een taak die gisteravond verviel is "1 dag te laat",
 * ook wanneer er nog geen vierentwintig uur voorbij zijn. Dat is hoe iemand die
 * de mail leest het zelf telt.
 */
function dagenVerschil(waarde, nu) {
  const sleutel = dagSleutel(waarde)
  if (!sleutel) return null
  const dag = (s) => Math.round(new Date(`${s}T12:00:00Z`).getTime() / 86400000)
  return dag(sleutel) - dag(dagSleutel(alsDatum(nu) ?? new Date()))
}

const voet = (link, taal) => `\n\n—\n${AFZENDERNAAM} · ${link}\n${zeg(taal, 'mail.voet')}`

/** "Er staat iets voor jou klaar." */
export function mailVoorToewijzing({ taak, link, taal = STANDAARDTAAL }) {
  const titel = (taak?.title ?? '').trim() || zeg(taal, 'mail.een_taak')
  return {
    onderwerp: zeg(taal, 'mail.toewijzing.onderwerp', { titel }),
    tekst: [
      zeg(taal, 'mail.toewijzing.regel', { titel }),
      taak?.customerName ? zeg(taal, 'mail.klant', { naam: taak.customerName }) : null,
      taak?.listName ? zeg(taal, 'mail.bord', { naam: taak.listName }) : null,
      '',
      zeg(taal, 'mail.openen', { link }),
    ]
      .filter((r) => r !== null)
      .join('\n') + voet(link, taal),
  }
}

/** "Er is op je taak gereageerd." */
export function mailVoorReactie({ taak, reactie, link, taal = STANDAARDTAAL }) {
  const titel = (taak?.title ?? '').trim() || zeg(taal, 'mail.een_taak')
  const wie = (reactie?.authorName ?? '').trim() || zeg(taal, 'mail.iemand')
  return {
    onderwerp: zeg(taal, 'mail.reactie.onderwerp', { wie, titel }),
    tekst:
      [
        zeg(taal, 'mail.reactie.regel', { wie, titel }),
        '',
        (reactie?.body ?? '').trim(),
        '',
        zeg(taal, 'mail.antwoorden', { link }),
      ].join('\n') + voet(link, taal),
  }
}

/** "Dit vervalt morgen." */
export function mailVoorDeadline({ taken, link, nu = new Date(), taal = STANDAARDTAAL }) {
  const rijen = lijst(taken)
  const aantal = rijen.length
  return {
    onderwerp: zeg(taal, 'mail.deadline.onderwerp', {
      aantal,
      titel: (rijen[0]?.title ?? '').trim() || zeg(taal, 'mail.een_taak'),
    }),
    tekst:
      [
        zeg(taal, 'mail.deadline.regel', { aantal }),
        '',
        ...rijen.map((t) => taakregel(t, { nu, toon: 'deadline', taal })),
        '',
        zeg(taal, 'mail.openen', { link }),
      ].join('\n') + voet(link, taal),
  }
}

/**
 * De ochtendmail met de te-laat-lijst.
 *
 * Alleen wanneer er iets in staat. Een dagelijkse mail die "niets te laat"
 * zegt, leert men wegklikken — en dan gaat ook de mail van de dag dat er wél
 * iets staat mee weg. Vandaar dat deze functie niets teruggeeft bij een lege
 * lijst, in plaats van een vriendelijke mail te maken die niemand wil.
 */
export function mailVoorTeLaat({ taken, link, nu = new Date(), taal = STANDAARDTAAL }) {
  const rijen = lijst(taken)
  if (rijen.length === 0) return null

  return {
    onderwerp: zeg(taal, 'mail.telaat.onderwerp', { aantal: rijen.length }),
    tekst:
      [
        zeg(taal, 'mail.telaat.regel'),
        '',
        ...rijen.map((t) => taakregel(t, { nu, toon: 'telaat', taal })),
        '',
        zeg(taal, 'mail.openen', { link }),
      ].join('\n') + voet(link, taal),
  }
}
