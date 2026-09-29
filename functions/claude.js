import { HttpsError } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'

/**
 * De enige plek waar deze applicatie met Claude praat.
 *
 * Server-side, omdat een API-sleutel niet in een browser hoort: wie de bundel
 * opent, leest hem mee. En omdat het werk moet doorgaan wanneer iemand halverwege
 * zijn tabblad sluit.
 *
 * Het model staat hier als constante en niet in een instelling. Een model
 * wisselen is geen knop maar een beslissing: de prompts zijn erop afgestemd en
 * de uitkomst verandert mee.
 */
const MODEL = 'claude-sonnet-5-5'
const API = 'https://api.anthropic.com/v1/messages'

/**
 * Wat er misgaat wanneer de sleutel ontbreekt.
 *
 * Firebase geeft anders "internal", en daar staat een gebruiker mee in de kou:
 * het klinkt als een fout in de app terwijl er alleen iets niet ingesteld is.
 * De melding zegt daarom wat er moet gebeuren en door wie.
 */
function eisSleutel(sleutel) {
  if (sleutel) return sleutel
  throw new HttpsError(
    'failed-precondition',
    'De sleutel voor de assistent is niet ingesteld. Een beheerder zet ANTHROPIC_API_KEY ' +
      'als secret bij de functions en rolt opnieuw uit — zie docs/assistent-aanzetten.md.'
  )
}

/**
 * Eén vraag aan Claude, met het antwoord zoals de API het geeft.
 *
 * De fout van de API wordt vertaald naar iets wat op het scherm te lezen is.
 * "429" en "overloaded" zijn tijdelijk en horen dat te zeggen; een verkeerde
 * sleutel is dat niet en hoort bij een beheerder terecht te komen.
 */
export async function vraagClaude({ sleutel, system, messages, tools, maxTokens = 2048 }) {
  const key = eisSleutel(sleutel)

  let antwoord
  try {
    antwoord = await fetch(API, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        ...(system ? { system } : {}),
        messages,
        ...(tools?.length ? { tools } : {}),
      }),
    })
  } catch (err) {
    logger.error('Claude niet bereikbaar', err)
    throw new HttpsError('unavailable', 'De assistent is even niet bereikbaar. Probeer het zo opnieuw.')
  }

  if (!antwoord.ok) {
    const tekst = await antwoord.text().catch(() => '')
    logger.error('Claude gaf een fout', { status: antwoord.status, tekst: tekst.slice(0, 500) })

    if (antwoord.status === 401 || antwoord.status === 403) {
      throw new HttpsError(
        'failed-precondition',
        'De sleutel voor de assistent wordt geweigerd. Een beheerder controleert ANTHROPIC_API_KEY.'
      )
    }
    if (antwoord.status === 429 || antwoord.status >= 500) {
      throw new HttpsError('unavailable', 'De assistent is even overbelast. Probeer het zo opnieuw.')
    }
    throw new HttpsError('internal', `De assistent gaf een fout (${antwoord.status}).`)
  }

  return antwoord.json()
}

/**
 * Hetzelfde, maar met een antwoord dat JSON moet zijn.
 *
 * Een model dat om JSON gevraagd wordt, zet er soms een zin omheen of een
 * ```json-blok. Dat hier opvangen is betrouwbaarder dan erop hopen, en het
 * scheelt een mislukte samenvatting van een overleg dat iemand net getypt heeft.
 */
export async function vraagClaudeJson({ sleutel, system, messages, maxTokens = 4096 }) {
  const data = await vraagClaude({ sleutel, system, messages, maxTokens })
  const tekst = (data.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()

  const zonderHek = tekst.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
  const eerste = zonderHek.indexOf('{')
  const laatste = zonderHek.lastIndexOf('}')
  const kandidaat = eerste >= 0 && laatste > eerste ? zonderHek.slice(eerste, laatste + 1) : zonderHek

  try {
    return JSON.parse(kandidaat)
  } catch (err) {
    logger.error('Claude gaf geen leesbare JSON', { tekst: tekst.slice(0, 500), err })
    throw new HttpsError('internal', 'Het antwoord was niet te lezen. Probeer het opnieuw.')
  }
}
