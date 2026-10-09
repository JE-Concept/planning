import { dayKey } from './dates'
import { dueOn, meetOordeel } from './checklist-templates'
import { herhalingVan } from './checklist-herhaling'

/**
 * Wat er van de dagelijkse lijsten overblijft als je er een maand op terugkijkt.
 *
 * Dit is waarvoor het afvinken bestaat. Een controleur vraagt niet of er vandaag
 * gepoetst is, maar of je kunt tonen dat het elke dag gebeurde, door wie, en wat
 * de gemeten waarden waren. Dat antwoord zit verspreid over dertig documenten met
 * een map vinkjes erin, en dit maakt er een verslag van.
 *
 * Het staat los van het scherm omdat het rekenwerk is, en omdat een fout hier
 * niet zichtbaar is: een dag die stilletjes overgeslagen wordt, ziet er precies
 * uit als een dag zonder werk. Vandaar een tabel met verwachte uitkomsten.
 *
 * Wat hier "verplicht" heet, is elk punt dat op die dag viel — voor iedereen
 * samen, niet per afdeling. Een verslag gaat over de zaak en niet over wie er
 * toevallig keek.
 *
 * Waarom dezelfde lijst niet elke dag evenveel punten telt
 * ────────────────────────────────────────────────────────
 * "Openen 0/24 en 0/25", "Poetsplan 0/5 en 0/12": dat leek een rekenfout, en
 * het is er geen. Het aantal per dag ligt vast als
 *
 *   elk punt van de lijst zoals ze nu is, waarvan de herhaling op die dag
 *   valt, en dat op die dag al op de lijst stond (`sinds`).
 *
 * De toiletten bij het openen zijn voor het weekend, de thermometers voor de
 * 1e van de maand, de friteuse voor maandag. Op de 1e telt het poetsplan dus
 * twaalf punten en op een gewone donderdag vijf. Dat moet zo — een maandelijks
 * punt op elke dag meetellen zou elke andere dag onvolledig maken — maar een
 * getal dat zonder uitleg verspringt, leest op een bewijsstuk als geknoei.
 * Vandaar dat elke dag ook zegt welke van zijn punten periodiek waren
 * (`periodiek`), en dat het verslag dat naast het getal zet.
 *
 * `sinds` staat op punten die later bij een lijst kwamen. Zonder dat telt een
 * punt dat vandaag toegevoegd wordt met terugwerkende kracht als "niet gedaan"
 * op elke dag van vorige maand, en verandert een afgesloten maand achteraf.
 *
 * Gesloten dagen
 * ──────────────
 * Een dag waarop de bistro dicht is, is geen gemiste dag. Zonder sluitingsdagen
 * stond elke maandag als "niet begonnen" en haalde geen enkele week de 7/7.
 * Op een sluitingsdag telt alleen wat er tóch afgevinkt werd: wie op een
 * gesloten dag de koelcel meet, hoort in het verslag te staan, en een lijst die
 * niemand opende, hoort er niet als gemist in te staan. Zie `sluitingOp`.
 */

/** De dagen van een maand, als sleutels. "2026-09" → ["2026-09-01", …]. */
export function dagenVanMaand(maand) {
  const [jaar, nr] = maand.split('-').map(Number)
  const laatste = new Date(jaar, nr, 0).getDate()
  return Array.from({ length: laatste }, (_, i) => `${maand}-${String(i + 1).padStart(2, '0')}`)
}

/** Alle punten van een lijst, plat, met hun sectie erbij. */
export function allePunten(checklist) {
  return (checklist?.sections ?? []).flatMap((sectie) =>
    (sectie.items ?? []).map((punt) => ({ ...punt, sectie: sectie.title }))
  )
}

/**
 * Welke punten van een lijst op deze dag vielen: de vaste definitie van
 * "verplicht" die bovenaan dit bestand uitgelegd staat.
 */
export function puntenOpDag(checklist, dag) {
  const datum = new Date(`${dag}T12:00:00`)
  return allePunten(checklist).filter((punt) => dueOn(punt, datum) && (!punt.sinds || punt.sinds <= dag))
}

/**
 * Telt deze lijst op deze dag mee?
 *
 * Een lijst die uit gebruik genomen is, telt tot de dag dat dat gebeurde
 * (`archivedOn`). Zonder die datum — lijsten die vóór dit veld gearchiveerd
 * werden — weten we niet wanneer ze stopte, en dan telt ze alleen op de dagen
 * waarop ze toch gebruikt werd. Anders staat een lijst die niemand meer
 * gebruikt elke dag als "niet begonnen" in het verslag, voor altijd.
 */
export function lijstTeltOp(checklist, dag, run) {
  if (run) return true
  if (!checklist.archived) return true
  return Boolean(checklist.archivedOn) && dag < checklist.archivedOn
}

/**
 * Eén dag van één lijst.
 *
 * `verplicht` is wat er die dag viel, `gedaan` wat er afgevinkt is, en `ontbreekt`
 * het verschil — met naam en toenaam, want "3 van de 12" zegt niet welke drie.
 * Een dag zonder run is geen lege dag maar een niet-gedane dag; dat onderscheid
 * is precies wat een controle zoekt.
 */
export function dagVerslag(checklist, run, dag) {
  const verplicht = puntenOpDag(checklist, dag)

  const gedaan = []
  const ontbreekt = []
  const metingen = []

  for (const punt of verplicht) {
    const staat = run?.items?.[punt.id]
    if (staat?.done) gedaan.push({ ...punt, door: staat.byName ?? null, om: staat.at ?? null })
    else ontbreekt.push(punt)

    if (punt.veld?.kind === 'getal') {
      const oordeel = meetOordeel(punt.veld, staat?.waarde)
      metingen.push({
        puntId: punt.id,
        label: punt.label,
        eenheid: punt.veld.eenheid ?? '',
        waarde: oordeel.getal ?? null,
        staat: oordeel.staat,
        grens: oordeel.grens ?? null,
        richting: oordeel.richting ?? null,
        door: staat?.waardeByName ?? null,
      })
    }
  }

  return {
    dag,
    checklistId: checklist.id,
    checklistName: checklist.name,
    verplicht: verplicht.length,
    periodiek: verplicht.filter((punt) => herhalingVan(punt).kind !== 'dagelijks'),
    gedaan,
    ontbreekt,
    metingen,
    volledig: verplicht.length > 0 && ontbreekt.length === 0,
    begonnen: Boolean(run),
    deelnemers: run?.participants ?? [],
    afgerondDoor: run?.closedByName ?? null,
    afgerondOm: run?.closedAt ?? null,
    opmerking: run?.notes ?? '',
  }
}

/**
 * De hele maand, per dag en per lijst.
 *
 * Dagen in de toekomst tellen niet mee: een maand die nog loopt hoort niet te
 * lezen als een maand vol gemiste dagen.
 */
export function maandVerslag({ maand, checklists, runs, sluiting = null, vandaag = new Date() }) {
  const runsPerDag = {}
  for (const run of runs) (runsPerDag[`${run.checklistId}_${run.day}`] = run)

  const grens = dayKey(vandaag)
  const dagen = dagenVanMaand(maand).filter((dag) => dag <= grens)

  const perDag = dagen.map((dag) => {
    const gesloten = sluitingOp(sluiting, dag)
    return {
      dag,
      gesloten,
      lijsten: checklists
        .filter((lijst) => {
          const run = runsPerDag[`${lijst.id}_${dag}`]
          // Op een sluitingsdag alleen wat er toch gedaan werd; zie bovenaan.
          return gesloten ? Boolean(run) : lijstTeltOp(lijst, dag, run)
        })
        .map((lijst) => dagVerslag(lijst, runsPerDag[`${lijst.id}_${dag}`], dag))
        .filter((verslag) => verslag.verplicht > 0),
    }
  })

  return { maand, dagen: perDag, ...samenvatting(perDag) }
}

/** De cijfers waarmee een verslag opent. */
export function samenvatting(perDag) {
  let verplicht = 0
  let gedaan = 0
  let volledigeDagen = 0
  let dagenMetWerk = 0
  let geslotenDagen = 0
  let meetpunten = 0
  let gemeten = 0
  const overschrijdingen = []

  for (const dag of perDag) {
    if (dag.lijsten.length === 0) {
      if (dag.gesloten) geslotenDagen += 1
      continue
    }
    dagenMetWerk += 1
    let allesRond = true

    for (const lijst of dag.lijsten) {
      verplicht += lijst.verplicht
      gedaan += lijst.gedaan.length
      if (!lijst.volledig) allesRond = false
      for (const meting of lijst.metingen) {
        meetpunten += 1
        if (meting.waarde != null) gemeten += 1
        if (meting.staat === 'buiten') overschrijdingen.push({ ...meting, dag: dag.dag, lijst: lijst.checklistName })
      }
    }
    if (allesRond) volledigeDagen += 1
  }

  return {
    verplicht,
    gedaan,
    ratio: verplicht ? gedaan / verplicht : 0,
    volledigeDagen,
    dagenMetWerk,
    geslotenDagen,
    // Hoeveel metingen er gevraagd werden en hoeveel er een getal kregen. Zonder
    // dat zegt "0 overschrijdingen" over een maand zonder één meting hetzelfde
    // als over een maand waarin elke koelkast koud stond — en het eerste is bij
    // een controle het omgekeerde van in orde.
    meetpunten,
    gemeten,
    overschrijdingen,
  }
}

/**
 * Wat het vak "Overschrijdingen" zegt: `buiten`, `binnen` of `geen`.
 *
 * "Alles binnen de grens" mag alleen staan als er iets gemeten is. Een maand
 * zonder metingen is geen goede maand maar een lege, en zo moet ze op het blad
 * ook heten.
 */
export function meetStand(verslag) {
  if (verslag.overschrijdingen.length) return 'buiten'
  return verslag.gemeten > 0 ? 'binnen' : 'geen'
}

/**
 * De metingen van één punt over de maand, voor de grafiek.
 *
 * Dagen zonder meting blijven in de reeks staan met `null`. Ze weglaten zou een
 * vloeiende lijn opleveren over gaten heen, en dat leest als een maand waarin
 * elke dag gemeten is — precies de indruk die een verslag niet mag wekken.
 */
export function reeksVoorPunt(verslag, puntId) {
  const punten = []
  let label = puntId
  let eenheid = ''

  for (const dag of verslag.dagen) {
    let waarde = null
    for (const lijst of dag.lijsten) {
      const meting = lijst.metingen.find((m) => m.puntId === puntId)
      if (!meting) continue
      label = meting.label
      eenheid = meting.eenheid
      if (meting.waarde != null) waarde = meting
    }
    punten.push({ dag: dag.dag, meting: waarde })
  }

  const gemeten = punten.filter((p) => p.meting).map((p) => p.meting.waarde)

  return {
    puntId,
    label,
    eenheid,
    punten,
    aantal: gemeten.length,
    min: gemeten.length ? Math.min(...gemeten) : null,
    max: gemeten.length ? Math.max(...gemeten) : null,
    gemiddelde: gemeten.length ? gemeten.reduce((a, b) => a + b, 0) / gemeten.length : null,
  }
}

/** Welke punten in deze maand een getal vroegen — de grafieken die er horen. */
export function meetpunten(verslag) {
  const gezien = new Map()
  for (const dag of verslag.dagen) {
    for (const lijst of dag.lijsten) {
      for (const meting of lijst.metingen) {
        if (!gezien.has(meting.puntId)) gezien.set(meting.puntId, { id: meting.puntId, label: meting.label })
      }
    }
  }
  return [...gezien.values()]
}

/**
 * Het verslag als tekst voor een rekenblad.
 *
 * Eén regel per punt per dag, met puntkomma's: Excel in het Nederlands leest een
 * komma als decimaalteken, dus een komma als scheiding levert een bestand op dat
 * in één kolom belandt.
 *
 * De kolomkoppen en de ja/nee staan hier in vaste Nederlandse tekst en volgen
 * met opzet niet de taal van wie het bestand maakt. Dit is een uitvoer voor de
 * FAVV-controle en voor de boekhouding, en twee exports van dezelfde maand
 * horen hetzelfde bestand te zijn — anders kloppen de kolommen niet meer met
 * wat er eerder bewaard is, en leest de controleur een kop die hij niet kent.
 * Hetzelfde geldt voor het verslag op het scherm; zie `pages/ChecklistReport`.
 */
export function naarCsv(verslag) {
  const regels = [
    ['Datum', 'Lijst', 'Sectie', 'Punt', 'Afgevinkt', 'Door', 'Waarde', 'Eenheid', 'Binnen de grens'].join(';'),
  ]

  for (const dag of verslag.dagen) {
    // Een gesloten dag staat er als één regel in. Weglaten zou een gat in de
    // datums laten, en dan vraagt de controleur terecht waar de 6e gebleven is.
    if (dag.gesloten && dag.lijsten.length === 0) {
      regels.push([dag.dag, '', '', geslotenTekst(dag.gesloten).replaceAll(';', ','), '', '', '', '', ''].join(';'))
      continue
    }
    for (const lijst of dag.lijsten) {
      const metingPer = Object.fromEntries(lijst.metingen.map((m) => [m.puntId, m]))
      const gedaanPer = Object.fromEntries(lijst.gedaan.map((p) => [p.id, p]))

      for (const punt of [...lijst.gedaan, ...lijst.ontbreekt]) {
        const meting = metingPer[punt.id]
        const gedaan = gedaanPer[punt.id]
        regels.push(
          [
            dag.dag,
            lijst.checklistName,
            punt.sectie ?? '',
            punt.label,
            gedaan ? 'ja' : 'nee',
            gedaan?.door ?? '',
            meting?.waarde ?? '',
            meting?.eenheid ?? '',
            meting ? (meting.staat === 'ok' ? 'ja' : meting.staat === 'buiten' ? 'nee' : '') : '',
          ]
            .map((veld) => String(veld).replaceAll(';', ','))
            .join(';')
        )
      }
    }
  }

  return regels.join('\n')
}

// ─── Sluitingsdagen ─────────────────────────────────────────────────────────

/*
  Wanneer de bistro dicht is, staat in `config/bistro` onder `gesloten`:

    weekdagen  [{ vanaf, ingesteld, dagen: [1, 2] }]
               De vaste sluitingsdagen, met hun geschiedenis. Een wijziging komt
               er als nieuwe regel bij die geldt vanaf de dag zelf; de oudere
               blijven gelden voor de dagen ervoor. Was de bistro tot de zomer
               op maandag dicht en sindsdien op dinsdag, dan blijft het verslag
               van mei zeggen wat er in mei gold. Een regel overschrijven zou een
               afgesloten maand achteraf herschrijven, en dat mag bij een
               FAVV-document niet. De allereerste regel heeft `vanaf: null` en
               geldt ook terug in de tijd: wie de sluitingsdagen voor het eerst
               instelt, doet dat juist omdat de vorige maanden niet klopten.

    periodes   [{ van, tot, reden }]
               Losse dagen en verlofperiodes: kerstdag, het jaarlijks verlof.
               Eén dag is een periode met `van` gelijk aan `tot`.

  Het staat op één plek voor de hele zaak en niet per lijst: de bistro is dicht,
  niet de openingslijst. En het gaat over de openingsuren van het pand, niet
  over wie wanneer kan werken — dat hoort in AAPI (zie CLAUDE.md).
*/

/** De wekelijkse regel die op deze dag gold, of null. */
function wekelijkseRegelOp(sluiting, dag) {
  let gekozen = null
  for (const regel of sluiting?.weekdagen ?? []) {
    if (regel.vanaf && regel.vanaf > dag) continue
    if (!gekozen || (regel.vanaf ?? '') >= (gekozen.vanaf ?? '')) gekozen = regel
  }
  return gekozen
}

/**
 * Was de bistro op deze dag dicht? Geeft `{ reden }` of null.
 *
 * Een losse periode gaat voor op de vaste weekdagen, omdat ze een reden kan
 * dragen die op het blad hoort ("jaarlijks verlof").
 */
export function sluitingOp(sluiting, dag) {
  if (!sluiting) return null
  for (const periode of sluiting.periodes ?? []) {
    if (!periode?.van) continue
    if (dag >= periode.van && dag <= (periode.tot || periode.van)) {
      return { reden: periode.reden?.trim() || null }
    }
  }
  const regel = wekelijkseRegelOp(sluiting, dag)
  const weekdag = new Date(`${dag}T12:00:00`).getDay()
  return (regel?.dagen ?? []).includes(weekdag) ? { reden: null } : null
}

/**
 * "Gesloten" of "Gesloten — jaarlijks verlof", zoals het op het blad staat.
 * Vaste Nederlandse tekst, om dezelfde reden als de kolomkoppen van `naarCsv`.
 */
export const geslotenTekst = (gesloten) => (gesloten?.reden ? `Gesloten — ${gesloten.reden}` : 'Gesloten')

/** De vaste sluitingsdagen die vandaag gelden, voor het scherm in Instellingen. */
export function sluitingsdagenVan(sluiting, vandaag = dayKey(new Date())) {
  return wekelijkseRegelOp(sluiting, vandaag)?.dagen ?? []
}

/**
 * Nieuwe vaste sluitingsdagen, zonder de vorige te herschrijven.
 *
 * Wie op één middag drie vakjes aanklikt, wil geen drie regels geschiedenis:
 * een regel die vandaag ingesteld werd, wordt vandaag nog bijgewerkt. Pas een
 * wijziging op een latere dag wordt een nieuwe regel.
 */
export function metSluitingsdagen(sluiting, dagen, vandaag = dayKey(new Date())) {
  const regels = sluiting?.weekdagen ?? []
  const gesorteerd = [...new Set(dagen)].sort((a, b) => a - b)
  const laatste = regels.at(-1)

  if (laatste?.ingesteld === vandaag) {
    return { ...sluiting, weekdagen: [...regels.slice(0, -1), { ...laatste, dagen: gesorteerd }] }
  }
  const vanaf = regels.length ? vandaag : null
  return { ...sluiting, weekdagen: [...regels, { vanaf, ingesteld: vandaag, dagen: gesorteerd }] }
}

/** Een losse dag of periode erbij. `tot` leeg is één dag; omgekeerd wordt rechtgezet. */
export function metPeriode(sluiting, { van, tot, reden }) {
  if (!van) return sluiting
  const [begin, eind] = tot && tot < van ? [tot, van] : [van, tot || van]
  const periodes = [...(sluiting?.periodes ?? []), { van: begin, tot: eind, reden: reden?.trim() || null }]
  return { ...sluiting, periodes: periodes.sort((a, b) => a.van.localeCompare(b.van)) }
}

export function zonderPeriode(sluiting, index) {
  return { ...sluiting, periodes: (sluiting?.periodes ?? []).filter((_, i) => i !== index) }
}

/**
 * Punten die altijd op een sluitingsdag vallen.
 *
 * De friteuse staat op maandag. Is de bistro op maandag dicht, dan telt dat punt
 * nooit meer mee en verdwijnt het uit het verslag zonder dat iemand het merkt —
 * de stille fout waar dit hele bestand tegen bestaat. Het scherm met de
 * sluitingsdagen noemt zulke punten daarom bij naam.
 */
export function puntenOpSluitingsdag(checklists, dagen) {
  if (!dagen?.length) return []
  const dicht = new Set(dagen)
  const uit = []
  for (const lijst of checklists ?? []) {
    if (lijst.archived) continue
    for (const punt of allePunten(lijst)) {
      const repeat = herhalingVan(punt)
      const vallen =
        repeat.kind === 'wekelijks' ? [repeat.days?.[0] ?? 1] : repeat.kind === 'weekdag' ? (repeat.days ?? []) : []
      if (vallen.length && vallen.every((d) => dicht.has(d))) {
        uit.push({ lijst: lijst.name, puntId: punt.id, label: punt.label })
      }
    }
  }
  return uit
}
