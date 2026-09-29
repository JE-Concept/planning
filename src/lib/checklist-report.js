import { dayKey } from './dates'
import { dueOn, meetOordeel } from './checklist-templates'

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
 * Eén dag van één lijst.
 *
 * `verplicht` is wat er die dag viel, `gedaan` wat er afgevinkt is, en `ontbreekt`
 * het verschil — met naam en toenaam, want "3 van de 12" zegt niet welke drie.
 * Een dag zonder run is geen lege dag maar een niet-gedane dag; dat onderscheid
 * is precies wat een controle zoekt.
 */
export function dagVerslag(checklist, run, dag) {
  const datum = new Date(`${dag}T12:00:00`)
  const verplicht = allePunten(checklist).filter((punt) => dueOn(punt, datum))

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
export function maandVerslag({ maand, checklists, runs, vandaag = new Date() }) {
  const runsPerDag = {}
  for (const run of runs) (runsPerDag[`${run.checklistId}_${run.day}`] = run)

  const grens = dayKey(vandaag)
  const dagen = dagenVanMaand(maand).filter((dag) => dag <= grens)

  const perDag = dagen.map((dag) => ({
    dag,
    lijsten: checklists
      .map((lijst) => dagVerslag(lijst, runsPerDag[`${lijst.id}_${dag}`], dag))
      .filter((verslag) => verslag.verplicht > 0),
  }))

  return { maand, dagen: perDag, ...samenvatting(perDag) }
}

/** De cijfers waarmee een verslag opent. */
export function samenvatting(perDag) {
  let verplicht = 0
  let gedaan = 0
  let volledigeDagen = 0
  let dagenMetWerk = 0
  const overschrijdingen = []

  for (const dag of perDag) {
    if (dag.lijsten.length === 0) continue
    dagenMetWerk += 1
    let allesRond = true

    for (const lijst of dag.lijsten) {
      verplicht += lijst.verplicht
      gedaan += lijst.gedaan.length
      if (!lijst.volledig) allesRond = false
      for (const meting of lijst.metingen) {
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
    overschrijdingen,
  }
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
