import { setGlobalOptions } from 'firebase-functions/v2'

/**
 * Het serviceaccount waaronder deze codebase draait.
 *
 * Zonder instelling draait elke functie als het standaard compute-account, en
 * dat heeft Editor op het hele project: een lek in één functie raakt dan alles,
 * ook wat die functie nooit nodig heeft. Met een eigen account per codebase
 * krijgt elke codebase alleen de rollen die ze gebruikt (zie de handover, stap
 * A12, voor welke).
 *
 * Opt-in: de uitrol zet JEPLAN_SA_MESSAGING uit een GitHub-variabele, en zolang die
 * leeg is, verandert er niets. De CLI leest dit bij het analyseren van de code,
 * vóór het uitrollen; daarom een omgevingsvariabele en geen parameter. Dit
 * bestand is de eerste import van index.js, zodat de instelling er staat voor
 * welke functie ook gedefinieerd wordt.
 */
const account = process.env.JEPLAN_SA_MESSAGING
if (account) setGlobalOptions({ serviceAccount: account })
