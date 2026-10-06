import { onRequest } from 'firebase-functions/v2/https'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { GoogleAuth } from 'google-auth-library'
import { mapnaamVoorEvent, mapnaamVoorKlant, rijVanDriveBestand } from './drive-naam.js'

/**
 * Documenten op Google Drive: een map per event en per klant.
 *
 * ── Waarom Drive en niet Firebase Storage ─────────────────────────────────
 * Omdat de bestanden van JE Concept al in Drive leven, en omdat Jasper erbij
 * moet kunnen zonder de app: een grondplan dat de leverancier mailt, sleep je
 * in de map en het staat in de tool. Storage is een emmer die alleen de app
 * kent; Drive is de kast waar iedereen al in kijkt.
 *
 * ── Waarom via de server en niet rechtstreeks uit de browser ──────────────
 * Rechtstreeks zou elke gebruiker een Google-login met Drive-rechten nodig
 * hebben, en dan schrijft iedereen onder zijn eigen naam in een map die van
 * de zaak is. Nu schrijft het **runtime-serviceaccount** van de functies,
 * dat lid is van de gedeelde Drive. Geen geheim, geen sleutel: Google geeft
 * het account zijn eigen toegang (Application Default Credentials). Wat de
 * browser doet, is een bestand aanreiken met zijn Firebase-aanmelding erbij.
 *
 * ── Eén gedeelde Drive, niet "Mijn Drive" van een serviceaccount ──────────
 * Een bestand dat een serviceaccount in zijn eigen Drive zet, is van
 * niemand: het telt op geen quota dat iemand beheert, en als het account
 * verdwijnt, verdwijnt het bestand. In een gedeelde Drive is het van JE
 * Concept. Het id ervan staat in `config/drive`, door een beheerder gezet.
 *
 * ── Wat er in Firestore staat ─────────────────────────────────────────────
 * Een kopie van de lijst (`attachments`), zodat het scherm meteen tekent en
 * zonder Drive-aanroep per bezoek. `sync` ververst die kopie uit Drive en
 * vindt zo ook wat er buiten de app om in de map gezet is.
 */

const DRIVE = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const MAP = 'application/vnd.google-apps.folder'
const VELDEN = 'id,name,mimeType,size,webViewLink,iconLink,thumbnailLink,modifiedTime,trashed'
const MAX_BYTES = 25 * 1024 * 1024

let auth = null
function client() {
  // Eén keer aanmaken; het token wordt vanzelf ververst.
  auth ??= new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/drive'] })
  return auth.getClient()
}

async function driveEcht(url, opties = {}) {
  const c = await client()
  const r = await c.request({ url, ...opties })
  return r.data
}

/** Wie klopt er aan, en mag die dat? Alleen het team: wie een profiel heeft. */
async function wieBent(db, req, verifieer) {
  const kop = String(req.get('authorization') ?? '')
  const token = /^Bearer\s+(\S+)$/.exec(kop)?.[1]
  if (!token) return null
  try {
    const { uid } = await verifieer(token)
    const profiel = await db.collection('profiles').doc(uid).get()
    if (!profiel.exists || profiel.data().active === false) return null
    const rol = profiel.data().role
    if (rol === 'staff' || rol === 'social') return null
    return { uid, rol }
  } catch {
    return null
  }
}

/** De gedeelde Drive, of niets — dan is de instelling nog niet gezet. */
async function instelling(db) {
  const snap = await db.collection('config').doc('drive').get()
  const driveId = String(snap.data()?.driveId ?? '').trim()
  return driveId || null
}

/**
 * De map van een event of klant, en ze aanmaken als ze er nog niet is.
 *
 * Het id komt op het document te staan (`driveFolderId`), zodat de tweede
 * keer geen Drive-aanroep meer nodig is en de knop "Open in Drive" meteen
 * weet waarheen. Wordt een event hernoemd, dan blijft de map heten zoals ze
 * heette: hernoemen in Drive is iets wat een mens doet, met de reden erbij.
 */
async function mapVoor(drive, db, driveId, { taskId, customerId }) {
  const col = taskId ? 'tasks' : 'customers'
  const id = taskId ?? customerId
  const ref = db.collection(col).doc(id)
  const snap = await ref.get()
  if (!snap.exists) return null
  const data = snap.data()
  if (data.driveFolderId) return { id: data.driveFolderId, webViewLink: data.driveFolderLink ?? null }

  const naam = taskId ? mapnaamVoorEvent(data) : mapnaamVoorKlant(data, id)
  const ouder = await submap(drive, driveId, taskId ? 'Events' : 'Klanten')
  const map = await drive(`${DRIVE}/files?supportsAllDrives=true&fields=id,webViewLink`, {
    method: 'POST',
    data: { name: naam, mimeType: MAP, parents: [ouder] },
  })
  await ref.update({ driveFolderId: map.id, driveFolderLink: map.webViewLink ?? null, updatedAt: FieldValue.serverTimestamp() })
  return { id: map.id, webViewLink: map.webViewLink ?? null }
}

/** `Events/` en `Klanten/` bovenin de gedeelde Drive; eenmalig aangemaakt. */
async function submap(drive, driveId, naam) {
  const q = encodeURIComponent(`name = '${naam}' and mimeType = '${MAP}' and '${driveId}' in parents and trashed = false`)
  const uit = await drive(`${DRIVE}/files?q=${q}&corpora=drive&driveId=${driveId}&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=files(id)`)
  if (uit.files?.[0]) return uit.files[0].id
  const map = await drive(`${DRIVE}/files?supportsAllDrives=true&fields=id`, {
    method: 'POST',
    data: { name: naam, mimeType: MAP, parents: [driveId] },
  })
  return map.id
}

/** Alles in een map, zonder prullenbak. */
async function bestandenIn(drive, driveId, mapId) {
  const q = encodeURIComponent(`'${mapId}' in parents and trashed = false and mimeType != '${MAP}'`)
  const uit = await drive(
    `${DRIVE}/files?q=${q}&corpora=drive&driveId=${driveId}&includeItemsFromAllDrives=true&supportsAllDrives=true&pageSize=200&orderBy=modifiedTime desc&fields=files(${VELDEN})`
  )
  return uit.files ?? []
}

/**
 * De kopie in Firestore gelijkzetten met de map.
 *
 * Wat in Drive staat en hier niet: erbij. Wat hier staat en in Drive niet
 * meer: weg. Wat allebei bestaat: de naam en de grootte bijwerken, want ook
 * die veranderen in Drive zonder dat de app het ziet.
 */
async function sync(drive, db, driveId, { taskId, customerId }, uid) {
  const map = await mapVoor(drive, db, driveId, { taskId, customerId })
  if (!map) return { fout: 'onbekend' }
  const inDrive = await bestandenIn(drive, driveId, map.id)

  const veld = taskId ? 'taskId' : 'customerId'
  const bestaand = await db.collection('attachments').where(veld, '==', taskId ?? customerId).get()
  const perDriveId = new Map()
  for (const d of bestaand.docs) {
    const r = d.data()
    if (r.driveId) perDriveId.set(r.driveId, d.ref)
  }

  const batch = db.batch()
  let erbij = 0
  let weg = 0
  for (const b of inDrive) {
    const rij = rijVanDriveBestand(b, { taskId, customerId })
    const ref = perDriveId.get(b.id)
    if (ref) {
      batch.set(ref, rij, { merge: true })
      perDriveId.delete(b.id)
    } else {
      batch.set(db.collection('attachments').doc(), { ...rij, uploadedBy: null, createdAt: FieldValue.serverTimestamp() })
      erbij += 1
    }
  }
  for (const ref of perDriveId.values()) {
    batch.delete(ref)
    weg += 1
  }
  await batch.commit()
  logger.info('Drive gesynchroniseerd', { taskId, customerId, erbij, weg, door: uid })
  return { map, aantal: inDrive.length, erbij, weg }
}

/**
 * `drive` en `verifieer` staan erin zodat tests/drive.test.js de echte handler
 * kan laten lopen tegen een nagebootste Drive en de Firestore-emulator; in
 * productie zijn het de Drive API en Firebase Auth.
 */
export function maakDrive({ db, region, drive = driveEcht, verifieer = (token) => getAuth().verifyIdToken(token) }) {
  return onRequest(
    { region, cors: false, invoker: 'private', memory: '512MiB', timeoutSeconds: 120, concurrency: 20, maxInstances: 10 },
    async (req, res) => {
      const pad = String(req.path ?? '').replace(/^\/api\/drive/, '').replace(/^\/+|\/+$/g, '')
      res.set('Cache-Control', 'no-store')

      const wie = await wieBent(db, req, verifieer)
      if (!wie) return res.status(401).json({ fout: 'niet_aangemeld' })

      const driveId = await instelling(db)
      if (!driveId) return res.status(409).json({ fout: 'geen_drive' })

      const taskId = String(req.query.taskId ?? req.body?.taskId ?? '').trim() || null
      const customerId = String(req.query.customerId ?? req.body?.customerId ?? '').trim() || null
      if (!taskId && !customerId) return res.status(400).json({ fout: 'geen_eigenaar' })

      try {
        if (req.method === 'POST' && pad === 'map') {
          const map = await mapVoor(drive, db, driveId, { taskId, customerId })
          return map ? res.json(map) : res.status(404).json({ fout: 'onbekend' })
        }

        if (req.method === 'POST' && pad === 'sync') {
          const uit = await sync(drive, db, driveId, { taskId, customerId }, wie.uid)
          return uit.fout ? res.status(404).json(uit) : res.json(uit)
        }

        /*
          Uploaden: de ruwe bytes in de body, de naam en het type in koppen.
          Geen multipart-ontleding — één bestand per verzoek, en de browser
          kan dat zo sturen. Daarna meteen een sync, zodat de lijst klopt.
        */
        if (req.method === 'POST' && pad === 'upload') {
          const naam = decodeURIComponent(String(req.get('x-bestandsnaam') ?? 'bestand')).slice(0, 200)
          const type = String(req.get('content-type') ?? 'application/octet-stream').split(';')[0]
          const bytes = req.rawBody
          if (!bytes || bytes.length === 0) return res.status(400).json({ fout: 'leeg' })
          if (bytes.length > MAX_BYTES) return res.status(413).json({ fout: 'te_groot' })

          const map = await mapVoor(drive, db, driveId, { taskId, customerId })
          if (!map) return res.status(404).json({ fout: 'onbekend' })

          const grens = `je-plan-${Date.now()}`
          const meta = JSON.stringify({ name: naam, parents: [map.id] })
          const body = Buffer.concat([
            Buffer.from(`--${grens}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${grens}\r\nContent-Type: ${type}\r\n\r\n`),
            bytes,
            Buffer.from(`\r\n--${grens}--`),
          ])
          const bestand = await drive(`${UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=${VELDEN}`, {
            method: 'POST',
            headers: { 'Content-Type': `multipart/related; boundary=${grens}` },
            body,
          })

          const rij = rijVanDriveBestand(bestand, { taskId, customerId })
          const ref = db.collection('attachments').doc()
          await ref.set({ ...rij, uploadedBy: wie.uid, createdAt: FieldValue.serverTimestamp() })
          logger.info('Bestand naar Drive', { taskId, customerId, naam, bytes: bytes.length, door: wie.uid })
          return res.json({ id: ref.id, ...rij })
        }

        /*
          Weghalen: naar de prullenbak van Drive, niet definitief. Wie zich
          vergist, vindt het daar dertig dagen terug. De rij in Firestore gaat
          wél meteen weg; dat is wat de app toont.
        */
        if (req.method === 'DELETE' && pad.startsWith('bestand/')) {
          const id = pad.slice('bestand/'.length)
          const snap = await db.collection('attachments').doc(id).get()
          if (!snap.exists) return res.status(404).json({ fout: 'onbekend' })
          const rij = snap.data()
          if (rij.driveId) {
            await drive(`${DRIVE}/files/${encodeURIComponent(rij.driveId)}?supportsAllDrives=true`, {
              method: 'PATCH',
              data: { trashed: true },
            }).catch((err) => logger.warn('Drive-bestand niet naar prullenbak', { id: rij.driveId, fout: err?.message }))
          }
          await snap.ref.delete()
          return res.json({ ok: true })
        }
      } catch (err) {
        /*
          De meest voorkomende fout hier is geen fout van de code maar van de
          inrichting: het serviceaccount is geen lid van de gedeelde Drive, of
          de Drive API staat niet aan. Dat hoort het scherm te kunnen zeggen.
        */
        const status = err?.response?.status ?? err?.code
        logger.error('Drive-aanroep mislukt', { pad, status, fout: String(err?.message ?? err).slice(0, 300) })
        if (status === 403 || status === 404) return res.status(502).json({ fout: 'drive_geen_toegang' })
        return res.status(502).json({ fout: 'drive_mislukt' })
      }

      return res.status(404).json({ fout: 'niet_gevonden' })
    }
  )
}
