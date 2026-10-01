/**
 * Het portret bij een e-mailadres.
 *
 * De avatars komen uit de e-mailhandtekeningen (zie scripts/avatars.mjs) en
 * staan als bestand in de app. Ze staan niet op het profiel in de databank:
 * dat zou betekenen dat iemand de live profielen moet bijwerken om een foto te
 * zien, en dat een nieuwe collega pas een gezicht krijgt nadat er iemand een
 * veld invult.
 *
 * Dit is dus een terugval, geen bron: wie wél een `avatarUrl` op zijn profiel
 * heeft staan, houdt die. Wie er geen heeft maar hier staat, krijgt zijn foto.
 * Wie nergens staat, houdt zijn initialen.
 *
 * Per persoon staan alle adressen waarop ze kunnen inloggen: Elke werkt onder
 * twee domeinen, en een profiel op het verkeerde adres mag niet stilletijd
 * zonder gezicht vallen.
 */
const PORTRETTEN = {
  'jasper@jeconcept.be': '/team/jasper.jpg',
  'elke@jeconcept.be': '/team/elke.jpg',
  'elke@kenjeklanten.be': '/team/elke.jpg',
  'maxine@jeconcept.be': '/team/maxine.jpg',
}

export function portretVan(email) {
  return PORTRETTEN[String(email ?? '').trim().toLowerCase()] ?? null
}
