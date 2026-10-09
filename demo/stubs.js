/** De resterende Firebase-modules die de demobuild niet nodig heeft. */
export const initializeApp = () => ({ __demo: true })
export const getStorage = () => ({ __demo: true })
export const connectStorageEmulator = () => {}
// App Check heeft in de demo niets te bewijzen: er is geen server.
export const initializeAppCheck = () => ({ __demo: true })
export class ReCaptchaEnterpriseProvider {}

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

const VERZONNEN_BEDRIJF = {
  naam: 'Brouwerij De Verzonnen Hop BV',
  adres: { street: 'Hopveld 12', postalCode: '3800', city: 'Sint-Truiden', country: 'België' },
}

/*
  De ploeg van de demo, met hun code. Verzonnen, net als de rest — maar het
  aanmeldscherm moet wél een lijst krijgen, anders is er niets te kiezen.
*/
const DEMO_PLOEG = [
  { id: 'a-jumana', naam: 'Jumana Mhanawi', code: '4821' },
  { id: 'a-roeland', naam: 'Roeland Kempeneers', code: '7305' },
  { id: 'a-herman', naam: 'Herman Van Ormelingen', code: null },
  { id: 'a-faycal', naam: 'Faycal El Amraoui', code: '9142' },
]

export const httpsCallable = (_functions, naam) => async (gegevens) => {
  if (naam === 'messagingHerspelen') {
    // De demo heeft geen verwerker; ze zet de stand op klaar zodat het scherm
    // laat zien wat herspelen doet.
    const { allDocs, schrijfAlsServer } = await import('./firestore.js')
    const id = gegevens?.id
    const verwerker = gegevens?.verwerker ?? 'event'
    const huidig = allDocs().get(`messaging/${id}`)
    if (!huidig) throw new Error('not-found')
    // Zoals de functie: langs de regels heen, want de browser mag de log niet schrijven.
    schrijfAlsServer('messaging', id, {
      verwerking: { ...(huidig.verwerking ?? {}), [verwerker]: { stand: 'klaar', taskId: 't-trouw', op: new Date() } },
    })
    return { data: { ok: true, stand: 'klaar' } }
  }
  if (naam === 'mailPlakken') {
    // Dezelfde rij als de functie, uit dezelfde bouwsteen, langs de regels heen.
    const { allDocs, maakAlsServer } = await import('./firestore.js')
    const { geplakteMail } = await import('../functions/mail-koppeling.js')
    const event = allDocs().get(`tasks/${gegevens?.eventId}`)
    if (!event || event.parentId) throw new Error('not-found')
    const rij = geplakteMail({ ...gegevens, customerId: event.customerId ?? null, door: 'u-jasper' })
    if (!rij) throw new Error('invalid-argument')
    maakAlsServer('mails', rij.id, rij.data)
    return { data: { id: rij.id } }
  }
  if (naam === 'linkVoorbeeld') return { data: { url: gegevens?.url ?? null, ...VERZONNEN_KAARTJE } }
  /*
    VIES bestaat in de demo niet: elk nummer hoort bij dezelfde verzonnen
    brouwerij, in de vorm die `leesViesAntwoord` teruggeeft. Behalve een
    nummer met alleen nullen — dan zegt de demo "ongeldig", zodat ook dat
    antwoord te zien is.
  */
  if (naam === 'btwOpzoeken') {
    if (/^(be)?[\s.0]*$/i.test(gegevens?.btw ?? '')) {
      return { data: { geldig: false, naam: '', adres: null, reden: 'ongeldig' } }
    }
    return { data: { geldig: true, naam: VERZONNEN_BEDRIJF.naam, adres: { ...VERZONNEN_BEDRIJF.adres }, reden: null } }
  }
  if (naam === 'ploegLijst') {
    return { data: { mensen: DEMO_PLOEG.map(({ id, naam: n }) => ({ id, naam: n })) } }
  }
  if (naam === 'ploegCodeLezen') {
    return { data: { code: DEMO_PLOEG.find((m) => m.id === gegevens?.medewerkerId)?.code ?? null } }
  }
  if (naam === 'ploegCodeWijzigen') return { data: { ok: true } }
  // De demo heeft geen Stripe; ze zegt ja en laat de rest aan het scherm.
  if (naam === 'verhuurWaarborgTerug') {
    return { data: { terugCent: Math.max(0, 15000 - (gegevens?.schadeCent ?? 0)), schadeCent: gegevens?.schadeCent ?? 0 } }
  }
  if (naam === 'ploegAanmelden') {
    /*
      De demo meldt niemand echt aan — er is geen Firebase Auth. Ze doet wel
      de controle na, zodat het scherm met een verkeerde code hetzelfde zegt
      als live. Een demo die alles goedkeurt, laat niet zien wat er gebeurt.
    */
    const wie = DEMO_PLOEG.find((m) => m.id === gegevens?.medewerkerId)
    if (!wie) throw new Error('ploeg.fout.algemeen')
    if (wie.code && gegevens?.code !== wie.code) throw new Error('ploeg.fout.verkeerd')
    return { data: { token: 'demo', nieuw: !wie.code } }
  }
  return { data: { ok: true, role: 'owner' } }
}

