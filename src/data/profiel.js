/**
 * Je eigen profiel: je naam en je foto.
 *
 * Alleen die twee, en alleen van jezelf. Je rol, je uurtarief en of je actief
 * bent staan er niet bij: die bepaalt een beheerder, en de regels in
 * `firestore.rules` laten hier ook niets anders door. Wat het scherm niet toont
 * is dus niet het enige dat het tegenhoudt.
 */
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { app, db } from '@lib/firebase'
import { AVATARMAAT, keurBestand, vierkanteFoto } from '@lib/beeld'

/* De klachten van `keurBestand`, in de woorden van dit scherm. */
const KLACHT = {
  geen_bestand: 'profiel.foto_geen_bestand',
  geen_beeld: 'profiel.foto_geen_beeld',
  te_groot: 'profiel.foto_te_groot',
}

/** Het pad in de opslag. Eén bestand per persoon: een nieuwe foto vervangt de vorige. */
export const avatarPad = (uid) => `avatars/${uid}`

export async function updateMyProfile(uid, { fullName }) {
  const naam = String(fullName ?? '').trim()
  if (!naam) throw new Error('profiel.naam_leeg')
  await updateDoc(doc(db, 'profiles', uid), { fullName: naam, updatedAt: serverTimestamp() })
}

/**
 * De foto erop.
 *
 * Eerst naar de opslag, dan pas het veld op het profiel: een `avatarUrl` die
 * naar een bestand wijst dat er niet staat, is een gebroken plaatje naast elke
 * taak die die persoon heeft.
 */
export async function uploadAvatar(uid, file) {
  const klacht = keurBestand(file)
  if (klacht) throw new Error(KLACHT[klacht])

  const blob = await vierkanteFoto(file, AVATARMAAT)

  const { getStorage, ref: storageRef, uploadBytes, getDownloadURL } = await import('firebase/storage')
  const bestand = storageRef(getStorage(app), avatarPad(uid))
  await uploadBytes(bestand, blob, { contentType: 'image/jpeg' })
  const url = await getDownloadURL(bestand)

  await updateDoc(doc(db, 'profiles', uid), { avatarUrl: url, updatedAt: serverTimestamp() })
  return url
}

/**
 * De foto eraf.
 *
 * Het veld eerst leeg, dan pas het bestand weg: andersom zou er even een
 * verwijzing staan naar iets dat al verdwenen is. Of het bestand werkelijk
 * verdwijnt is bijzaak — het staat nergens meer in de weg — dus een mislukte
 * opruiming laat de knop niet falen.
 */
export async function removeAvatar(uid) {
  await updateDoc(doc(db, 'profiles', uid), { avatarUrl: null, updatedAt: serverTimestamp() })
  try {
    const { getStorage, ref: storageRef, deleteObject } = await import('firebase/storage')
    await deleteObject(storageRef(getStorage(app), avatarPad(uid)))
  } catch {
    /* het bestand was er al niet meer, of de opslag wil niet; het profiel klopt. */
  }
}
