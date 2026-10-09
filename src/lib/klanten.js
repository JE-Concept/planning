/**
 * Het rekenwerk achter een klantfiche: het btw-nummer, de hoofdcontactpersoon,
 * het factuuradres en wat de events van een klant samen opleveren.
 *
 * Het stond eerder verspreid in het scherm zelf: de fiche telde de bedragen op
 * in de render en schreef het btw-nummer over zoals het getypt werd. Daardoor
 * was er geen enkele manier om na te gaan of "te factureren" echt telde wat op
 * `ready to invoice` staat zonder een browser te openen. Alles wat hier staat
 * is een gewone functie over gewone objecten, en `tests/klanten.test.js` houdt
 * ze eerlijk.
 */

/**
 * De stap uit de pijplijn waar facturatie begint (zie `src/lib/pipeline.js`).
 * Staat hier als naam en niet als import van de hele pijplijn: dit bestand
 * moet één ding weten, niet negen.
 */
export const TE_FACTUREREN = 'ready to invoice'

// ─── Btw-nummer ─────────────────────────────────────────────────────────────

/**
 * Een Belgisch btw-nummer leesbaar zetten: BE 0123.456.789.
 *
 * Soepel met opzet. Een klant geeft zijn nummer door als "BE0456789123", als
 * "0456.789.123" of met een streepje ertussen, en een veld dat dat weigert
 * levert een leeg veld op in plaats van een ingevuld veld — precies het
 * omgekeerde van wat facturatie nodig heeft. Wat er niet als een Belgisch
 * nummer uitziet (een Nederlandse of Franse klant) blijft staan zoals het
 * getypt is.
 */
export function formatVat(raw) {
  const tekst = (raw ?? '').trim()
  if (!tekst) return ''

  const cijfers = tekst.replace(/\D/g, '')
  const belgisch = /^(be)?\s*[\d.\s-]+$/i.test(tekst)
  if (!belgisch) return tekst

  // Negen cijfers is het oude ondernemingsnummer; de nul hoort er nog voor.
  const tien = cijfers.length === 9 ? `0${cijfers}` : cijfers
  if (tien.length !== 10) return tekst

  return `BE ${tien.slice(0, 4)}.${tien.slice(4, 7)}.${tien.slice(7)}`
}

/** De tien cijfers van een btw-nummer, of null als het er geen tien zijn. */
export function vatDigits(raw) {
  const cijfers = (raw ?? '').replace(/\D/g, '')
  if (cijfers.length === 9) return `0${cijfers}`
  return cijfers.length === 10 ? cijfers : null
}

/**
 * Klopt de controle op het nummer?
 *
 * De laatste twee cijfers van een Belgisch ondernemingsnummer zijn 97 min de
 * rest van de eerste acht gedeeld door 97. Daarmee vang je een typefout op
 * zonder ergens iets op te vragen.
 */
export function vatIsValid(raw) {
  const cijfers = vatDigits(raw)
  if (!cijfers || !/^[01]/.test(cijfers)) return false
  const basis = Number(cijfers.slice(0, 8))
  const controle = Number(cijfers.slice(8))
  return 97 - (basis % 97) === controle
}

/**
 * Wat er onder het veld komt te staan. Nooit een fout, altijd een opmerking:
 * het nummer wordt bewaard zoals het is en het is aan de mens om te beslissen
 * of het klopt.
 */
export function vatHint(raw) {
  const tekst = (raw ?? '').trim()
  if (!tekst) return 'Leeg mag; zonder btw-nummer wordt er particulier gefactureerd.'
  if (vatIsValid(tekst)) return null
  if (vatDigits(tekst)) return 'De controlecijfers kloppen niet — nakijken voor de eerste factuur.'
  return 'Geen Belgisch nummer; blijft staan zoals je het typt.'
}

// ─── Naam en adres uit VIES ─────────────────────────────────────────────────

const zelfde = (a, b) =>
  (a ?? '').toString().replace(/\s+/g, ' ').trim().toLowerCase() ===
  (b ?? '').toString().replace(/\s+/g, ' ').trim().toLowerCase()

const adresLeeg = (adres) => !['street', 'postalCode', 'city'].some((veld) => (adres?.[veld] ?? '').trim())

/**
 * Wat er van een VIES-antwoord op de fiche mag, en wat eerst gevraagd moet.
 *
 * Een leeg veld vullen is altijd goed: daar stond niets wat iemand getypt had.
 * Een gevuld veld overschrijven niet zonder het te vragen, want wat er staat
 * kan juister zijn dan VIES — "Blum" is hoe het team de klant kent, en
 * "Blum België BV" is hoe de KBO hem kent. Het adres gaat als één blok: een
 * straat uit VIES met een gemeente die iemand eerder typte, is een adres dat
 * niet bestaat.
 *
 *   { patch, vragen: [{ veld: 'name' | 'address', nu, nieuw }] }
 *
 * `patch` kan meteen bewaard worden; `vragen` is wat er bij een "ja" bij komt
 * (de nieuwe waarde staat in `nieuw`). Wat hetzelfde is, komt in geen van
 * beide — anders vraagt het scherm "Blum vervangen door Blum?".
 */
export function viesVoorstel(klant, gevonden) {
  const patch = {}
  const vragen = []
  if (!gevonden?.geldig) return { patch, vragen }

  const naam = (gevonden.naam ?? '').trim()
  if (naam) {
    if (!(klant?.name ?? '').trim()) patch.name = naam
    else if (!zelfde(klant.name, naam)) vragen.push({ veld: 'name', nu: klant.name, nieuw: naam })
  }

  const nieuw = gevonden.adres
  if (nieuw && !adresLeeg(nieuw)) {
    const adres = {
      street: nieuw.street ?? '',
      postalCode: nieuw.postalCode ?? '',
      city: nieuw.city ?? '',
      country: nieuw.country || klant?.address?.country || 'België',
    }
    const nu = klant?.address ?? null
    if (adresLeeg(nu)) patch.address = adres
    else if (!['street', 'postalCode', 'city'].every((v) => zelfde(nu[v], adres[v]))) {
      vragen.push({ veld: 'address', nu: addressLine(nu), nieuw: adres })
    }
  }
  return { patch, vragen }
}

// ─── Contactpersonen ────────────────────────────────────────────────────────

/**
 * Wie je belt. Dat is degene die als hoofdcontact aangeduid staat, en anders
 * gewoon de eerste: een klant met één contactpersoon hoort niet eerst een
 * vinkje te moeten krijgen voor zijn naam ergens verschijnt.
 */
export function primaryContact(customer) {
  const contacten = customer?.contacts ?? []
  return contacten.find((c) => c.primary) ?? contacten[0] ?? null
}

/** Eén hoofdcontact per klant: wie je aanduidt, duidt de andere af. */
export function setPrimaryContact(contacts, contactId) {
  return (contacts ?? []).map((c) => ({ ...c, primary: c.id === contactId }))
}

// ─── Facturatie ─────────────────────────────────────────────────────────────

/**
 * Het adres waar de factuur naartoe gaat.
 *
 * Meestal hetzelfde als het bezoekadres, soms een boekhoudkantoor of een
 * hoofdzetel in een andere stad. Leeg betekent dus niet "geen adres" maar
 * "hetzelfde"; dat scheelt het tweemaal intypen én het scheelt dat de helft
 * van de klanten twee adressen heeft die stil uit elkaar lopen.
 */
export function billingAddressOf(customer) {
  const factuur = customer?.billingAddress
  const gevuld = factuur && Object.values(factuur).some((v) => (v ?? '').toString().trim())
  return { adres: gevuld ? factuur : (customer?.address ?? null), eigen: Boolean(gevuld) }
}

/** Het e-mailadres voor facturen: het aparte als het er is, anders het gewone. */
export function billingEmailOf(customer) {
  const apart = (customer?.billingEmail ?? '').trim()
  if (apart) return { email: apart, eigen: true }
  const hoofd = (customer?.email ?? '').trim()
  return { email: hoofd, eigen: false }
}

/** Het adres op één regel, zoals het op een factuur zou staan. */
export function addressLine(address) {
  if (!address) return ''
  const plaats = [address.postalCode, address.city].filter(Boolean).join(' ')
  return [address.street, plaats, address.country].map((d) => (d ?? '').trim()).filter(Boolean).join(', ')
}

// ─── Historiek ──────────────────────────────────────────────────────────────

const tijd = (waarde) => {
  if (!waarde) return null
  const d = waarde instanceof Date ? waarde : new Date(waarde)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Het bedrag van een event. `quoteAmount` is het nieuwe veld, `budget` het oude. */
export function amountOf(task) {
  const bedrag = task?.quoteAmount ?? task?.budget ?? null
  return bedrag == null || bedrag === '' ? null : Number(bedrag)
}

/** De dag van het event, met dezelfde terugval als het eventscherm gebruikt. */
export function dateOf(task) {
  return tijd(task?.eventDate) ?? tijd(task?.startDate) ?? tijd(task?.dueDate)
}

/**
 * De laatste dag van het event.
 *
 * De historiek van een klant sorteert op de begindag — daar staat het in zijn
 * agenda — maar "is het al geweest" hangt aan het einde.
 */
export function endDateOf(task) {
  return tijd(task?.eventEndDate) ?? dateOf(task)
}

/**
 * De historiek van een klant uit zijn taken.
 *
 * Wat binnenkomt is alles wat op deze klant staat — de events én hun subtaken,
 * want die query staat op één veld en haalt beide op. Een event is een taak
 * zonder ouder; de rest hoort op de fiche van het event thuis en niet in een
 * lijst met bedragen, anders telt hetzelfde bedrag twee keer mee.
 *
 * Nieuwste bovenaan, want de vraag op een klantfiche is bijna altijd "wat
 * deden we het laatst voor hen". Wat geen datum heeft (een aanvraag zonder
 * dag) zakt naar onder in plaats van de lijst aan te voeren.
 */
export function customerHistory(tasks = []) {
  const events = tasks
    .filter((t) => !t.parentId && !t.archived)
    .map((t) => ({
      id: t.id,
      title: t.title ?? '',
      date: dateOf(t),
      statusName: t.statusName ?? null,
      statusColor: t.statusColor ?? null,
      amount: amountOf(t),
      open: t.open !== false,
    }))
    .sort((a, b) => (b.date?.getTime() ?? -Infinity) - (a.date?.getTime() ?? -Infinity))

  const teFactureren = events.filter((e) => e.statusName === TE_FACTUREREN)

  return {
    events,
    aantal: events.length,
    totaal: som(events),
    teFactureren: { events: teFactureren, aantal: teFactureren.length, totaal: som(teFactureren) },
  }
}

function som(events) {
  return events.reduce((t, e) => t + (e.amount ?? 0), 0)
}
