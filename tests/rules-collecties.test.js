import { readFileSync } from 'node:fs'
import { connect } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'

/**
 * De tien collecties die `rules.test.js` niet raakte, tegen de echte rules.
 *
 * Het zijn de collecties waar een browser níét mag schrijven (de server doet
 * het, met beheerdersrechten) of waar alleen een deel van de rollen bij mag.
 * Dat zijn ook de plekken waar een fout het meest kost: een personeelscode
 * die leesbaar wordt, een order die iemand zelf op betaald zet, een
 * reservatie die een medewerker blind aanmaakt. Zie `rules.test.js` voor
 * waarom de test zichzelf overslaat zonder emulator.
 */

const HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
const [host, poort] = HOST.split(':')

const draait = await new Promise((klaar) => {
  const v = connect({ host, port: Number(poort), timeout: 1500 })
  const antwoord = (uit) => {
    v.destroy()
    klaar(uit)
  }
  v.once('connect', () => antwoord(true))
  v.once('error', () => antwoord(false))
  v.once('timeout', () => antwoord(false))
})
const beschrijf = draait ? describe : describe.skip

let omgeving = null

beforeAll(async () => {
  if (!draait) return
  omgeving = await initializeTestEnvironment({
    projectId: 'je-planning-rules-collecties',
    firestore: {
      host,
      port: Number(poort),
      rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  })
}, 30000)

afterAll(async () => {
  await omgeving?.cleanup()
})

const RIJEN = {
  'profiles/u-eigenaar': { role: 'owner', active: true },
  'profiles/u-lid': { role: 'member', active: true },
  'profiles/u-personeel': { role: 'staff', active: true },
  'profiles/u-social': { role: 'social', active: true },
  'personeelCodes/e-1': { hash: 'x', aapiEmployeeId: 'e-1' },
  'messaging/barvue-h1': { bron: 'barvue', soort: 'offerte.aangevraagd', inhoud: { email: 'an@example.be' } },
  'huurorders/o-1': { status: 'betaald', totaal: 12000 },
  'verhuuraanvragen/a-1': { naam: 'An', stand: 'nieuw' },
  'verhuurSessies/s-1': { hash: 'x', vervalt: new Date('2030-01-01') },
  'materiaal/m-1': { naam: 'Statafel', inkoop: 40, leverancier: 'X' },
  'reservaties/r-1': { materiaalId: 'm-1', aantal: 2 },
  'attachments/b-1': { taskId: 't-1', naam: 'plan.pdf' },
  'config/algemeen': { naam: 'JE Concept' },
  'aapiShifts/d-1': { aapiEmployeeId: 'e-1', uren: 6 },
  'aapiShifts/d-2': { aapiEmployeeId: 'e-2', uren: 8 },
  'aapiEmployees/e-1': { naam: 'Lien' },
  'aapiImportRuns/i-1': { stand: 'klaar' },
  'aapiImportQueue/q-1': { stand: 'wacht' },
}

beforeEach(async () => {
  if (!draait) return
  await omgeving.clearFirestore()
  await omgeving.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    for (const [pad, data] of Object.entries(RIJEN)) await setDoc(doc(db, pad), data)
  })
})

const als = (uid, claims) => omgeving.authenticatedContext(uid, claims).firestore()
const niemand = () => omgeving.unauthenticatedContext().firestore()
const ROLLEN = ['u-eigenaar', 'u-lid', 'u-personeel', 'u-social']

/** Niemand in een browser, welke rol ook: niet lezen, niet schrijven. */
async function dicht(pad) {
  for (const uid of ROLLEN) {
    await assertFails(getDoc(doc(als(uid), pad)))
    await assertFails(setDoc(doc(als(uid), pad), { x: 1 }))
    await assertFails(deleteDoc(doc(als(uid), pad)))
  }
  await assertFails(getDoc(doc(niemand(), pad)))
}

/** Het team leest, personeel en de socialrol niet, en niemand schrijft. */
async function teamLeestAlleenServerSchrijft(pad) {
  await assertSucceeds(getDoc(doc(als('u-eigenaar'), pad)))
  await assertSucceeds(getDoc(doc(als('u-lid'), pad)))
  await assertFails(getDoc(doc(als('u-personeel'), pad)))
  await assertFails(getDoc(doc(als('u-social'), pad)))
  for (const uid of ROLLEN) {
    await assertFails(setDoc(doc(als(uid), pad), { x: 1 }))
    await assertFails(deleteDoc(doc(als(uid), pad)))
  }
}

beschrijf('collecties die alleen de server kent', () => {
  it('personeelCodes: uit geen enkele browser leesbaar, ook niet voor de eigenaar', async () => {
    await dicht('personeelCodes/e-1')
    // Ook niet met de claim van de medewerker zelf: zijn code kent hij, de hash niet.
    await assertFails(getDoc(doc(als('u-personeel', { aapiEmployeeId: 'e-1' }), 'personeelCodes/e-1')))
  })

  it('verhuurSessies: hashes en vervaldagen, voor niemand', async () => {
    await dicht('verhuurSessies/s-1')
  })
})

beschrijf('messaging', () => {
  it('leest alleen een beheerder: er staan namen en mailadressen in', async () => {
    await assertSucceeds(getDoc(doc(als('u-eigenaar'), 'messaging/barvue-h1')))
    await assertFails(getDoc(doc(als('u-lid'), 'messaging/barvue-h1')))
    await assertFails(getDoc(doc(als('u-personeel'), 'messaging/barvue-h1')))
    await assertFails(getDoc(doc(niemand(), 'messaging/barvue-h1')))
  })

  it('schrijft niemand, ook de beheerder niet: de log is onveranderlijk', async () => {
    for (const uid of ROLLEN) {
      await assertFails(setDoc(doc(als(uid), 'messaging/nieuw'), { bron: 'barvue' }))
      await assertFails(updateDoc(doc(als(uid), 'messaging/barvue-h1'), { 'verwerking.event.stand': 'klaar' }))
      await assertFails(deleteDoc(doc(als(uid), 'messaging/barvue-h1')))
    }
  })
})

beschrijf('verhuur', () => {
  it('huurorders: het magazijn leest, niemand zet zijn eigen order op betaald', async () => {
    await teamLeestAlleenServerSchrijft('huurorders/o-1')
    await assertFails(updateDoc(doc(als('u-eigenaar'), 'huurorders/o-1'), { status: 'betaald' }))
  })

  it('verhuuraanvragen: de functie maakt ze aan, het team werkt de stand bij', async () => {
    await assertSucceeds(getDoc(doc(als('u-lid'), 'verhuuraanvragen/a-1')))
    await assertFails(getDoc(doc(als('u-personeel'), 'verhuuraanvragen/a-1')))
    await assertFails(setDoc(doc(als('u-eigenaar'), 'verhuuraanvragen/a-2'), { naam: 'Nep' }))
    await assertSucceeds(updateDoc(doc(als('u-lid'), 'verhuuraanvragen/a-1'), { stand: 'gebeld' }))
    await assertFails(updateDoc(doc(als('u-personeel'), 'verhuuraanvragen/a-1'), { stand: 'gebeld' }))
    await assertFails(updateDoc(doc(als('u-social'), 'verhuuraanvragen/a-1'), { stand: 'gebeld' }))
  })

  it('verhuuraanvragen: wissen doet een beheerder', async () => {
    await assertFails(deleteDoc(doc(als('u-lid'), 'verhuuraanvragen/a-1')))
    await assertSucceeds(deleteDoc(doc(als('u-eigenaar'), 'verhuuraanvragen/a-1')))
  })

  it('materiaal: het team leest, alleen een beheerder past de catalogus aan', async () => {
    await assertSucceeds(getDoc(doc(als('u-lid'), 'materiaal/m-1')))
    await assertFails(getDoc(doc(als('u-personeel'), 'materiaal/m-1')))
    await assertFails(getDoc(doc(als('u-social'), 'materiaal/m-1')))
    await assertFails(updateDoc(doc(als('u-lid'), 'materiaal/m-1'), { inkoop: 1 }))
    await assertSucceeds(updateDoc(doc(als('u-eigenaar'), 'materiaal/m-1'), { inkoop: 45 }))
  })

  it('reservaties: het team reserveert, personeel en de socialrol niet', async () => {
    await assertSucceeds(setDoc(doc(als('u-lid'), 'reservaties/r-2'), { materiaalId: 'm-1', aantal: 1 }))
    await assertSucceeds(updateDoc(doc(als('u-lid'), 'reservaties/r-1'), { aantal: 3 }))
    await assertSucceeds(deleteDoc(doc(als('u-lid'), 'reservaties/r-2')))
    for (const uid of ['u-personeel', 'u-social']) {
      await assertFails(getDoc(doc(als(uid), 'reservaties/r-1')))
      await assertFails(setDoc(doc(als(uid), 'reservaties/r-3'), { materiaalId: 'm-1', aantal: 10 }))
      await assertFails(updateDoc(doc(als(uid), 'reservaties/r-1'), { aantal: 0 }))
      await assertFails(deleteDoc(doc(als(uid), 'reservaties/r-1')))
    }
  })
})

beschrijf('werkruimte', () => {
  it('attachments: alleen het team', async () => {
    await assertSucceeds(getDoc(doc(als('u-lid'), 'attachments/b-1')))
    await assertSucceeds(setDoc(doc(als('u-lid'), 'attachments/b-2'), { taskId: 't-1', naam: 'x.pdf' }))
    for (const uid of ['u-personeel', 'u-social']) {
      await assertFails(getDoc(doc(als(uid), 'attachments/b-1')))
      await assertFails(setDoc(doc(als(uid), 'attachments/b-3'), { taskId: 't-1' }))
    }
  })

  it('config: elk lid leest, alleen een beheerder schrijft', async () => {
    for (const uid of ROLLEN) await assertSucceeds(getDoc(doc(als(uid), 'config/algemeen')))
    await assertFails(getDoc(doc(niemand(), 'config/algemeen')))
    await assertFails(setDoc(doc(als('u-lid'), 'config/algemeen'), { naam: 'Nep' }))
    await assertSucceeds(setDoc(doc(als('u-eigenaar'), 'config/algemeen'), { naam: 'JE Concept' }))
  })
})

beschrijf('AAPI: JE Plan leest alleen', () => {
  it('niemand schrijft in een aapi-collectie, ook de eigenaar niet', async () => {
    for (const pad of ['aapiShifts/d-1', 'aapiEmployees/e-1', 'aapiImportRuns/i-1', 'aapiImportQueue/q-1']) {
      for (const uid of ROLLEN) {
        await assertFails(setDoc(doc(als(uid), pad), { x: 1 }))
        await assertFails(deleteDoc(doc(als(uid), pad)))
      }
    }
  })

  it('het team leest alle diensten, medewerkers en importen', async () => {
    for (const pad of ['aapiShifts/d-1', 'aapiShifts/d-2', 'aapiEmployees/e-1', 'aapiImportRuns/i-1', 'aapiImportQueue/q-1']) {
      await assertSucceeds(getDoc(doc(als('u-lid'), pad)))
    }
  })

  it('een medewerker leest zijn eigen diensten en niet die van een collega', async () => {
    const lien = als('u-personeel', { aapiEmployeeId: 'e-1' })
    await assertSucceeds(getDoc(doc(lien, 'aapiShifts/d-1')))
    await assertFails(getDoc(doc(lien, 'aapiShifts/d-2')))
    await assertFails(getDoc(doc(lien, 'aapiEmployees/e-1')))
    // Zonder claim, dus een veld in zijn profiel helpt hem niet.
    await assertFails(getDoc(doc(als('u-personeel'), 'aapiShifts/d-1')))
  })
})
