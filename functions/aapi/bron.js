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

/*
  Of een mailbijlage voor ons bedoeld is, wordt níét hier beslist maar in
  `functions-mail/planning-herkennen.js`. Die codebase ziet de bijlage als
  eerste en kan deze niet importeren; één herkenner op twee plaatsen zou
  betekenen dat ze uit elkaar lopen. Wat hier gebeurt is het échte antwoord:
  staat het blad "Data" erin met de kolommen die nodig zijn? Zo niet, dan geeft
  de parser een fout en heet de bijlage "geen planning".
*/
