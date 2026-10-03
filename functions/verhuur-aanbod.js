/**
 * Wat de verhuursite van het magazijn te zien krijgt — en wat niet.
 *
 * ── Waarom dit een eigen bestand is zonder één import ─────────────────────
 * Omdat het de enige plek is waar bepaald wordt welke velden het pand
 * verlaten, en dat wil je kunnen testen zonder een Cloud Functions-omgeving
 * op te tuigen. CI draait alleen `npm ci` in de wortel; een bestand dat
 * `firebase-admin` binnenhaalt, is daar niet te testen. Dus: nul imports,
 * zuivere functies, en een test die ernaast ligt.
 *
 * ── De regel: een witte lijst, geen zwarte ────────────────────────────────
 * Hieronder staat wát er meegaat, niet wat er weg moet. Dat is met opzet de
 * omgekeerde kant op van wat vanzelf gaat. Een zwarte lijst is één veld
 * achter: zet iemand volgende maand `marge` of `laatsteInkoopprijs` op een
 * artikel, dan staat dat de dag erna op een openbare pagina en merkt niemand
 * het. Met een witte lijst verschijnt een nieuw veld gewoon niet, tot iemand
 * er bewust over nadenkt.
 *
 * Wat hier dus nooit bij komt: `inkoopwaarde`, `leverancier`, `vervangwaarde`,
 * `createdBy`. Het eerste is wat wij betaalden, het tweede is bij wie — en
 * allebei horen ze bij de inkoop, niet bij de klant die het huurt.
 */

/** De velden die een bezoeker van een artikel te zien krijgt. */
export const PUBLIEKE_VELDEN = [
  'naam',
  'omschrijving',
  'categorie',
  'prijsPerDag',
  'prijsWeekend',
  'prijsWeek',
  'waarborg',
  'minDagen',
  'gerelateerd',
  // Een download-URL uit Storage (vraag 9). Geen pad: de site heeft geen
  // Storage-SDK en hoort die ook niet te krijgen.
  'foto',
]

/** Wat er nooit mee naar buiten mag. Alleen om het in een test te kunnen zeggen. */
export const INTERNE_VELDEN = ['inkoopwaarde', 'leverancier', 'vervangwaarde', 'createdBy', 'position']

const getal = (waarde) => {
  if (waarde === null || waarde === undefined || waarde === '') return null
  const n = Number(waarde)
  return Number.isFinite(n) ? n : null
}

/**
 * Eén artikel, klaar om op een openbare pagina te staan.
 *
 * `aantal` gaat wél mee, maar als `voorraad` en niet als bedrijfsgeheim: een
 * bezoeker die wil weten of er zes statafels zijn, komt daar met twee
 * zoekopdrachten toch achter, en zonder dat getal kan de site niet zeggen
 * "nog drie beschikbaar". Wat we niet meesturen is wie ze leverde en wat ze
 * kostten.
 */
export function publiekArtikel(materiaal) {
  const uit = { id: materiaal.id }
  for (const veld of PUBLIEKE_VELDEN) {
    if (materiaal[veld] !== undefined) uit[veld] = materiaal[veld]
  }
  uit.voorraad = Math.max(0, Math.round(getal(materiaal.aantal) ?? 0))
  // De uitlooptijd is geen prijs maar wel een belofte: ze bepaalt wanneer een
  // stuk opnieuw kan. De site heeft ze nodig om een datum te durven aanbieden.
  uit.uitloopDagen = Math.max(0, Math.round(getal(materiaal.uitloopDagen) ?? 0))
  return uit
}

/**
 * Mag dit artikel op de verhuursite staan?
 *
 * Dezelfde drie voorwaarden als bij het afrekenen, en met opzet hier herhaald
 * in plaats van ergens gedeeld: wat je tóónt en wat je verkóópt moeten
 * hetzelfde antwoord geven, en als die twee ooit uit elkaar lopen, is een
 * artikel dat je wel ziet maar niet kunt huren de vriendelijkste van de twee
 * fouten. `tests/verhuur-aanbod.test.js` houdt ze gelijk.
 */
export const hoortInDeCatalogus = (materiaal) =>
  materiaal?.archived !== true
  && materiaal?.directTeHuren === true
  && getal(materiaal?.prijsPerDag) != null

/**
 * De catalogus, op categorie en dan op naam.
 *
 * Gesorteerd op de server en niet in de browser, want de volgorde van een
 * catalogus is een redactionele keuze en geen toeval — en twee bezoekers
 * horen dezelfde pagina te zien.
 */
export function catalogusVan(materialen = []) {
  return materialen
    .filter(hoortInDeCatalogus)
    .map(publiekArtikel)
    .sort(
      (a, b) =>
        (a.categorie ?? '').localeCompare(b.categorie ?? '')
        || (a.naam ?? '').localeCompare(b.naam ?? '')
    )
}

/** Alle categorieën die werkelijk iets bevatten, op alfabet. */
export const categorieenVan = (catalogus = []) =>
  [...new Set(catalogus.map((m) => m.categorie).filter(Boolean))].sort((a, b) => a.localeCompare(b))

/**
 * Wat er per artikel vrij is in een periode — het minimum over de dagen.
 *
 * Niet het gemiddelde en niet de eerste dag. Een tent die vier van de vijf
 * dagen vrij is, is niet vrij, en een site die dat anders rekent verkoopt een
 * gat in de week.
 *
 * `bezetPerDag` komt binnen als een gewone kaart van dagsleutel naar aantal,
 * zodat deze functie niets van Firestore hoeft te weten.
 */
export function vrijInPeriode(artikel, dagen = [], bezetPerDag = new Map()) {
  const voorraad = Math.max(0, Math.round(getal(artikel?.voorraad ?? artikel?.aantal) ?? 0))
  if (dagen.length === 0) return voorraad

  let vrij = voorraad
  for (const dag of dagen) vrij = Math.min(vrij, voorraad - (bezetPerDag.get(dag) ?? 0))
  return Math.max(0, vrij)
}

/**
 * Het antwoord op "wat kan er van 12 tot 14 maart".
 *
 * Per artikel een getal en niet een ja of nee, want de site moet "nog drie
 * beschikbaar" kunnen zeggen. Een artikel dat helemaal vol zit blijft in de
 * lijst staan met nul: verdwijnen zou de bezoeker laten denken dat we het niet
 * hebben, en dan belt hij niet eens.
 */
export function beschikbaarheidVan(catalogus = [], dagen = [], bezetPerArtikel = new Map()) {
  return catalogus.map((artikel) => ({
    id: artikel.id,
    vrij: vrijInPeriode(artikel, dagen, bezetPerArtikel.get(artikel.id) ?? new Map()),
    voorraad: artikel.voorraad ?? 0,
  }))
}
