/**
 * Wat elk onderhoudsscript nodig heeft.
 *
 * ── Waarom deze scripts bestaan ───────────────────────────────────────────
 * De tool draait live. Af en toe moet er iets rechtgezet worden dat niet via
 * een scherm kan — een veld dat op honderd events tegelijk moet wijzigen, een
 * regel die met terugwerkende kracht geldt. Dat kon tot nu alleen door iemand
 * met de sleutel in handen, en die sleutel hoort nergens anders te zijn dan in
 * de uitrol.
 *
 * Dus staan de scripts hier, in de repo: ze worden gelezen en gecommit voor ze
 * kunnen draaien, en ze draaien in een GitHub-actie die de servicesleutel al
 * heeft. Wat er gebeurt staat in de actielog, met datum en met wie hem startte.
 *
 * ── Waarom ze standaard niets schrijven ───────────────────────────────────
 * Elk script draait droog tenzij je het uitdrukkelijk anders zegt. Een
 * droogloop leest alles, rekent alles uit en vertelt wat het zou doen — maar
 * raakt geen enkel document aan. Pas met `--schrijf` gaat het echt.
 *
 * Dat is geen voorzichtigheid om de voorzichtigheid: deze scripts raken
 * gegevens van een zaak die ermee werkt, en de enige manier om zeker te weten
 * dat een filter klopt, is hem eerst laten opsommen wat hij gevonden heeft.
 */
import { readFileSync } from 'node:fs'
import { applicationDefault, cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

/** De database, met beheerdersrechten. */
export function verbind() {
  const pad = process.env.GOOGLE_APPLICATION_CREDENTIALS
  initializeApp(
    pad ? { credential: cert(JSON.parse(readFileSync(pad, 'utf8'))) } : { credential: applicationDefault() }
  )
  return getFirestore()
}

/** Draait dit script echt, of kijkt het alleen? */
export const schrijftEcht = () => process.argv.includes('--schrijf')

/**
 * Eén profiel op e-mailadres.
 *
 * Bij gebrek aan een profiel stopt het script in plaats van verder te gaan met
 * `null`: een script dat honderd events op "niemand" zet omdat een adres niet
 * klopte, is erger dan een script dat niet draait.
 */
export async function profielVan(db, email) {
  const snap = await db.collection('profiles').where('email', '==', String(email).toLowerCase()).limit(1).get()
  if (snap.empty) throw new Error(`Geen profiel met het adres ${email}.`)
  return { id: snap.docs[0].id, ...snap.docs[0].data() }
}

/**
 * De samenvatting waarmee elk script afsluit.
 *
 * Altijd dezelfde vorm, zodat de actielog te lezen is zonder het script erbij
 * te halen: wat er gevonden is, wat er veranderd zou worden, en of het echt
 * gebeurd is.
 */
export function verslag({ gevonden, geraakt, regels = [], echt }) {
  console.log('')
  console.log(`Gevonden:  ${gevonden}`)
  console.log(`Te wijzigen: ${geraakt}`)
  for (const regel of regels.slice(0, 50)) console.log(`  · ${regel}`)
  if (regels.length > 50) console.log(`  … en nog ${regels.length - 50}`)
  console.log('')
  console.log(echt ? 'GESCHREVEN.' : 'DROOGLOOP — er is niets aangepast. Draai opnieuw met schrijven aan.')
}
