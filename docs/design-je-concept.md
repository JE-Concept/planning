# Het design in de app

Bron: Claude Design-project **"Planning tool ClickUp vervanging"** (`Planning.dc.html`,
JE Concept Design System). Dit document zegt waar elk deel van dat design in de code
staat, en welke keuzes er gemaakt zijn waar het design een prototype was.

## Huisstijl

| Design | Code |
|---|---|
| Tokens (kleur, type, ruimte, radius, schaduw, beweging) | `src/styles/je-ds.css`, letterlijk uit het design system |
| Componenten (Button, Badge, Tag, Tabs, Checkbox, Switch, Select, Input, Field, Dialog, Icon, Logotype) | `src/components/ds/index.jsx` — zelfde namen, props en `je-*`-klassen |
| Schil, panelen, bord, kalender | `src/styles/app.css` |
| Oswald / Source Sans 3 / Parisienne / Prata | `index.html` (Google Fonts) |
| Iconen (Lucide) | `lucide-react`, alleen de gebruikte iconen |

De Tailwind-schalen `ink` en `accent` staan op de nieuwe navy-tokens, en alle afrondingen
zijn klein gezet. Zo staan ook de schermen die niet in het design zitten (Socials, Klanten,
Openen & sluiten, Teamoverleg, Uren, Goals, de andere borden) in dezelfde stijl.

**Logo:** zet het logobestand in `public/brand/je-concept-logo.png`. Zolang het er niet is,
toont de app een getekend zeshoekje met "JE".

## Schermen

| Design | Route | Bestand |
|---|---|---|
| Events — lijst / bord / kalender | `/`, `/?weergave=lijst`, `/kalender` | `src/pages/Events.jsx` |
| Event detail (taken, bestellijst, draaiboek, notities & bijlagen, tijd) | `/events/:id` | `src/pages/EventDetail.jsx` |
| Nieuw event (custom of vaste formule) | dialoog | `src/components/events/NewEventDialog.jsx` |
| Mijn taken | `/mijn-taken` | `src/pages/MyTasks.jsx` |
| Werklast | `/werklast` | `src/pages/Workload.jsx` |
| Instellingen (team & toegang, pijplijn, templates, formules, concepten & kostenplaatsen) | `/instellingen` | `src/pages/Settings.jsx` |
| Aanmelden | — | `src/pages/Login.jsx` |
| Zoekbalk (`/`) | overal | `src/components/layout/GlobalSearch.jsx` |
| Assistent | overal | `src/components/layout/AssistantPanel.jsx`, `src/context/AssistantProvider.jsx` |

De vroegere schermen staan onder **Meer** in de zijbalk (op een telefoon: `/meer`).
Het oude "Mijn werk" (met de keuze van persoon en de kalender) staat onder Meer als
"Taken per persoon" op `/mijn-werk`; het oude "Vandaag" staat op `/vandaag`.

## Gegevens

Een event is een taak op het hoofdniveau van de eventlijst — de lijst met de
negen statussen (`request` … `complete`). De taken van een event zijn zijn subtaken.
Zo blijven de gemigreerde ClickUp-gegevens, de klanten, het socialbord en de
automatisaties werken zoals voorheen.

Nieuwe velden op een event: `eventDate`, `eventEndDate`, `pax`, `kids`, `formule`, `eventType`,
`quoteAmount`, `draaiboek` (`[{tijd, wat, wie}]`), en — komt het uit een vaste
formule — `formuleId`, `formuleKeuzes`, `formulePrijsPerPersoon` en `bestellijst`. Op een taak: `checklist`
(`[{text, done}]`) en `repeat`. Waar een oud veld bestond, valt de app erop terug
(`budget` voor de offerte, `startDate`/`dueDate` voor de eventdatum).

- **Meerdaags:** `eventEndDate` staat er alleen wanneer een event langer dan één
  dag duurt; leeg betekent eendaags. Er is géén apart vinkje in de database — het
  vinkje op de fiche leest het bestaan van dit veld, want twee velden voor één
  waarheid lopen uit elkaar. Wie wil weten welke dagen een event beslaat, vraagt
  het aan `src/lib/eventdagen.js` (en server-side aan `dagenVanEvent` in
  `functions/aapi/matcher.js`) en rekent het niet zelf uit: die vraag wordt op
  acht schermen gesteld.

- **Statuslabels:** de namen in de database blijven de ClickUp-namen; het Nederlandse
  label ("Offerte maken") staat als `label` op de status en is te hernoemen in
  Instellingen → Pijplijn.
- **Offerteregel:** klant, datum, gasten en offertebedrag zijn verplicht om een
  aanvraag verder te zetten (`src/lib/pipeline.js`). Dat geldt ook voor het bord en
  voor de assistent.
- **Templates:** collectie `templates` (lezen: team, schrijven: beheerders). Zolang ze
  leeg is gelden de templates uit het design; de eerste aanpassing schrijft ze weg.
  "Nieuw event" is het standaardtemplate: offerte, voorschot, personeel, materiaal,
  social, draaiboek en facturatie. Een negatief aantal dagen valt ná het event.
- **Formules:** collectie `formules` (lezen: team, schrijven: beheerders), te beheren in
  Instellingen → Formules. Een formule heeft een prijs per persoon, vragen met
  antwoorden (hapjes, drankenformule, dessert) en bestelregels die eraan hangen. Bij een
  nieuw event kies je custom of een formule; bij een formule staan prijs, btw en een op
  het aantal personen berekende bestellijst meteen op het event, en zijn ze daarna
  gewoon te wijzigen. Het rekenwerk (afronden per verpakking) staat in
  `src/lib/formules.js`, met tests in `tests/formules.test.js`.
- **Domeinen:** `config/access.allowedDomains` (die las `ensureProfile` al).
- **Kostenplaatsen:** `config/workspace.costCenters`.
- **Automatisaties** vuren niet meer op subtaken: een taak uit een template hield
  anders de toewijzing en deadline van de aanvraagregel in plaats van die van het template.

## De assistent

Het model draait in de Cloud Function `assistant` (codebase `meetings`, naast de
overlegsamenvattingen, met hetzelfde geheim `ANTHROPIC_API_KEY`). De tools uit het
design — taken opvragen, taak aanmaken, status wijzigen, afvinken, timer starten,
event openen — draaien in de browser met de rechten van wie typt. Hoogstens vijftien
beurten per minuut per persoon. In de demo is er geen verbinding met Claude.
