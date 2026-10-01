/**
 * De teksten die de server verstuurt, in twee talen.
 *
 * Deze staan hier en niet in `src/lib/taal/`, om dezelfde reden als de
 * statuslijst in `notify.js`: `functions/` wordt apart verpakt en uitgerold en
 * kan niets uit `src/` importeren. Het zijn een handvol zinnen; ze twee keer
 * opschrijven is minder erg dan een bouwstap die de twee mappen aan elkaar
 * knoopt.
 *
 * Waarom de server überhaupt van taal moet weten: iemand die de tool op Engels
 * zet en 's ochtends een Nederlandse mail krijgt over zijn te-laat-lijst, heeft
 * geen Engelse tool. De taalkeuze staat op het profiel (`prefs.taal`), en de
 * ontvanger is hier bekend — dus kan het.
 *
 * De vorm is dezelfde als in de app: Nederlands en Engels naast elkaar op
 * dezelfde regel, `{naam}` als invulplek, en Nederlands als terugval.
 */

const TEKSTEN = {
  // ── Push ────────────────────────────────────────────────────────────────
  'push.toewijzing': { nl: 'Nieuwe taak voor jou', en: 'A new task for you' },
  'push.review': { nl: 'Een post wacht op jouw review', en: 'A post is waiting for your review' },
  'push.reactie': { nl: '{wie} reageerde', en: '{wie} commented' },
  'push.iemand': { nl: 'Iemand', en: 'Someone' },

  // ── De tool die over zichzelf meldt ────────────────────────────────────
  // Alleen wanneer er iets aan de hand is. Een dagelijks "alles in orde"
  // wordt na een week weggeklikt zonder lezen, en dan gaat het bericht dat
  // er wél toe doet mee.
  'push.systeem': { nl: 'JE Plan heeft je even nodig', en: 'JE Plan needs a look' },
  'push.systeem_post': {
    nl: 'Al {uren} uur geen post opgehaald.',
    en: 'No mail fetched for {uren} hours.',
  },
  'push.systeem_mail_een': { nl: '{aantal} mail is niet vertrokken.', en: '{aantal} message did not go out.' },

  // ── De planning die per mail binnenkwam ───────────────────────────────
  'push.planning': { nl: 'De planning is binnen', en: 'The planning is in' },
  'push.planning_klaar': {
    nl: '{nieuw} nieuw, {bij} bijgewerkt, {weg} weg uit AAPI.',
    en: '{nieuw} new, {bij} updated, {weg} gone from AAPI.',
  },
  'push.planning_twijfel_een': {
    nl: 'Eén shift bij Evenementen vraagt nog welk event het is.',
    en: 'One shift in Events still needs to know which event it is.',
  },
  'push.planning_twijfel_meer': {
    nl: '{aantal} shifts bij Evenementen vragen nog welk event het is.',
    en: '{aantal} shifts in Events still need to know which event they are.',
  },
  'push.planning_mislukt': { nl: 'De planning uit de mail is niet gelukt', en: 'The planning from the mail failed' },
  'mail.planning.onderwerp': { nl: 'JE Plan — de planning uit AAPI', en: 'JE Plan — the planning from AAPI' },
  'push.systeem_mail_meer': { nl: '{aantal} mails zijn niet vertrokken.', en: '{aantal} messages did not go out.' },
  'mail.systeem.onderwerp': {
    nl: 'JE Plan: er is iets blijven hangen',
    en: 'JE Plan: something is stuck',
  },
  'mail.systeem.kop': {
    nl: 'Deze ochtend zag JE Plan het volgende bij zichzelf:',
    en: 'This morning JE Plan noticed the following about itself:',
  },
  'push.deadline_een': { nl: 'Morgen te doen', en: 'Due tomorrow' },
  'push.deadline_meer': { nl: 'Morgen vervallen {aantal} taken', en: '{aantal} tasks are due tomorrow' },
  'push.telaat_een': { nl: '1 taak staat te laat', en: '1 task is overdue' },
  'push.telaat_meer': { nl: '{aantal} taken staan te laat', en: '{aantal} tasks are overdue' },

  // ── E-mail ──────────────────────────────────────────────────────────────
  'mail.toewijzing.onderwerp': { nl: 'Nieuwe taak voor jou: {titel}', en: 'A new task for you: {titel}' },
  'mail.toewijzing.regel': { nl: '{titel} staat nu op jouw naam.', en: '{titel} is now in your name.' },
  'mail.reactie.onderwerp': { nl: '{wie} reageerde op {titel}', en: '{wie} commented on {titel}' },
  'mail.reactie.regel': { nl: '{wie} schreef bij "{titel}":', en: '{wie} wrote on "{titel}":' },
  'mail.deadline.onderwerp_een': { nl: 'Morgen: {titel}', en: 'Tomorrow: {titel}' },
  'mail.deadline.onderwerp_meer': { nl: 'Morgen vervallen {aantal} taken', en: '{aantal} tasks are due tomorrow' },
  'mail.deadline.regel_een': {
    nl: 'Dit staat morgen op je naam te vervallen:',
    en: 'This is due in your name tomorrow:',
  },
  'mail.deadline.regel_meer': { nl: 'Deze taken vervallen morgen:', en: 'These tasks are due tomorrow:' },
  'mail.telaat.onderwerp_een': { nl: '1 taak staat te laat', en: '1 task is overdue' },
  'mail.telaat.onderwerp_meer': { nl: '{aantal} taken staan te laat', en: '{aantal} tasks are overdue' },
  'mail.telaat.regel': { nl: 'Dit staat op jouw naam over tijd:', en: 'This is overdue in your name:' },

  // ── De onderdelen die in elke mail terugkomen ───────────────────────────
  'mail.klant': { nl: 'Klant: {naam}', en: 'Customer: {naam}' },
  'mail.bord': { nl: 'Bord: {naam}', en: 'Board: {naam}' },
  'mail.openen': { nl: 'Openen: {link}', en: 'Open: {link}' },
  'mail.antwoorden': { nl: 'Antwoorden: {link}', en: 'Reply: {link}' },
  'mail.voet': {
    nl: 'Deze berichten zet je per soort aan of uit bij Meldingen in de app.',
    en: 'You turn these messages on or off per type under Notifications in the app.',
  },
  'mail.geen_titel': { nl: 'Taak zonder titel', en: 'Untitled task' },
  'mail.een_taak': { nl: 'een taak', en: 'a task' },
  'mail.iemand': { nl: 'Iemand', en: 'Someone' },
  'mail.telaat_een': { nl: '{aantal} dag te laat', en: '{aantal} day overdue' },
  'mail.telaat_meer': { nl: '{aantal} dagen te laat', en: '{aantal} days overdue' },
}

export const STANDAARDTAAL = 'nl'

/** De taal van een profiel, met de taal van de zaak als terugval. */
export const taalVan = (profiel) => (TEKSTEN['mail.voet'][profiel?.prefs?.taal] ? profiel.prefs.taal : STANDAARDTAAL)

/**
 * Een tekst opzoeken. Dezelfde regels als `vertaal` in de app: `{naam}` wordt
 * ingevuld, `aantal` kiest tussen `_een` en `_meer`, en een ontbrekende Engelse
 * tekst wordt de Nederlandse in plaats van de sleutel.
 */
export function zeg(taal, sleutel, waarden = null) {
  let echte = sleutel
  if (waarden && typeof waarden.aantal === 'number') {
    const vorm = `${sleutel}${waarden.aantal === 1 ? '_een' : '_meer'}`
    if (TEKSTEN[vorm]) echte = vorm
  }

  const regel = TEKSTEN[echte]
  const tekst = regel?.[taal] ?? regel?.[STANDAARDTAAL] ?? echte
  if (!waarden) return tekst

  return tekst.replace(/\{(\w+)\}/g, (heel, naam) =>
    waarden[naam] === undefined || waarden[naam] === null ? heel : String(waarden[naam])
  )
}

/** Welke sleutels nog geen Engelse tekst hebben — voor de test die daarop let. */
export const ontbrekendeVertalingen = (taal = 'en') => Object.keys(TEKSTEN).filter((s) => !TEKSTEN[s][taal])
