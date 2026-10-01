/**
 * Waar je tijd op kunt boeken.
 *
 * Tijd hoort op een event of op een taak — dat is de afspraak sinds de
 * factureerbaar-vink eruit ging. In de gegevens is een event óók een taak (de
 * bovenste van de eventlijst), dus staan ze hier in één lijst: eerst het event,
 * daaronder het werk dat eraan hangt. Zo kies je "Trouw Niels en Inez" of
 * "Drankenlijst finaliseren" uit dezelfde lijst, en hoef je niet eerst te weten
 * in welke van de twee soorten jouw werk zit.
 *
 * Dit staat los van de schermen zodat het na te rekenen is, en zodat de
 * zijbalk en het urenscherm gegarandeerd dezelfde lijst tonen.
 */

/** Hoeveel regels er hooguit in de lijst komen; wie meer nodig heeft, zoekt. */
export const MAX_KEUZES = 60

const open = (taak) => taak?.open !== false

/**
 * De keuzes, gefilterd op wat er getypt is.
 *
 * `behoud` is de id die er sowieso bij moet, ook als die taak intussen
 * afgevinkt is: anders wist het aanpassen van een oude boeking stilletjes haar
 * taak. Zoeken kijkt naar de titel én naar waar het onder hangt, want "Niels"
 * is hoe je een taak van dat event terugvindt.
 */
export function werkKeuzes({ events = [], tasks = [], zoek = '', behoud = null, max = MAX_KEUZES } = {}) {
  const eventById = Object.fromEntries(events.map((e) => [e.id, e]))

  const regels = []
  for (const ev of events) {
    if (open(ev) || ev.id === behoud) {
      regels.push({ id: ev.id, titel: ev.name ?? ev.title, sub: ev.concept ?? null, soort: 'event' })
    }
  }
  for (const taak of tasks) {
    if (!open(taak) && taak.id !== behoud) continue
    regels.push({
      id: taak.id,
      titel: taak.title,
      sub: eventById[taak.parentId]?.name ?? taak.listName ?? null,
      soort: 'taak',
    })
  }

  const naald = zoek.trim().toLowerCase()
  const gevonden = naald
    ? regels.filter((r) => `${r.titel} ${r.sub ?? ''}`.toLowerCase().includes(naald))
    : regels

  // Wat behouden moet blijven mag nooit buiten de afkapping vallen: dan zou de
  // keuzelijst een waarde tonen die er niet in staat.
  const vast = behoud ? gevonden.filter((r) => r.id === behoud) : []
  const rest = gevonden.filter((r) => r.id !== behoud)
  return [...vast, ...rest].slice(0, max)
}

/** Het echte event of de echte taak achter een gekozen id. */
export function werkVan(id, { events = [], tasks = [] } = {}) {
  if (!id) return null
  return events.find((e) => e.id === id) ?? tasks.find((t) => t.id === id) ?? null
}
