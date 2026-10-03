import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as tool from '../src/lib/voorraad'
import * as server from '../functions-betaling/vrij'
import { past } from '../functions-betaling/vrij'

/**
 * De twee kanten van de verhuur moeten hetzelfde rekenen.
 *
 * De backoffice rekent in de browser en de kassa rekent op de server, en dat
 * is met opzet: de browser kan geen prijzen bepalen en de server kan geen
 * kalender tekenen. Maar lopen die twee uit elkaar, dan verkoopt de site een
 * tent die het magazijn al vergeven heeft, en dat merkt niemand tot de camion
 * geladen wordt.
 *
 * Dus staat hier geen test van één bestand maar van de afspraak tussen twee.
 */

describe('de prijsmotor staat twee keer en is twee keer dezelfde', () => {
  /*
    Een kopie en geen gedeelde import, want een Cloud Functions-codebase mag
    niets uit `src/` halen: wat er in de functiemap staat, is alles wat er
    uitgerold wordt. Een kopie die stilletjes uit elkaar loopt is dan het
    gevaar, en dit is het alarm. Kwam je hier omdat deze test omviel: pas het
    bestand in `src/lib/` aan en kopieer het, niet omgekeerd en niet allebei.
  */
  it('is letterlijk hetzelfde bestand', () => {
    const inDeTool = readFileSync(new URL('../src/lib/huurprijs.js', import.meta.url), 'utf8')
    const opDeServer = readFileSync(new URL('../functions-betaling/huurprijs.js', import.meta.url), 'utf8')
    expect(opDeServer).toBe(inDeTool)
  })
})

describe('bezetting telt aan beide kanten hetzelfde', () => {
  /*
    Niet één gedeelde implementatie, want de vraag verschilt: de backoffice
    mág overboeken en de kassa niet. Wat wél gelijk moet zijn is het tellen —
    welke standen bezet houden, hoe de uitloop meetelt, wat er gebeurt bij een
    vroege teruggave. Die gevallen staan hieronder, en ze gaan door beide
    implementaties.
  */
  const gevallen = [
    { naam: 'een gewone vaste boeking', r: [{ van: '2027-03-12', tot: '2027-03-14', aantal: 2, status: 'vast' }] },
    { naam: 'een optie zonder vervaldatum', r: [{ van: '2027-03-12', tot: '2027-03-13', aantal: 1, status: 'optie' }] },
    { naam: 'een stuk dat buiten is', r: [{ van: '2027-03-12', tot: '2027-03-12', aantal: 3, status: 'uit' }] },
    { naam: 'een afgezegde boeking', r: [{ van: '2027-03-12', tot: '2027-03-14', aantal: 5, status: 'geannuleerd' }] },
    { naam: 'een teruggebrachte boeking', r: [{ van: '2027-03-12', tot: '2027-03-14', aantal: 1, status: 'terug' }] },
    {
      naam: 'vroeger terug dan geboekt',
      r: [{ van: '2027-03-12', tot: '2027-03-18', aantal: 2, status: 'uit', teruggebrachtOp: '2027-03-14' }],
    },
    {
      naam: 'twee boekingen die elkaar overlappen',
      r: [
        { van: '2027-03-12', tot: '2027-03-14', aantal: 2, status: 'vast' },
        { van: '2027-03-13', tot: '2027-03-16', aantal: 3, status: 'optie' },
      ],
    },
    { naam: 'een boeking van één dag', r: [{ van: '2027-03-12', tot: '2027-03-12', aantal: 1, status: 'vast' }] },
  ]

  /*
    De backoffice splitst vast en optie, want daar is het verschil er een om
    te zien: een optie is nog te bellen. De kassa heeft alleen het totaal
    nodig, want online is bezet gewoon bezet. Vergeleken wordt dus de som —
    en dát is wat gelijk moet blijven.
  */
  const totalen = (kaart) =>
    Object.fromEntries(
      [...kaart].sort().map(([dag, waarde]) => [dag, typeof waarde === 'number' ? waarde : waarde.vast + waarde.optie])
    )

  for (const { naam, r } of gevallen) {
    for (const uitloopDagen of [0, 1, 2]) {
      it(`${naam}, met ${uitloopDagen} uitloopdagen`, () => {
        const nu = new Date('2027-03-01T10:00:00Z')
        expect(totalen(server.bezetPerDag(r, { uitloopDagen, nu }))).toEqual(
          totalen(tool.bezetPerDag(r, { uitloopDagen, nu }))
        )
      })
    }
  }
})

describe('de kassa is strenger dan de backoffice', () => {
  const tent = { id: 'm-tent', naam: 'Stretchtent', aantal: 2, uitloopDagen: 1 }
  const bezet = [{ van: '2027-03-12', tot: '2027-03-13', aantal: 2, status: 'vast' }]

  /*
    Hetzelfde geval, twee antwoorden — en dat is de bedoeling. In de
    backoffice is "te weinig" een waarschuwing waar je overheen mag: je huurt
    bij of je belt de andere klant. Online kan dat niet, dus daar is het een
    weigering.
  */
  it('weigert wat de backoffice alleen zou aanstippen', () => {
    const inDeTool = tool.kanErbij({ materiaal: tent, van: '2027-03-12', tot: '2027-03-12', aantal: 1, reservaties: bezet })
    const opDeKassa = past({ materiaal: tent, van: '2027-03-12', tot: '2027-03-12', aantal: 1, reservaties: bezet })

    expect(inDeTool.vrij).toBe(0)
    expect(opDeKassa.kan).toBe(false)
    expect(opDeKassa.reden).toBe('te_weinig')
  })

  it('laat door wat er wél is', () => {
    const uit = past({ materiaal: tent, van: '2027-03-20', tot: '2027-03-21', aantal: 2, reservaties: bezet })
    expect(uit.kan).toBe(true)
    expect(uit.vrij).toBe(2)
  })

  /*
    Het minimum over de dagen, niet het gemiddelde. Een tent die vier van de
    vijf dagen vrij is, is niet vrij — en een kassa die dat verkeerd leest,
    laat iemand betalen voor een gat in de week.
  */
  it('neemt de krapste dag van de periode', () => {
    const uit = past({
      materiaal: { aantal: 3, uitloopDagen: 0 },
      van: '2027-03-12',
      tot: '2027-03-16',
      aantal: 2,
      reservaties: [{ van: '2027-03-14', tot: '2027-03-14', aantal: 2, status: 'vast' }],
    })
    expect(uit.kan).toBe(false)
    expect(uit.vrij).toBe(1)
  })

  /*
    Een afgebroken afrekening mag de voorraad niet gijzelen. Zonder dit staat
    een tent een halfuur — of voor altijd, als er iets misging — geblokkeerd
    voor iemand die nooit betaald heeft.
  */
  it('telt een vervallen optie niet meer mee', () => {
    const nu = new Date('2027-03-01T12:00:00Z')
    const verlopen = [
      {
        van: '2027-03-12',
        tot: '2027-03-12',
        aantal: 2,
        status: 'optie',
        optieVervalt: new Date('2027-03-01T11:00:00Z'),
      },
    ]
    expect(past({ materiaal: { aantal: 2 }, van: '2027-03-12', tot: '2027-03-12', aantal: 2, reservaties: verlopen, nu }).kan).toBe(true)
  })

  it('houdt een optie die nog loopt wél vast', () => {
    const nu = new Date('2027-03-01T12:00:00Z')
    const lopend = [
      {
        van: '2027-03-12',
        tot: '2027-03-12',
        aantal: 2,
        status: 'optie',
        optieVervalt: new Date('2027-03-01T12:20:00Z'),
      },
    ]
    expect(past({ materiaal: { aantal: 2 }, van: '2027-03-12', tot: '2027-03-12', aantal: 1, reservaties: lopend, nu }).kan).toBe(false)
  })

  it('zegt nee bij een onvolledige vraag in plaats van ja', () => {
    expect(past({ materiaal: { aantal: 5 }, van: '', tot: '', aantal: 1 }).kan).toBe(false)
    expect(past({ materiaal: { aantal: 5 }, van: '2027-03-12', tot: '2027-03-12', aantal: 0 }).kan).toBe(false)
  })

  /*
    Een omgekeerde of belachelijke periode uit een formulier mag geen
    oneindige lus worden. Dat klinkt vergezocht tot iemand een jaartal
    verkeerd typt.
  */
  it('loopt niet vast op een rare periode', () => {
    expect(server.dagenTussen('2027-03-14', '2027-03-12')).toEqual([])
    expect(server.dagenTussen('2027-03-12', '2099-03-12').length).toBe(1100)
  })
})
