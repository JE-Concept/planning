import { getAuth } from 'firebase-admin/auth'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'
import {
  codesGelijk,
  codeVorm,
  isGeblokkeerd,
  keurCode,
  medewerkerUitUid,
  naGoedeBeurt,
  naMisseBeurt,
  uidVan,
} from './ploegcode.js'

/**
 * Aanmelden met een cijfercode, voor de ploeg.
 *
 * ── Waarom dit via een functie loopt en niet via de regels ────────────────
 * Omdat er iemand moet beslissen of de code klopt, en dat kan de browser niet
 * doen: dan zou hij de code moeten kunnen lezen om ze te vergelijken, en dan
 * kan iedereen die van iedereen lezen. De code staat in een collectie die
 * geen enkel tabblad mag openen (`allow read, write: if false`), en alleen
 * deze functie komt erbij. Wat ze teruggeeft is een `custom token`, waarmee
 * Firebase Auth de persoon verder als gewone gebruiker behandelt.
 *
 * ── Wat er op het spel staat ──────────────────────────────────────────────
 * Vier cijfers beschermen hier: je eigen uren, en de events waarop je staat
 * met hun tijd en plaats. Geen bedragen, geen gegevens van anderen. Dat is
 * wat deze drempel waard moet zijn, niet meer — en het slot na vijf misse
 * pogingen (zie `ploegcode.js`) is wat hem van een drempel een slot maakt.
 *
 * ── Waarom de namenlijst open staat ───────────────────────────────────────
 * Je moet je naam kunnen kiezen voordat je aangemeld bent; dat is de hele
 * opzet. De lijst geeft dus namen prijs aan wie het aanmeldscherm opent — en
 * niets meer: geen e-mail, geen gsm, geen statuut, geen afdeling. Dat is de
 * prijs van aanmelden zonder account, en ze is bewust zo laag mogelijk
 * gehouden.
 */

/** Hoe lang een beheerder een code mag inkijken voor het weer dichtgaat. */
const KIJK_LOGBOEK = 'personeelCodeGelezen'

export function maakPloegFuncties({ db, region }) {
  const codes = () => db.collection('personeelCodes')
  const mensen = () => db.collection('aapiEmployees')

  async function medewerker(id) {
    const snap = await mensen().doc(String(id ?? '')).get()
    if (!snap.exists) throw new HttpsError('not-found', 'Die medewerker kennen we niet.')
    const rij = { id: snap.id, ...snap.data() }
    if (rij.active === false) throw new HttpsError('permission-denied', 'Dat account staat uit.')
    return rij
  }

  /**
   * Het profiel waarmee iemand uit AAPI in de tool rondloopt.
   *
   * `set` met samenvoegen en niet overschrijven: zijn foto en zijn voorkeuren
   * zet hij zelf, en die mogen bij een volgende aanmelding niet teruggezet
   * worden. De rol staat vast op `staff` — die komt hier vandaan en niet uit
   * een keuzelijst, want een code-account hoort nooit meer te kunnen dan de
   * ploeg.
   */
  async function zorgVoorProfiel(rij) {
    const uid = uidVan(rij.id)
    const ref = db.collection('profiles').doc(uid)
    const bestaand = await ref.get()

    await ref.set(
      {
        fullName: rij.displayName ?? rij.rawName ?? 'Medewerker',
        email: rij.email ?? null,
        role: 'staff',
        active: true,
        // Waar hij vandaan komt. Hieraan hangt wat hij van AAPI mag zien.
        aapiEmployeeId: rij.id,
        viaCode: true,
        department: rij.afdeling ?? null,
        updatedAt: new Date(),
        ...(bestaand.exists ? {} : { createdAt: new Date() }),
      },
      { merge: true }
    )
    return uid
  }

  /**
   * De namen om uit te kiezen op het aanmeldscherm.
   *
   * Zonder aanmelding, want dat is het punt. Alleen id en naam — zie de kop.
   */
  const ploegLijst = onCall({ region, cors: true }, async () => {
    const snap = await mensen().where('active', '==', true).get()
    return {
      mensen: snap.docs
        .map((d) => ({ id: d.id, naam: d.data().displayName ?? d.data().rawName ?? null }))
        .filter((m) => m.naam)
        .sort((a, b) => a.naam.localeCompare(b.naam)),
    }
  })

  /**
   * Aanmelden, en bij de eerste keer meteen een code kiezen.
   *
   * Eén functie voor allebei, want het is één handeling: je kiest je naam, je
   * typt vier cijfers, en of dat nu de eerste keer is of de twintigste weet de
   * server beter dan het scherm. Zou het scherm beslissen, dan kon iemand
   * "eerste keer" spelen op andermans naam en zo zijn code overschrijven.
   */
  const ploegAanmelden = onCall({ region, cors: true }, async (request) => {
    const id = String(request.data?.medewerkerId ?? '').trim()
    const code = String(request.data?.code ?? '')
    const rij = await medewerker(id)

    const ref = codes().doc(rij.id)
    const snap = await ref.get()
    const stand = snap.exists ? snap.data() : null

    const slot = isGeblokkeerd(stand, new Date())
    if (slot.dicht) {
      throw new HttpsError('resource-exhausted', 'ploeg.fout.geblokkeerd', {
        tot: slot.tot.toISOString(),
      })
    }

    // Nog geen code: dan is dit de eerste keer en zet hij hem nu.
    if (!stand?.code) {
      const klacht = keurCode(code)
      if (klacht) throw new HttpsError('invalid-argument', klacht)
      await ref.set({ code, gezetOp: new Date(), ...naGoedeBeurt(new Date()) }, { merge: true })
      return { token: await maakToken(rij), nieuw: true }
    }

    if (!codeVorm(code) || !codesGelijk(code, stand.code)) {
      const na = naMisseBeurt(stand, new Date())
      await ref.set(na, { merge: true })
      if (na.geblokkeerdTot) {
        throw new HttpsError('resource-exhausted', 'ploeg.fout.geblokkeerd', {
          tot: na.geblokkeerdTot.toISOString(),
        })
      }
      throw new HttpsError('permission-denied', 'ploeg.fout.verkeerd')
    }

    await ref.set(naGoedeBeurt(new Date()), { merge: true })
    return { token: await maakToken(rij), nieuw: false }
  })

  async function maakToken(rij) {
    const uid = await zorgVoorProfiel(rij)
    /*
      Het Employee Id gaat mee als claim.

      Daardoor kunnen de regels "zijn eigen shifts" uitdrukken zonder eerst
      zijn profiel te lezen — en een claim kan hij niet zelf zetten, een veld
      in een document in sommige gevallen wel.
    */
    return getAuth().createCustomToken(uid, { ploeg: true, aapiEmployeeId: rij.id })
  }

  /** Je eigen code wijzigen, als je met een code binnen bent. */
  const ploegCodeWijzigen = onCall({ region, cors: true }, async (request) => {
    const uid = request.auth?.uid
    const eigen = medewerkerUitUid(uid)
    if (!eigen) throw new HttpsError('permission-denied', 'Alleen de ploeg heeft een code.')

    const klacht = keurCode(String(request.data?.code ?? ''))
    if (klacht) throw new HttpsError('invalid-argument', klacht)

    await codes().doc(eigen).set(
      { code: String(request.data.code), gezetOp: new Date(), mislukt: 0, geblokkeerdTot: null },
      { merge: true }
    )
    return { ok: true }
  })

  /**
   * De code van iemand opzoeken, voor wie met Google aanmeldt.
   *
   * Jasper wil ze in de backoffice kunnen zien, en dat is de reden dat ze
   * leesbaar bewaard wordt in plaats van versleuteld. De keerzijde staat in de
   * documentatie en op het scherm waar iemand zijn code kiest: vier cijfers
   * zijn de vorm van een bankcode, en mensen hergebruiken die.
   *
   * Wie kijkt, laat een spoor na. Dat is wat "zichtbaar" draaglijk maakt: niet
   * dat niemand kan kijken, maar dat kijken niet onzichtbaar is.
   */
  const ploegCodeLezen = onCall({ region, cors: true }, async (request) => {
    const uid = request.auth?.uid
    if (!uid) throw new HttpsError('unauthenticated', 'Meld je eerst aan.')

    const mij = await db.collection('profiles').doc(uid).get()
    const rol = mij.data()?.role
    if (!['owner', 'admin', 'member', 'guest'].includes(rol)) {
      throw new HttpsError('permission-denied', 'Alleen het bureau kan dit inkijken.')
    }

    const id = String(request.data?.medewerkerId ?? '').trim()
    const snap = await codes().doc(id).get()

    await db.collection(KIJK_LOGBOEK).add({
      medewerkerId: id,
      doorId: uid,
      doorNaam: mij.data()?.fullName ?? null,
      op: new Date(),
    }).catch((err) => logger.warn('kijklogboek mislukt', { fout: String(err) }))

    return { code: snap.exists ? (snap.data().code ?? null) : null }
  })

  return { ploegLijst, ploegAanmelden, ploegCodeWijzigen, ploegCodeLezen }
}
