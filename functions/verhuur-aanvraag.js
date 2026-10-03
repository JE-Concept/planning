/**
 * Wat er uit het offerteformulier binnenkomt, uitgepakt en nagekeken.
 *
 * Nul imports, zodat CI dit kan testen zonder een Cloud Functions-omgeving —
 * dezelfde afspraak als bij `verhuur-aanbod.js` en `archief-stand.js`.
 *
 * ── Waarom afkappen en niet weigeren ─────────────────────────────────────
 * Een aanvraag met een te lang verhaal erin is geen aanval maar een
 * enthousiaste klant. Die een foutmelding geven kost een opdracht. Dus kappen
 * we af op een lengte waar geen echt antwoord tegenaan loopt, en weigeren we
 * alleen wat we werkelijk niet kunnen gebruiken: een aanvraag zonder
 * e-mailadres, want dan kunnen we niet terug.
 */

const MAXIMA = {
  naam: 120,
  email: 160,
  telefoon: 40,
  datum: 10,
  wat: 4000,
}

const tekst = (waarde, max) => String(waarde ?? '').trim().slice(0, max)

export const isEmail = (waarde) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(waarde ?? '').trim())

export function leesAanvraag(body) {
  const email = tekst(body?.email, MAXIMA.email)
  if (!isEmail(email)) return { fout: 'geen_email' }

  const wat = tekst(body?.wat, MAXIMA.wat)
  if (wat.length < 3) return { fout: 'geen_vraag' }

  const datum = tekst(body?.datum, MAXIMA.datum)
  const gasten = Math.max(0, Math.round(Number(body?.gasten) || 0))

  return {
    // Een verborgen veld dat een mens niet ziet en dus niet invult.
    lokvink: String(body?.bedrijfsnaam ?? '').trim() !== '',
    velden: {
      naam: tekst(body?.naam, MAXIMA.naam),
      email,
      telefoon: tekst(body?.telefoon, MAXIMA.telefoon),
      // Leeg blijft leeg: "geen datum gekozen" is iets anders dan 1 januari.
      datum: /^\d{4}-\d{2}-\d{2}$/.test(datum) ? datum : null,
      gasten: gasten > 0 ? gasten : null,
      wat,
    },
  }
}
