import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * De grens tussen JE Plan en AAPI, als test.
 *
 * ── Waarom dit bestaat ────────────────────────────────────────────────────
 * Beschikbaarheid, contracten, statuten, Dimona en loon horen in AAPI en
 * nergens anders. Dat staat in `CLAUDE.md`, maar een afspraak op papier
 * verdwijnt: over een jaar vraagt iemand "kunnen we hier niet gewoon
 * bijhouden wie kan werken", en dat is één scherm werk en één bron te veel.
 *
 * Twee bronnen voor dezelfde vraag betekent dat er een dag komt waarop ze
 * verschillen. Bij een planningsconflict kost dat een misverstand. Bij een
 * contract of een Dimona-aangifte kost het een boete, en dan staat er in twee
 * systemen iets anders over wat iemand gewerkt heeft.
 *
 * Deze test houdt die grens tegen de code aan. Ze is met opzet grof: ze kijkt
 * naar namen, niet naar bedoelingen. Wie hier tegenaan loopt, hoort niet het
 * woord te veranderen maar de regel te lezen.
 */

const wortel = new URL('../', import.meta.url)
const lees = (pad) => readFileSync(new URL(pad, wortel), 'utf8')

/** Wat uit AAPI komt, wordt hier niet geschreven. */
const UIT_AAPI = ['aapiShifts', 'aapiEmployees', 'aapiImportRuns', 'aapiImportQueue']

/**
 * Onderwerpen die in JE Plan geen eigen collectie krijgen.
 *
 * Geen losse woorden: `uren` zou de tijdsregistratie raken, en die gaat over
 * waar iemand aan gewerkt heeft en niet over wat hij betaald krijgt.
 */
const NIET_HIER = [
  'beschikbaarheid',
  'beschikbaarheden',
  'availability',
  'contracten',
  'contracts',
  'arbeidscontract',
  'dimona',
  'loon',
  'loonbrief',
  'payroll',
  'uurrooster',
  'uurroosters',
  'personeelsplanning',
]

describe('personeel komt uit AAPI', () => {
  const regels = lees('firestore.rules')

  for (const collectie of UIT_AAPI) {
    it(`${collectie} is nergens vanuit een browser te schrijven`, () => {
      const blok = regels.match(new RegExp(`match /${collectie}/\\{[^}]+\\} \\{([\\s\\S]*?)\\n    \\}`))
      expect(blok, `${collectie} staat niet in firestore.rules`).not.toBeNull()
      expect(blok[1]).toMatch(/allow write:\s*if false/)
      expect(blok[1]).not.toMatch(/allow (create|update|delete|write):\s*if (?!false)/)
    })
  }

  it('heeft geen eigen collectie voor wat in AAPI hoort', () => {
    /*
      Zowel de rules als de collectienamen in de app: een collectie die in
      `collections.js` staat maar niet in de rules, is een collectie die
      niemand mag lezen — maar ze is er dan wel, en dan is het een kwestie van
      tijd voor de rules volgen.
    */
    const bronnen = [lees('firestore.rules'), lees('src/lib/collections.js'), lees('demo/regels.js')]
    const gevonden = []
    for (const onderwerp of NIET_HIER) {
      const patroon = new RegExp(`(match /|['"\`])${onderwerp}(/|['"\`])`, 'i')
      if (bronnen.some((bron) => patroon.test(bron))) gevonden.push(onderwerp)
    }
    expect({ verboden: gevonden, zie: 'CLAUDE.md' }).toEqual({ verboden: [], zie: 'CLAUDE.md' })
  })

  it('schrijft nergens in de app naar een AAPI-collectie', () => {
    /*
      De rules zijn het slot; dit is de deurklink. Code die toch probeert te
      schrijven, krijgt live een rechtenfout — en dat is een scherm dat stuk
      lijkt in plaats van een afspraak die uitgelegd wordt.
    */
    const bestanden = []
    const loop = (map) => {
      for (const naam of readdirSync(new URL(map, wortel), { withFileTypes: true })) {
        if (naam.isDirectory()) loop(`${map}${naam.name}/`)
        else if (/\.jsx?$/.test(naam.name)) bestanden.push(`${map}${naam.name}`)
      }
    }
    loop('src/')

    const schrijvers = []
    for (const pad of bestanden) {
      const bron = lees(pad)
      for (const collectie of UIT_AAPI) {
        // `setDoc`, `updateDoc`, `addDoc`, `deleteDoc` of een batch op die naam.
        if (new RegExp(`(setDoc|updateDoc|addDoc|deleteDoc|batch\\.(set|update|delete))\\([^)]*${collectie}`).test(bron)) {
          schrijvers.push(`${pad} → ${collectie}`)
        }
      }
    }
    expect({ schrijvers, zie: 'CLAUDE.md' }).toEqual({ schrijvers: [], zie: 'CLAUDE.md' })
  })
})
