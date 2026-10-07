/**
 * Wat er vrij is in de gekozen periode.
 *
 * Alleen met een datum: zonder is "nog drie vrij" een getal over vandaag, en
 * dat is zelden de dag waarop iemand het nodig heeft. Volzet blijft staan,
 * met een lege stip: weglaten zou zeggen dat we het niet hébben.
 */
export default function Beschikbaar({ vrij, voorraad, laadt, metPeriode = false }) {
  if (laadt && vrij === undefined) {
    return (
      <span className="je-avail je-avail--loading">
        <span className="je-avail__dot" />
        nakijken…
      </span>
    )
  }
  const aantal = vrij ?? voorraad
  if (aantal === 0) {
    return (
      <span className="je-avail je-avail--full">
        <span className="je-avail__dot" />
        volzet op deze datum
      </span>
    )
  }
  const weinig = aantal <= 3
  return (
    <span className={`je-avail${weinig ? ' je-avail--few' : ''}`}>
      <span className="je-avail__dot" />
      {weinig ? 'nog ' : ''}
      {aantal} vrij{metPeriode ? ' in je periode' : ''}
    </span>
  )
}
