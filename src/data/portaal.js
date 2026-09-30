/**
 * De klantenpagina's praten met één functie, niet met Firestore.
 *
 * Waarom dat zo is, staat in `functions/portaal.js`: een browser leest altijd
 * een heel document, en op een offerte staan marges en interne notities. Wat
 * de klant ziet, kiest de server per veld.
 *
 * Er zit geen Firebase-SDK aan deze kant. Dat is niet toevallig: deze pagina's
 * worden geopend door mensen die de tool nooit zullen gebruiken, vaak op een
 * telefoon, vaak één keer. Een halve megabyte SDK inladen om een offerte te
 * lezen is dat niet waard — en zonder login heeft ze hier ook niets te doen.
 */

const BASIS = '/api/portaal'

async function vraag(pad, opties) {
  const res = await fetch(`${BASIS}/${pad}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opties,
  })
  if (!res.ok) throw new Error(`portaal ${res.status}`)
  return res.json()
}

export const haalPortaal = (pad) => vraag(pad)

export const stuurAntwoord = (token, body) =>
  vraag(`offerte/${token}/antwoord`, { method: 'POST', body: JSON.stringify(body) })
