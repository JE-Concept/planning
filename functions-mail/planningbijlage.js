/**
 * Een planningsexport die per mail binnenkomt.
 *
 * ── Wat deze codebase wel en niet doet ────────────────────────────────────
 * Alleen aannemen en doorgeven. De bijlage gaat naar de opslag en er komt een
 * regel in een wachtrij; wat erin staat en of het wel een planning ís, bekijkt
 * de andere codebase.
 *
 * Dat is geen nette taakverdeling om het nette, het is een harde grens:
 * `functions-mail` wordt apart verpakt en uitgerold en kan niets uit
 * `functions/` importeren. De lezer, de parser en de matcher staan daar.
 * Hier een tweede kopie van maken zou betekenen dat ze uit elkaar lopen, en
 * dan importeert de mail iets anders dan de knop.
 *
 * ── Waarom naar de opslag en niet in het document ─────────────────────────
 * Een Firestore-document mag een megabyte, en base64 maakt een bestand een
 * derde groter. De export van oktober was vijftien kilobyte, dus het zou
 * passen — tot de dag dat iemand een heel jaar exporteert. Een bestand hoort
 * in een bestandsopslag.
 *
 * ── Waarom alles met een .xlsx meegaat ────────────────────────────────────
 * Op naam of onderwerp filteren betekent raden. Een xlsx doorsturen kost hier
 * een paar kilobyte opslag; de andere kant kijkt of het blad "Data" erin zit
 * met de kolommen die nodig zijn, en zegt "niet voor ons" als dat niet zo is.
 * Beter een wachtrij met een afgewezen regel erin dan een import die niet
 * draaide omdat iemand het bestand anders genoemd had.
 */
import { getStorage } from 'firebase-admin/storage'
import { FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { lijktOpPlanning } from './planning-herkennen.js'

/** Waar de bestanden landen. Niemand kan hier vanuit een browser bij. */
const MAP = 'aapi-import'

/**
 * De bijlagen van één bericht in de wachtrij zetten.
 *
 * De documentnaam komt uit de Message-ID en de naam van de bijlage. Haalt de
 * ophaler hetzelfde bericht ooit twee keer op, dan is het hetzelfde document
 * en draait de import niet opnieuw — dezelfde reden waarom een mail zelf op
 * zijn Message-ID bewaard wordt.
 */
export async function zetPlanningInDeWachtrij(db, post, mailNaam) {
  const bijlagen = (post.attachments ?? []).filter(lijktOpPlanning)
  if (bijlagen.length === 0) return 0

  const bucket = getStorage().bucket()
  let gezet = 0

  for (const bijlage of bijlagen) {
    const bestandsnaam = String(bijlage.filename ?? 'planning.xlsx')
    const sleutel = `${mailNaam}__${bestandsnaam}`.replace(/[^A-Za-z0-9._@-]/g, '_').slice(0, 220)
    const pad = `${MAP}/${sleutel}`

    const rij = db.collection('aapiImportQueue').doc(sleutel)
    // Bestaat de regel al, dan is dit bericht al eens langsgekomen.
    if ((await rij.get()).exists) continue

    await bucket.file(pad).save(bijlage.content, {
      contentType: bijlage.contentType ?? 'application/octet-stream',
      resumable: false,
    })

    await rij.set({
      status: 'wachtend',
      storagePath: pad,
      fileName: bestandsnaam,
      bytes: bijlage.content.length,
      mailId: mailNaam,
      van: post.from?.text ?? '',
      onderwerp: post.subject ?? '',
      ontvangenOp: post.date ?? new Date(),
      createdAt: FieldValue.serverTimestamp(),
    })

    gezet += 1
  }

  if (gezet) logger.info('Planningsbijlage in de wachtrij', { mailNaam, aantal: gezet })
  return gezet
}
