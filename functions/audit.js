/**
 * Het logboek: wie heeft wat veranderd, in de hele tool.
 *
 * ── Waarom dit aan de serverkant staat ────────────────────────────────────
 * Er is al een activiteitslog per taak, en dat schrijft de app zelf. Dat is
 * prima voor "wie heeft deze taak verzet?", maar het is geen logboek waar je
 * iets mee kunt aantonen: wie de app omzeilt schrijft er niets in, en wie een
 * regel wil laten verdwijnen, laat ze verdwijnen. Een logboek dat de schrijver
 * zelf mag overslaan, bewijst niets.
 *
 * Deze triggers draaien na de schrijfbeurt, met beheerdersrechten, buiten de
 * browser om. Ze zien elke wijziging — ook die van een regel uit de
 * regelengine, van een script, of van iemand met de database open.
 *
 * ── Wat er gelogd wordt, en wat niet ──────────────────────────────────────
 * Per collectie een korte lijst velden. Bewust kort: een logboek dat alles
 * registreert leest niemand meer, en dan valt ook de regel weg die ertoe deed.
 * Wat erin hoort is wat je achteraf wil kunnen navragen — een bedrag dat
 * veranderde, een rol die iemand kreeg, een event dat weg is.
 *
 * Het afvinken van de dagelijkse lijsten staat er met opzet niet in: dat zijn
 * honderden regels per dag en er is al een eigen rapportage voor (Registraties).
 *
 * ── Wie het gedaan heeft ──────────────────────────────────────────────────
 * Uit `updatedBy` / `createdBy` op het document zelf, want een trigger weet
 * niet wie er aanmeldde. Bij een verwijdering is dat wie het document als
 * laatste bewerkte en niet per se wie het weggooide — daar is de schrijver niet
 * meer om het te vertellen. Dat staat als `actorZeker: false` in de regel, en
 * het scherm zegt het er dan ook bij. Liever een eerlijke onzekerheid dan een
 * naam die misschien niet klopt.
 */

/** Wat er van elke collectie bijgehouden wordt. */
export const AUDIT = {
  tasks: {
    soort: 'taak',
    naam: (d) => d.title,
    velden: [
      'title',
      'statusName',
      'dueDate',
      'assignees',
      'priority',
      'archived',
      'budget',
      'quoteAmount',
      'customerId',
      'location',
      'pax',
      'socialStage',
      'listId',
    ],
  },
  customers: {
    soort: 'klant',
    naam: (d) => d.name,
    velden: ['name', 'vatNumber', 'email', 'phone', 'address', 'archived'],
  },
  lists: {
    soort: 'lijst',
    naam: (d) => d.name,
    velden: ['name', 'kind', 'archived', 'statuses'],
  },
  profiles: {
    soort: 'profiel',
    naam: (d) => d.fullName || d.email,
    // De rol en de toegang: dit is het eerste waar je naar kijkt wanneer er
    // iets gebeurd is dat niemand gedaan zegt te hebben.
    velden: ['role', 'active', 'email', 'department'],
  },
  formules: {
    soort: 'formule',
    naam: (d) => d.name,
    velden: ['name', 'prijsPerPersoon', 'prijsVast', 'btwPercent', 'archived', 'opties'],
  },
  templates: {
    soort: 'template',
    naam: (d) => d.name,
    velden: ['name', 'archived', 'taken'],
  },
  automations: {
    soort: 'regel',
    naam: (d) => d.name,
    velden: ['name', 'enabled', 'entity', 'trigger', 'conditions', 'actions', 'table'],
  },
  offertes: {
    soort: 'offerte',
    naam: (d) => `${d.nummer ?? ''} ${d.eventNaam ?? ''}`.trim(),
    velden: ['status', 'regels', 'bedragExcl', 'verstuurdOp', 'token'],
  },
  checklists: {
    soort: 'afvinklijst',
    naam: (d) => d.name,
    velden: ['name', 'kind', 'archived', 'sections'],
  },
  shifts: {
    soort: 'dienst',
    naam: (d) => `${d.date ?? ''} ${d.start ?? ''}-${d.end ?? ''}`.trim(),
    velden: ['profileId', 'date', 'start', 'end', 'breakMinutes', 'note'],
  },
  config: {
    soort: 'instelling',
    naam: (_d, id) => id,
    velden: ['allowedDomains', 'kostenplaatsen', 'workspaceName'],
  },
}

/** Velden die nooit in het logboek terechtkomen, ook al staan ze in de lijst. */
const GEHEIM = ['token', 'sleutel', 'apiKey', 'password']

const norm = (waarde) => {
  if (waarde === undefined) return null
  if (waarde && typeof waarde.toDate === 'function') {
    try {
      return waarde.toDate().toISOString()
    } catch {
      return null
    }
  }
  if (waarde instanceof Date) return waarde.toISOString()
  return waarde
}

/**
 * Een waarde klein genoeg om te bewaren.
 *
 * Een lijst met kolommen, een tabel met regels of de secties van een
 * afvinklijst zijn te groot om in het logboek te zetten, en niemand leest ze
 * daar terug. Wat je wil weten is dát ze veranderden en door wie; het verschil
 * zelf staat in het document. Daarom wordt zoiets één woord.
 */
export function kort(waarde) {
  const genormaliseerd = norm(waarde)
  if (genormaliseerd === null || genormaliseerd === '') return null
  if (Array.isArray(genormaliseerd)) {
    if (genormaliseerd.every((v) => typeof v === 'string' || typeof v === 'number')) {
      return genormaliseerd.slice(0, 12).map(String)
    }
    return `${genormaliseerd.length} regels`
  }
  if (typeof genormaliseerd === 'object') return 'aangepast'
  const tekst = String(genormaliseerd)
  return tekst.length > 120 ? `${tekst.slice(0, 119)}…` : tekst
}

/** Welke velden er veranderden, met hun oude en nieuwe waarde. */
export function verschillen(voor, na, velden) {
  const uit = []
  for (const veld of velden) {
    if (GEHEIM.some((g) => veld.toLowerCase().includes(g.toLowerCase()))) continue
    const oud = norm(voor?.[veld])
    const nieuw = norm(na?.[veld])
    if (JSON.stringify(oud) === JSON.stringify(nieuw)) continue
    uit.push({ veld, van: kort(voor?.[veld]), naar: kort(na?.[veld]) })
  }
  return uit
}

/**
 * De regel die in het logboek komt, of niets.
 *
 * Niets wanneer er aan de gevolgde velden niets veranderde. Dat scheelt niet
 * alleen schrijfbeurten: een logboek waarin elke automatische stempel een regel
 * is, is een logboek dat niemand doorleest.
 */
export function regelVan({ collectie, id, voor, na, nu = new Date() }) {
  const opzet = AUDIT[collectie]
  if (!opzet) return null

  const bestondEerst = Boolean(voor)
  const bestaatNu = Boolean(na)
  if (!bestondEerst && !bestaatNu) return null

  const actie = !bestondEerst ? 'aangemaakt' : !bestaatNu ? 'verwijderd' : 'gewijzigd'
  const bron = na ?? voor

  if (actie === 'gewijzigd') {
    const wijzigingen = verschillen(voor, na, opzet.velden)
    if (wijzigingen.length === 0) return null
    return maak({ opzet, collectie, id, bron, actie, wijzigingen, na, voor, nu })
  }

  return maak({ opzet, collectie, id, bron, actie, wijzigingen: [], na, voor, nu })
}

function maak({ opzet, collectie, id, bron, actie, wijzigingen, na, voor, nu }) {
  // Bij een verwijdering is de schrijver er niet meer om te zeggen wie het
  // deed; dan is dit wie het als laatste bewerkte. Het scherm zegt dat erbij.
  const actorId = (na ?? voor)?.updatedBy ?? (na ?? voor)?.createdBy ?? null

  return {
    at: nu,
    collectie,
    soort: opzet.soort,
    documentId: id,
    naam: (opzet.naam?.(bron ?? {}, id) ?? '').toString().slice(0, 140) || null,
    actie,
    wijzigingen,
    actorId,
    actorZeker: actie !== 'verwijderd' && Boolean(actorId),
  }
}

/** Hoe lang het logboek bewaard blijft. */
export const BEWAARMAANDEN = 24

export function teOud(regel, nu = new Date()) {
  const grens = new Date(nu)
  grens.setMonth(grens.getMonth() - BEWAARMAANDEN)
  const at = regel?.at?.toDate ? regel.at.toDate() : new Date(regel?.at)
  return !Number.isNaN(at?.getTime?.()) && at < grens
}
