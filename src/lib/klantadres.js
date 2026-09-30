/**
 * Het adres van een pagina voor de klant.
 *
 * ── Waarom dit niet zomaar een sjabloon is ────────────────────────────────
 * De app draait in productie op een padrouter en in de demo op een
 * hashrouter — die laatste omdat de demo onder een submap gepubliceerd wordt.
 * Een link met een `#` erin werkt daardoor lokaal wel en live niet, of
 * andersom, en dat merk je pas wanneer een klant hem al gekregen heeft.
 *
 * `VITE_APP_URL` gaat voor op het adres in de adresbalk: deze link gaat in een
 * mail, en dan hoort er niet "localhost" in te staan omdat iemand hem vanaf
 * zijn laptop kopieerde.
 */
export function klantAdres(pad) {
  const basis = import.meta.env.VITE_APP_URL ?? window.location.origin
  const hash = import.meta.env.MODE === 'demo' ? '#/' : '/'
  return `${basis.replace(/\/+$/, '')}/${hash}${pad}`.replace(/([^:])\/\//g, '$1/')
}
