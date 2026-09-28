/**
 * De openings- en sluitingslijst van de bistro, zoals ze op papier hangt.
 *
 * De lijsten staan hier en niet alleen in de database, omdat ze de bron zijn
 * voor zowel de seed als de demo: één plek om ze te wijzigen, en geen twee
 * versies die uit elkaar lopen. De seed schrijft ze naar `checklists`; daarna
 * is de database leidend en kan het team ze in de app aanpassen.
 *
 * Velden per punt:
 *   id           blijft vast, want de afvinkingen hangen eraan
 *   label        wat afgevinkt wordt
 *   hint         de toelichting die op papier tussen haakjes stond
 *   secret       toegangscode — de app toont die pas na een klik
 *   weekendOnly  hoort alleen bij weekend en feestdagen
 */

export const OPENING = {
  id: 'openen',
  key: 'openen',
  name: 'Openen van de bistro',
  kind: 'open',
  sections: [
    {
      id: 'aankomst',
      title: 'Aankomst & veiligheid',
      items: [
        { id: 'sleutel', label: 'Sleutel uit het sleutelkluisje', hint: 'Roze hanger met kruisje op. Kluiscode 2807.', secret: true },
        { id: 'alarm', label: 'Alarm uitschakelen', hint: 'Code 3440.', secret: true },
        { id: 'licht-binnen', label: 'Verlichting binnen aanzetten', hint: 'Laatste kast achter de bar, aan de linkerzijde.' },
      ],
    },
    {
      id: 'keuken',
      title: 'Keuken',
      items: [
        { id: 'apparatuur-aan', label: 'Keukenapparatuur opstarten', hint: 'Fornuis, oven, friteuse, vaatwasser…' },
        { id: 'houdbaarheid', label: 'Houdbaarheidsdata van producten controleren' },
        { id: 'koeling-keuken', label: 'Koelkasten en vriezers controleren op temperatuur' },
        { id: 'mise-en-place', label: 'Mise en place van de dag voorbereiden' },
        { id: 'werkvlakken', label: 'Werkoppervlakken en snijplanken schoon en klaar' },
        { id: 'voorraad', label: 'Voorraad aanvullen waar nodig', hint: 'Via de voorraadlijst.' },
      ],
    },
    {
      id: 'bar',
      title: 'Bar',
      items: [
        { id: 'koeling-bar', label: 'Koeling dranken controleren op temperatuur' },
        { id: 'tap', label: 'Tapinstallatie controleren', hint: 'Acide fles openen.' },
        { id: 'koffie', label: 'Koffietoestel, melkschuimer en bonenmachine opstarten' },
        { id: 'kassa-aan', label: 'Kassa en betaalterminal opstarten en testen' },
        { id: 'ijsbak-vullen', label: 'IJsbak vullen' },
        { id: 'bestekzakjes', label: 'Voldoende bestekzakjes klaarzetten' },
      ],
    },
    {
      id: 'zaal',
      title: 'Zaal en terras',
      items: [
        { id: 'tafels-open', label: 'Tafels en stoelen proper en correct opgesteld' },
        { id: 'afval-check', label: 'Terras en zaal controleren op afval, zaal dweilen waar nodig' },
        { id: 'terras-open', label: 'Terras openzetten en meubilair klaarzetten', hint: 'Als het weer het toelaat.' },
        { id: 'parasols-open', label: 'Parasols en zonwering openen', hint: 'Moeilijk alleen — wacht op versterking.' },
        { id: 'menukaarten-open', label: 'Menukaarten controleren', hint: 'Volledig, proper en up-to-date.' },
        { id: 'decoratie-open', label: 'Decoratie, kaarsen en tafelaccessoires nakijken' },
        { id: 'muziek-aan', label: 'Muziek en ambiance aanzetten', hint: 'iPad of pc in de rechtse kast achter de bar.' },
        { id: 'toiletten-open', label: 'Toiletten controleren', hint: 'Proper, papier en zeep aangevuld.', weekendOnly: true },
      ],
    },
    {
      id: 'administratie-open',
      title: 'Administratie',
      items: [{ id: 'reserveringen-open', label: 'Reserveringen van de dag doornemen', hint: 'Zie de kassa.' }],
    },
    {
      id: 'klaar',
      title: 'Klaar om te openen',
      items: [{ id: 'deuren-open', label: 'Ingang ontgrendeld, zijramen van het terras en de ingangsdeur open' }],
    },
  ],
}

export const CLOSING = {
  id: 'sluiten',
  key: 'sluiten',
  name: 'Sluiten van de bistro',
  kind: 'close',
  sections: [
    {
      id: 'gasten',
      title: 'Laatste gasten en zaal',
      items: [
        { id: 'laatste-bestellingen', label: 'Laatste bestellingen genoteerd en tijdig doorgegeven' },
        { id: 'gasten-uit', label: 'Alle gasten vriendelijk uitgeleid' },
        { id: 'terras-op', label: 'Terras en buiten opgeruimd' },
        { id: 'parasols-dicht', label: 'Parasols en zonwering gesloten' },
        { id: 'licht-buiten-uit', label: 'Lichten buiten uit' },
        { id: 'tafels-dicht', label: 'Tafels en stoelen proper en op hun plaats' },
        { id: 'kaarsen-uit', label: 'Decoratie en kaarsen gedoofd en opgeruimd' },
        { id: 'menukaarten-dicht', label: 'Menukaarten verzameld en opgeborgen' },
        { id: 'zaal-dweilen', label: 'Zaal borstelen en dweilen' },
      ],
    },
    {
      id: 'bar-dicht',
      title: 'Bar',
      items: [
        { id: 'tap-dicht', label: 'Tapinstallatie afsluiten', hint: 'Acide fles dichtdraaien.' },
        { id: 'koeling-aanvullen', label: 'Koeling dranken aangevuld voor de volgende dag' },
        { id: 'stock-dranken', label: 'Stock nakijken in de koelcel dranken' },
        { id: 'glazen', label: 'Glazen en materiaal gewassen en opgeborgen' },
        { id: 'bar-droog', label: 'Werkblad en bar volledig proper en droog' },
        { id: 'ijsbak-leeg', label: 'IJsbak leegmaken en reinigen' },
        { id: 'borstelen-toog', label: 'Borstelen achter de toog' },
        { id: 'vuilnis-bar', label: 'Vuilnis achter de bar buitenzetten, leeg glaswerk mee' },
        { id: 'muziek-uit', label: 'Muziek en ambiance uitgeschakeld' },
        { id: 'telefoons', label: 'Telefoons insteken' },
      ],
    },
    {
      id: 'keuken-dicht',
      title: 'Keuken',
      items: [
        { id: 'apparatuur-uit', label: 'Alle keukenapparatuur uitschakelen', hint: 'Fornuis, oven, friteuse…' },
        { id: 'koeling-dicht', label: 'Koelkasten en vriezers sluiten, temperatuur een laatste keer controleren' },
        { id: 'restvoedsel', label: 'Restvoedsel bewaren of weggooien en bijvullen voor morgen', hint: 'Etiketteren met de datum.' },
        { id: 'reinigen-keuken', label: 'Werkoppervlakken, snijplanken en gerief grondig reinigen' },
        { id: 'vaatwasser', label: 'Vaatwasser leegmaken en uitschakelen' },
        { id: 'vuilnis-keuken', label: 'Vuilnis buitenzetten en afval sorteren' },
        { id: 'vloer-keuken', label: 'Vloer van de keuken vegen en dweilen' },
        { id: 'putjes', label: 'Warm water door de putjes gieten', hint: 'Elke dag. Bij stinkende geur ook azijn.' },
        { id: 'stocktelling', label: 'Stocktelling koelcel eten, diepvriescel en kamertemperatuur', hint: 'Zie de lijstjes.' },
      ],
    },
    {
      id: 'kassa',
      title: 'Kassa en administratie',
      items: [
        { id: 'kassa-af', label: 'Kassa afsluiten en dagtotaal tellen', hint: 'Niet duidelijk? Bekijk het instructieblad.' },
        { id: 'kasverschil', label: 'Kasverschillen noteren', hint: 'Indien van toepassing.' },
        { id: 'terminal-af', label: 'Betaalterminal afsluiten' },
        { id: 'logboek', label: 'Reserveringen en bijzonderheden voor morgen in het logboek' },
      ],
    },
    {
      id: 'toiletten-dicht',
      title: 'Toiletten',
      items: [
        { id: 'toiletten-bij', label: 'Toiletten proper en aangevuld', hint: 'Papier en zeep.', weekendOnly: true },
        { id: 'vuilnisbakken', label: 'Vuilnisbakken geleegd', weekendOnly: true },
        { id: 'algemene-ruimtes', label: 'Algemene ruimtes proper en opgeruimd', weekendOnly: true },
      ],
    },
    {
      id: 'afsluiten',
      title: 'Veiligheid en afsluiten',
      items: [
        { id: 'licht-binnen-uit', label: 'Alle verlichting binnen uit', hint: 'Behalve de noodverlichting.' },
        { id: 'ramen-deuren', label: 'Ramen en deuren gecontroleerd en gesloten' },
        { id: 'alarm-aan', label: 'Alarm inschakelen', hint: 'Code 3440.', secret: true },
        { id: 'sleutel-terug', label: 'Deur op slot, sleutel terug in de sleutelkluis', hint: 'Kluiscode 2807. Roze hanger en blauwe hanger.', secret: true },
      ],
    },
  ],
}

export const CHECKLIST_TEMPLATES = [OPENING, CLOSING]

/** Zaterdag en zondag. Feestdagen zet het team zelf aan met de weekendschakelaar. */
export function isWeekend(date = new Date()) {
  const day = date.getDay()
  return day === 0 || day === 6
}

/**
 * De punten die vandaag echt moeten. Weekendpunten blijven zichtbaar op een
 * weekdag — ze staan ook op het papier — maar tellen dan niet mee, anders
 * haalt niemand de lijst ooit rond.
 */
export function itemApplies(item, { weekend }) {
  return !item.weekendOnly || weekend
}

export function requiredItems(checklist, { weekend }) {
  return (checklist?.sections ?? [])
    .flatMap((section) => section.items)
    .filter((item) => itemApplies(item, { weekend }))
}

/** Voortgang over de punten die vandaag gelden. */
export function runProgress(checklist, run, { weekend }) {
  const required = requiredItems(checklist, { weekend })
  const done = required.filter((item) => run?.items?.[item.id]?.done).length
  return { done, total: required.length, ratio: required.length ? done / required.length : 0 }
}

/** Eén run per lijst per dag, zodat iedereen in dezelfde lijst afvinkt. */
export const runId = (checklistId, day) => `${checklistId}_${day}`
