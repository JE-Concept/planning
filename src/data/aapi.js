/**
 * De koppeling met Aapi, de planningstool waar het personeel in staat.
 *
 * Dit bestand is met opzet leeg gelaten. Er is geen documentatie, geen adres en
 * geen sleutel van Aapi bekend, en een koppeling die op gokwerk gebouwd is, is
 * erger dan geen koppeling: ze lijkt te werken tot het moment dat er een dienst
 * verdwijnt en niemand weet aan welke kant.
 *
 * Het rooster in JE Plan werkt volledig op zichzelf. Zodra de documentatie er is,
 * hoeft alleen dit bestand ingevuld te worden — de rest van de app praat
 * uitsluitend via deze twee functies met Aapi en kent er verder niets van.
 *
 * Wat er dan nog beslist moet worden, en wat niet uit code volgt:
 *
 *   Wie is de baas. Staat het rooster in Aapi en leest JE Plan mee, of andersom?
 *   Zolang dat niet vastligt, overschrijven twee systemen elkaars wijzigingen en
 *   is de laatste die schreef toevallig de winnaar.
 *
 *   Wie is wie. Een persoon in Aapi en een profiel hier moeten aan elkaar
 *   geknoopt worden. Op naam is dat vragen om fouten zodra er twee Sams zijn;
 *   een id uit Aapi op het profiel bewaren is de veilige weg.
 *
 *   Wat met een dienst die aan één kant weg is. Verwijderen of markeren — en dat
 *   is een vraag voor wie met het rooster werkt, niet voor de code.
 */

/** Of de koppeling ingesteld is. Zolang dit onwaar is, toont de app niets erover. */
export const aapiIngesteld = () => false

/**
 * Haalt de diensten van een week op bij Aapi.
 *
 * Verwachte vorm, zodat de rest van de app nu al klopt: een lijst van
 * `{ externId, profileId, date: 'JJJJ-MM-DD', start: 'HH:MM', end: 'HH:MM', note }`.
 */
export async function haalShiftsOp() {
  throw new Error('De koppeling met Aapi is nog niet ingesteld.')
}

/** Stuurt de diensten van een week naar Aapi. Zelfde vorm als hierboven. */
export async function stuurShifts() {
  throw new Error('De koppeling met Aapi is nog niet ingesteld.')
}
