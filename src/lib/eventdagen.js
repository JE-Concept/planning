import { asDate, dayKey } from './dates'

/**
 * Welke dagen een event beslaat.
 *
 * ── De vraag van Maxine ───────────────────────────────────────────────────
 * "Kan een event een start- en einddatum hebben? Bijvoorbeeld: meerdaags
 * aankruisen en dan popt de einddatum op." Een event in JE Plan was tot nu één
 * dag, en dat klopt voor een trouw of een bedrijfsfeest. Het klopt niet voor
 * een festival, een beurs of een weekend — en die staan er ook tussen.
 *
 * ── Waarom er geen vinkje "meerdaags" in de databank staat ────────────────
 * Het vinkje is er in het scherm wél, want zo vroeg Maxine het en zo denk je
 * erover. Maar het wordt niet bewaard: wat bewaard wordt is `eventEndDate`, en
 * of een event meerdaags is lees je af aan het bestaan daarvan. Een vinkje
 * naast een datum is twee bronnen voor één waarheid, en die lopen uit elkaar
 * zodra iemand het vinkje uitzet en de datum laat staan — of omgekeerd. Dan
 * staat er een event dat volgens het ene veld één dag duurt en volgens het
 * andere drie.
 *
 * ── Waarom alles hier staat en niet in de schermen ────────────────────────
 * "Valt dit event op deze dag" is een vraag die op acht plaatsen gesteld wordt:
 * de kalender, het dashboard, het rooster, de agendafeed, het archief, het
 * klantenportaal, de personeelskoppeling en de zoekbalk. Acht keer `dayKey(e
 * .eventDate) === dag` schrijven werkte zolang een event één dag was; nu zou
 * het acht plaatsen zijn waar een meerdaags event half klopt.
 *
 * Een dag is hier een sleutel als "2026-10-25", in lokale tijd — dezelfde
 * sleutel die `dayKey` maakt en waarop elke kalender in deze tool al bucketet.
 */

/** Hoeveel dagen een event hoogstens mag beslaan. */
const MAX_DAGEN = 400

/** De eerste dag, of niets. */
export function beginVan(event) {
  return asDate(event?.eventDate) ?? null
}

/**
 * De laatste dag.
 *
 * Zonder einddatum is dat de begindag zelf: een event van één dag begint en
 * eindigt dezelfde dag, en dan hoeft geen enkele oproeper te weten of het veld
 * ingevuld is. Een einddatum die vóór de begindag ligt is onzin en wordt
 * genegeerd in plaats van een leeg venster op te leveren — zulke rijen bestaan,
 * want data wordt met de hand ingevuld.
 */
export function eindeVan(event) {
  const begin = beginVan(event)
  const einde = asDate(event?.eventEndDate)
  if (!begin) return einde
  if (!einde) return begin
  return einde.getTime() < begin.getTime() ? begin : einde
}

/** Duurt dit event meer dan één dag? */
export function isMeerdaags(event) {
  const begin = beginVan(event)
  const einde = eindeVan(event)
  if (!begin || !einde) return false
  return dayKey(einde) !== dayKey(begin)
}

/**
 * Elke dag die het event raakt, van begin tot einde.
 *
 * Met een bovengrens, want dit voedt lussen in de schermen. Een tikfout in een
 * jaartal — 2062 in plaats van 2026 — zou anders een kalender van dertienduizend
 * dagen tekenen en het tabblad doen vastlopen.
 */
export function dagenVan(event) {
  const begin = beginVan(event)
  const einde = eindeVan(event)
  if (!begin || !einde) return []

  const dagen = []
  const loper = new Date(begin.getFullYear(), begin.getMonth(), begin.getDate(), 12)
  const laatste = dayKey(einde)
  while (dagen.length < MAX_DAGEN) {
    const sleutel = dayKey(loper)
    dagen.push(sleutel)
    if (sleutel >= laatste) break
    loper.setDate(loper.getDate() + 1)
  }
  return dagen
}

/** Het aantal dagen dat het event duurt; 0 wanneer er geen datum staat. */
export function aantalDagen(event) {
  return dagenVan(event).length
}

/**
 * Valt dit event op die dag?
 *
 * Dit is de vraag die elke kalender stelt. Bij een event van één dag kost ze
 * één vergelijking; pas bij een meerdaags event wordt er gerekend.
 */
export function valtOpDag(event, sleutel) {
  const begin = beginVan(event)
  if (!begin || !sleutel) return false
  const van = dayKey(begin)
  if (van === sleutel) return true
  return sleutel > van && sleutel <= dayKey(eindeVan(event))
}

/** Valt dit event (deels) binnen een periode, grenzen meegerekend? */
export function raaktPeriode(event, vanSleutel, totSleutel) {
  const begin = beginVan(event)
  if (!begin) return false
  const van = dayKey(begin)
  const tot = dayKey(eindeVan(event))
  if (vanSleutel && tot < vanSleutel) return false
  if (totSleutel && van > totSleutel) return false
  return true
}

/**
 * De patch die "meerdaags" aan- of uitzet.
 *
 * Aanzetten zet de einddatum op de dag erna en niet op dezelfde dag: meerdaags
 * bétekent meer dan één dag, en een einddatum gelijk aan de begindag is een
 * vinkje dat aanstaat zonder gevolg. Uitzetten wist het veld — dat is wat "het
 * is toch maar één dag" betekent, en de datum half laten staan is precies het
 * soort rest waar later niemand meer uit wijs raakt.
 */
export function zetMeerdaags(event, aan) {
  if (!aan) return { eventEndDate: null }
  const begin = beginVan(event)
  if (!begin) return { eventEndDate: null }
  const dag = new Date(begin.getFullYear(), begin.getMonth(), begin.getDate() + 1, 12)
  return { eventEndDate: dag }
}

/**
 * De patch die een einddatum zet.
 *
 * Vroeger dan de begindag kan niet. Het scherm houdt dat al tegen met een
 * `min` op het invoerveld, maar een browser is geen waarborg en een script al
 * helemaal niet: een event dat eindigt voor het begint, maakt elk venster dat
 * erop rekent leeg.
 */
export function zetEinddatum(event, datum) {
  if (!datum) return { eventEndDate: null }
  const begin = beginVan(event)
  const d = asDate(datum)
  if (!d) return { eventEndDate: null }
  if (begin && d.getTime() < begin.getTime()) return { eventEndDate: begin }
  return { eventEndDate: d }
}

/**
 * De patch die de datum van een event zet of leegmaakt.
 *
 * Leegmaken wist ook `startDate` en `dueDate`. Wie een event leest, valt voor
 * oudere dossiers terug op die twee (`eventDateOf`: eventDate, dan startDate,
 * dan dueDate), en een nieuw event krijgt zijn datum ook als dueDate. Bleef
 * die staan, dan kwam de gewiste datum meteen terug op het scherm, en leek
 * leegmaken niet te werken. Een einddatum zonder begindag zegt niets meer en
 * gaat mee weg.
 */
export function zetDatum(datum) {
  const d = datum ? asDate(datum) : null
  if (!d) return { eventDate: null, startDate: null, dueDate: null, eventEndDate: null }
  return { eventDate: d, dueDate: d }
}
