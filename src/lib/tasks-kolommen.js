/**
 * De kolommen van het Tasks-bord, en de weg van de oude namen naar de nieuwe.
 *
 * Het bord met de losse taken en de verslagen van het overleg kwam mee uit
 * ClickUp, en droeg daar de namen van een ander werkproces: "Opgenomen",
 * "Samengevat", "Nagelezen". Dat gaat over een verslag dat uitgetypt wordt, niet
 * over werk dat te doen is — en het is werk dat er nu op staat. De kolommen
 * heten daarom "open", "on going" en "closed", net als op een vers bord.
 *
 * De seed maakt een bord alleen aan als het nog niet bestaat, dus die verandert
 * niets aan het bord dat live staat. Het hernoemen is daarom een migratie, en
 * het rekenwerk ervan staat hier: welke kolom wordt wat, welke id krijgt ze, en
 * wat er níét aangeraakt wordt. Dat laatste is het belangrijkste — een kolom
 * die dit bestand niet kent blijft staan zoals ze is, met haar taken erin.
 */

/** De id die de seed aan een kolom geeft, zodat live en nieuw hetzelfde zijn. */
export const kolomId = (naam) => `seed-${naam.replace(/[^a-z]+/gi, '-')}`

export const TASKS_LIJST_ID = 'overleg'

export const TASKS_KOLOMMEN = [
  { name: 'open', color: '#8593a9', kind: 'open' },
  { name: 'on going', color: '#3377ff', kind: 'active' },
  { name: 'closed', color: '#008844', kind: 'closed' },
]

const VORM = Object.fromEntries(TASKS_KOLOMMEN.map((k) => [k.name, k]))

/**
 * Welke oude naam op welke nieuwe kolom uitkomt.
 *
 * De nieuwe namen staan er zelf ook in. Dat is geen franje: draait deze
 * migratie een tweede keer, of heeft iemand een kolom al met de hand hernoemd,
 * dan moet ze diezelfde kolom herkennen in plaats van er nog een aan te maken.
 */
const NAAR_NIEUW = {
  opgenomen: 'open',
  samengevat: 'on going',
  nagelezen: 'closed',
  open: 'open',
  'on going': 'on going',
  ongoing: 'on going',
  closed: 'closed',
}

const sleutel = (naam) =>
  (naam ?? '')
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, ' ')

/**
 * Wat er met elke kolom van dit bord gebeurt.
 *
 * Geeft de nieuwe kolommenlijst terug plus een regel per kolom, zodat de
 * uitrol kan loggen wát er gebeurde en niet alleen dát er iets gebeurde. De
 * volgorde en de posities blijven zoals ze stonden: het bord verspringt niet
 * onder de handen van wie het gewend is.
 *
 * `verplaatsing` staat er alleen bij als de id verandert. Dan — en alleen dan —
 * moeten de taken van die kolom mee, want een taak draagt een kopie van haar
 * kolom bij zich.
 */
export function planHernoeming(statuses = []) {
  const bezet = new Set()
  const regels = []

  const nieuw = statuses.map((status) => {
    const doel = NAAR_NIEUW[sleutel(status.name)]

    if (!doel) {
      regels.push({ vanId: status.id, vanNaam: status.name, actie: 'ongemoeid' })
      return status
    }

    // Twee kolommen die op dezelfde nieuwe kolom uitkomen zouden dezelfde id
    // krijgen en elkaars taken opslokken. De tweede blijft dus staan zoals ze
    // is; samenvoegen is een beslissing, geen migratie.
    if (bezet.has(doel)) {
      regels.push({ vanId: status.id, vanNaam: status.name, actie: 'dubbel', doel })
      return status
    }
    bezet.add(doel)

    const vorm = VORM[doel]
    const naarId = kolomId(doel)
    const gelijk =
      status.id === naarId && status.name === vorm.name && status.kind === vorm.kind && status.color === vorm.color

    regels.push({
      vanId: status.id,
      vanNaam: status.name,
      naarId,
      naarNaam: vorm.name,
      actie: gelijk ? 'al goed' : 'hernoemd',
      verplaatsing: status.id !== naarId ? { van: status.id, naar: naarId } : null,
    })

    return { ...status, id: naarId, name: vorm.name, color: vorm.color, kind: vorm.kind }
  })

  return { statuses: nieuw, regels, gewijzigd: regels.some((r) => r.actie === 'hernoemd') }
}

/**
 * De velden die een taak van haar kolom meedraagt.
 *
 * Een taak bewaart naam, kleur en soort van haar kolom omdat een bord anders
 * per kaart het lijstdocument zou moeten ophalen. Verhuist ze, dan moeten die
 * kopieën mee — inclusief `open`, want daar hangt aan of ze nog op iemands
 * lijstje staat.
 */
export function taakVelden(naam) {
  const vorm = VORM[naam]
  if (!vorm) throw new Error(`Onbekende kolom: ${naam}`)
  return {
    statusId: kolomId(vorm.name),
    statusName: vorm.name,
    statusColor: vorm.color,
    statusKind: vorm.kind,
    open: vorm.kind !== 'done' && vorm.kind !== 'closed',
  }
}
