import { describe, expect, it } from 'vitest'
import { huurTotaal, regelPrijs } from '../src/lib/huurprijs'
import { bearerVan, bevestiging, centen, hashVan, leesAanvraag, melding, stripeRegels } from '../functions-betaling/order'
import { bearerVan as bearerLeeskant, hashVan as hashLeeskant, nieuwToken } from '../functions/verhuur-login'

/**
 * De kassa, voor zover ze zonder Stripe te testen is.
 *
 * Wat hier staat is het deel dat fout kan gaan zonder dat iemand het merkt:
 * een aanvraag die ten onrechte doorgelaten wordt, een Stripe-pagina die een
 * ander bedrag toont dan de mand, een mail met het verkeerde kenmerk.
 */

const over = (dagen) => {
  const d = new Date()
  d.setDate(d.getDate() + dagen)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const goed = {
  van: over(10),
  tot: over(12),
  regels: [{ materiaalId: 'm-statafel', aantal: 6 }],
  klant: { naam: 'Lies', email: 'lies@voorbeeld.be', telefoon: '', opmerking: '' },
}

describe('wat de browser mag vragen', () => {
  it('laat een gewone aanvraag door, met de dagen uitgeteld', () => {
    const uit = leesAanvraag(goed)
    expect(uit.fout).toBeUndefined()
    expect(uit.dagen).toHaveLength(3)
    expect(uit.regels).toEqual([{ materiaalId: 'm-statafel', aantal: 6 }])
  })

  /*
    Het boekingsvenster — vraag 7 en 8. Niet voor morgen, niet over twee
    jaar. De server beslist; het formulier houdt het alleen alvast tegen.
  */
  it('weigert wat te vroeg of te ver vooruit is', () => {
    expect(leesAanvraag({ ...goed, van: over(0), tot: over(0) }).fout).toBe('te_vroeg')
    expect(leesAanvraag({ ...goed, van: over(1), tot: over(1) }).fout).toBe('te_vroeg')
    expect(leesAanvraag({ ...goed, van: over(2), tot: over(2) }).fout).toBeUndefined()
    expect(leesAanvraag({ ...goed, van: over(400), tot: over(401) }).fout).toBe('te_ver_vooruit')
  })

  it('weigert wat geen periode is', () => {
    expect(leesAanvraag({ ...goed, van: 'morgen' }).fout).toBe('geen_datum')
    expect(leesAanvraag({ ...goed, van: over(12), tot: over(10) }).fout).toBe('omgekeerde_datum')
    expect(leesAanvraag({ ...goed, tot: over(300) }).fout).toBe('rare_periode')
  })

  it('weigert wat geen bestelling is', () => {
    expect(leesAanvraag({ ...goed, regels: [] }).fout).toBe('geen_regels')
    expect(leesAanvraag({ ...goed, regels: [{ materiaalId: 'x', aantal: 0 }] }).fout).toBe('rare_regel')
    expect(leesAanvraag({ ...goed, regels: [{ materiaalId: 'x', aantal: 9999 }] }).fout).toBe('rare_regel')
    expect(leesAanvraag({ ...goed, regels: [{ aantal: 1 }] }).fout).toBe('rare_regel')
  })

  it('weigert een aanvraag zonder bruikbaar e-mailadres', () => {
    expect(leesAanvraag({ ...goed, klant: { email: 'niets' } }).fout).toBe('geen_email')
  })

  /*
    Het hele punt van de kassa: wat er aan bedragen meekomt, wordt genegeerd.
    Een browser die `prijs: 1` meestuurt, krijgt geen fout — hij krijgt
    gewoon de echte prijs.
  */
  it('negeert elk bedrag dat de browser meestuurt', () => {
    const uit = leesAanvraag({
      ...goed,
      regels: [{ materiaalId: 'm-statafel', aantal: 6, prijs: 1, netto: 0.01 }],
      teBetalen: 0.01,
    })
    expect(uit.fout).toBeUndefined()
    expect(uit.regels[0]).toEqual({ materiaalId: 'm-statafel', aantal: 6 })
    expect(uit).not.toHaveProperty('teBetalen')
  })

  it('kapt vrije tekst af in plaats van te weigeren', () => {
    const uit = leesAanvraag({ ...goed, klant: { ...goed.klant, opmerking: 'x'.repeat(5000), naam: 'y'.repeat(500) } })
    expect(uit.fout).toBeUndefined()
    expect(uit.klant.opmerking).toHaveLength(1000)
    expect(uit.klant.naam).toHaveLength(120)
  })

  it('neemt bedrijfsnaam en ondernemingsnummer over, het nummer zonder opmaak', () => {
    const uit = leesAanvraag({ ...goed, klant: { ...goed.klant, bedrijf: ' Bakkerij Lies bv ', ondernemingsnummer: 'be 0712.345.678' } })
    expect(uit.klant.bedrijf).toBe('Bakkerij Lies bv')
    expect(uit.klant.ondernemingsnummer).toBe('BE0712345678')
    expect(leesAanvraag(goed).klant.bedrijf).toBe('')
  })
})

describe('de regels op de Stripe-pagina', () => {
  const bar = { id: 'm-bar', naam: 'Mobiele bar', prijsPerDag: 185, prijsWeekend: 260, prijsWeek: 650, waarborg: 150 }
  const koeling = { id: 'm-koeling', naam: 'Koelkast', prijsPerDag: 45, waarborg: 50 }
  const dagen = ['2027-03-12', '2027-03-13', '2027-03-14']

  const totaal = huurTotaal([
    regelPrijs({ materiaal: bar, aantal: 1, dagen, kortingPercent: 10 }),
    regelPrijs({ materiaal: koeling, aantal: 2, dagen }),
  ])

  /*
    De enige test die er echt toe doet: tel je de regels op die Stripe toont,
    dan staat er precies wat wij afrekenen. Een cent verschil tussen de mand
    en de betaalpagina is een klant die niet meer betaalt — en terecht.
  */
  it('tellen op tot exact wat wij afrekenen, in centen', () => {
    const regels = stripeRegels(totaal)
    const som = regels.reduce((s, r) => s + r.price_data.unit_amount * r.quantity, 0)
    expect(som).toBe(centen(totaal.teBetalen))
  })

  it('zetten btw en waarborg als aparte regel, niet verstopt in de stukprijs', () => {
    const namen = stripeRegels(totaal).map((r) => r.price_data.product_data.name)
    expect(namen).toContain('Btw 21%')
    expect(namen).toContain('Waarborg')
    expect(namen.filter((n) => n.includes('Mobiele bar'))).toHaveLength(1)
  })

  it('noemen aantal en duur in de regel, zodat de klant herkent wat hij koos', () => {
    const [eerste] = stripeRegels(totaal)
    expect(eerste.price_data.product_data.name).toBe('1× Mobiele bar')
    expect(eerste.price_data.product_data.description).toBe('3 dagen huur')
    expect(eerste.price_data.currency).toBe('eur')
  })

  it('laten de waarborgregel weg wanneer er geen waarborg is', () => {
    const zonder = huurTotaal([regelPrijs({ materiaal: { ...koeling, waarborg: null }, aantal: 1, dagen })])
    expect(stripeRegels(zonder).map((r) => r.price_data.product_data.name)).not.toContain('Waarborg')
  })

  it('rekenen in hele centen', () => {
    for (const r of stripeRegels(totaal)) expect(Number.isInteger(r.price_data.unit_amount)).toBe(true)
    expect(centen(0.1 + 0.2)).toBe(30)
    expect(centen('12.345')).toBe(1235)
  })
})

describe('de mails', () => {
  const order = {
    id: 'ho-abc123',
    status: 'betaald',
    van: '2027-03-12',
    tot: '2027-03-14',
    klant: { naam: 'Lies Vandeputte', email: 'lies@voorbeeld.be', telefoon: '0479 00 00 00', opmerking: 'Graag voor 10u' },
    regels: [{ aantal: 6, naam: 'Statafel', netto: 84 }],
    exclBtw: 84,
    btw: 17.64,
    waarborg: 0,
    teBetalen: 101.64,
  }

  it('zeggen de klant wat, wanneer en met welk kenmerk', () => {
    const { onderwerp, tekst } = bevestiging(order)
    expect(onderwerp).toContain('ho-abc123')
    expect(tekst).toContain('Beste Lies Vandeputte')
    expect(tekst).toContain('van 2027-03-12 tot en met 2027-03-14')
    expect(tekst).toContain('6 × Statafel')
    expect(tekst).toContain('€ 101,64')
    expect(tekst).toContain('ho-abc123')
    // Geen waarborg, dus geen regel over een waarborg.
    expect(tekst).not.toContain('Waarborg')
  })

  /*
    Een order die op nakijken staat, is niet bevestigd. De klant mag dan niet
    lezen dat zijn tent klaarstaat — en ook niet hoe laat hij ze mag komen
    halen.
  */
  it('beloven bij nakijken niets wat niet vastligt', () => {
    const { onderwerp, tekst } = bevestiging({ ...order, status: 'nakijken' })
    expect(onderwerp).toContain('we kijken iets na')
    expect(tekst).toContain('niets vastgelegd')
    expect(tekst).not.toContain('staat op jouw naam')
    expect(tekst).not.toContain('Afhalen en terugbrengen')
  })

  it('zetten in de melding aan het team het geld bovenaan en de klant eronder', () => {
    const { onderwerp, tekst } = melding(order, 'k-9')
    expect(onderwerp).toBe('Online huur van Lies Vandeputte')
    expect(tekst.split('\n')[2]).toContain('Betaald: € 101,64')
    expect(tekst).toContain('0479 00 00 00')
    expect(tekst).toContain('Graag voor 10u')
    expect(tekst).toContain('/klanten/k-9')
  })

  it('markeren nakijken in het onderwerp, zodat het opvalt in een volle mailbox', () => {
    const { onderwerp, tekst } = melding({ ...order, status: 'nakijken' })
    expect(onderwerp.startsWith('Nakijken:')).toBe(true)
    expect(tekst).toContain('NAKIJKEN')
  })

  it('vallen terug op het e-mailadres wanneer er geen naam is', () => {
    const anoniem = { ...order, klant: { ...order.klant, naam: '' } }
    expect(bevestiging(anoniem).tekst).toContain('Beste klant')
    expect(melding(anoniem).onderwerp).toBe('Online huur van lies@voorbeeld.be')
  })
})

describe('de sessie aan de kassa', () => {
  /*
    De leeskant maakt de sessie, de kassa leest ze. Twee codebases, dus twee
    keer dezelfde twee regels — en dit is wat ze gelijk houdt. Wijkt de hash
    af, dan vindt de kassa geen enkele sessie en krijgt niemand nog korting,
    zonder foutmelding.
  */
  it('hasht precies zoals de leeskant', () => {
    const t = nieuwToken()
    expect(hashVan(t)).toBe(hashLeeskant(t))
    expect(bearerVan(`Bearer ${t}`)).toBe(bearerLeeskant(`Bearer ${t}`))
    expect(bearerVan('Bearer x')).toBe(null)
  })
})
