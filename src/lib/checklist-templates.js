/**
 * De openings- en sluitingslijst van de bistro, zoals ze op papier hangt.
 *
 * De lijsten staan hier en niet alleen in de database, omdat ze de bron zijn
 * voor zowel de seed als de demo: één plek om ze te wijzigen, en geen twee
 * versies die uit elkaar lopen. De seed schrijft ze naar `checklists`; daarna
 * is de database leidend en kan het team ze in de app aanpassen.
 *
 * Velden per punt:
 *   id      blijft vast, want de afvinkingen hangen eraan
 *   label   wat afgevinkt wordt
 *   hint    de toelichting die op papier tussen haakjes stond
 *   secret  toegangscode — de app toont die pas na een klik
 *   who     wie het ziet: iedereen, verantwoordelijke, keuken of zaal
 *   repeat  wanneer het moet; ontbreekt = elke dag
 *   veld    vraagt naast het vinkje een waarde: een datum of een getal
 */

// Met extensie, want `scripts/seed.mjs` leest dit bestand met kale Node en die
// vult geen `.js` aan.
import { huidigeLocaleVan } from './dates.js'
import { tekst } from './i18n.js'

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
        { id: 'sleutel', label: 'Sleutel uit het sleutelkluisje', hint: 'Roze hanger met kruisje op. Kluiscode 2807.', secret: true, who: 'verantwoordelijke' },
        { id: 'alarm', label: 'Alarm uitschakelen', hint: 'Code 3440.', secret: true, who: 'verantwoordelijke' },
        { id: 'licht-binnen', label: 'Verlichting binnen aanzetten', hint: 'Laatste kast achter de bar, aan de linkerzijde.', who: 'verantwoordelijke' },
      ],
    },
    {
      id: 'keuken',
      title: 'Keuken',
      items: [
        { id: 'apparatuur-aan', label: 'Keukenapparatuur opstarten', hint: 'Fornuis, oven, friteuse, vaatwasser…', who: 'keuken' },
        { id: 'houdbaarheid', label: 'Houdbaarheidsdata van producten controleren', who: 'keuken' },
        { id: 'koeling-keuken', label: 'Koelkasten en vriezers controleren op temperatuur', who: 'keuken' },
        { id: 'mise-en-place', label: 'Mise en place van de dag voorbereiden', who: 'keuken' },
        { id: 'werkvlakken', label: 'Werkoppervlakken en snijplanken schoon en klaar', who: 'keuken' },
        { id: 'voorraad', label: 'Voorraad aanvullen waar nodig', hint: 'Via de voorraadlijst.', who: 'keuken' },
      ],
    },
    {
      id: 'bar',
      title: 'Bar',
      items: [
        { id: 'koeling-bar', label: 'Koeling dranken controleren op temperatuur', who: 'zaal' },
        { id: 'tap', label: 'Tapinstallatie controleren', hint: 'Acide fles openen.', who: 'zaal' },
        { id: 'koffie', label: 'Koffietoestel, melkschuimer en bonenmachine opstarten', who: 'zaal' },
        { id: 'kassa-aan', label: 'Kassa en betaalterminal opstarten en testen', who: 'zaal' },
        { id: 'ijsbak-vullen', label: 'IJsbak vullen', who: 'zaal' },
        { id: 'bestekzakjes', label: 'Voldoende bestekzakjes klaarzetten', who: 'zaal' },
      ],
    },
    {
      id: 'zaal',
      title: 'Zaal en terras',
      items: [
        { id: 'tafels-open', label: 'Tafels en stoelen proper en correct opgesteld', who: 'zaal' },
        { id: 'afval-check', label: 'Terras en zaal controleren op afval, zaal dweilen waar nodig', who: 'zaal' },
        { id: 'terras-open', label: 'Terras openzetten en meubilair klaarzetten', hint: 'Als het weer het toelaat.', who: 'zaal' },
        { id: 'parasols-open', label: 'Parasols en zonwering openen', hint: 'Moeilijk alleen — wacht op versterking.', who: 'zaal' },
        { id: 'menukaarten-open', label: 'Menukaarten controleren', hint: 'Volledig, proper en up-to-date.', who: 'zaal' },
        { id: 'decoratie-open', label: 'Decoratie, kaarsen en tafelaccessoires nakijken', who: 'zaal' },
        { id: 'muziek-aan', label: 'Muziek en ambiance aanzetten', hint: 'iPad of pc in de rechtse kast achter de bar.', who: 'zaal' },
        { id: 'toiletten-open', label: 'Toiletten controleren', hint: 'Proper, papier en zeep aangevuld.', repeat: { kind: 'weekdag', days: [0, 6] }, who: 'zaal' },
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
        { id: 'laatste-bestellingen', label: 'Laatste bestellingen genoteerd en tijdig doorgegeven', who: 'zaal' },
        { id: 'gasten-uit', label: 'Alle gasten vriendelijk uitgeleid', who: 'zaal' },
        { id: 'terras-op', label: 'Terras en buiten opgeruimd', who: 'zaal' },
        { id: 'parasols-dicht', label: 'Parasols en zonwering gesloten', who: 'zaal' },
        { id: 'licht-buiten-uit', label: 'Lichten buiten uit', who: 'zaal' },
        { id: 'tafels-dicht', label: 'Tafels en stoelen proper en op hun plaats', who: 'zaal' },
        { id: 'kaarsen-uit', label: 'Decoratie en kaarsen gedoofd en opgeruimd', who: 'zaal' },
        { id: 'menukaarten-dicht', label: 'Menukaarten verzameld en opgeborgen', who: 'zaal' },
        { id: 'zaal-dweilen', label: 'Zaal borstelen en dweilen', who: 'zaal' },
      ],
    },
    {
      id: 'bar-dicht',
      title: 'Bar',
      items: [
        { id: 'tap-dicht', label: 'Tapinstallatie afsluiten', hint: 'Acide fles dichtdraaien.', who: 'zaal' },
        { id: 'koeling-aanvullen', label: 'Koeling dranken aangevuld voor de volgende dag', who: 'zaal' },
        { id: 'stock-dranken', label: 'Stock nakijken in de koelcel dranken', who: 'zaal' },
        { id: 'glazen', label: 'Glazen en materiaal gewassen en opgeborgen', who: 'zaal' },
        { id: 'bar-droog', label: 'Werkblad en bar volledig proper en droog', who: 'zaal' },
        { id: 'ijsbak-leeg', label: 'IJsbak leegmaken en reinigen', who: 'zaal' },
        { id: 'borstelen-toog', label: 'Borstelen achter de toog', who: 'zaal' },
        { id: 'vuilnis-bar', label: 'Vuilnis achter de bar buitenzetten, leeg glaswerk mee', who: 'zaal' },
        { id: 'muziek-uit', label: 'Muziek en ambiance uitgeschakeld', who: 'zaal' },
        { id: 'telefoons', label: 'Telefoons insteken', who: 'zaal' },
      ],
    },
    {
      id: 'keuken-dicht',
      title: 'Keuken',
      items: [
        { id: 'apparatuur-uit', label: 'Alle keukenapparatuur uitschakelen', hint: 'Fornuis, oven, friteuse…', who: 'keuken' },
        { id: 'koeling-dicht', label: 'Koelkasten en vriezers sluiten, temperatuur een laatste keer controleren', who: 'keuken' },
        { id: 'restvoedsel', label: 'Restvoedsel bewaren of weggooien en bijvullen voor morgen', hint: 'Etiketteren met de datum.', who: 'keuken' },
        { id: 'reinigen-keuken', label: 'Werkoppervlakken, snijplanken en gerief grondig reinigen', who: 'keuken' },
        { id: 'vaatwasser', label: 'Vaatwasser leegmaken en uitschakelen', who: 'keuken' },
        { id: 'vuilnis-keuken', label: 'Vuilnis buitenzetten en afval sorteren', who: 'keuken' },
        { id: 'vloer-keuken', label: 'Vloer van de keuken vegen en dweilen', who: 'keuken' },
        { id: 'putjes', label: 'Warm water door de putjes gieten', hint: 'Elke dag. Bij stinkende geur ook azijn.', who: 'keuken' },
        { id: 'stocktelling', label: 'Stocktelling koelcel eten, diepvriescel en kamertemperatuur', hint: 'Zie de lijstjes.', who: 'keuken' },
      ],
    },
    {
      id: 'kassa',
      title: 'Kassa en administratie',
      items: [
        { id: 'kassa-af', label: 'Kassa afsluiten en dagtotaal tellen', hint: 'Niet duidelijk? Bekijk het instructieblad.', who: 'verantwoordelijke' },
        { id: 'kasverschil', label: 'Kasverschillen noteren', hint: 'Indien van toepassing.', who: 'verantwoordelijke' },
        { id: 'terminal-af', label: 'Betaalterminal afsluiten', who: 'verantwoordelijke' },
        { id: 'logboek', label: 'Reserveringen en bijzonderheden voor morgen in het logboek', who: 'verantwoordelijke' },
      ],
    },
    {
      id: 'toiletten-dicht',
      title: 'Toiletten',
      items: [
        { id: 'toiletten-bij', label: 'Toiletten proper en aangevuld', hint: 'Papier en zeep.', repeat: { kind: 'weekdag', days: [0, 6] }, who: 'zaal' },
        { id: 'vuilnisbakken', label: 'Vuilnisbakken geleegd', repeat: { kind: 'weekdag', days: [0, 6] }, who: 'zaal' },
        { id: 'algemene-ruimtes', label: 'Algemene ruimtes proper en opgeruimd', repeat: { kind: 'weekdag', days: [0, 6] }, who: 'zaal' },
      ],
    },
    {
      id: 'afsluiten',
      title: 'Veiligheid en afsluiten',
      items: [
        { id: 'licht-binnen-uit', label: 'Alle verlichting binnen uit', hint: 'Behalve de noodverlichting.', who: 'verantwoordelijke' },
        { id: 'ramen-deuren', label: 'Ramen en deuren gecontroleerd en gesloten', who: 'verantwoordelijke' },
        { id: 'alarm-aan', label: 'Alarm inschakelen', hint: 'Code 3440.', secret: true, who: 'verantwoordelijke' },
        { id: 'sleutel-terug', label: 'Deur op slot, sleutel terug in de sleutelkluis', hint: 'Kluiscode 2807. Roze hanger en blauwe hanger.', secret: true, who: 'verantwoordelijke' },
      ],
    },
  ],
}


/**
 * De registraties die de autocontrole vraagt.
 *
 * Basis is de Europese hygiëneverordening 852/2004, die elk horecabedrijf een
 * HACCP-systeem oplegt met aantoonbare bewaking van de kritische punten; in
 * België werkt dat via de FAVV-gids G-023 voor de horeca. Wat een controleur
 * wil zien is telkens hetzelfde: gedateerd, per dag, met de naam van wie het
 * deed — precies wat een afvinklijst met naam en tijdstip oplevert.
 *
 * Deze lijst is een startpunt, geen juridisch document: leg ze naast jullie
 * eigen autocontrolegids voor je erop steunt bij een controle.
 */
export const FAVV = {
  id: 'favv',
  key: 'favv',
  name: 'FAVV-registraties',
  kind: 'register',
  sections: [
    {
      id: 'temperaturen',
      title: 'Temperaturen',
      items: [
        { id: 'temp-koelkasten', label: 'Temperatuur koelkasten', hint: 'Bij voorkeur 4 °C.', who: 'keuken', veld: { kind: 'getal', label: 'Gemeten', eenheid: '°C', max: 7 } },
        { id: 'temp-diepvries', label: 'Temperatuur diepvriezers', who: 'keuken', veld: { kind: 'getal', label: 'Gemeten', eenheid: '°C', max: -18 } },
        { id: 'temp-koelcel', label: 'Temperatuur koelcel', who: 'keuken', veld: { kind: 'getal', label: 'Gemeten', eenheid: '°C', max: 7 } },
        { id: 'temp-afwijking', label: 'Afwijkingen en genomen maatregelen genoteerd', hint: 'Alleen invullen als er iets buiten de grenzen lag.', who: 'keuken' },
      ],
    },
    {
      id: 'ontvangst',
      title: 'Ontvangst van goederen',
      items: [
        { id: 'levering-temp', label: 'Temperatuur bij levering, gekoeld', hint: 'Diepvries hoort bij het punt hieronder.', who: 'keuken', veld: { kind: 'getal', label: 'Gemeten', eenheid: '°C', max: 7 } },
        { id: 'levering-staat', label: 'Verpakking, houdbaarheid en staat van de levering gecontroleerd', who: 'keuken' },
        { id: 'levering-bon', label: 'Leveringsbon bewaard', hint: 'Traceerbaarheid: wie leverde wat, wanneer.', who: 'keuken' },
      ],
    },
    {
      id: 'bereiding',
      title: 'Bereiding en bewaring',
      items: [
        { id: 'etikettering', label: 'Bereide gerechten geëtiketteerd met datum', who: 'keuken' },
        { id: 'frituurolie', label: 'Frituurolie beoordeeld', hint: 'Kleur, geur en rook.', who: 'keuken', veld: { kind: 'datum', label: 'Laatst vervangen op' } },
        { id: 'kerntemperatuur', label: 'Kerntemperatuur van risicobereidingen', hint: 'In de kern van het dikste stuk.', who: 'keuken', veld: { kind: 'getal', label: 'Gemeten', eenheid: '°C', min: 75 } },
      ],
    },
    {
      id: 'hygiene',
      title: 'Hygiëne',
      items: [
        { id: 'handhygiene', label: 'Handwasplaatsen voorzien van zeep en papier', who: 'iedereen' },
        { id: 'werkkledij', label: 'Propere werkkledij', who: 'iedereen' },
      ],
    },
    {
      id: 'periodiek',
      title: 'Periodiek',
      items: [
        { id: 'thermometer-ijk', label: 'Thermometers gecontroleerd', hint: 'IJswater = 0 °C, kokend water = 100 °C.', who: 'verantwoordelijke', repeat: { kind: 'maandelijks', dayOfMonth: 1 } },
        { id: 'ongedierte', label: 'Ongediertebestrijding nagekeken', hint: 'Vangplaten en lokdozen; rapport van de firma bewaren.', who: 'verantwoordelijke', repeat: { kind: 'maandelijks', dayOfMonth: 1 } },
        { id: 'allergenen', label: 'Allergenenfiches nagekeken op de actuele kaart', who: 'verantwoordelijke', repeat: { kind: 'kwartaal', dayOfMonth: 1 } },
        { id: 'opleiding', label: 'Hygiëneopleiding personeel nagekeken', who: 'verantwoordelijke', repeat: { kind: 'jaarlijks', month: 0, dayOfMonth: 15 } },
        { id: 'autocontrole', label: 'Autocontrolesysteem doorgenomen en bijgewerkt', who: 'verantwoordelijke', repeat: { kind: 'jaarlijks', month: 0, dayOfMonth: 15 } },
      ],
    },
  ],
}

/**
 * Het poetsplan: wat wanneer schoongemaakt wordt.
 *
 * De autocontrole vraagt niet alleen dát er gepoetst wordt maar dat het
 * vastligt met een frequentie, en dat je kan tonen dat het gebeurd is. Vandaar
 * één lijst met de frequentie op elk punt, in plaats van een blad aan de muur
 * waar niemand een datum op zet.
 */
export const POETSPLAN = {
  id: 'poetsplan',
  key: 'poetsplan',
  name: 'Poetsplan',
  kind: 'register',
  sections: [
    {
      id: 'poets-dagelijks',
      title: 'Dagelijks',
      items: [
        { id: 'poets-werkvlakken', label: 'Werkoppervlakken en snijplanken gereinigd en ontsmet', who: 'keuken' },
        { id: 'poets-vloer-keuken', label: 'Vloer keuken gedweild', who: 'keuken' },
        { id: 'poets-toog', label: 'Toog en spoelbak gereinigd', who: 'zaal' },
        { id: 'poets-toiletten', label: 'Toiletten gereinigd en aangevuld', who: 'zaal' },
        { id: 'poets-vuilnis', label: 'Vuilnis buitengezet en bakken gereinigd', who: 'iedereen' },
      ],
    },
    {
      id: 'poets-wekelijks',
      title: 'Wekelijks',
      items: [
        { id: 'poets-koelkasten', label: 'Koelkasten binnenin gereinigd', who: 'keuken', repeat: { kind: 'wekelijks', days: [1] } },
        { id: 'poets-friteuse', label: 'Friteuse volledig gereinigd', who: 'keuken', repeat: { kind: 'wekelijks', days: [1] } },
        { id: 'poets-afvoer', label: 'Afvoerputjes gereinigd en ontstopt', who: 'keuken', repeat: { kind: 'wekelijks', days: [1] } },
        { id: 'poets-tapleidingen', label: 'Tapleidingen gespoeld', who: 'zaal', repeat: { kind: 'wekelijks', days: [1] } },
        { id: 'poets-terras', label: 'Terrasmeubilair gereinigd', who: 'zaal', repeat: { kind: 'wekelijks', days: [1] } },
      ],
    },
    {
      id: 'poets-maandelijks',
      title: 'Maandelijks',
      items: [
        { id: 'poets-oven', label: 'Oven en fornuis grondig ontvet', who: 'keuken', repeat: { kind: 'maandelijks', dayOfMonth: 1 } },
        { id: 'poets-dampkap', label: 'Dampkapfilters gereinigd', who: 'keuken', repeat: { kind: 'maandelijks', dayOfMonth: 1 } },
        { id: 'poets-diepvries', label: 'Diepvriezers ontdooid en gereinigd', who: 'keuken', repeat: { kind: 'maandelijks', dayOfMonth: 1 } },
        { id: 'poets-voorraadrek', label: 'Voorraadrekken leeggemaakt en gereinigd', who: 'keuken', repeat: { kind: 'maandelijks', dayOfMonth: 1 } },
        { id: 'poets-ramen', label: 'Ramen binnen en buiten', who: 'zaal', repeat: { kind: 'maandelijks', dayOfMonth: 1 } },
      ],
    },
    {
      id: 'poets-periodiek',
      title: 'Per kwartaal en per jaar',
      items: [
        { id: 'poets-dampkap-firma', label: 'Dampkapkanalen door een firma gereinigd', who: 'verantwoordelijke', repeat: { kind: 'kwartaal', dayOfMonth: 1 } },
        { id: 'poets-vetvang', label: 'Vetvangput geledigd', who: 'verantwoordelijke', repeat: { kind: 'kwartaal', dayOfMonth: 1 } },
        { id: 'poets-koeltechniek', label: 'Koeltechniek nagekeken door de onderhoudsfirma', who: 'verantwoordelijke', repeat: { kind: 'jaarlijks', month: 2, dayOfMonth: 1 } },
        { id: 'poets-brandblussers', label: 'Brandblussers gekeurd', who: 'verantwoordelijke', repeat: { kind: 'jaarlijks', month: 2, dayOfMonth: 1 } },
      ],
    },
  ],
}

export const CHECKLIST_TEMPLATES = [OPENING, CLOSING, FAVV, POETSPLAN]

/** Zaterdag en zondag. */
export function isWeekend(date = new Date()) {
  const day = date.getDay()
  return day === 0 || day === 6
}

// ─── Wie ziet wat ───────────────────────────────────────────────────────────

export const VELDSOORTEN = [
  { kind: '', label: 'Geen — alleen afvinken' },
  { kind: 'datum', label: 'Een datum' },
  { kind: 'getal', label: 'Een getal' },
]

/**
 * Ligt de gemeten waarde binnen de grenzen?
 *
 * Een vinkje bij "temperatuur koelkast gecontroleerd" zegt dat er iemand gekeken
 * heeft. Het zegt niet dat de koelkast koud genoeg was, en dat is precies wat een
 * FAVV-controleur wil zien. Vandaar een grens op het veld: onder `min` of boven
 * `max` is het punt niet in orde, hoe het vinkje ook staat.
 *
 * Een lege waarde is geen overschrijding maar een ontbrekende meting; die twee
 * hebben elk hun eigen antwoord, want "niet gemeten" en "te warm" vragen iets
 * anders van wie het leest.
 */
export function meetOordeel(veld, waarde) {
  if (!veld || veld.kind !== 'getal') return { staat: 'nvt' }
  if (waarde === '' || waarde === null || waarde === undefined) return { staat: 'leeg' }

  const getal = Number(waarde)
  if (Number.isNaN(getal)) return { staat: 'onleesbaar' }

  const onder = veld.min != null && getal < Number(veld.min)
  const boven = veld.max != null && getal > Number(veld.max)
  if (!onder && !boven) return { staat: 'ok', getal }

  return {
    staat: 'buiten',
    getal,
    grens: onder ? Number(veld.min) : Number(veld.max),
    richting: onder ? 'onder' : 'boven',
  }
}

/** De grens in één regel, zoals ze onder het invoerveld staat. */
export function grensTekst(veld) {
  if (!veld || veld.kind !== 'getal') return ''
  // De eenheid staat er los achter: "°C" is in beide talen hetzelfde, en zo
  // hoeft ze niet in elke variant van de zin opnieuw.
  const eenheid = veld.eenheid ? ` ${veld.eenheid}` : ''
  if (veld.min != null && veld.max != null) {
    return tekst('lijstlib.grens.tussen', { min: veld.min, max: veld.max }) + eenheid
  }
  if (veld.max != null) return tekst('lijstlib.grens.max', { waarde: veld.max }) + eenheid
  if (veld.min != null) return tekst('lijstlib.grens.min', { waarde: veld.min }) + eenheid
  return veld.eenheid ? tekst('lijstlib.grens.eenheid', { eenheid: veld.eenheid }) : ''
}

/*
  De sleutel ligt vast, de naam hangt aan de taal.

  Daarom is `label` een getter: deze lijst wordt één keer gemaakt en op meerdere
  schermen uitgelezen, en een vaste tekst zou na een taalwissel de oude blijven
  tonen tot iemand de pagina herlaadt. Dezelfde afspraak als `PRIORITIES` in
  `format.js`.
*/
export const AFDELINGEN = ['iedereen', 'verantwoordelijke', 'keuken', 'zaal'].map((key) => ({
  key,
  get label() {
    return tekst(`lijstlib.afdeling.${key}`)
  },
}))

export const afdelingLabel = (key) =>
  AFDELINGEN.find((a) => a.key === (key || 'iedereen'))?.label ?? key

/**
 * Een punt hoort bij iedereen, of bij één afdeling.
 *
 * De verantwoordelijke ziet alles — die is het die moet weten of de keuken
 * klaar is. Wie geen afdeling heeft, ziet wat voor iedereen is; dat is de
 * veilige kant, want een gemist punt is erger dan een punt te veel.
 */
export function visibleTo(item, person) {
  const who = item.who ?? 'iedereen'
  if (who === 'iedereen') return true
  if (!person) return false
  if (person.role === 'owner' || person.role === 'admin') return true
  if (person.department === 'verantwoordelijke') return true
  return person.department === who
}

// ─── Wanneer het moet ───────────────────────────────────────────────────────

export const HERHALINGEN = [
  { kind: 'dagelijks', label: 'Elke dag' },
  { kind: 'weekdag', label: 'Op bepaalde dagen' },
  { kind: 'wekelijks', label: 'Eén keer per week' },
  { kind: 'maandelijks', label: 'Eén keer per maand' },
  { kind: 'kwartaal', label: 'Elk kwartaal' },
  { kind: 'jaarlijks', label: 'Eén keer per jaar' },
]

export const WEEKDAGEN = [
  { dag: 1, label: 'ma' },
  { dag: 2, label: 'di' },
  { dag: 3, label: 'wo' },
  { dag: 4, label: 'do' },
  { dag: 5, label: 'vr' },
  { dag: 6, label: 'za' },
  { dag: 0, label: 'zo' },
]

/**
 * Een id voor een nieuw punt, afgeleid van wat erin staat.
 *
 * Leesbaar in de database, en vooral: vast. De afvinkingen van vandaag hangen
 * aan deze id, dus hij mag nooit meer veranderen wanneer iemand later de tekst
 * bijschaaft. Bestaat hij al, dan komt er een nummer achter.
 */
export function nieuwPuntId(label, bestaande = []) {
  const basis =
    (label ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'punt'

  if (!bestaande.includes(basis)) return basis
  let n = 2
  while (bestaande.includes(`${basis}-${n}`)) n += 1
  return `${basis}-${n}`
}

const dagenInMaand = (jaar, maand) => new Date(jaar, maand + 1, 0).getDate()

/**
 * Valt dit punt op deze dag?
 *
 * Een maanddag die niet bestaat — de 31e in februari — schuift naar de laatste
 * dag van de maand. Anders slaat zo'n punt elf maanden van het jaar over zonder
 * dat iemand het merkt.
 */
export function dueOn(item, date) {
  // Oudere lijsten kennen alleen weekendOnly; dat is een wekelijkse herhaling.
  const repeat = item.repeat ?? (item.weekendOnly ? { kind: 'weekdag', days: [0, 6] } : { kind: 'dagelijks' })

  switch (repeat.kind) {
    case 'weekdag':
      return (repeat.days ?? []).includes(date.getDay())
    case 'wekelijks':
      return date.getDay() === (repeat.days?.[0] ?? 1)
    case 'maandelijks':
      return date.getDate() === Math.min(repeat.dayOfMonth ?? 1, dagenInMaand(date.getFullYear(), date.getMonth()))
    case 'kwartaal':
      return (
        date.getMonth() % 3 === 0 &&
        date.getDate() === Math.min(repeat.dayOfMonth ?? 1, dagenInMaand(date.getFullYear(), date.getMonth()))
      )
    case 'jaarlijks':
      return (
        date.getMonth() === (repeat.month ?? 0) &&
        date.getDate() === Math.min(repeat.dayOfMonth ?? 1, dagenInMaand(date.getFullYear(), date.getMonth()))
      )
    case 'dagelijks':
    default:
      return true
  }
}

/*
  Dag- en maandnamen komen van `Intl`, niet uit een tabel hier.

  Een eigen lijstje "zondag, maandag, …" zou bij een taalwissel Nederlands
  blijven, en naast de namen van de kalenders komen te staan. `Intl` kent ze in
  beide talen en `huidigeLocaleVan` zegt in welke we nu staan — dezelfde bron
  waar `dates.js` zijn opmaak mee maakt.

  Ze worden per taal één keer gemaakt en pas opnieuw wanneer de taal wisselt:
  `Intl.DateTimeFormat` is duurder dan het lijkt, en `repeatLabel` staat op elke
  regel van een lijst met tientallen punten.

  4 januari 2026 is een zondag, dus `4 + dag` geeft precies de dag die JavaScript
  met dat nummer bedoelt.
*/
let naamLocale = null
let dagNamen = []
let maandVorm = null
let rangregels = null

function namenVanNu() {
  const locale = huidigeLocaleVan()
  if (locale !== naamLocale) {
    naamLocale = locale
    const dagVorm = new Intl.DateTimeFormat(locale, { weekday: 'long' })
    dagNamen = Array.from({ length: 7 }, (_, d) => dagVorm.format(new Date(2026, 0, 4 + d)))
    maandVorm = new Intl.DateTimeFormat(locale, { month: 'long' })
    rangregels = new Intl.PluralRules(locale, { type: 'ordinal' })
  }
  return { dagNamen, maandVorm, rangregels }
}

/** "1e" of "1st", "2e" of "2nd" — welke vorm het getal krijgt, weet `Intl`. */
function rangtelwoord(getal) {
  return tekst(`lijstlib.ordinaal_${namenVanNu().rangregels.select(getal)}`, { dag: getal })
}

/** De herhaling in één regel, zoals ze in de lijst en de editor leest. */
export function repeatLabel(item) {
  const repeat = item.repeat ?? (item.weekendOnly ? { kind: 'weekdag', days: [0, 6] } : { kind: 'dagelijks' })
  const { dagNamen: dagen, maandVorm: maand } = namenVanNu()

  switch (repeat.kind) {
    case 'weekdag': {
      const gekozen = repeat.days ?? []
      if (gekozen.length === 2 && gekozen.includes(0) && gekozen.includes(6)) {
        return tekst('lijstlib.herhaal.weekend')
      }
      return gekozen.map((d) => dagen[d]).join(', ') || tekst('lijstlib.herhaal.geen_dag')
    }
    case 'wekelijks':
      return tekst('lijstlib.herhaal.wekelijks', { dag: dagen[repeat.days?.[0] ?? 1] })
    case 'maandelijks':
      return tekst('lijstlib.herhaal.maandelijks', { dag: rangtelwoord(repeat.dayOfMonth ?? 1) })
    case 'kwartaal':
      return tekst('lijstlib.herhaal.kwartaal', { dag: rangtelwoord(repeat.dayOfMonth ?? 1) })
    case 'jaarlijks':
      return tekst('lijstlib.herhaal.jaarlijks', { maand: maand.format(new Date(2026, repeat.month ?? 0, 1)) })
    default:
      return tekst('lijstlib.herhaal.dagelijks')
  }
}

/**
 * Alles wat vandaag geldt voor deze persoon.
 *
 * Twee filters, niet één: wat vandaag moet, en wat deze persoon aangaat. Een
 * punt dat vandaag niet valt blijft helemaal weg — anders staat de lijst vol
 * met dingen die pas volgende maand moeten.
 */
export function requiredItems(checklist, { date = new Date(), person } = {}) {
  return (checklist?.sections ?? [])
    .flatMap((section) => section.items)
    .filter((item) => dueOn(item, date) && visibleTo(item, person))
}

/** Voortgang over de punten die vandaag voor deze persoon gelden. */
export function runProgress(checklist, run, options = {}) {
  const required = requiredItems(checklist, options)
  const done = required.filter((item) => run?.items?.[item.id]?.done).length
  return { done, total: required.length, ratio: required.length ? done / required.length : 0 }
}

/** Eén run per lijst per dag, zodat iedereen in dezelfde lijst afvinkt. */
export const runId = (checklistId, day) => `${checklistId}_${day}`
