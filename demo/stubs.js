/** De resterende Firebase-modules die de demobuild niet nodig heeft. */
export const initializeApp = () => ({ __demo: true })
export const getStorage = () => ({ __demo: true })
export const connectStorageEmulator = () => {}

/**
 * Opslag in de demo: het bestand blijft in dit tabblad.
 *
 * Een blob-URL leeft zolang de pagina openstaat, en dat is precies wat de demo
 * is. Zo werkt uploaden en openen zoals het hoort zonder dat er iets de deur
 * uit gaat.
 */
export const ref = (_storage, path) => ({ path })
// De blob blijft aan de verwijzing hangen, want `getDownloadURL` krijgt die
// verwijzing mee en niet het antwoord van `uploadBytes` — zonder dit leverde de
// demo een '#' op en bleef elk geüpload bestand een gebroken plaatje.
export const uploadBytes = async (bestand, blob) => {
  bestand.blob = blob
  return { ref: bestand, blob }
}
export const getDownloadURL = async (bestand) =>
  bestand.blob ? URL.createObjectURL(bestand.blob) : '#'
export const deleteObject = async () => {}
export const getFunctions = () => ({ __demo: true })
/*
  De demo kent één functie bij naam: het voorbeeldkaartje bij een link. De rest
  geeft hetzelfde vriendelijke antwoord als altijd.

  Het kaartje is verzonnen en er gaat niets de deur uit — een demo die een
  vreemde site ophaalt, is een demo die zonder internet stukgaat en die elke
  bezoeker aanmeldt bij iemand anders' server.
*/
const VERZONNEN_KAARTJE = {
  titel: 'Hoeve Vanhove — feestzaal in Borgloon',
  omschrijving: 'Een gerestaureerde vierkantshoeve met boomgaard, tot 180 gasten. Parkeren op het erf.',
  afbeelding: null,
  site: 'Hoeve Vanhove',
  leeg: false,
}

export const httpsCallable = (_functions, naam) => async (gegevens) => {
  if (naam === 'linkVoorbeeld') return { data: { url: gegevens?.url ?? null, ...VERZONNEN_KAARTJE } }
  return { data: { ok: true, role: 'owner' } }
}
