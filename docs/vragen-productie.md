# Vragen vóór productie — beantwoord

Twintig beslissingen, op 3 oktober 2026 door Jasper beantwoord in het gesprek.
Per vraag: het antwoord, en waar het in de code zit. Wat afwijkt van de
oorspronkelijke aanname staat **vet**.

## Stripe en geld

- [x] **1. Live- of testsleutels eerst?**
  *Antwoord:* **Meteen live.** Geen testronde met testsleutels; testen met een kleine echte betaling die daarna teruggestort wordt. `docs/testen-productie.md` is daarop aangepast.
- [x] **2. Bancontact naast kaart?**
  *Antwoord:* **Kaart, Bancontact én Apple/Google Pay.** `payment_method_types: ['card','bancontact']` in `functions-betaling/index.js`; de wallets toont Stripe vanzelf bij 'card' zodra ze in het dashboard aanstaan.
- [x] **3. Waarborg automatisch terugstorten na "terug", of met de hand?**
  *Antwoord:* Knop in de backoffice. Nog te bouwen: 'Waarborg terugstorten' bij een betaalde order, met een in te houden bedrag voor schade.
- [x] **4. Factuur van ons, of volstaat de Stripe-kwitantie?**
  *Antwoord:* Stripe-kwitantie volstaat. Niets te doen.
## Wat online staat

- [x] **5. Welke artikelen mogen los verhuurd worden?**
  *Antwoord:* **Alles wat een dagprijs heeft.** Eenmalige backfill in `scripts/seed.mjs` zet `directTeHuren: true` op elk artikel met een dagprijs; daarna beslist het vinkje per artikel.
- [x] **6. Weekendtarief: vrijdag–maandag of vrijdag–zondag?**
  *Antwoord:* Vrijdag t/m maandag. `WEEKENDDAGEN` in `src/lib/huurprijs.js`.
- [x] **7. Minstens hoeveel dagen vooraf online boeken?**
  *Antwoord:* **2 dagen; last minute via mail.** `MIN_DAGEN_VOORAF = 2`; de tekst bij een te vroege datum verwijst naar mail, niet naar bellen.
- [x] **8. Hoe ver vooruit?**
  *Antwoord:* 1 jaar. `MAX_DAGEN_VOORAF = 365`.
- [x] **9. Foto's bij de artikelen — wie levert ze?**
  *Antwoord:* Uploaden in de backoffice. Nog te bouwen: fotoveld op het artikelformulier, Storage-pad `materiaal/`, plaatshouder op de site.
- [x] **10. Telefoonnummer, mailadres en afhaaluren?**
  *Antwoord:* **info@jeconcept.be; telefoonnummer komt later.** `CONTACT.telefoon = null` in `verhuur/src/lib/instellingen.js`: de site toont geen nummer tot het ingevuld is, en verwijst naar mail.
## Klanten

- [x] **11. Korting op e-mailadres aan laten tot er een login is?**
  *Antwoord:* **Korting via login.** Zodra het klantenlogin er is, komt de korting van de ingelogde klant en niet meer van een ingetikt adres. Tot dan blijft het adres de bron (zie `kortingVoor`).
- [x] **12. Klantenlogin nu al (e-mail-link, zonder wachtwoord)?**
  *Antwoord:* Ja, e-mail-link zonder wachtwoord. Nog te bouwen, zonder Firebase-SDK in de publieke bundel: eigen magische link via `mailQueue`.
- [x] **13. Online huur maakt automatisch een klantenfiche aan?**
  *Antwoord:* Ja, bij de eerste betaling. Gebouwd: `klantfiche()` in `functions-betaling/index.js`.
## Berichten

- [x] **14. Welke mail na betaling, van welk adres?**
  *Antwoord:* Bevestiging met kenmerk en afhaalafspraak. Gebouwd: `bevestiging()` in `functions-betaling/order.js`.
- [x] **15. Wie krijgt een melding bij een order of aanvraag?**
  *Antwoord:* **Mail én pushmelding.** Gebouwd: soort `verhuur` in `functions/notify.js`; `functions/verhuur-orders.js` pusht de beheerders bij een betaling en bij een aanvraag.
## Domein en uitrol

- [x] **16. `rental.jeconcept.be` of `verhuur.jeconcept.be`?**
  *Antwoord:* rental.jeconcept.be. DNS-koppeling door Jasper; stappen in `docs/testen-productie.md`.
- [x] **17. Al vindbaar voor Google, of `noindex` tot de prijzen kloppen?**
  *Antwoord:* **Ja, meteen vindbaar.** De `noindex`-regel is weg uit `verhuur/index.html`; `robots.txt` staat toe; de test bewaakt nu het omgekeerde.
## Backoffice

- [x] **18. Online order als event op het bord, of alleen in het magazijn?**
  *Antwoord:* **Ja, als event, meteen in 'planning ongoing'.** Gebouwd: `functions/verhuur-orders.js` maakt het event bij betaling en hangt de reservaties eraan.
- [x] **19. Laadlijst per dag, printbaar?**
  *Antwoord:* Zo is het goed. Gebouwd.
- [x] **20. Wat is "productie-klaar": alleen de verhuur, of ook tafelreservaties?**
  *Antwoord:* De verhuur: site, betaling, backoffice. Tafelreservaties en inkooplijst volgen.