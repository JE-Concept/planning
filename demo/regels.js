/**
 * De beveiligingsregels, nagespeeld voor de demobuild.
 *
 * Waarom dit bestaat: de terugkerende fout in dit project is dat de client iets
 * opvraagt wat `firestore.rules` weigert. Dat komt niet terug als een leeg
 * antwoord maar als een fout, en die strandt een heel scherm. De demo had geen
 * regels, dus de browsertest zei groen over schermen die live op een
 * rechtenfout stuiten — precies het geval dat we niet meer willen.
 *
 * Dit bestand is dus geen tweede waarheid maar een spiegel: elke regel hieronder
 * hoort één op één bij een `match`-blok in `firestore.rules`, en
 * `tests/rollen.test.js` controleert dat ze niet uit elkaar lopen. Verandert er
 * iets aan wie wat mag, dan verandert het daar én hier, of de test valt om.
 *
 * Wat hier bewust níét in zit: de voorwaarden die over de inhoud van één
 * document gaan en die Firestore per document nakijkt (`viewerIds`,
 * `ownerId`). Die horen bij het document en niet bij de rol, en ze nabouwen zou
 * dit bestand een tweede regelmotor maken. Waar het wél over de rol gaat — een
 * vraag die over andermans rijen zou lopen — staat het er wel, want dat is het
 * soort weigering dat een scherm laat stranden.
 */

/** De rolpredicaten uit `firestore.rules`, in dezelfde woorden. */
const isMember = () => true // elke rol in de demo heeft een profiel
const isTeam = (rol) => rol !== 'staff' && rol !== 'social'
const isSocial = (rol) => rol === 'social'
const isBistro = (rol) => rol !== 'social'
const isAdmin = (rol) => rol === 'owner' || rol === 'admin'

/** Heeft de vraag een `where`-filter dat dit veld op deze waarde vastlegt? */
const filtertOp = (filters, veld, waarde) =>
  filters.some((f) => f.field === veld && f.op === '==' && f.value === waarde)

/**
 * Per collectie: wie mag lezen, wie mag schrijven.
 *
 * `false` betekent niemand — ook geen beheerder. Een collectie die hier niet
 * staat is dicht, net als de slotregel onderaan `firestore.rules`.
 */
export const REGELS = {
  profiles:       { lezen: isMember, schrijven: (rol, ctx) => isAdmin(rol) || ctx.id === ctx.uid },
  invites:        { lezen: isAdmin, schrijven: isAdmin },
  pushTokens:     { lezen: isMember, schrijven: isMember },
  config:         { lezen: isMember, schrijven: isAdmin },
  mailQueue:      { lezen: () => false, schrijven: () => false },

  brands:         { lezen: (rol) => isTeam(rol) || isSocial(rol), schrijven: isTeam },
  spaces:         { lezen: isTeam, schrijven: isTeam },
  folders:        { lezen: isTeam, schrijven: isTeam },
  lists:          { lezen: (rol) => isTeam(rol) || isSocial(rol), schrijven: isTeam },
  tags:           { lezen: (rol) => isTeam(rol) || isSocial(rol), schrijven: isTeam },

  /*
    Taken dragen de bedragen. De socialrol leest ze niet en schrijft er alleen
    de stand van de content op — of alles, maar dan op een sociallijst.
  */
  tasks: {
    lezen: isTeam,
    schrijven: (rol, ctx) =>
      isTeam(rol) ||
      (isSocial(rol) &&
        (ctx.velden.every((v) =>
          ['socialStage', 'socialWanted', 'updatedAt', 'updatedBy', 'position'].includes(v)
        ) ||
          ctx.lijstIsSocial)),
  },

  socialEvents:   { lezen: (rol) => isTeam(rol) || isSocial(rol), schrijven: () => false },
  customers:      { lezen: isTeam, schrijven: isTeam },
  comments:       { lezen: isTeam, schrijven: isTeam },
  attachments:    { lezen: isTeam, schrijven: isTeam },
  goals:          { lezen: isTeam, schrijven: isTeam },
  goalUpdates:    { lezen: isTeam, schrijven: isTeam },
  socialPosts:    { lezen: (rol) => isTeam(rol) || isSocial(rol), schrijven: (rol) => isTeam(rol) || isSocial(rol) },
  agendaItems:    { lezen: isTeam, schrijven: isTeam },
  meetings:       { lezen: isMember, schrijven: isAdmin },
  automations:    { lezen: isTeam, schrijven: isAdmin },
  automationRuns: { lezen: isTeam, schrijven: () => false },
  templates:      { lezen: isTeam, schrijven: isAdmin },
  formules:       { lezen: isTeam, schrijven: isAdmin },
  checklists:     { lezen: isBistro, schrijven: isAdmin },
  checklistRuns:  { lezen: isBistro, schrijven: isBistro },
  postReviews:    { lezen: (rol) => isTeam(rol) || isSocial(rol), schrijven: (rol) => isTeam(rol) || isSocial(rol) },
  activity:       { lezen: isTeam, schrijven: isTeam },
  shifts:         { lezen: isBistro, schrijven: isAdmin },

  /*
    Uren: het team ziet de cijfers van de ploeg, de socialrol alleen haar eigen
    rijen. Een vraag zonder filter op `profileId` zou over andermans rijen lopen
    en wordt daarom in haar geheel geweigerd — dát is wat een scherm laat
    stranden, en dus staat het hier.
  */
  timeEntries: {
    lezen: (rol, ctx) =>
      isTeam(rol) ||
      (isSocial(rol) && (ctx.id ? true : filtertOp(ctx.filters, 'profileId', ctx.uid))),
    schrijven: (rol) => isTeam(rol) || isSocial(rol),
  },
  runningTimers: {
    lezen: (rol, ctx) => isTeam(rol) || (isSocial(rol) && ctx.id === ctx.uid),
    schrijven: (rol, ctx) => ctx.id === ctx.uid,
  },
  agendaSleutels: {
    lezen: (rol, ctx) => ctx.id === ctx.uid,
    schrijven: (rol, ctx) => ctx.id === ctx.uid,
  },

  offertes:       { lezen: isTeam, schrijven: isTeam },
  auditLog:       { lezen: isTeam, schrijven: () => false },
}

/**
 * Mag deze rol dit? `soort` is 'lezen' of 'schrijven'.
 *
 * Geeft `null` terug als het mag, en anders de reden — die tekst komt in de
 * fout terecht en in het logboek dat de browsertest nakijkt, zodat er niet
 * alleen staat dát het misging maar ook waar.
 */
export function toets(soort, { rol, uid, collectie, id = null, filters = [], velden = [], lijstIsSocial = false }) {
  const regel = REGELS[collectie]
  if (!regel) return `de collectie "${collectie}" staat in geen enkele regel`
  const ctx = { uid, id, filters, velden, lijstIsSocial }
  return regel[soort](rol, ctx) ? null : `rol "${rol}" mag niet ${soort} in "${collectie}"`
}
