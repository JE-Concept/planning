#!/usr/bin/env node
/**
 * Maakt iemand eigenaar of beheerder — ook als die nog nooit is ingelogd.
 *
 * Twee gevallen, omdat een werkruimte twee toestanden kent. Heeft de persoon al
 * een profiel, dan wordt de rol daarop gezet. Heeft die er nog geen, dan wordt
 * een uitnodiging met die rol klaargezet plus, voor een lege werkruimte, de
 * `bootstrapOwnerEmail`; de eerstvolgende aanmelding landt dan meteen goed in
 * plaats van als gewoon lid.
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/make-admin.mjs jasper@kenjeklanten.be [owner|admin]
 */

import { readFileSync } from 'node:fs'
import { applicationDefault, cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const email = (process.argv[2] ?? '').trim().toLowerCase()
const role = (process.argv[3] ?? 'owner').trim()

if (!email.includes('@')) {
  console.error('Gebruik: node scripts/make-admin.mjs <e-mailadres> [owner|admin]')
  process.exit(1)
}
if (!['owner', 'admin'].includes(role)) {
  console.error(`Onbekende rol "${role}". Kies owner of admin.`)
  process.exit(1)
}

const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
initializeApp(
  credentialsPath
    ? { credential: cert(JSON.parse(readFileSync(credentialsPath, 'utf8'))) }
    : { credential: applicationDefault() }
)

const db = getFirestore()

/** Het profiel hangt aan de Firebase-uid, niet aan het adres. */
async function profileForEmail(address) {
  try {
    const user = await getAuth().getUserByEmail(address)
    const snap = await db.collection('profiles').doc(user.uid).get()
    return { uid: user.uid, exists: snap.exists, data: snap.data() }
  } catch (err) {
    if (err.code === 'auth/user-not-found') return null
    throw err
  }
}

async function main() {
  const domain = email.split('@')[1]
  const accessRef = db.collection('config').doc('access')
  const access = await accessRef.get()
  const allowed = access.data()?.allowedDomains ?? []

  const found = await profileForEmail(email)

  if (found?.exists) {
    await db.collection('profiles').doc(found.uid).set(
      { role, active: true, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    )
    console.log(`${email} is nu ${role} (profiel ${found.uid} bijgewerkt).`)
    return
  }

  // Nog geen profiel: de uitnodiging bepaalt de rol bij de eerste aanmelding,
  // en bootstrapOwnerEmail zorgt dat niemand anders de lege werkruimte claimt.
  await db.collection('invites').doc(email).set(
    { email, role, createdAt: FieldValue.serverTimestamp() },
    { merge: true }
  )

  const patch = { updatedAt: FieldValue.serverTimestamp() }
  if (role === 'owner') patch.bootstrapOwnerEmail = email
  if (!allowed.includes(domain)) patch.allowedDomains = FieldValue.arrayUnion(domain)
  await accessRef.set(patch, { merge: true })

  console.log(
    found
      ? `${email} bestaat in Firebase Auth maar heeft nog geen profiel — uitnodiging als ${role} klaargezet.`
      : `${email} heeft nog nooit ingelogd — uitnodiging als ${role} klaargezet.`
  )
  console.log('Meld je aan op de tool; je komt meteen binnen met die rol.')
  if (!allowed.includes(domain)) console.log(`Domein ${domain} toegevoegd aan de toegelaten domeinen.`)
}

main().catch((err) => {
  console.error('Mislukt:', err.message)
  process.exit(1)
})
