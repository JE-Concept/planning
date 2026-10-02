import { lazy } from 'react'
import { laadCatalogus } from './i18n'

/**
 * Een scherm én zijn teksten, samen onderweg.
 *
 * De schermen komen al los binnen (`lazy`), maar hun teksten niet: die zaten
 * allemaal in de eerste download. Honderddertig kilobyte over elk scherm van
 * de tool, opgehaald door iedereen die de app opent — ook door wie alleen zijn
 * uren komt boeken, en door elke klant die op een offertelink klikt.
 *
 * Dit zet de twee naast elkaar. Welke woordenlijsten een scherm nodig heeft,
 * staat bij dat scherm in de routetabel, en hier worden ze tegelijk met het
 * scherm opgehaald — twee verzoeken naast elkaar, niet na elkaar. De
 * `<Suspense>` die er voor de schermen toch al staat, wacht op allebei; er is
 * dus geen tweede laadtoestand en geen moment waarin het scherm zijn sleutels
 * laat zien.
 *
 * Een vergeten woordenlijst is precies dat laatste: een scherm waarop elk
 * label een kale sleutel is. Daarom rekent `tests/taalbundels.test.js` na welke
 * sleutels elk scherm opzoekt, en of de lijst hier dat dekt.
 */
export function pagina(laad, ...catalogi) {
  return lazy(async () => {
    const [module] = await Promise.all([laad(), ...catalogi.map(laadCatalogus)])
    return module
  })
}
