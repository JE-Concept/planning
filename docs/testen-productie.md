# Testen vóór productie — de verhuur

Een draaiboek voor Jasper. Stap voor stap, met wat je moet zien. Elk vinkje
dat niet lukt, is iets om te melden met het kenmerk erbij.

De aannames waarop dit gebouwd is, staan in `vragen-productie.md`. Wat daar
niet beantwoord is, staat nog op de aanname.

## 0. Wat er klaar moet staan

- [ ] De twee Stripe-geheimen, **meteen live** (vraag 1): de `sk_live_…`
  sleutel en het `whsec_…` van het live webhook-eindpunt:
  ```
  firebase functions:secrets:set STRIPE_SECRET --project je-planning
  firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project je-planning
  ```
  Daarna een uitrol (push naar `main` volstaat). In het logboek van de uitrol
  hoort `functions:betaling` nu *niet* meer overgeslagen te worden.
- [ ] In het Stripe-dashboard (live-modus): **Developers → Webhooks → Add
  endpoint**, met als adres de functie-URL van `verhuurWebhook` — die staat in
  de Firebase Console onder Functions — en de gebeurtenissen
  `checkout.session.completed` en `checkout.session.expired`. Het
  ondertekeningsgeheim dat Stripe dan toont, is `STRIPE_WEBHOOK_SECRET`.
- [ ] **Bancontact, Apple Pay en Google Pay aanzetten** onder Settings →
  Payment methods (vraag 2). Bancontact is nodig, anders weigert Stripe de
  sessie; de wallets toont Stripe vanzelf op toestellen die ze kunnen.
- [ ] Omdat we live testen: zet een artikel tijdelijk op een kleine dagprijs
  (bijvoorbeeld € 1) voor stap 3, en stort de testbetaling daarna terug in
  Stripe → Payments → Refund. De order komt dan níét op "vervallen" — een
  terugbetaling is geen afgebroken afrekening — dus haal de reservatie met
  de hand weg op het event.
- [ ] De tweede hosting-site: in de Firebase Console onder Hosting een site
  `je-planning-verhuur` toevoegen. Zonder die site faalt de uitrol van
  hosting met "site not found"; de naam staat in `.firebaserc`.
- [ ] Het domein: onder Hosting → `je-planning-verhuur` → Add custom domain,
  `rental.jeconcept.be`. Firebase geeft twee DNS-records; zet die bij de
  domeinhouder. Tot dan werkt `je-planning-verhuur.web.app`.
- [ ] `SMTP_URL`, als je de mails wilt zien aankomen. Zonder blijven ze in
  `mailQueue` staan op "wachtend" — je kunt ze daar wel lezen.

## 1. Een artikel online zetten

In JE Plan → **Materiaal**, klik op een artikelnaam.

- [ ] Vul een dagprijs in. Het vinkje *Mag zonder offerte gehuurd worden*
  gaat van slot.
- [ ] Zet het vinkje aan. Onder het vinkje verschijnt wat 1, 3, 6 en 7 dagen
  kosten. **Zes dagen mag niet meer zijn dan zeven.** Zet eens een weekprijs
  die hoger is dan zeven dagprijzen en kijk of de voorbeeldrij dat laat zien.
- [ ] Zet een waarborg en bewaar. De rij in de kalender krijgt het label
  *Los te huren*.
- [ ] Open het artikel opnieuw en kies een foto van je telefoon (vraag 9). Na
  een paar seconden staat ze in het formulier; op de site staat ze op de
  kaart. Een artikel zonder foto toont zijn categorie als plaatshouder.

## 2. De site

Open de verhuursite.

- [ ] Het artikel staat er, met "vanaf € … per dag". Geen aantal vrije stuks
  zolang je geen datum koos.
- [ ] Kies een datum **binnen twee dagen**: het formulier laat het niet toe.
  Kies er een over een week. Nu staat bij elk artikel hoeveel er vrij zijn.
- [ ] Leg in JE Plan op diezelfde datum een reservatie voor een eigen event op
  het artikel. Ververs de site: het aantal vrij is gezakt. Leg alles vast:
  het artikel staat er nog, met *volzet op deze datum*, en de knop is uit.
- [ ] Open het artikel. De staffel staat er met dag, weekend en week. Kies
  zes dagen: het bedrag is dat van een week.
- [ ] Leg iets in de mand. Ga naar de mand. Btw en waarborg staan apart; het
  totaal onderaan is huur + btw + waarborg. **De btw is 21% van de huur
  alleen**, niet van de waarborg.

## 3. Betalen

Vul je eigen e-mailadres in en klik op *Betalen*.

- [ ] Je komt op een Stripe-pagina met de regels die je in de mand zag, plus
  een regel *Btw 21%* en een regel *Waarborg*. Het totaal is hetzelfde als in
  de mand.
- [ ] Open intussen JE Plan → Materiaal. Onderaan staat de order op *Wacht op
  betaling*, en in de kalender staat het stuk als optie (lichter blauw).
- [ ] Betaal met je eigen kaart of Bancontact (live, dus een echt bedrag —
  vandaar de € 1 hierboven).
- [ ] Je komt terug op *Bedankt — je betaling is doorgegeven* met een kenmerk.
  De mand is leeg.
- [ ] In JE Plan staat de order binnen een minuut op *Betaald* en is de optie
  een vaste reservatie geworden. In **Klanten** staat een nieuwe fiche met
  jouw adres.
- [ ] Op het **bord** staat een nieuw event *Verhuur — <jouw naam>* in de
  kolom *planning ongoing*, met de reservaties op zijn tabblad Materiaal
  (vraag 18). En je telefoon trilt, als je pushmeldingen aan hebt staan
  (vraag 15).
- [ ] In `mailQueue` (of in je mailbox, als SMTP er is) staan twee mails: een
  bevestiging aan jou als klant, en een melding aan de beheerders.

- [ ] Op de betaalde order in het magazijn staat *Waarborg terugstorten*
  (vraag 3). Klik, hou € 1 in voor schade en bevestig. In Stripe → Payments
  staat een gedeeltelijke terugbetaling; op de order staat *Waarborg terug:
  € …*; in het **logboek** staat wie het deed.

## 4. Afbreken en verlopen

- [ ] Leg opnieuw iets in de mand, klik *Betalen* en klik op de Stripe-pagina
  op de pijl terug. Je komt op *Je afrekening is afgebroken*; de mand staat
  er nog.
- [ ] In JE Plan staat die order op *Wacht op betaling* met een optie in de
  kalender. **Wacht 36 minuten** (of pas de tijd aan in je hoofd): de ronde
  die elk uur draait zet de order op *Vervallen* en haalt de optie weg.
  Sneller testen: in Stripe → Developers → Events kun je een
  `checkout.session.expired` opnieuw versturen.

## 5. Wat niet mag kunnen

- [ ] Open de ontwikkelaarsconsole van de browser (F12 → Network) en klik
  *Betalen*. Bekijk het verzoek naar `/api/afrekenen`. **Er staat geen enkel
  bedrag in** — alleen artikelnummers, aantallen, de periode en je gegevens.
- [ ] Probeer de webhook-URL rechtstreeks te openen in de browser. Je krijgt
  *handtekening klopt niet* en er verandert niets.
- [ ] Zet in Stripe een testbetaling op een ander bedrag (bijvoorbeeld door
  het artikel een andere prijs te geven tússen de mand en de webhook). De
  order komt op *Nakijken* te staan, rood, en de klant krijgt een andere
  mail.

## 6. De offerteaanvraag

- [ ] Vul het formulier in op `/offerte` met je eigen adres. *Bedankt — we
  hebben je aanvraag.*
- [ ] In JE Plan → Events → het envelopje rechtsboven. De aanvraag staat
  bovenaan met het label *Verhuursite*, datum en aantal personen.
- [ ] Klik *Event maken*. Je komt op een nieuw event met je tekst als
  omschrijving. Terug in het postvak is de aanvraag weg.

## 7. Op een telefoon

Open de site op je telefoon.

- [ ] Niets schuift horizontaal. Elke knop is met een duim te raken.
- [ ] De datumkiezer is die van je toestel zelf.
- [ ] Het telefoonnummer onderaan is klikbaar en belt.

## Daarna

De site is al vindbaar (vraag 17) en draait al live (vraag 1), dus wat
hierboven klopt, is in productie. Wat nog volgt:

1. Het **telefoonnummer** (vraag 10): zet het in `verhuur/src/lib/instellingen.js`
   én in `functions-betaling/order.js` zodra je het hebt. Tot dan toont de site
   alleen het mailadres.
2. Zet de dagprijs van het testartikel terug.
