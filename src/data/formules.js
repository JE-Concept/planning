import { deleteDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { COL, newRef, ref } from '@lib/collections'
import { prijsVan } from '@lib/formules'
import { tekst } from '@lib/i18n'

/**
 * Vaste formules: een aanbod met een vaste prijs per persoon, een reeks vragen
 * (hapjes, drankenformule, dessert) en de bestelregels die eruit volgen.
 *
 * Het rekenwerk staat in `@lib/formules`; hier staat alleen wat er naar
 * Firestore gaat. Een formule beheert een beheerder in Instellingen, net als
 * de templates — daarom leest het team ze en schrijft alleen een beheerder.
 */

const id = () => Math.random().toString(36).slice(2, 10)

export const nieuweKeuze = (label = '') => ({ id: id(), label, prijsPerPersoon: 0, prijsVast: 0 })

/**
 * Een nieuwe vraag begint met twee antwoorden waarvan het eerste gratis is.
 * Zo is "geen dessert" altijd een geldig antwoord en kan niemand per ongeluk
 * een meerprijs aanrekenen door een vraag over te slaan.
 */
export const nieuweOptie = (label = 'Nieuwe vraag') => ({
  id: id(),
  label,
  btwPercent: null,
  keuzes: [nieuweKeuze('Geen'), nieuweKeuze('Ja')],
})

export const nieuweBestelregel = (keuzeId = null) => ({
  id: id(),
  item: '',
  categorie: 'Keuken',
  eenheid: 'stuks',
  perPersoon: 1,
  vast: 0,
  inhoud: 1,
  verpakking: '',
  keuzeId,
})

export const nieuweFormule = (position = 0) => ({
  icon: 'utensils',
  name: 'Nieuwe formule',
  omschrijving: '',
  prijsPerPersoon: 0,
  prijsVast: 0,
  btwPercent: 12,
  templateId: 'nieuw-event',
  position,
  archived: false,
  opties: [],
  bestelregels: [],
})

/** Het regeltje onder een formule in de lijst. */
export function formuleSamenvatting(formule) {
  const vragen = formule?.opties?.length ?? 0
  const regels = formule?.bestelregels?.length ?? 0
  const bedrag = (Number(formule?.prijsPerPersoon) || 0).toFixed(2).replace('.', ',')
  return [
    tekst('formulelib.formule.per_persoon', { bedrag }),
    vragen
      ? tekst('formulelib.formule.vraag', { aantal: vragen })
      : tekst('formulelib.formule.geen_vragen'),
    tekst('formulelib.formule.bestelregel', { aantal: regels }),
  ].join(' · ')
}

/**
 * Het offertebedrag dat een event uit deze formule meekrijgt.
 *
 * Exclusief btw, want dat is wat `quoteAmount` elders in de tool betekent (het
 * vult ook `budget`, en daar wordt op gerapporteerd). De btw staat er apart bij
 * op de fiche, zodat niemand hoeft te gokken welke kant van de btw hij ziet.
 */
export function offerteBedrag(formule, keuzes, personen) {
  return prijsVan(formule, keuzes, personen).exclBtw
}

export function saveFormule(formule) {
  const { id: formuleId, ...rest } = formule
  return setDoc(ref(COL.formules, formuleId), { ...rest, updatedAt: serverTimestamp() })
}

export function createFormule(formule) {
  const nieuweId = newRef(COL.formules).id
  return saveFormule({ ...formule, id: nieuweId }).then(() => nieuweId)
}

export function deleteFormule(formuleId) {
  return deleteDoc(ref(COL.formules, formuleId))
}
