import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { REGELS, toets } from '../demo/regels.js'

/**
 * De demo speelt de beveiligingsregels na (`demo/regels.js`), zodat de
 * browsertest kan zien wat een rol werkelijk te zien krijgt. Dat is alleen iets
 * waard zolang die twee hetzelfde zeggen: een spiegel die achterloopt geeft
 * groen licht aan een scherm dat live op een rechtenfout strandt — precies de
 * fout die deze hele constructie moet vangen.
 *
 * Deze test leest `firestore.rules` en vergelijkt hem regel voor regel met de
 * tabel. Alleen de eenvoudige gevallen: de `allow read`-regels die uit
 * rolpredicaten bestaan. De voorwaarden die over de inhoud van één document
 * gaan (`viewerIds`, `profileId == request.auth.uid`) staan hier niet in — die
 * kijkt Firestore per document na en de tabel doet dat bewust niet.
 */

const pad = (naam) => fileURLToPath(new URL(`../${naam}`, import.meta.url))
const rules = readFileSync(pad('firestore.rules'), 'utf8')

const ROLLEN = ['owner', 'admin', 'member', 'guest', 'staff', 'social']

/** De rolpredicaten uit `firestore.rules`, per rol uitgerekend. */
const PREDICAAT = {
  isMember: () => true,
  isTeam: (rol) => rol !== 'staff' && rol !== 'social',
  isSocial: (rol) => rol === 'social',
  isBistro: (rol) => rol !== 'social',
  isAdmin: (rol) => rol === 'owner' || rol === 'admin',
  signedIn: () => true,
}

/**
 * De leesregel van elke collectie die er één op één in staat.
 *
 * `match /x/{id} { allow read: if isTeam(); }` en de eenregelige vorm
 * `match /x/{id}      { allow read: if isTeam() || isSocial(); allow write: … }`
 * komen allebei voor; deze uitdrukking vangt ze allebei, en slaat een regel
 * over waar iets anders in staat dan alleen rolpredicaten.
 */
function leesregelsUitRules() {
  const gevonden = {}
  // Haakjes tellen in plaats van er een uitdrukking op loslaten: een blok van
  // één regel en een blok van twintig zien er anders uit, en een uitdrukking
  // die het verschil niet ziet slaat stilzwijgend collecties over.
  const koppen = rules.matchAll(/match\s+\/([a-zA-Z]+)\/\{[^}]+\}\s*\{/g)
  for (const kop of koppen) {
    const collectie = kop[1]
    let diepte = 1
    let i = kop.index + kop[0].length
    const start = i
    for (; i < rules.length && diepte > 0; i++) {
      if (rules[i] === '{') diepte += 1
      else if (rules[i] === '}') diepte -= 1
    }
    const body = rules.slice(start, i - 1)
    const lees = body.match(/allow\s+read[^:]*:\s*if\s+([^;]+);/)
    if (!lees) continue
    const uitdrukking = lees[1].replace(/\s+/g, ' ').trim()
    // Alleen de vorm "predicaat() || predicaat()" — de rest is documentwerk.
    if (!/^(\w+\(\)\s*(\|\|\s*)?)+$/.test(uitdrukking)) continue
    gevonden[collectie] = uitdrukking.split('||').map((deel) => deel.trim().replace('()', ''))
  }
  return gevonden
}

const UIT_RULES = leesregelsUitRules()

describe('demo/regels.js spiegelt firestore.rules', () => {
  it('vindt de collecties die met een rolregel afgeschermd zijn', () => {
    // Zonder deze controle zou een stukgelopen uitdrukking hierboven de hele
    // test stilzwijgend groen maken: nul collecties vergelijken lukt altijd.
    expect(Object.keys(UIT_RULES).length).toBeGreaterThan(25)
    expect(UIT_RULES.tasks).toEqual(['isTeam'])
    expect(UIT_RULES.socialEvents).toEqual(['isTeam', 'isSocial'])
  })

  for (const [collectie, predicaten] of Object.entries(UIT_RULES)) {
    it(`${collectie}: dezelfde rollen mogen lezen`, () => {
      expect(REGELS[collectie], `${collectie} ontbreekt in demo/regels.js`).toBeTruthy()

      for (const rol of ROLLEN) {
        const volgensRules = predicaten.some((naam) => PREDICAAT[naam](rol))
        const volgensDemo = toets('lezen', { rol, uid: 'u', collectie, id: 'x' }) === null
        expect(volgensDemo, `${collectie} · ${rol}`).toBe(volgensRules)
      }
    })
  }
})

describe('de rollen zoals de regels ze kennen', () => {
  it('sluit personeel en de socialrol uit de taken, en dus uit de bedragen', () => {
    for (const rol of ['staff', 'social']) {
      expect(toets('lezen', { rol, uid: 'u', collectie: 'tasks' })).toContain('mag niet lezen')
    }
  })

  it('laat de socialrol wel op de kale kopie van de events', () => {
    expect(toets('lezen', { rol: 'social', uid: 'u', collectie: 'socialEvents' })).toBeNull()
  })

  it('laat de socialrol alleen haar eigen uren opvragen', () => {
    const zonderFilter = toets('lezen', { rol: 'social', uid: 'u-charish', collectie: 'timeEntries' })
    expect(zonderFilter).toContain('mag niet lezen')

    const metFilter = toets('lezen', {
      rol: 'social',
      uid: 'u-charish',
      collectie: 'timeEntries',
      filters: [{ field: 'profileId', op: '==', value: 'u-charish' }],
    })
    expect(metFilter).toBeNull()
  })

  /*
    De gastrol is niet meer te kiezen, en deze test houdt dat zo.

    In `firestore.rules` komt het woord `guest` nergens voor: `isTeam()` sluit
    alleen personeel en de socialrol uit. Een gast was dus een volwaardig
    teamlid met een ander woord ervoor — inclusief de offertes, de bedragen en
    het logboek — terwijl de interface hem juist wegliet uit de kiezers voor
    uitvoerders. Wie iemand op Gast zette, dacht te beperken en deed dat niet.

    Er stond niemand op, dus de optie is uit de keuzelijst gehaald. Wie de rol
    ooit echt wil, bouwt hem eerst in de regels en zet hem daarna pas terug —
    en komt dan hier langs.
  */
  it('geeft een gast nog altijd dezelfde rechten als een teamlid', () => {
    for (const collectie of Object.keys(REGELS)) {
      const gast = toets('lezen', { rol: 'guest', uid: 'u', collectie, id: 'u' })
      const lid = toets('lezen', { rol: 'member', uid: 'u', collectie, id: 'u' })
      expect(Boolean(gast), `${collectie}`).toBe(Boolean(lid))
    }
  })

  it('is daarom niet meer te kiezen bij Instellingen', () => {
    const settings = readFileSync(new URL('../src/pages/Settings.jsx', import.meta.url), 'utf8')
    const lijst = settings.slice(settings.indexOf('const ROLES = ['), settings.indexOf(']', settings.indexOf('const ROLES = [')))
    expect(lijst).not.toContain("'guest'")
  })
})
