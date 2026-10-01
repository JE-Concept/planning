/**
 * Waar de planning vandaan komt.
 *
 * Vandaag uit een xlsx die iemand uploadt of doormailt; morgen uit de API van
 * AAPI, zodra daar een sleutel voor is. Die twee verschillen in precies één
 * ding: hoe je aan de rijen komt. Al de rest — valideren, normaliseren,
 * upserten, matchen, rapporteren — is er hetzelfde aan.
 *
 * Vandaar deze dunne laag. Niet omdat een interface met één implementatie
 * mooi staat, maar omdat de plek waar de tweede komt dan al vastligt en
 * niemand er later een tweede importpad naast bouwt.
 *
 * Er staat met opzet géén `ApiSource` die doet alsof. Een stub die een lege
 * lijst teruggeeft, ziet er in een test uit als "werkt" en in productie als
 * "er staat niemand ingepland".
 */
import { leesXlsx } from './xlsx.js'

/**
 * Een bron levert rijen, en zegt waar ze vandaan komen.
 *
 *   naam()   → voor in het rapport: `xlsx-upload`, `xlsx-mail`, `api`
 *   rijen()  → de platte rijen van het blad, kop incluis
 */

/** De bron van vandaag: een xlsx-bestand als buffer. */
export class XlsxBron {
  constructor(buffer, { naam = 'xlsx-upload', bestandsnaam = null, blad = 'Data' } = {}) {
    this.buffer = buffer
    this.soort = naam
    this.bestandsnaam = bestandsnaam
    this.blad = blad
  }

  naam() {
    return this.soort
  }

  async rijen() {
    return leesXlsx(this.buffer, this.blad)
  }
}

/** Herkent of een bijlage voor ons bedoeld is; zie fase 2 (de mailophaler). */
export function lijktOpPlanning(bestandsnaam, contentType) {
  const naam = String(bestandsnaam ?? '').toLowerCase()
  const type = String(contentType ?? '').toLowerCase()
  return naam.endsWith('.xlsx') || type.includes('spreadsheetml')
}
