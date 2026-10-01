import { tekst } from './i18n'

/**
 * Werk dat vanzelf terugkomt.
 *
 * ── Waarom dit er niet was ────────────────────────────────────────────────
 * De tool kende twee soorten herhaling: de punten van een dagelijkse lijst
 * (het poetsplan — een rol, geen persoon) en de taken van een eventtemplate
 * (die hangen aan een datum van een event). Wat ertussen viel, bestond niet:
 * administratie die elke week of elke maand terugkomt en aan één persoon
 * hangt. Dat werd onthouden, en wat onthouden wordt, wordt vergeten.
 *
 * ── Waarom het een eigen document is en geen taak met een vlag ────────────
 * Een taak is één keer werk, met een eigen afvinkmoment en een eigen
 * geschiedenis. Een herhaling is het recept. Zou de taak zichzelf
 * vermenigvuldigen, dan erft elke kopie het verleden van de vorige — de
 * reacties, de geboekte uren, het logboek — en dan weet niemand nog welke
 * week je aan het lezen bent.
 *
 * ── Waarom de datum hier berekend wordt en niet op de server ──────────────
 * Omdat het scherm hetzelfde moet kunnen zeggen als de functie: "volgende
 * keer maandag 6 oktober". Twee berekeningen die uit elkaar lopen, is een
 * herhaling die op een ander moment komt dan wat de instelling belooft.
 * Dit bestand draait in de browser én in `functions/herhalingen.js`.
 */

/** De soorten, met wat ze nodig hebben om een datum te kunnen bepalen. */
export const SOORTEN = ['dagelijks', 'wekelijks', 'maandelijks']

/** Waar een herhaling landt. Een taak op een bord, of werk op de socials. */
export const DOELEN = ['taak', 'social']

/* Maandag is 1, zondag is 7 — ISO, net als in het rooster en het poetsplan. */
const isoDag = (datum) => ((new Date(datum).getDay() + 6) % 7) + 1

/** Eén herhaling, met alles ingevuld wat de planner nodig heeft. */
export function maakHerhaling({
  id = null,
  titel = '',
  omschrijving = '',
  doel = 'taak',
  listId = null,
  profileId = null,
  brandId = null,
  soort = 'wekelijks',
  dagen = [1],
  dagVanMaand = 1,
  prioriteit = '',
  actief = true,
} = {}) {
  const echteSoort = SOORTEN.includes(soort) ? soort : 'wekelijks'
  return {
    ...(id ? { id } : {}),
    titel: String(titel ?? '').trim(),
    omschrijving: String(omschrijving ?? ''),
    doel: DOELEN.includes(doel) ? doel : 'taak',
    listId: listId ?? null,
    profileId: profileId ?? null,
    brandId: brandId ?? null,
    soort: echteSoort,
    // Alleen geldige weekdagen, gesorteerd en zonder dubbels: een herhaling op
    // "maandag, maandag, 9" zou anders twee taken maken en één nooit.
    dagen: [...new Set((Array.isArray(dagen) ? dagen : [dagen]).map(Number).filter((d) => d >= 1 && d <= 7))].sort(
      (a, b) => a - b
    ),
    /*
      Hoogstens de 28e. Een herhaling op de 31e slaat februari over en in vier
      van de twaalf maanden ook de laatste dag — en dan is het geen
      maandelijkse herhaling meer maar een herhaling die soms komt. Wie de
      laatste dag van de maand wil, vraagt om iets anders dan dit veld.
    */
    dagVanMaand: Math.min(28, Math.max(1, Math.round(Number(dagVanMaand) || 1))),
    prioriteit: String(prioriteit ?? ''),
    actief: actief !== false,
  }
}

/** Valt deze herhaling vandaag? */
export function isVervaldag(herhaling, datum = new Date()) {
  if (!herhaling || herhaling.actief === false) return false
  const d = new Date(datum)
  if (Number.isNaN(d.getTime())) return false

  if (herhaling.soort === 'dagelijks') return true
  if (herhaling.soort === 'wekelijks') return (herhaling.dagen ?? []).includes(isoDag(d))
  if (herhaling.soort === 'maandelijks') return d.getDate() === (herhaling.dagVanMaand ?? 1)
  return false
}

/**
 * De eerstvolgende keer dat ze valt, vanaf vandaag.
 *
 * Vooruit tellen en niet rekenen: hoogstens 31 stappen, en dan is elke
 * schrikkeldag, elke maandlengte en elke zomertijd vanzelf juist. Rekenen met
 * modulo's is korter en heeft hier al drie keer een dag verschoven.
 */
export function volgendeKeer(herhaling, vanaf = new Date()) {
  const d = new Date(vanaf)
  if (Number.isNaN(d.getTime()) || !herhaling || herhaling.actief === false) return null
  d.setHours(12, 0, 0, 0)
  for (let i = 0; i <= 31; i += 1) {
    if (isVervaldag(herhaling, d)) return new Date(d)
    d.setDate(d.getDate() + 1)
  }
  return null
}

/** De dag als sleutel, zonder tijdzone-verrassingen: 2026-10-06. */
export const dagSleutel = (datum) => {
  const d = new Date(datum)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Het vaste adres van de taak die deze herhaling vandaag maakt.
 *
 * Deterministisch, zodat een tweede poging op dezelfde dag — een herstart van
 * de functie, een handmatige herstart — exact hetzelfde document schrijft in
 * plaats van een tweede taak. Dat is de hele reden dat deze sleutel bestaat.
 */
export const sleutelVan = (herhalingId, datum) => `h-${herhalingId}-${dagSleutel(datum)}`

/** Hoe de instelling leest in het scherm: "Elke maandag", "Elke 1e". */
export function omschrijf(herhaling) {
  if (!herhaling) return ''
  if (herhaling.soort === 'dagelijks') return tekst('herhaling.elke_dag')
  if (herhaling.soort === 'maandelijks') {
    return tekst('herhaling.elke_maand', { dag: herhaling.dagVanMaand ?? 1 })
  }
  const namen = (herhaling.dagen ?? []).map((d) => tekst(`herhaling.dag.${d}`))
  return namen.length ? tekst('herhaling.elke_week', { dagen: namen.join(', ') }) : tekst('herhaling.geen_dag')
}
