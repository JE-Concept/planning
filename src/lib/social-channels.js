/**
 * De kanalen waarop een post terechtkomt.
 *
 * Dit stond in `src/data/social.js`, naast de Firestore-abonnementen. Zodra de
 * weekweergave per kanaal moest bucketen en de preview de verhouding van een
 * kanaal moest kennen, kwam dat rijtje in het rekenwerk terecht — en dat
 * rekenwerk hoort testbaar te zijn zonder dat er een Firebase-app opstart.
 * Daarom staat het hier, puur, en haalt `@data/social` het hiervandaan.
 *
 * `ratio` is de verhouding waarin het beeld op dat kanaal getoond wordt, als
 * CSS-waarde voor `aspect-ratio`. Die verhoudingen zijn wat de kanalen zelf
 * aanraden voor een gewone feedpost: Instagram toont staand beeld het grootst,
 * Facebook en LinkedIn liggend, TikTok schermvullend staand.
 *
 * De namen van de kanalen zijn merknamen en blijven in elke taal staan. Alleen
 * de nieuwsbrief en de rij zonder kanaal hebben een tekst die vertaald wordt,
 * en die wordt opgezocht op het moment van tekenen — deze lijst wordt één keer
 * gemaakt en overal uitgelezen, dus een vaste tekst zou na een taalwissel de
 * oude blijven tonen tot iemand de pagina herlaadt.
 */

import { tekst } from './i18n'

export const CHANNELS = [
  {
    key: 'instagram',
    label: 'Instagram',
    short: 'IG',
    color: '#d62976',
    ratio: '4 / 5',
    ratioLabel: '4:5',
    captionMax: 2200,
    hashtagMax: 30,
  },
  {
    key: 'facebook',
    label: 'Facebook',
    short: 'FB',
    color: '#1877f2',
    ratio: '1.91 / 1',
    ratioLabel: '1.91:1',
    captionMax: 63206,
    hashtagMax: null,
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    short: 'TT',
    color: '#161a22',
    ratio: '9 / 16',
    ratioLabel: '9:16',
    captionMax: 2200,
    hashtagMax: null,
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    short: 'LI',
    color: '#0a66c2',
    ratio: '1.91 / 1',
    ratioLabel: '1.91:1',
    captionMax: 3000,
    hashtagMax: null,
  },
  {
    key: 'google',
    label: 'Google Business',
    short: 'GB',
    color: '#34a853',
    ratio: '4 / 3',
    ratioLabel: '4:3',
    captionMax: 1500,
    hashtagMax: null,
  },
  {
    key: 'newsletter',
    get label() {
      return tekst('formulelib.kanaal.nieuwsbrief')
    },
    short: 'NB',
    color: '#f59e0b',
    ratio: '2 / 1',
    ratioLabel: '2:1',
    captionMax: null,
    hashtagMax: null,
  },
]

/**
 * De rij voor posts waar nog geen kanaal op staat.
 *
 * Zonder zo'n rij verdwijnt zo'n post uit de weekweergave, en dat is precies
 * de post die iemand nog moet oppakken. Geen echt kanaal dus, maar wel een
 * plek waar hij te zien is.
 */
export const GEEN_KANAAL = 'geen'

const GEEN = {
  key: GEEN_KANAAL,
  get label() {
    return tekst('formulelib.kanaal.geen')
  },
  short: '—',
  color: '#8593a9',
  ratio: '1 / 1',
  ratioLabel: '1:1',
  captionMax: null,
  hashtagMax: null,
}

export const CHANNEL_KEYS = CHANNELS.map((c) => c.key)

/** Een onbekende sleutel levert nog steeds iets toonbaars op, geen lege kaart. */
export function channelMeta(key) {
  if (key === GEEN_KANAAL) return GEEN
  return (
    CHANNELS.find((c) => c.key === key) ?? {
      key,
      label: key ?? tekst('formulelib.kanaal.onbekend'),
      short: (key ?? '?').slice(0, 2).toUpperCase(),
      color: '#8593a9',
      ratio: '1 / 1',
      ratioLabel: '1:1',
      captionMax: null,
      hashtagMax: null,
    }
  )
}

/**
 * De kanalen van een post, ontdubbeld en in de volgorde van `CHANNELS`.
 *
 * De volgorde van het veld zelf hangt af van de volgorde waarin iemand de
 * knopjes aanklikte; dat mag niet bepalen hoe de kaart eruitziet.
 */
export function kanalenVan(post) {
  const gekozen = new Set(Array.isArray(post?.channels) ? post.channels : [])
  return CHANNEL_KEYS.filter((key) => gekozen.has(key))
}

/**
 * Het kanaal waarop de preview standaard staat.
 *
 * Het eerste gekozen kanaal in de vaste volgorde: staat een post op Instagram
 * en Facebook, dan is het beeld dat je wil nakijken het Instagram-beeld, want
 * dat is het strengste formaat.
 */
export function hoofdKanaal(post) {
  return kanalenVan(post)[0] ?? GEEN_KANAAL
}

/**
 * Welke rijen de weekweergave krijgt: de kanalen die deze week voorkomen.
 *
 * Alle zes kanalen tonen geeft vier lege rijen; dit team post niet op TikTok.
 * Een lege week zou dan helemaal niets tonen, dus valt die terug op de twee
 * kanalen waar bijna alles op gaat.
 */
export function kanaalRijen(posts = []) {
  const gebruikt = new Set()
  let zonder = false

  for (const post of posts) {
    const kanalen = kanalenVan(post)
    if (kanalen.length === 0) zonder = true
    for (const key of kanalen) gebruikt.add(key)
  }

  const rijen = CHANNEL_KEYS.filter((key) => gebruikt.has(key))
  if (zonder) rijen.push(GEEN_KANAAL)
  return rijen.length > 0 ? rijen : ['instagram', 'facebook']
}
