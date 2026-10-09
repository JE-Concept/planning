import { Field } from '@components/ds'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { createCustomer } from '@data/customers'
import ObjectKiezer from './ObjectKiezer'

const LOS = '__zonder_fiche'

/**
 * De klant van een event, een taak of een offerte: één veld dat zoekt terwijl
 * je typt, met onderaan "Nieuwe klant ‘…’ maken".
 *
 * Vroeger was dit een keuzelijst met alle klanten plus een apart vrij veld
 * "Klantnaam". Met honderden klanten is zo'n lijst scrollen in plaats van
 * kiezen, en het vrije veld werd de weg van de minste weerstand: een naam op
 * het event, maar geen fiche, dus geen historiek en geen btw-nummer. Nu is
 * het getypte de zoekvraag, en staat de klant er niet bij, dan is aanmaken
 * de laatste regel van dezelfde lijst — met alleen de naam. De rest vult wie
 * het weet later aan op de fiche, of haalt ze op met het btw-nummer.
 *
 * Wat naar buiten gaat is het paar `{ id, naam }`; de ouder zet het op zijn
 * eigen velden (`customerId`/`customerName` op een event of taak,
 * `klantId`/`klantNaam` op een offerte). De naam reist mee als kopie, want
 * Firestore kan niet joinen en een lijst die per rij de klant moet opzoeken,
 * leest zich scheef; een hernoeming werkt die kopie server-side bij
 * (`spreadCustomerRename`).
 *
 * Een naam zonder id — van vóór dit veld, of de afzender uit een ingelezen
 * aanvraag — blijft staan en wordt erbij gezegd. Ze stilletjes wissen zou
 * gegevens weggooien; ze stilletjes tot klant maken zou een fiche maken die
 * niemand gevraagd heeft.
 */
export default function KlantKiezer({ id, naam, onChange, label, veldnaam, required = false, className }) {
  const { t } = useTaal()
  const toast = useToast()

  /*
    Een losse naam staat ook als pil, met een plaatsvervangend id: zo is ze
    met hetzelfde kruisje weg te halen als een gekoppelde klant. Dat id gaat
    nooit naar buiten — weghalen geeft een lege keuze, en kiezen geeft de
    echte klant.
  */
  const waarde = id
    ? [{ soort: 'klant', id, label: naam || '' }]
    : naam
      ? [{ soort: 'klant', id: LOS, label: naam }]
      : []

  const maak = async (tekst) => {
    try {
      const nieuwId = await createCustomer({ name: tekst })
      toast.success(t('klant.kiezen.toegevoegd', { naam: tekst }))
      return { soort: 'klant', id: nieuwId, label: tekst }
    } catch (err) {
      toast.error(err.message)
      throw err
    }
  }

  const hint = id
    ? t('klant.kiezen.gekoppeld', { naam: naam || '' })
    : naam
      ? t('klant.kiezen.los', { naam })
      : t('klant.kiezen.hint')

  return (
    <Field label={label ?? t('events.fiche.klant')} required={required} hint={hint} className={className}>
      <ObjectKiezer
        waarde={waarde}
        onChange={([k]) => onChange(k ? { id: k.id, naam: k.label } : { id: null, naam: null })}
        soorten={['klant']}
        meerdere={false}
        plaatshouder={t('klant.kiezen.plaatshouder')}
        naam={veldnaam ?? t('klant.kiezen.veld')}
        nieuw={{ soort: 'klant', label: (tekst) => t('klant.kiezen.nieuw', { naam: tekst }), maak }}
      />
    </Field>
  )
}
