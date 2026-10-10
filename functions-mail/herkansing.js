/**
 * Wanneer een mail uit de wachtrij nog een keer mag, en wanneer niet meer.
 *
 * ── Waarom er herkanst wordt ──────────────────────────────────────────────
 * De verzender stuurt een rij één keer, op het moment dat ze aangemaakt
 * wordt. Lukte dat niet — een geweigerde aanmelding, een server die even
 * niet antwoordt — dan bleef de rij voor altijd op "mislukt" staan. En een rij
 * die aangemaakt werd terwijl de verzender niet uitgerold was, kwam nooit
 * meer aan de beurt: de trigger vuurt maar één keer. Zo stonden er begin
 * oktober zeventig rijen klaar en was er nog nooit één mail vertrokken.
 *
 * ── Waarom niet eeuwig ────────────────────────────────────────────────────
 * Een melding "er is op je taak gereageerd" van vorige week is geen dienst
 * meer maar ruis, en een bevestiging aan een klant die drie dagen te laat
 * komt, wekt meer vragen dan ze beantwoordt. Daarom: hooguit een etmaal oud,
 * hooguit drie pogingen. Wat ouder is krijgt de stand "verlopen" — niet
 * gewist, zodat te zien blijft wat er niet vertrok.
 *
 * Nul imports, zodat `tests/mail-herkansing.test.js` het in CI kan draaien.
 */

export const MAX_POGINGEN = 3
export const MAX_LEEFTIJD_MS = 24 * 60 * 60 * 1000

const tijd = (v) => {
  if (!v) return null
  if (typeof v.toDate === 'function') return v.toDate().getTime()
  if (typeof v.toMillis === 'function') return v.toMillis()
  const t = new Date(v).getTime()
  return Number.isNaN(t) ? null : t
}

/**
 * Wat er met één rij moet gebeuren: `'versturen'`, `'verlopen'` of `null`
 * (niets — al verstuurd, of de pogingen zijn op).
 *
 * Een rij zonder aanmaakdatum wordt als verlopen behandeld: zonder datum is
 * niet te zeggen of ze nog actueel is, en dan is niet sturen de veilige kant.
 */
export function herkansing(rij, nu = Date.now()) {
  if (!rij?.aan) return null
  if (rij.status !== 'wachtend' && rij.status !== 'mislukt') return null
  const aangemaakt = tijd(rij.createdAt)
  if (aangemaakt == null || nu - aangemaakt > MAX_LEEFTIJD_MS) return 'verlopen'
  if (rij.status === 'mislukt' && (rij.pogingen ?? 0) >= MAX_POGINGEN) return null
  return 'versturen'
}

/**
 * Weigert de mailserver de aanmelding zelf?
 *
 * Dat is geen fout van één mail maar van de instelling: elke volgende mail
 * faalt op dezelfde manier. Gmail antwoordt met 534 ("Application-specific
 * password required") of 535 (verkeerde gegevens); nodemailer zet er de code
 * `EAUTH` op.
 */
export function isAanmeldfout(err) {
  if (!err) return false
  if (err.code === 'EAUTH') return true
  if (err.responseCode === 534 || err.responseCode === 535) return true
  return /\b53[45]\b|application-specific password|username and password not accepted/i.test(
    String(err.message ?? err)
  )
}

/** De uitleg die in de log en op de rij komt — zonder het wachtwoord, want dat staat nooit in een fout. */
export function redenVan(err) {
  if (isAanmeldfout(err)) {
    return (
      'De mailserver weigert de aanmelding. Bij Gmail vraagt dat een app-wachtwoord: ' +
      'maak er een aan voor plan@jeconcept.be en zet SMTP_URL opnieuw ' +
      '(smtps://plan%40jeconcept.be:<app-wachtwoord>@smtp.gmail.com:465).'
    )
  }
  return String(err?.message ?? err).slice(0, 300)
}
