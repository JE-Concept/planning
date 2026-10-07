/**
 * Van het geheim IMAP_URL naar de instellingen die ImapFlow verwacht.
 *
 * ── Waarom dit nodig is ───────────────────────────────────────────────────
 * ImapFlow kent geen optie `url`. Met `new ImapFlow({ url })` negeert het die
 * stil en verbindt het met de standaard: localhost, poort 143. Zo faalde de
 * ophaler op 7 oktober elke vijf minuten met ECONNREFUSED 127.0.0.1:143, terwijl
 * het geheim zelf in orde was. Dus zetten we het hier om naar host, poort,
 * secure en login, en weigeren we luid wat geen IMAP-adres is.
 *
 * Het geheim blijft wat het was, zoals de handover het zet:
 *   imaps://plan%40jeconcept.be:<app-wachtwoord>@imap.gmail.com:993
 * Gebruikersnaam en wachtwoord zijn URL-gecodeerd; spaties in een
 * app-wachtwoord van Google gaan eruit, want Google zet ze er alleen voor de
 * leesbaarheid in.
 */
export function imapInstellingen(url) {
  let adres
  try {
    adres = new URL(String(url).trim())
  } catch {
    throw new Error('IMAP_URL is geen geldig adres')
  }
  const soort = adres.protocol.replace(':', '')
  if (soort !== 'imaps' && soort !== 'imap') {
    throw new Error(`IMAP_URL moet met imaps:// of imap:// beginnen, niet met ${soort}://`)
  }
  if (!adres.hostname || !adres.username || !adres.password) {
    throw new Error('IMAP_URL mist de server, de gebruikersnaam of het wachtwoord')
  }
  const secure = soort === 'imaps'
  return {
    host: adres.hostname,
    port: adres.port ? Number(adres.port) : secure ? 993 : 143,
    secure,
    auth: {
      user: decodeURIComponent(adres.username),
      pass: decodeURIComponent(adres.password).replace(/\s+/g, ''),
    },
  }
}
