#!/usr/bin/env node
/**
 * Waarom kan iemand niet inloggen?
 *
 * Het aanmeldscherm kan maar één ding zeggen, en de oorzaak ligt op vier
 * plekken tegelijk: het profiel, de toegangsconfiguratie, de aanmeldmethode bij
 * Google, en de functie die de eerste twee schrijft. Dit script leest ze alle
 * vier uit met de servicesleutel, zodat het antwoord uit de bron komt in plaats
 * van uit een vermoeden.
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/diagnose.mjs [e-mailadres]
 */

import { readFileSync } from 'node:fs'
import { applicationDefault, cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const email = (process.argv[2] ?? '').trim().toLowerCase()
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
const credential = credentialsPath
  ? cert(JSON.parse(readFileSync(credentialsPath, 'utf8')))
  : applicationDefault()

const app = initializeApp({ credential })
const db = getFirestore()
const projectId =
  process.env.FIREBASE_PROJECT ??
  (credentialsPath ? JSON.parse(readFileSync(credentialsPath, 'utf8')).project_id : null)

const kop = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`)
const ok = (t) => console.log(`  ✔ ${t}`)
const nok = (t) => console.log(`  ✗ ${t}`)

/** Een toegangstoken van de servicesleutel, voor de beheer-API's. */
async function accessToken() {
  const token = await app.options.credential.getAccessToken()
  return token.access_token
}

async function main() {
  kop('Toegangsconfiguratie')
  const access = await db.collection('config').doc('access').get()
  if (!access.exists) {
    nok('config/access bestaat niet — de seed heeft nooit gedraaid.')
  } else {
    const data = access.data()
    ok(`toegelaten domeinen: ${(data.allowedDomains ?? []).join(', ') || '(geen)'}`)
    ok(`eigenaar bij eerste aanmelding: ${data.bootstrapOwnerEmail ?? '(niet gezet)'}`)
  }

  kop('Mensen')
  const profiles = await db.collection('profiles').get()
  console.log(`  ${profiles.size} profiel(en)`)
  profiles.forEach((d) => console.log(`    · ${d.data().email} — ${d.data().role}${d.data().active === false ? ' (gedeactiveerd)' : ''}`))
  const invites = await db.collection('invites').get()
  invites.forEach((d) => console.log(`    · uitnodiging ${d.id} — ${d.data().role}`))

  kop('Aanmeldmethodes bij Google')
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/defaultSupportedIdpConfigs`,
      { headers: { Authorization: `Bearer ${await accessToken()}` } }
    )
    const body = await res.json()
    const configs = body.defaultSupportedIdpConfigs ?? []
    if (!res.ok) {
      nok(`kon de aanmeldmethodes niet opvragen (${res.status}): ${body.error?.message ?? ''}`)
    } else if (configs.length === 0) {
      nok('er staat GEEN enkele aanmeldmethode aan. Zet Google aan bij Authentication → Sign-in method.')
    } else {
      for (const c of configs) {
        const naam = c.name.split('/').pop()
        c.enabled ? ok(`${naam} staat aan`) : nok(`${naam} staat UIT`)
      }
      if (!configs.some((c) => c.name.endsWith('google.com') && c.enabled)) {
        nok('Google staat niet aan — dat is de aanmeldmethode die de app gebruikt.')
      }
    }
  } catch (err) {
    nok(`aanmeldmethodes niet gelezen: ${err.message}`)
  }

  kop('Toegelaten domeinen voor de aanmeldpop-up')
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`,
      { headers: { Authorization: `Bearer ${await accessToken()}` } }
    )
    const body = await res.json()
    if (!res.ok) nok(`niet opgevraagd (${res.status}): ${body.error?.message ?? ''}`)
    else ok((body.authorizedDomains ?? []).join(', ') || '(geen)')
  } catch (err) {
    nok(err.message)
  }

  if (email) {
    kop(`Het account ${email}`)
    try {
      const user = await getAuth().getUserByEmail(email)
      ok(`bestaat in Firebase Auth (uid ${user.uid})`)
      const snap = await db.collection('profiles').doc(user.uid).get()
      snap.exists
        ? ok(`heeft een profiel met rol ${snap.data().role}`)
        : nok('heeft GEEN profiel — ensureProfile is niet gelukt bij het aanmelden.')
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        nok('heeft zich nog nooit aangemeld bij Google in dit project.')
      } else {
        nok(err.message)
      }
    }
  }

  console.log()
}

main().catch((err) => {
  console.error('Diagnose mislukt:', err.message)
  process.exit(1)
})
