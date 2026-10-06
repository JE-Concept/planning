import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { maakMessaging } from './messaging.js'

/**
 * De ingang van messaging: één HTTP-adres waar elke bron van buiten haar
 * berichten aflevert. Een eigen codebase omdat er een geheim aan hangt
 * (MESSAGING_TOKENS); zie `messaging.js`. De verwerkers staan in `functions/`,
 * want die hebben geen geheim nodig en horen bij de rest van de tool.
 */

initializeApp()
const db = getFirestore()
const REGION = 'europe-west1'

export const messaging = maakMessaging({ db, region: REGION })
