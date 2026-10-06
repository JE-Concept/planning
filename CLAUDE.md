# JE Plan — afspraken van dit huis

JE Plan draait **live** op planning.jeconcept.be en wordt elke dag gebruikt.
Er gaat geen gegeven verloren omdat een wijziging handig leek.

## De harde regel: personeel komt uit AAPI

**Beschikbaarheid, contracten, statuten, Dimona, uren-als-arbeidsrecht en
loonverwerking horen in AAPI en nergens anders.** JE Plan leest die gegevens
en toont ze; het schrijft ze niet, berekent ze niet opnieuw en biedt er geen
eigen invulscherm voor aan.

Waarom dit absoluut is en niet "bij voorkeur": twee bronnen voor dezelfde
vraag betekent dat er een dag komt waarop ze verschillen, en dan is niet meer
te zeggen wie gelijk had. Bij een planningsconflict kost dat een misverstand.
Bij een contract of een Dimona-aangifte kost het een boete, en dan staat er in
twee systemen iets anders over wat iemand gewerkt heeft.

In de praktijk:

- `aapiShifts`, `aapiEmployees`, `aapiImportRuns` en `aapiImportQueue` staan in
  `firestore.rules` op `allow write: if false`. Dat blijft zo. Schrijven doet
  alleen de import, server-side, in `functions/aapi-import.js`.
- Er komt **geen** collectie voor beschikbaarheid, contracten, uurroosters,
  Dimona of loon in JE Plan. `tests/aapi-grens.test.js` bewaakt dat.
- De tijdsregistratie in JE Plan (`timeEntries`) gaat over **waar iemand aan
  gewerkt heeft** — welk event, welke taak — en is een planningsgegeven, geen
  prestatiestaat. Ze vervangt de uren in AAPI niet en wordt daar niet naartoe
  geschreven.
- Wat JE Plan wél mag: tonen wie er volgens AAPI gepland staat, daaraan een
  event koppelen (via een functie, met `linkedBy` in het log), en de loonkost
  van een event ráming maken op basis van wat AAPI zegt. Ramen is niet
  vastleggen.

Komt er ooit een vraag om beschikbaarheid in JE Plan te zetten: dat is een
*intentie vooraf* ("kan jij op 14 maart?"), die iemand daarna met de hand in
AAPI invoert. Ze mag nooit op planning lijken en nooit een shift worden.

## Hoe hier geschreven wordt

- **Commentaar en commitberichten in het Nederlands**, en ze leggen uit *waarom*
  iets zo is — niet wat de regel eronder doet.
- Nieuwe code leest als de code eromheen: dezelfde dichtheid aan commentaar,
  dezelfde naamgeving.
- Een afspraak die stilletjes kan breken, krijgt een test die dat meldt. Zie
  `tests/queries-indexen.test.js` (elke samengestelde query naast haar index),
  `tests/rollen.test.js` (`firestore.rules` naast `demo/regels.js`),
  `tests/taalbundels.test.js` (elk scherm naast zijn woordenlijsten),
  `tests/archief.test.js`, `tests/aapi-grens.test.js` en
  `tests/betaalmotor.test.js` (de twee prijsmotoren en de twee
  beschikbaarheidsmodules naast elkaar).

## Waar je op stuk loopt

- **Vijf aparte functies-codebases** (`functions`, `functions-meetings`,
  `functions-mail`, `functions-betaling`, `functions-messaging`). Ze kunnen
  niets uit elkaar of uit `src/` importeren; `tests/codebases.test.js` bewaakt
  dat elke codebase met een geheim in beide workflows achter `geheim.sh` staat.
- **Een `defineSecret` hoort nooit in `functions/` (default).** Een
  functions-uitrol faalt in zijn geheel op één ontbrekend geheim, en het
  uitroldienstaccount heeft `roles/secretmanager.admin` nog altijd niet. Zet
  je er een geheim bij, dan nemen de archieffuncties, de agendafeed, AAPI, het
  portaal en het inloggen van de ploeg dat mee. Alles wat aan een geheim hangt
  krijgt een **eigen codebase** plus een `scripts/ci/geheim.sh`-wacht met
  `|| echo "::warning::..."` in `ci.yml` én `go-live.yml` — zoals `mail`,
  `meetings`, `betaling` en `messaging`.
- **Geen `retry: true` op een functie, en een functie verandert niet van
  soort trigger.** De uitrol draait zonder `--force`: een nieuwe functie met
  platformherkansing, een andere soort trigger onder dezelfde naam of een
  verdwenen functie laten ze dan afbreken. Herkansen gaat via de bus van
  messaging (zie `functions/messaging-bus.js`); daarom heet de relay daar nog
  `messagingEvent`.
- **Op de messaging-bus staat nooit inhoud**, alleen de verwijzing naar de rij
  in de log (claim check). Een verwerker leest de rij zelf.
- **De verhuursite (`verhuur/`) mag niets uit de backoffice halen.** Geen
  `@data/`, `@components/`, `@context/`, `@ui/`, en geen Firebase-SDK. Alleen
  `@lib/` en `@styles/` zijn gedeeld. `tests/verhuur-bundel.test.js` weigert de
  rest. Welke velden het pand verlaten, staat als **witte lijst** in
  `functions/verhuur-aanbod.js` — nooit een zwarte lijst, want die is altijd
  één nieuw veld achter.
- **`npm run mobiel` dekt de verhuursite niet**; die heeft zijn eigen
  telefooncontrole aan het eind van `npm run smoke:verhuur`. En `mobiel`
  bouwt niet zelf — draai eerst `npm run build:demo`, anders meet je de
  vorige build.
- **Alles van de kassa wat zonder Stripe te zeggen is, staat in
  `functions-betaling/order.js`** (aanvraag lezen, Stripe-regels, mailteksten)
  en heeft nul imports buiten de prijsmotor — zodat `tests/betaling-order.test.js`
  het in CI kan draaien. `index.js` doet alleen lezen, schrijven en betalen.
  Nieuwe rekenregels horen in `order.js`, niet in `index.js`.
- **Een bedrag dat uit de browser komt, is een wens.** De verhuursite stuurt
  artikelnummers en aantallen; `functions-betaling/` zoekt de prijzen zelf op
  en rekent zelf na. `src/lib/huurprijs.js` staat daarom letterlijk twee keer
  op schijf; `tests/betaalmotor.test.js` eist dat de kopieën gelijk zijn.
- **CI draait alleen `npm ci` in de wortel.** `functions/node_modules` bestaat
  daar niet. Een test die een bestand importeert dat `firebase-functions` of
  `firebase-admin` binnenhaalt, slaagt lokaal en faalt in CI. Reken erop dat
  alles wat een test aanraakt in `functions/` **nul imports** heeft — zoals
  `functions/archief-stand.js`, `functions/ploegcode.js`, `functions/og.js`.
- `initializeApp()` draait ná de imports in `functions/index.js`. Vandaar de
  fabriekjes: `maakArchiveren({ db, region })` en zo.
- Firestore vindt een document **niet** met `where('veld', '==', false)`
  zolang dat veld er niet op staat. Een nieuw veld waarop gefilterd wordt,
  heeft dus altijd twee dingen nodig: de schrijvers zetten het mee, en
  `scripts/seed.mjs` vult het bij op wat er al is. Die seed draait in de uitrol
  vóór hosting gepubliceerd wordt.
- De demo vervangt de Firebase-SDK door `demo/` via Vite-aliassen. Nieuwe
  collecties horen ook in `demo/seed.js` en in `demo/regels.js`.

## Wat nooit in de repo komt

- **`All-in personeelslijst.xlsx`** — de echte lijst draagt rijksregisternummers,
  rekeningnummers, adressen en geboortedata van tweeëndertig mensen. De
  testbestanden zijn verzonnen gegevens.
- `personeelCodes` is `allow read, write: if false` voor elke browser. Een code
  lezen gaat via `ploegCodeLezen`, en dat wordt gelogd in `personeelCodeGelezen`.

## Voor je klaar bent

```bash
npm run lint && npm test && npm run smoke && npm run mobiel
```
