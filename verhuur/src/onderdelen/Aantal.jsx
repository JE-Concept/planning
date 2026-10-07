/**
 * Hoeveel stuks: min, het getal, plus.
 *
 * Een kaal getalveld vraagt op een telefoon om een toetsenbord voor iets wat
 * bijna altijd "één meer" is. De knoppen zijn een duim breed; het veld blijft
 * om er veertig in te tikken.
 */
export default function Aantal({ waarde, onWijzig, min = 1, klein = false, naam = 'Aantal' }) {
  return (
    <div className={`je-qty${klein ? ' je-qty--sm' : ''}`} role="group" aria-label={naam}>
      <button type="button" className="je-qty__btn" aria-label="Eén minder" disabled={waarde <= min} onClick={() => onWijzig(waarde - 1)}>
        −
      </button>
      <input
        className="je-qty__input"
        type="number"
        min={min}
        value={waarde}
        aria-label={naam}
        onChange={(e) => onWijzig(Math.max(min, Math.round(Number(e.target.value) || min)))}
      />
      <button type="button" className="je-qty__btn" aria-label="Eén meer" onClick={() => onWijzig(waarde + 1)}>
        +
      </button>
    </div>
  )
}
