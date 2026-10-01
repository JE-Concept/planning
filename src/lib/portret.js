/**
 * Het portret bij een persoon.
 *
 * De avatars komen uit de e-mailhandtekeningen (zie scripts/avatars.mjs) en
 * staan als bestand in de app. Ze staan niet op het profiel in de databank:
 * dat zou betekenen dat iemand de live profielen moet bijwerken om een foto te
 * zien, en dat een nieuwe collega pas een gezicht krijgt nadat er iemand een
 * veld invult.
 *
 * Dit is dus een terugval, geen bron: wie wél een `avatarUrl` op zijn profiel
 * heeft staan, houdt die. Wie er geen heeft maar hier herkend wordt, krijgt
 * zijn foto. Wie nergens past, houdt zijn initialen.
 *
 * ── Waarom op de voornaam en niet op het volledige adres ──────────────────
 * Dat stond er eerst, met een vaste lijst adressen, en het werkte precies voor
 * de adressen die ik gegokt had. Elke werkt onder twee domeinen, Maxine had nog
 * geen profiel, en een adres als `elke.motmans@` zou er helemaal naast vallen —
 * terwijl het dezelfde persoon is.
 *
 * Nu: het eerste stuk van het adres binnen onze eigen domeinen, en anders de
 * voornaam. Bij een ploeg van zes is dat eenduidig. Komt er ooit een tweede
 * Elke, dan zet die haar eigen foto op haar profiel en wint die — zoals elke
 * eigen foto hier wint.
 */
const PORTRETTEN = {
  jasper: '/team/jasper.jpg',
  elke: '/team/elke.jpg',
  maxine: '/team/maxine.jpg',
}

/** Onze eigen adressen. Een gmail-adres van een flexi zegt niets over wie het is. */
const EIGEN_DOMEINEN = ['jeconcept.be', 'kenjeklanten.be']

const schoon = (v) => String(v ?? '').trim().toLowerCase()

/** Het portret bij een e-mailadres, of niets. */
export function portretVan(email) {
  const adres = schoon(email)
  if (!adres.includes('@')) return null

  const [lokaal, domein] = adres.split('@')
  if (!EIGEN_DOMEINEN.includes(domein)) return null

  // `elke+test@`, `elke.motmans@` en `elke@` zijn alledrie Elke.
  const voornaam = lokaal.split(/[+._-]/)[0]
  return PORTRETTEN[voornaam] ?? null
}

/**
 * Het portret bij een heel profiel: eerst het adres, dan de naam.
 *
 * De naam erbij omdat een profiel niet altijd op een adres van ons staat —
 * iemand die met een privéadres aangemeld is, heet nog altijd "Elke Motmans".
 */
export function portretVoor(profile) {
  const viaAdres = portretVan(profile?.email)
  if (viaAdres) return viaAdres

  const voornaam = schoon(profile?.fullName).split(/\s+/)[0]
  return PORTRETTEN[voornaam] ?? null
}
