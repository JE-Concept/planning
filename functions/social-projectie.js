/**
 * Wat een socialmedewerker van een event te zien krijgt.
 *
 * ── Waarom er een kopie van het event bestaat ─────────────────────────────
 * De rol "social" werkt alleen in de socials, en hoort daar geen prijzen,
 * offertebedragen of budgetten te zien. Firestore kan geen velden verbergen:
 * wie een document mag lezen, leest het hele document. "Het staat niet op het
 * scherm" is dus geen afscherming — de gegevens staan gewoon in het antwoord
 * van de database, en een tabblad met de ontwikkelaarsconsole open toont ze.
 *
 * Daarom staat hier een tweede, kale versie van elk event dat content moet
 * opleveren: naam, datum, locatie, klant, stand. Geen bedragen, niet één. De
 * socialrol leest die collectie en `tasks` helemaal niet, en dan is "ze ziet
 * geen prijzen" een eigenschap van de database in plaats van een belofte van
 * de interface.
 *
 * ── Waarom een trigger en geen query ──────────────────────────────────────
 * De kopie moet volgen zodra iemand een event hernoemt of verzet, ook wanneer
 * er niemand met de socialrol aangemeld is. Dat kan alleen aan de serverkant.
 *
 * Wat hier gekopieerd wordt, staat in één lijst hieronder. Komt er ooit een
 * veld bij op een event dat gevoelig is, dan hoeft er niets te gebeuren: alles
 * wat niet in die lijst staat, gaat niet mee.
 */

/**
 * De velden die mee mogen. Met opzet een witte lijst en geen zwarte: vergeet je
 * bij een zwarte lijst één nieuw veld, dan lekt het. Vergeet je er hier één,
 * dan mist er iets op het scherm en zegt iemand dat.
 */
export const VELDEN = [
  'title',
  'listId',
  'listName',
  'statusName',
  'statusKind',
  'socialStage',
  'socialWanted',
  'dueDate',
  'eventDate',
  'date',
  'location',
  'locationPlaceId',
  'locationLat',
  'locationLng',
  'customerName',
  'brandId',
  'assignees',
  'tags',
  'position',
  'archived',
  'parentId',
]

/*
  Dezelfde regel als op het scherm (`src/lib/social-stage.js`), en bewust een
  tweede keer opgeschreven: `functions/` wordt apart verpakt en uitgerold en kan
  niets uit `src/` importeren. Verandert de regel, dan moet het op beide
  plaatsen — daarom staat het hier met dezelfde woorden.
*/
export const SOCIAL_VANAF = ['ready to invoice', 'invoiced', 'complete']

const norm = (v) => (v ?? '').toString().trim().toLowerCase()

export function heeftSocial(taak) {
  if (!taak) return false
  if (taak.socialWanted === false) return false
  return Boolean(taak.socialStage) || taak.socialWanted === true || SOCIAL_VANAF.includes(norm(taak.statusName))
}

/** De kale versie van een event. Alleen wat in `VELDEN` staat. */
export function kopieVan(taak) {
  const uit = {}
  for (const veld of VELDEN) if (taak[veld] !== undefined) uit[veld] = taak[veld]
  return uit
}

/**
 * Of deze kopie bijgewerkt moet worden.
 *
 * Een event wordt bij elke wijziging geschreven — een uur geboekt, een taak
 * afgevinkt, een bedrag aangepast. Alleen wanneer er iets verandert aan wat in
 * de kopie staat, hoeft die kopie mee. Scheelt schrijfbeurten, en houdt het
 * logboek leesbaar.
 */
export function moetBijwerken(voor, na) {
  if (!voor) return true
  return VELDEN.some((veld) => JSON.stringify(voor[veld] ?? null) !== JSON.stringify(na[veld] ?? null))
}
