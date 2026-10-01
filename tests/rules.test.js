import { readFileSync } from 'node:fs'
import { connect } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'

/**
 * De echte `firestore.rules`, tegen een echte database.
 *
 * ── Waarom dit er moest komen ─────────────────────────────────────────────
 * `demo/regels.js` spiegelt de leesregels zodat de browsertest merkt wanneer
 * een scherm iets opvraagt wat de regels weigeren. Maar dat is een kopie, en
 * een kopie bewijst niets over het origineel. De regels zelf draaiden tot nu
 * in geen enkele test: een fout erin kwam pas aan het licht in productie, op
 * een tool waar klantgegevens en bedragen in staan.
 *
 * Hier draait de emulator met precies het bestand dat uitgerold wordt. Wat
 * hieronder staat is niet "elke regel" — dat leest niemand na — maar de
 * gevallen waar het echt om gaat: mag de verkeerde rol erbij, blijft de vorm
 * van een bedrag kloppen, en kan iemand de sporen uitwissen.
 *
 * ── Zonder emulator ───────────────────────────────────────────────────────
 * Deze test slaat zichzelf over wanneer er geen emulator draait, met een
 * regel in de uitvoer. Een test die faalt omdat er iets níét draait, wordt na
 * drie keer genegeerd — en dan wordt hij ook genegeerd wanneer hij terecht
 * faalt. Starten doe je met `npm run emulators` of `npm run test:rules`.
 */

const HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
const [host, poort] = HOST.split(':')

/*
  Eerst kijken of de emulator er is, en pas daarna de tests opstellen.

  Zou dit in `beforeAll` staan, dan zouden de tests zichzelf overslaan mét een
  vinkje: 23 groene regels voor 23 dingen die niet gecontroleerd zijn. Dat is
  erger dan geen test, want het leest als bewijs. Nu staan ze als "skipped" in
  de uitvoer, en dat is wat er gebeurd is.
*/
const draait = await bereikbaar(host, Number(poort))
if (!draait) {
  console.warn(
    `\n  Regeltest overgeslagen: geen Firestore-emulator op ${HOST}.` +
      ' Draai "npm run test:rules" om hem mét emulator te draaien.\n'
  )
}

function bereikbaar(adres, poortnummer) {
  return new Promise((klaar) => {
    const verbinding = connect({ host: adres, port: poortnummer, timeout: 1500 })
    const antwoord = (uit) => {
      verbinding.destroy()
      klaar(uit)
    }
    verbinding.once('connect', () => antwoord(true))
    verbinding.once('error', () => antwoord(false))
    verbinding.once('timeout', () => antwoord(false))
  })
}

/** Beschrijvingen die alleen bestaan wanneer er iets te testen valt. */
const beschrijf = draait ? describe : describe.skip

let omgeving = null

beforeAll(async () => {
  if (!draait) return
  omgeving = await initializeTestEnvironment({
    projectId: 'je-planning-rules-test',
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

beforeEach(async () => {
  if (!draait) return
  await omgeving.clearFirestore()
  // De profielen bepalen wie wie is; de regels lezen ze op elke vraag.
  await omgeving.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'profiles/u-eigenaar'), { role: 'owner', active: true })
    await setDoc(doc(db, 'profiles/u-lid'), { role: 'member', active: true })
    await setDoc(doc(db, 'profiles/u-tweede'), { role: 'member', active: true })
    await setDoc(doc(db, 'profiles/u-personeel'), { role: 'staff', active: true })
    await setDoc(doc(db, 'profiles/u-social'), { role: 'social', active: true })
    await setDoc(doc(db, 'profiles/u-weg'), { role: 'member', active: false })
    await setDoc(doc(db, 'lists/l-events'), { kind: 'events', name: 'Events' })
    await setDoc(doc(db, 'tasks/t-1'), {
      title: 'Trouw Niels en Inez',
      listId: 'l-events',
      quoteAmount: 16399,
      pax: 140,
      archived: false,
      createdBy: 'u-lid',
      createdAt: new Date('2026-01-01'),
    })
    await setDoc(doc(db, 'comments/c-1'), { taskId: 't-1', authorId: 'u-lid', body: 'Van mij' })
    await setDoc(doc(db, 'customers/k-1'), { name: 'Blum België' })
    await setDoc(doc(db, 'mails/m-1'), { van: 'klant@example.be', tekst: 'dag', eventId: null })
  })
})

const alsWie = (uid) => omgeving.authenticatedContext(uid).firestore()
const alsNiemand = () => omgeving.unauthenticatedContext().firestore()

beschrijf('wie er überhaupt binnen mag', () => {
  it('niet aangemeld: niets', async () => {
    await assertFails(getDoc(doc(alsNiemand(), 'tasks/t-1')))
    await assertFails(getDoc(doc(alsNiemand(), 'customers/k-1')))
  })

  // De grootste zorg van deze tool: personeel ziet geen bedragen en geen
  // klantgegevens. Dat is geen belofte van het scherm maar van de database.
  it('personeel komt niet bij taken, klanten of offertes', async () => {
    const db = alsWie('u-personeel')
    await assertFails(getDoc(doc(db, 'tasks/t-1')))
    await assertFails(getDoc(doc(db, 'customers/k-1')))
    await assertFails(getDoc(doc(db, 'offertes/o-1')))
  })

  it('de socialrol ook niet', async () => {
    const db = alsWie('u-social')
    await assertFails(getDoc(doc(db, 'tasks/t-1')))
    await assertFails(getDoc(doc(db, 'customers/k-1')))
  })

  // Wie vertrokken is, is vertrokken. Het account blijft bestaan voor de
  // historiek, maar leest niets meer.
  it('een gearchiveerd profiel leest niets meer', async () => {
    await assertFails(getDoc(doc(alsWie('u-weg'), 'tasks/t-1')))
  })

  it('het team leest wel', async () => {
    await assertSucceeds(getDoc(doc(alsWie('u-lid'), 'tasks/t-1')))
  })
})

beschrijf('de vorm van wat er geschreven wordt', () => {
  it('een bedrag als tekst gaat er niet in', async () => {
    await assertFails(updateDoc(doc(alsWie('u-lid'), 'tasks/t-1'), { quoteAmount: '16399' }))
  })

  it('een negatief bedrag ook niet', async () => {
    await assertFails(updateDoc(doc(alsWie('u-lid'), 'tasks/t-1'), { quoteAmount: -100 }))
  })

  it('een aantal gasten van min tien evenmin', async () => {
    await assertFails(updateDoc(doc(alsWie('u-lid'), 'tasks/t-1'), { pax: -10 }))
  })

  it('een taak zonder titel bestaat niet', async () => {
    await assertFails(setDoc(doc(alsWie('u-lid'), 'tasks/t-2'), { title: '', listId: 'l-events' }))
  })

  it('een klant zonder naam ook niet', async () => {
    await assertFails(setDoc(doc(alsWie('u-lid'), 'customers/k-2'), { name: '' }))
  })

  it('wat wél klopt, gaat er gewoon in', async () => {
    await assertSucceeds(updateDoc(doc(alsWie('u-lid'), 'tasks/t-1'), { quoteAmount: 17200, pax: 145 }))
    await assertSucceeds(
      setDoc(doc(alsWie('u-lid'), 'tasks/t-2'), { title: 'Nieuw event', listId: 'l-events', archived: false })
    )
  })

  // Een aanmaakdatum die opschuift maakt elk rapport over doorlooptijd
  // waardeloos.
  it('de herkomst blijft staan', async () => {
    const db = alsWie('u-lid')
    await assertFails(updateDoc(doc(db, 'tasks/t-1'), { createdAt: new Date() }))
    await assertFails(updateDoc(doc(db, 'tasks/t-1'), { createdBy: 'u-tweede' }))
  })
})

beschrijf('notities', () => {
  it('je schrijft op je eigen naam of niet', async () => {
    await assertFails(
      setDoc(doc(alsWie('u-lid'), 'comments/c-2'), { taskId: 't-1', authorId: 'u-tweede', body: 'Niet van mij' })
    )
    await assertSucceeds(
      setDoc(doc(alsWie('u-lid'), 'comments/c-2'), { taskId: 't-1', authorId: 'u-lid', body: 'Wel van mij' })
    )
  })

  // Dit was het gat: het scherm toonde de prullenbak alleen bij je eigen
  // notitie, de regels lieten iedereen alles wissen.
  it('een ander kan jouw notitie niet wissen', async () => {
    await assertFails(deleteDoc(doc(alsWie('u-tweede'), 'comments/c-1')))
    await assertSucceeds(deleteDoc(doc(alsWie('u-lid'), 'comments/c-1')))
  })

  it('een beheerder kan dat wel — er moet een weg zijn', async () => {
    await assertSucceeds(deleteDoc(doc(alsWie('u-eigenaar'), 'comments/c-1')))
  })

  // Een notitie die achteraf anders kan gaan luiden, is geen gesprek.
  it('niemand herschrijft een notitie, ook de schrijver niet', async () => {
    await assertFails(updateDoc(doc(alsWie('u-lid'), 'comments/c-1'), { body: 'Iets anders' }))
  })
})

beschrijf('de post', () => {
  // De draad is bewijs van wat er gezegd is; een browser die hem kan
  // bewerken, maakt dat bewijs waardeloos.
  it('de inhoud van een bericht is onaanraakbaar', async () => {
    await assertFails(updateDoc(doc(alsWie('u-lid'), 'mails/m-1'), { tekst: 'anders' }))
    await assertFails(setDoc(doc(alsWie('u-lid'), 'mails/m-2'), { van: 'verzonnen@example.be' }))
  })

  it('koppelen aan een event mag wel', async () => {
    await assertSucceeds(
      updateDoc(doc(alsWie('u-lid'), 'mails/m-1'), { eventId: 't-1', customerId: null, koppeling: 'handmatig' })
    )
  })
})

beschrijf('het logboek', () => {
  // Een logboek dat een browser kan aanvullen, bewijst niets.
  it('kan niemand schrijven', async () => {
    await assertFails(setDoc(doc(alsWie('u-eigenaar'), 'auditLog/verzonnen'), { actie: 'niets' }))
  })

  it('kan het team wel lezen', async () => {
    await assertSucceeds(getDoc(doc(alsWie('u-lid'), 'auditLog/wat-dan-ook')))
  })
})

beschrijf('het eigen profiel', () => {
  // Wie zichzelf op "personeel" zet, sluit zichzelf buiten en heeft dan
  // niemand meer om het terug te draaien.
  it('niemand zet zijn eigen rol, ook een eigenaar niet', async () => {
    await assertFails(updateDoc(doc(alsWie('u-eigenaar'), 'profiles/u-eigenaar'), { role: 'staff' }))
    await assertFails(updateDoc(doc(alsWie('u-lid'), 'profiles/u-lid'), { role: 'admin' }))
  })

  it('je eigen naam en voorkeuren wel', async () => {
    await assertSucceeds(
      updateDoc(doc(alsWie('u-lid'), 'profiles/u-lid'), { fullName: 'Nieuwe Naam', prefs: { taal: 'en' } })
    )
  })

  it('een gewoon lid zet de rol van een ander niet', async () => {
    await assertFails(updateDoc(doc(alsWie('u-lid'), 'profiles/u-tweede'), { role: 'admin' }))
  })
})

beschrijf('werk dat vanzelf terugkomt', () => {
  const geldig = {
    titel: 'eBox controleren',
    omschrijving: '',
    doel: 'taak',
    soort: 'wekelijks',
    dagen: [1],
    dagVanMaand: 1,
    prioriteit: '',
    actief: true,
  }

  it('leest het hele team', async () => {
    await assertSucceeds(getDoc(doc(alsWie('u-lid'), 'herhalingen/h-1')))
  })

  it('maar personeel niet', async () => {
    await assertFails(getDoc(doc(alsWie('u-personeel'), 'herhalingen/h-1')))
  })

  /*
    Een herhaling deelt werk uit aan een persoon, elke week opnieuw. Dat is een
    afspraak en geen voorkeursinstelling, dus ze hoort bij de beheerders —
    anders zet het ene teamlid stilletjes een taak op de agenda van het andere.
  */
  it('wordt door een beheerder gezet, niet door een gewoon lid', async () => {
    await assertFails(setDoc(doc(alsWie('u-lid'), 'herhalingen/h-nieuw'), geldig))
    await assertSucceeds(setDoc(doc(alsWie('u-eigenaar'), 'herhalingen/h-nieuw'), geldig))
  })

  /*
    Een onbekende soort zou elke nacht gelezen worden en nooit iets doen: een
    stille storing, en die zijn het duurst.
  */
  it('weigert een ritme dat de planner niet kent', async () => {
    await assertFails(
      setDoc(doc(alsWie('u-eigenaar'), 'herhalingen/h-raar'), { ...geldig, soort: 'per kwartaal' })
    )
  })

  it('weigert een bestemming die niet bestaat', async () => {
    await assertFails(setDoc(doc(alsWie('u-eigenaar'), 'herhalingen/h-raar'), { ...geldig, doel: 'factuur' }))
  })

  it('weigert een titel die geen tekst is', async () => {
    await assertFails(setDoc(doc(alsWie('u-eigenaar'), 'herhalingen/h-raar'), { ...geldig, titel: 42 }))
  })
})
