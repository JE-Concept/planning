/**
 * De foto van een artikel, of een nette plaatshouder.
 *
 * ── Waarom de plaatshouder geen grijs vlak met een icoon is ─────────────
 * Omdat een grijs vlak zegt "hier hoort iets te staan dat er niet is", en
 * dat is wat een bezoeker onthoudt. De plaatshouder draagt de categorie in
 * de huisletter, en ziet eruit als een keuze en niet als een gat. Zodra er
 * een foto geüpload is (vraag 9), verdwijnt hij vanzelf.
 *
 * `loading="lazy"` op de kaarten: een catalogus met dertig foto\'s hoort niet
 * dertig foto\'s te laden voor de eerste zichtbaar is. Op de artikelpagina
 * niet, want daar is de foto het eerste wat je ziet.
 */
export default function Foto({ artikel, groot = false }) {
  if (artikel.foto) {
    return (
      <img
        className={`vh__foto${groot ? ' vh__foto--groot' : ''}`}
        src={artikel.foto}
        alt={artikel.naam}
        loading={groot ? 'eager' : 'lazy'}
        decoding="async"
      />
    )
  }
  return (
    <div className={`vh__foto vh__foto--leeg${groot ? ' vh__foto--groot' : ''}`} aria-hidden="true">
      <span>{artikel.categorie || 'JE Concept'}</span>
    </div>
  )
}
