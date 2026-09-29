# Een tekst vertalen

JE Plan staat in het Nederlands en in het Engels. Dit is hoe je er een tekst
bij zet, of er een wijzigt.

## Waar de teksten staan

In `src/lib/taal/`, één bestand per stuk van de app:

| Bestand | Waarover |
| --- | --- |
| `schil.js` | Navigatie, aanmelden, timer, accountmenu |
| `events.js` | Events, klanten, bestellijsten |
| `tasks.js` | Tasks, borden, werklast, goals |
| `bistro.js` | Openen & sluiten, registraties |
| `team.js` | Dashboard, overleg, uren, rooster, meldingen |
| `socials.js` | Socials |
| `instellingen.js` | Instellingen en de regelengine |

Elk bestand wordt vanzelf opgepikt; er is geen lijst die je moet bijwerken.
Dat er meerdere bestanden zijn, is niet uit netheid: zo schrijven twee mensen
die tegelijk aan twee schermen werken niet in hetzelfde bestand.

Voor de e-mails en meldingen die de server verstuurt staat er een aparte,
kleine lijst in `functions/teksten.js`. Die map wordt apart verpakt en
uitgerold en kan niets uit `src/` importeren.

## Een tekst toevoegen

```js
// src/lib/taal/tasks.js
'tasks.leeg': { nl: 'Niets te doen.', en: 'Nothing to do.' },
```

En op het scherm:

```jsx
import { useTaal } from '@context/TaalProvider'

const { t } = useTaal()
return <p>{t('tasks.leeg')}</p>
```

De sleutel zegt waar het staat, niet wat er staat: `alg.opslaan` blijft kloppen
wanneer de knop ooit "Bewaren" gaat heten, `alg.bewaren` niet.

## Iets in de tekst invullen

```js
'tasks.geboekt': { nl: 'Deze week geboekt: {tijd}', en: 'Logged this week: {tijd}' },
```

```jsx
t('tasks.geboekt', { tijd: '8u30' })
```

## Enkelvoud en meervoud

Zet twee sleutels, met `_een` en `_meer`, en geef `aantal` mee:

```js
'tasks.aantal_een': { nl: '{aantal} taak', en: '{aantal} task' },
'tasks.aantal_meer': { nl: '{aantal} taken', en: '{aantal} tasks' },
```

```jsx
t('tasks.aantal', { aantal: 3 })  // "3 taken"
```

## Wat je niet vertaalt

- **Gegevens uit de database**: namen van events, klanten, taken, lijsten,
  borden en mensen. Die schrijft het team zelf, in de taal die het kiest.
- **Vakwoorden die het team in beide talen gebruikt**: "Socials", "Goals",
  "Tasks", "billable", "FAVV", en de statusnamen van de pijplijn zoals
  "ready to invoice" — die staan zo in de database en op de borden.
- **De FAVV-maandrapportage**: die blijft Nederlands, ook voor wie de tool op
  Engels heeft staan. Een controleur van de voedselinspectie leest Nederlands,
  en een officieel rapport dat per gebruiker van taal verandert, is geen
  rapport.
- **Commentaar in de code.** Dat blijft Nederlands, net als de rest.

## Wat er misgaat als je iets vergeet

Niets ergs, en dat is met opzet: ontbreekt de Engelse tekst, dan verschijnt de
Nederlandse. Een half vertaald scherm met hier en daar een Nederlands woord is
bruikbaar; een scherm vol `tasks.leeg` is dat niet.

`npm test` valt er wel over:

- **`kent elke Nederlandse sleutel ook in het Engels`** — er staat een `nl`
  zonder `en`.
- **`claimt geen sleutel twee keer`** — dezelfde sleutel staat in twee
  bestanden. Eén van de twee wint stilletjes, en dan verandert er een tekst op
  een scherm waar je niet aan gewerkt hebt.
- **`gebruikt in beide talen dezelfde invulplekken`** — de ene taal heeft
  `{tijd}` en de andere niet. Dan staat er straks letterlijk `{tijd}` op het
  scherm.

## Nakijken of er nog Nederlands staat

```bash
npm run build:demo && node scripts/taalcheck.mjs
```

Dat zet de tool op Engels, loopt elk scherm af en meldt de regels met Nederlandse
woorden erin. Het is geen test en het hoeft niet op nul te staan: de namen van
events, klanten en afvinkpunten komen uit de database en zijn Nederlands, en de
FAVV-rapportage hoort dat te zijn. Wat je zoekt is een knop of een kop die nog
niet om is.

## Datums, maanden en dagnamen

Die volgen de gekozen taal vanzelf, via `zetLocale()` in `src/lib/dates.js`.
Je hoeft er niets voor te doen — en je moet er vooral geen eigen lijstje
maandnamen voor maken.

## Een taal erbij

`TALEN` in `src/lib/i18n.js` uitbreiden, en in elk bestand in `src/lib/taal/`
de derde taal naast `nl` en `en` zetten. De test die op ontbrekende teksten
let, kijkt vandaag alleen naar het Engels; breid die dan mee uit.

Bedenk vooraf of het de moeite is: een taal die half af is, is erger dan geen
taal, want dan krijgt iemand een scherm in een mengsel van drie talen.
