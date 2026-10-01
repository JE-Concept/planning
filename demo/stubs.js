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
export const httpsCallable = () => async () => ({ data: { ok: true, role: 'owner' } })
