const euro = (n) => `€ ${Number(n ?? 0).toFixed(2).replace('.', ',')}`

/**
 * Een prijs met erbij waarvoor hij geldt.
 *
 * Een bedrag zonder eenheid is geen prijs maar een getal. Zonder gekozen
 * datum staat er daarom "vanaf € 9 per dag", en mét datum het bedrag voor
 * precies die periode — want dat is wat de bezoeker wil weten en wat hij
 * straks betaalt.
 */
export default function Prijs({ artikel, dagen, bedrag }) {
  if (dagen.length === 0) {
    return (
      <span className="vh__prijs">
        vanaf <strong>{euro(artikel.prijsPerDag)}</strong> <span className="vh__klein">per dag</span>
      </span>
    )
  }

  return (
    <span className="vh__prijs">
      <strong>{euro(bedrag)}</strong>{' '}
      <span className="vh__klein">
        voor {dagen.length} {dagen.length === 1 ? 'dag' : 'dagen'}, excl. btw
      </span>
    </span>
  )
}
