import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { maakWintermoods } from './wintermoods.js'

/**
 * De ontvanger van reservatie-aanvragen van wintermoods.jeconcept.be.
 *
 * Een eigen codebase omdat er een geheim aan hangt (WINTERMOODS_TOKEN); zie de
 * uitleg bovenaan `wintermoods.js` en de regel in CLAUDE.md. Eén functie,
 * publiek bereikbaar via de rewrite `/api/wintermoods/**` op de backoffice-site.
 */

initializeApp()
const db = getFirestore()
const REGION = 'europe-west1'

export const wintermoods = maakWintermoods({ db, region: REGION })
