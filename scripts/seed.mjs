#!/usr/bin/env node
/**
 * First-run seed: the brands, the access config and the two boards that carry
 * the business. Safe to run again — every document has a stable id and is
 * merged, so a second run repairs rather than duplicates.
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/seed.mjs
 */

import { readFileSync } from 'node:fs'
import { applicationDefault, cert, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { CHECKLIST_TEMPLATES } from '../src/lib/checklist-templates.js'

const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
initializeApp(
  credentialsPath
    ? { credential: cert(JSON.parse(readFileSync(credentialsPath, 'utf8'))) }
    : { credential: applicationDefault() }
)
const db = getFirestore()

const BRANDS = [
  { id: 'je-concept', name: 'JE Concept', color: '#1d57f5' },
  { id: 'bar-vue', name: 'Bar Vue', color: '#b8860b' },
  { id: 'meer', name: 'Meer — Het Vinne', color: '#0f8a5f' },
  { id: 'feestbeest', name: 'Feestbeest', color: '#e8578a' },
  { id: 'maison-folie', name: 'Maison Folie', color: '#7c3aed' },
  { id: 'wintermoods', name: 'Wintermoods', color: '#0ea5e9' },
  { id: 'kjk', name: 'Ken je klanten', color: '#38404f' },
]

/** The pipeline as it runs in ClickUp today, so nobody has to relearn it. */
const OVERVIEW_STATUSES = [
  ['request', '#8593a9', 'open'],
  ['create offer', '#3377ff', 'active'],
  ['offer send', '#7c3aed', 'active'],
  ['offer accepted', '#a855f7', 'active'],
  ['planning ongoing', '#1090e0', 'active'],
  ['planning ready', '#3db88b', 'active'],
  ['ready to invoice', '#0ea5e9', 'active'],
  ['invoiced', '#0d9488', 'done'],
  ['complete', '#008844', 'closed'],
]

const SOCIAL_STATUSES = [
  ['pending', '#87909e', 'open'],
  ['in progress', '#f8ae00', 'active'],
  ['ready for review', '#b660e0', 'active'],
  ['planning', '#5f55ee', 'active'],
  ['done', '#008844', 'closed'],
]

const columns = (rows) =>
  rows.map(([name, color, kind], position) => ({
    id: `seed-${name.replace(/[^a-z]+/gi, '-')}`,
    name,
    color,
    kind,
    position,
  }))

async function main() {
  const batch = db.batch()

  batch.set(
    db.collection('config').doc('access'),
    {
      allowedDomains: ['jeconcept.be', 'kenjeklanten.be'],
      // Wie de lege werkruimte mag claimen. Zonder dit wordt dat "wie het eerst
      // inlogt", en dat is een race die je achteraf niet meer rechtzet.
      bootstrapOwnerEmail: (process.env.OWNER_EMAIL ?? 'jasper@kenjeklanten.be').toLowerCase(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  )

  BRANDS.forEach((brand, position) => {
    batch.set(
      db.collection('brands').doc(brand.id),
      { key: brand.id, name: brand.name, color: brand.color, position, archived: false },
      { merge: true }
    )
  })

  batch.set(
    db.collection('spaces').doc('je-concept'),
    { name: 'JE Concept', color: '#1d57f5', position: 1, archived: false },
    { merge: true }
  )

  batch.set(
    db.collection('lists').doc('overview-planning'),
    {
      spaceId: 'je-concept',
      folderId: null,
      brandId: null,
      name: 'Overview planning',
      description: 'Aanvraag → offerte → planning → facturatie. De hoofdpijplijn.',
      kind: 'tasks',
      position: 1,
      archived: false,
      statuses: columns(OVERVIEW_STATUSES),
    },
    { merge: true }
  )

  batch.set(
    db.collection('lists').doc('socials'),
    {
      spaceId: 'je-concept',
      folderId: null,
      brandId: null,
      name: 'Socials',
      description: 'Contentproductie voor alle merken.',
      kind: 'social',
      position: 2,
      archived: false,
      statuses: columns(SOCIAL_STATUSES),
    },
    { merge: true }
  )

  // De openings- en sluitingslijst. Merge, zodat een aangepaste lijst niet bij
  // elke seed terugvalt op de versie uit de repo.
  CHECKLIST_TEMPLATES.forEach((template, position) => {
    batch.set(
      db.collection('checklists').doc(template.id),
      {
        key: template.key,
        name: template.name,
        kind: template.kind,
        brandId: null,
        sections: template.sections,
        position,
        archived: false,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
  })

  await batch.commit()
  console.log('Seed klaar: merken, toegangsdomeinen, de twee borden en de dagelijkse lijsten staan klaar.')
}

main().catch((err) => {
  console.error('Seed mislukt:', err.message)
  process.exit(1)
})
