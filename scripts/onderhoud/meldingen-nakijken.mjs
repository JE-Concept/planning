#!/usr/bin/env node
/**
 * Werken de meldingen echt?
 *
 * "Krijgt iedereen zijn pushberichten en zijn mails" is van buitenaf niet te
 * zien: de functies staan uitgerold of niet, de sleutels bestaan of niet, en de
 * mensen hebben hun toestel aangemeld of niet. Dit leest die drie dingen uit de
 * live gegevens en zegt per persoon wat er aan de hand is.
 *
 * Het schrijft niets — ook niet met `--schrijf`. Dit is een vraag, geen
 * ingreep: wat eruit komt zegt wat er moet gebeuren, en dat is telkens iets
 * wat een mens doet (een sleutel zetten, een toestel aanmelden).
 *
 *   Actions → Onderhoud → meldingen-nakijken
 */
import { verbind } from './_hulp.mjs'

const db = verbind()

const tel = (lijst, sleutel) =>
  lijst.reduce((op, rij) => ({ ...op, [rij[sleutel] ?? 'onbekend']: (op[rij[sleutel] ?? 'onbekend'] ?? 0) + 1 }), {})

const datum = (v) => (v?.toDate ? v.toDate().toISOString().slice(0, 16).replace('T', ' ') : '—')

// ── De mensen en hun toestellen ─────────────────────────────────────────────
const profielen = (await db.collection('profiles').get()).docs.map((d) => ({ id: d.id, ...d.data() }))
const tokens = (await db.collection('pushTokens').get()).docs.map((d) => ({ id: d.id, ...d.data() }))
const perPersoon = tel(tokens, 'profileId')

console.log('── Push ─────────────────────────────────────────────────────────')
console.log(`${tokens.length} aangemelde toestellen over ${Object.keys(perPersoon).length} mensen.`)
console.log('')
for (const p of profielen.filter((p) => p.active !== false).sort((a, b) => (a.email > b.email ? 1 : -1))) {
  const n = perPersoon[p.id] ?? 0
  /*
    Een leeg `prefs` betekent niet "niets aan" maar "de standaard", en die
    staat in functions/notify.js. Dat verschil is belangrijk: wie nooit iets
    instelde krijgt wél meldingen, en moet hier dus niet als probleem staan.
  */
  const voorkeur = p.prefs?.meldingen ? JSON.stringify(p.prefs.meldingen) : 'standaard'
  console.log(`  ${n === 0 ? '✗' : '✓'} ${String(p.email).padEnd(30)} ${n} toestel(len)   voorkeuren: ${voorkeur}`)
}
console.log('')
console.log('  ✗ = deze persoon heeft nooit op "meldingen aanzetten" geklikt, of deed dat')
console.log('      op een toestel waar de melding daarna geweigerd is. Push bereikt hem niet.')

// ── De wachtrij met post ────────────────────────────────────────────────────
const post = (await db.collection('mailQueue').orderBy('createdAt', 'desc').limit(500).get()).docs.map((d) => ({
  id: d.id,
  ...d.data(),
}))

console.log('')
console.log('── Mail ─────────────────────────────────────────────────────────')
if (post.length === 0) {
  console.log('De wachtrij is leeg: er is nog nooit een mail klaargezet.')
} else {
  const standen = tel(post, 'status')
  console.log(`De laatste ${post.length} rijen in mailQueue:`)
  for (const [stand, aantal] of Object.entries(standen)) console.log(`  ${stand.padEnd(12)} ${aantal}`)

  const wachtend = post.filter((r) => r.status === 'wachtend')
  const verstuurd = post.filter((r) => r.status === 'verstuurd')
  const mislukt = post.filter((r) => r.status === 'mislukt')

  console.log('')
  console.log(`Oudste wachtende : ${wachtend.length ? datum(wachtend[wachtend.length - 1].createdAt) : '—'}`)
  console.log(`Laatst verstuurd : ${verstuurd.length ? datum(verstuurd[0].createdAt) : 'nog nooit'}`)

  for (const r of mislukt.slice(0, 5)) {
    console.log(`  mislukt ${datum(r.createdAt)} → ${r.aan}: ${r.fout ?? 'geen reden genoteerd'}`)
  }

  /*
    De uitleg die het antwoord is op "waarom komt er geen mail aan".

    De verzender staat in een eigen codebase (`functions-mail/`) die alleen
    uitgerold wordt als het geheim SMTP_URL bestaat. Zonder dat geheim schrijven
    de triggers hun rijen netjes weg en blijft alles op "wachtend" staan — geen
    fout, geen mail. Dat is precies wat je hier dan ziet.
  */
  if (wachtend.length > 0 && verstuurd.length === 0) {
    console.log('')
    console.log('Er staat post klaar die nooit vertrokken is, en er is nooit iets verstuurd.')
    console.log('Dat betekent vrijwel zeker dat de verzender niet uitgerold is omdat het')
    console.log('geheim SMTP_URL niet bestaat. Zetten met:')
    console.log('')
    console.log('  firebase functions:secrets:set SMTP_URL --project je-planning')
    console.log('  smtps://plan%40jeconcept.be:<app-wachtwoord>@smtp.gmail.com:465')
    console.log('')
    console.log('Daarna een keer de CI laten lopen; die rolt functions:mail dan vanzelf uit.')
  }
}

console.log('')
console.log('Dit script leest alleen; er is niets aangepast.')
