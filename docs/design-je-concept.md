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
| Event detail (taken, draaiboek, notities & bijlagen, tijd) | `/events/:id` | `src/pages/EventDetail.jsx` |
| Nieuw event (met template) | dialoog | `src/components/events/NewEventDialog.jsx` |
| Mijn taken | `/mijn-taken` | `src/pages/MyTasks.jsx` |
| Werklast | `/werklast` | `src/pages/Workload.jsx` |
| Instellingen (team & toegang, pijplijn, templates, concepten & kostenplaatsen) | `/instellingen` | `src/pages/Settings.jsx` |
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

Nieuwe velden op een event: `eventDate`, `pax`, `kids`, `formule`, `eventType`,
`quoteAmount`, `draaiboek` (`[{tijd, wat, wie}]`). Op een taak: `checklist`
(`[{text, done}]`) en `repeat`. Waar een oud veld bestond, valt de app erop terug
(`budget` voor de offerte, `startDate`/`dueDate` voor de eventdatum).

- **Statuslabels:** de namen in de database blijven de ClickUp-namen; het Nederlandse
  label ("Offerte maken") staat als `label` op de status en is te hernoemen in
  Instellingen → Pijplijn.
- **Offerteregel:** klant, datum, gasten en offertebedrag zijn verplicht om een
  aanvraag verder te zetten (`src/lib/pipeline.js`). Dat geldt ook voor het bord en
  voor de assistent.
- **Templates:** collectie `templates` (lezen: team, schrijven: beheerders). Zolang ze
  leeg is gelden de vier templates uit het design; de eerste aanpassing schrijft ze weg.
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
