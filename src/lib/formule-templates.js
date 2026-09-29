/**
 * De voorbeeldformules waarmee een lege werkruimte begint.
 *
 * Ze staan hier en niet in `src/data/formules.js` omdat de seed ze ook moet
 * kunnen lezen, en die draait in Node zonder de Firebase-SDK van de browser —
 * net zoals `checklist-templates.js` naast de dagelijkse lijsten staat.
 *
 * Alle bedragen zijn **exclusief btw**, met het Belgische tarief erbij: bereide
 * maaltijd 12%, drank 21%. Eén tarief over een formule met drank in plakken is
 * een factuur die niet klopt, dus draagt elke vraag haar eigen tarief.
 *
 * De hoeveelheden zijn de vuistregels waarmee JE Concept vandaag bestelt. Ze
 * zijn een startpunt: zodra iemand ze in Instellingen aanpast is dit bestand
 * niet meer de baas — de seed raakt een bestaande formule nooit aan.
 */

const keuze = (id, label, prijsPerPersoon = 0, prijsVast = 0) => ({ id, label, prijsPerPersoon, prijsVast })

/**
 * `inhoud` is het aantal eenheden in één bestelverpakking: duizend gram in een
 * kilo, zes flessen in een bak. Het rekenwerk rondt daarop af, want een
 * leverancier levert geen halve bak.
 */
const regel = (id, item, categorie, eenheid, perPersoon, extra = {}) => ({
  id,
  item,
  categorie,
  eenheid,
  perPersoon,
  vast: 0,
  inhoud: 1,
  verpakking: '',
  keuzeId: null,
  ...extra,
})

export const DEFAULT_FORMULES = [
  {
    id: 'winter-bbq',
    name: 'Winter BBQ',
    icon: 'utensils',
    omschrijving: 'Wintergrill met drie stukken vlees, warme bijgerechten en brood. Vaste prijs per persoon.',
    prijsPerPersoon: 29.9,
    prijsVast: 0,
    btwPercent: 12,
    templateId: 'nieuw-event',
    position: 0,
    archived: false,
    opties: [
      {
        id: 'hapjes',
        label: 'Hapjes vooraf',
        btwPercent: 12,
        keuzes: [
          keuze('hapjes-geen', 'Geen hapjes'),
          keuze('hapjes-koud', 'Koud aperobord', 4.5),
          keuze('hapjes-warm', 'Warm en koud', 7),
        ],
      },
      {
        id: 'dranken',
        label: 'Drankenformule',
        btwPercent: 21,
        keuzes: [
          keuze('dranken-geen', 'Geen (water op tafel)'),
          keuze('dranken-2u', 'Twee uur open bar', 12),
          keuze('dranken-avond', 'Heel de avond', 19),
        ],
      },
      {
        id: 'dessert',
        label: 'Dessert',
        btwPercent: 12,
        keuzes: [keuze('dessert-geen', 'Geen dessert'), keuze('dessert-bord', 'Dessertbord', 6.5)],
      },
    ],
    bestelregels: [
      regel('bbq-vlees', 'Gemengd vlees (3 soorten)', 'Keuken', 'g', 180, { inhoud: 1000, verpakking: 'kg' }),
      regel('bbq-brood', 'Broodjes', 'Keuken', 'stuks', 2),
      regel('bbq-gratin', 'Aardappelgratin', 'Keuken', 'g', 150, { inhoud: 1000, verpakking: 'kg' }),
      regel('bbq-groenten', 'Wintergroenten', 'Keuken', 'g', 120, { inhoud: 1000, verpakking: 'kg' }),
      regel('bbq-saus', 'Koude sauzen', 'Keuken', 'g', 60, { inhoud: 2500, verpakking: 'emmer' }),
      regel('bbq-water', 'Water plat en bruis', 'Drank', 'flessen', 0.5, { inhoud: 6, verpakking: 'bak' }),
      regel('bbq-houtskool', 'Houtskool', 'Materiaal', 'kg', 0, { vast: 10, inhoud: 5, verpakking: 'zak' }),
      regel('bbq-aanmaak', 'Aanmaakblokjes', 'Materiaal', 'dozen', 0, { vast: 2 }),
      regel('bbq-bord', 'Borden', 'Materiaal', 'stuks', 2),
      regel('bbq-bestek', 'Bestek', 'Materiaal', 'sets', 1.2),
      regel('bbq-servet', 'Servetten', 'Materiaal', 'stuks', 3, { inhoud: 100, verpakking: 'pak' }),
      // Hapjes: vier koude, en bij "warm en koud" komen er drie warme bij.
      regel('bbq-hapje-koud', 'Koude aperohapjes', 'Keuken', 'stuks', 4, { keuzeId: 'hapjes-koud' }),
      regel('bbq-hapje-koud-2', 'Koude aperohapjes', 'Keuken', 'stuks', 4, { keuzeId: 'hapjes-warm' }),
      regel('bbq-hapje-warm', 'Warme hapjes', 'Keuken', 'stuks', 3, { keuzeId: 'hapjes-warm' }),
      // Twee uur bar of heel de avond: dezelfde artikelen, andere aantallen.
      regel('bbq-wijn-2u', 'Wijn wit en rood', 'Drank', 'flessen', 0.25, { inhoud: 6, verpakking: 'bak', keuzeId: 'dranken-2u' }),
      regel('bbq-pils-2u', 'Pils', 'Drank', 'flesjes', 1.5, { inhoud: 24, verpakking: 'bak', keuzeId: 'dranken-2u' }),
      regel('bbq-fris-2u', 'Frisdrank', 'Drank', 'flesjes', 1, { inhoud: 24, verpakking: 'bak', keuzeId: 'dranken-2u' }),
      regel('bbq-wijn-avond', 'Wijn wit en rood', 'Drank', 'flessen', 0.4, { inhoud: 6, verpakking: 'bak', keuzeId: 'dranken-avond' }),
      regel('bbq-pils-avond', 'Pils', 'Drank', 'flesjes', 2.5, { inhoud: 24, verpakking: 'bak', keuzeId: 'dranken-avond' }),
      regel('bbq-fris-avond', 'Frisdrank', 'Drank', 'flesjes', 1.5, { inhoud: 24, verpakking: 'bak', keuzeId: 'dranken-avond' }),
      regel('bbq-glas-wijn', 'Wijnglazen', 'Materiaal', 'stuks', 1.5, { keuzeId: 'dranken-2u' }),
      regel('bbq-glas-wijn-2', 'Wijnglazen', 'Materiaal', 'stuks', 2, { keuzeId: 'dranken-avond' }),
      regel('bbq-dessert', 'Dessertbord', 'Keuken', 'stuks', 1, { keuzeId: 'dessert-bord' }),
    ],
  },
  {
    id: 'walking-dinner',
    name: 'Walking dinner',
    icon: 'utensils',
    omschrijving: 'Vijf gangen staand geserveerd, met bediening. Prijs per persoon, drank apart.',
    prijsPerPersoon: 42,
    prijsVast: 0,
    btwPercent: 12,
    templateId: 'walking-dinner',
    position: 1,
    archived: false,
    opties: [
      {
        id: 'gangen',
        label: 'Aantal gangen',
        btwPercent: 12,
        keuzes: [keuze('gangen-5', 'Vijf gangen'), keuze('gangen-7', 'Zeven gangen', 9)],
      },
      {
        id: 'dranken',
        label: 'Drankenformule',
        btwPercent: 21,
        keuzes: [
          keuze('wd-dranken-geen', 'Geen (op verbruik)'),
          keuze('wd-dranken-wijn', 'Wijnarrangement', 16),
          keuze('wd-dranken-all', 'All-in vier uur', 24),
        ],
      },
      {
        id: 'kaas',
        label: 'Kaasplank na',
        btwPercent: 12,
        // Een kaasplank per tien personen, plus het opzetten ervan: de vaste
        // kost dekt de plank en de garnituur, de rest gaat per persoon.
        keuzes: [keuze('kaas-geen', 'Geen kaas'), keuze('kaas-plank', 'Kaasplank', 5.5, 35)],
      },
    ],
    bestelregels: [
      regel('wd-gang-5', 'Gangen (mise en place)', 'Keuken', 'porties', 5, { keuzeId: 'gangen-5' }),
      regel('wd-gang-7', 'Gangen (mise en place)', 'Keuken', 'porties', 7, { keuzeId: 'gangen-7' }),
      regel('wd-brood', 'Brood bij de gangen', 'Keuken', 'g', 80, { inhoud: 1000, verpakking: 'kg' }),
      regel('wd-servies', 'Amuseborden', 'Materiaal', 'stuks', 5, { inhoud: 25, verpakking: 'bak' }),
      regel('wd-statafel', 'Statafels', 'Materiaal', 'stuks', 0.15),
      regel('wd-linnen', 'Statafelrokken', 'Materiaal', 'stuks', 0.15),
      regel('wd-servet', 'Servetten', 'Materiaal', 'stuks', 4, { inhoud: 100, verpakking: 'pak' }),
      regel('wd-water', 'Water plat en bruis', 'Drank', 'flessen', 0.5, { inhoud: 6, verpakking: 'bak' }),
      regel('wd-wijn', 'Wijn (arrangement)', 'Drank', 'flessen', 0.35, { inhoud: 6, verpakking: 'bak', keuzeId: 'wd-dranken-wijn' }),
      regel('wd-wijn-all', 'Wijn (all-in)', 'Drank', 'flessen', 0.4, { inhoud: 6, verpakking: 'bak', keuzeId: 'wd-dranken-all' }),
      regel('wd-pils-all', 'Pils', 'Drank', 'flesjes', 2, { inhoud: 24, verpakking: 'bak', keuzeId: 'wd-dranken-all' }),
      regel('wd-fris-all', 'Frisdrank', 'Drank', 'flesjes', 1.5, { inhoud: 24, verpakking: 'bak', keuzeId: 'wd-dranken-all' }),
      regel('wd-kaas', 'Kaasschotel', 'Keuken', 'g', 90, { inhoud: 1000, verpakking: 'kg', keuzeId: 'kaas-plank' }),
      regel('wd-confituur', 'Vijgenconfituur', 'Keuken', 'potten', 0, { vast: 3, keuzeId: 'kaas-plank' }),
    ],
  },
]

export const FORMULE_CATEGORIEEN = ['Keuken', 'Drank', 'Materiaal', 'Personeel', 'Overige']

export const BTW_TARIEVEN = [
  { value: 6, label: '6% — afhaal en logies' },
  { value: 12, label: '12% — bereide maaltijd ter plaatse' },
  { value: 21, label: '21% — drank, verhuur, diensten' },
]
