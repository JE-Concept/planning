import { euro, metBtw } from '../lib/weergave'

/**
 * Een prijs met erbij waarvoor hij geldt.
 *
 * Een bedrag zonder eenheid is geen prijs maar een getal. Zonder gekozen
 * datum staat er daarom "vanaf € 10,89 per dag", en mét datum het bedrag voor
 * precies die periode — want dat is wat de bezoeker wil weten en wat hij
 * straks betaalt. Met btw: zie `lib/weergave.js`.
 */
export default function Prijs({ artikel, dagen, bedrag, groot = false }) {
  const klasse = `je-price${groot ? ' je-price--lg' : ''}`
  if (dagen.length === 0) {
    return (
      <span className={klasse}>
        <span className="je-price__from">vanaf</span>
        <span className="je-price__amount">{euro(metBtw(artikel.prijsPerDag))}</span>
        <span>per dag</span>
      </span>
    )
  }

  return (
    <span className={klasse}>
      <span className="je-price__amount">{euro(metBtw(bedrag))}</span>
      <span>
        voor {dagen.length} {dagen.length === 1 ? 'dag' : 'dagen'}
        {groot ? ', incl. btw' : ''}
      </span>
    </span>
  )
}
