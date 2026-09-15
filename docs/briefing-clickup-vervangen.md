# Briefing — ClickUp vervangen door een self-hosted applicatie

**Voor:** Claude Code-sessie `session_01EGJ3Lp3v5NJrGGUwbKyHcT`
**Van:** analyse van de live ClickUp-workspace, 15 september 2026
**Opdrachtgever:** Jasper Hansen — JE Concept BV / Ken je klanten
**Status van dit document:** feitelijke nulmeting + aanbeveling. Alle cijfers komen uit de ClickUp API op 15/09/2026, niet uit schattingen.

---

## 1. Waar het over gaat

JE Concept (hospitality & events, Tongeren–Borgloon) en Jaspers projectbureau Ken je klanten draaien vandaag hun werkopvolging in één ClickUp-workspace (`24317841`). De opdracht is om ClickUp te vervangen door een eigen, self-hosted applicatie.

De belangrijkste conclusie van de analyse vooraf: **ClickUp wordt hier niet als projecttool gebruikt, maar als eventadministratie plus urenregistratie.** Wie het probeert te vervangen door "een ClickUp-kloon" bouwt 80% ballast. De echte kern is klein en scherp omlijnd, en staat in §6.

---

## 2. De mensen

| Naam | ID | E-mail | Rol in de data |
|---|---|---|---|
| Jasper Hansen | 36332561 | jasper@kenjeklanten.be | Eigenaar, doet events + platform/IT |
| Elke Motmans | 56641471 | elke@kenjeklanten.be | Zwaarste gebruiker op Overview planning + facturatie |
| Anneleen Coenen | 112550285 | anneleen@kenjeklanten.be | Mede-eigenaar, planning |
| Anneleen Coenen | 112550287 | anneleen@jeconcept.be | **Duplicaat-account van dezelfde persoon** |
| Charish | 106555280 | charish.talento@gmail.com | Socials + actieve urenregistratie |

**Let op — twee categorieën rommel die je moet opvangen in de migratie:**

1. Anneleen heeft **twee accounts** (`112550285` en `112550287`). Bij migratie samenvoegen tot één gebruiker, met beide e-mailadressen als alias.
2. Twee **oud-medewerkers bestaan niet meer als member, maar wel overal in de data**: Maxine Vanbrabant (`88692608`) en Aïcha Van Roy (`94521343`). Samen goed voor ~892 tijdregistraties en honderden taak-assignments. De nieuwe app heeft dus gebruikers nodig die *gearchiveerd* kunnen zijn maar historisch blijven bestaan — niet hard verwijderd worden.

---

## 3. De huidige structuur

ClickUp-hiërarchie: Workspace › Space › Folder › List › Task. Zo ziet ze eruit, met de echte IDs:

```
Workspace 24317841
├── Space 90050449043  JE Concept
│   ├── Folder 90154158713  General
│   │   ├── List 901520618219  Socials              →  48 taken   ACTIEF
│   │   └── List 901506892740  Overview planning    → 576 taken   ACTIEF — de kern
│   ├── Folder 90157394193  Meetings en notes       →   0 lists (bevat enkel docs)
│   ├── Folder 90157394329  Concepten               →   0 lists (bevat enkel docs)
│   ├── Folder 90155361221  STVV
│   │   ├── List 901508759870  To do Eerste ploeg   →   4 taken   SLAPEND (okt 2025)
│   │   ├── List 901508759898  To do Youth kantine  →   4 taken   SLAPEND (okt 2025)
│   │   └── List 901508759918  To do Youth          →  64 taken   SLAPEND (mei 2025)
│   └── Folder 901515248854  Platform Development
│       └── List 901522286516  Requirements         →  19 taken   half actief
├── Space 90153118075  Persoonlijk J&E
│   ├── List 901513097220  Shoppinglist             →  40 taken   SLAPEND (apr 2026)
│   ├── List 901508734244  To do's                  →  22 taken   SLAPEND (mrt 2026)
│   └── List 901508734409  471A                     →   3 taken   SLAPEND (feb 2026)
├── Space 90153328803  Ken je klanten
│   ├── List 901516923907  Volu-events.be           →   0 taken   LEEG
│   ├── Folder 90157339198  Bouw-partner.be         →   0 lists (lege doc-placeholder)
│   ├── Folder 901510815650  Deli Roma              →   0 lists (lege doc-placeholder)
│   └── Folder 901511029458  Volu-events.be
│       └── List 901516923883  List                 →   0 taken   LEEG
└── Space 90159779833  Charish To do's              →   0 lists   LEEG
```

**Totaal: 780 taken.** Daarvan zitten er **576 (74%) in één enkele list: Overview planning.** Voeg Socials (48) en Requirements (19) toe en je zit aan 82% van alles wat er nog toe doet. De rest is historie of leegstand.

### Wat dat betekent voor het ontwerp

De vierlaagse hiërarchie Space›Folder›List›Task wordt **niet gebruikt zoals ze bedoeld is**. Ze is gebruikt om drie dingen uit elkaar te houden die eigenlijk drie verschillende *soorten werk* zijn:

- **Events & klantopdrachten** (Overview planning) — de eigenlijke business
- **Socials-planning** (Socials) — een redactiekalender
- **Softwareontwikkeling** (Requirements) — een backlog
- plus **privé** (Persoonlijk J&E) en **archief** (STVV)

Bouw de nieuwe app dus niet rond een generieke boom van spaces/folders/lists. Bouw ze rond die werksoorten. Eén platte "werkruimte"-laag (JE Concept / Ken je klanten / Privé) volstaat; daaronder typed entiteiten in plaats van naamloze lijsten.

---

## 4. Statusmodellen — dit is het waardevolste in de hele workspace

Elke list heeft een eigen statusreeks. Die van **Overview planning** is geen takenworkflow maar een **volledige order-to-cash-pijplijn**, en die moet één-op-één overleven:

| # | Status | ClickUp-type | Betekenis |
|---|---|---|---|
| 0 | `request` | open | binnengekomen aanvraag |
| 1 | `create offer` | unstarted | offerte moet gemaakt worden |
| 2 | `offer send` | unstarted | offerte verstuurd, wachten op klant |
| 3 | `offer accepted` | custom | akkoord — wordt een echt event |
| 4 | `planning ongoing` | custom | operationele voorbereiding loopt |
| 5 | `planning ready` | custom | draaiboek staat |
| 6 | `ready to invoice` | custom | event gebeurd, mag gefactureerd |
| 7 | `invoiced` | done | factuur verstuurd |
| 8 | `complete` | closed | betaald/afgesloten |

Dit is de bedrijfslogica van JE Concept, in negen stappen, met exact de overgangen die Jasper en Elke dagelijks gebruiken. Het is meteen ook de reden waarom een generieke takenapp niet volstaat: hier hangt facturatie aan.

De andere statusreeksen, ter referentie:

- **Socials** (`901520618219`): `pending` → `in progress` → `ready for review` → `planning` → `done`. Merk op dat `planning` ná `ready for review` staat in de orderindex — dat is wellicht historisch gegroeid en ongewenst; navragen.
- **Requirements** (`901522286516`, space-breed `p90050449043_*`): `to do` → `on going` → `complete`.
- **STVV Eerste ploeg**: `Open` → `to do` → `doing` → `Closed` (hoofdletters inconsequent).
- **Persoonlijk J&E** (space-breed): `to do` → `in progress` → `complete`.
- **Ken je klanten** (space-breed): `to do` → `planning` → `in progress` → `at risk` → `update required` → `on hold` → `complete` → `cancelled`. Acht statussen op nul taken — volledig ongebruikt, niet overnemen.

---

## 5. Velden, tags en metadata

**Custom fields — er zijn er precies drie in de hele workspace:**

| Veld | ID | Type | Scope | Gebruik |
|---|---|---|---|---|
| Budget | `13cc2c16-270c-4b0d-a497-0576edb84951` | currency, EUR, 2 decimalen | Space JE Concept | gedefinieerd, in de praktijk **leeg** |
| Locatie | `b81f06e9-a930-4098-b39e-da9970b65e67` | location (geo) | Space JE Concept | gedefinieerd, in de praktijk **leeg** |
| Progress Updates | `bf31084c-99ec-4c77-8f1f-e1c10f0048de` | text, AI-gegenereerd uit activity (24u, bullets) | List Socials | leeg |

Dat die velden leeg blijven is het scherpste signaal in deze hele analyse: **de gestructureerde velden die ClickUp aanbiedt, worden niet ingevuld; alle echte informatie zit in vrije tekst in de taakbeschrijving.** Een migratie die dat gedrag niet doorbreekt, levert opnieuw een systeem op waar niets uit te rapporteren valt. Zie §9.

**Tags** — enkel in twee lists, en met twee verschillende betekenissen:

- *Overview planning*: eventcategorie — `wintermoods`, `stvv`, `losse events`, `oldskool`, `shop & the city`
- *Socials*: merk-label — `meer` (9×), `je concept` (7×), `jeconcept` (4×), `barvue` (3×), `feestbeest` (3×)

Let op de dubbele spelling `je concept` / `jeconcept`: vrije tags lopen uit de hand. In de nieuwe app worden dit **vaste keuzelijsten** (concept/merk, eventtype), geen vrij invulbare tags.

**Overige metadata:** priority wordt alleen in Requirements consequent gebruikt (19/19), elders zeldzaam en dan meestal `urgent` op facturatiedeadlines. Due dates staan op ongeveer een derde van de events, nauwelijks elders.

---

## 6. Wat écht gebruikt wordt (en wat niet)

Dit is de kern van de briefing. Bouw wat links staat; laat wat rechts staat vallen.

### Wél in gebruik — moet mee

| Feature | Omvang | Opmerking |
|---|---|---|
| **Taken met vrije-tekstbeschrijving** | 780 taken | de beschrijving is het eigenlijke dossier, zie hieronder |
| **Statuspijplijn per werksoort** | 9 statussen op de kern-list | = de order-to-cash-logica, §4 |
| **Tijdregistratie** | **~1.379 entries, ~2.224 uur** | zwaarst gebruikte feature van allemaal |
| **Billable-vlag op tijd** | 889/892 historisch, 360/487 actueel | facturatiebasis |
| **Toewijzing aan mensen** | overal | inclusief twee vertrokken medewerkers |
| **Docs** | 20 docs / ~24 pagina's | licht, maar met echte operationele inhoud |
| **Bijlagen** | **4 bestanden** (4× image.png) | verwaarloosbaar volume, maar mechanisme is nodig |

### Niet in gebruik — schrappen

| Feature | Bevinding |
|---|---|
| Chat | 14 kanalen, **2 berichten in totaal** (beide van Jasper, juni 2025). Communicatie loopt via WhatsApp en mail. Niet bouwen. |
| Reminders | 0 stuks. |
| Checklists | 0 gevonden. |
| Subtaken | 0 gevonden. |
| Dependencies | 0 gevonden. |
| Whiteboards | 2 stuks, laatst aangeraakt feb–apr 2025. Dood. |
| Dashboards | 1 stuk, minimaal gebruik. |
| Automations / forms / goals / custom task types | geen spoor van. |
| Comments | 1 comment op 5 gecontroleerde taken. **Zie waarschuwing hieronder.** |

**Waarschuwing bij comments:** ze zijn zeldzaam, maar waar ze bestaan bevatten ze zware operationele inhoud. Het enige gevonden exemplaar (taak `86cb0gp08`, event Blum) is een complete leverancierschecklist van Elke — offertes bij verhuur, catering, sanitair en drank, plus interne materiaallijst. Comments mogen dus niet verdwijnen in de migratie, ook al verdient de feature geen threads, reacties of assigned comments. Eén platte notitiestroom per dossier volstaat.

### Hoe rijk is een taak echt?

Drie representatieve dossiers, ter kalibratie van het datamodel:

- **Socials-taak** (`86cbh9w0j`, "JE Concept (September 13-19)"): vrijwel leeg. Titel + status + assignee. Meer niet. Socials is een kalender, geen dossier.
- **Requirements-taak** (`86c91j5m1`, "Architecture — Multi-tenant SaaS platform"): lange markdown met beslissingen, een ASCII-architectuurdiagram en een genummerde build-volgorde. Geen enkel gestructureerd veld ingevuld.
- **Event-taak** (`86c3tbx9y`, "Trouw Niels en Inez"): het rijkste wat er is — een volledig eventdossier in markdown. Twee tabellen in label/waarde-vorm: een "Fiche evenement" (klant, gelegenheid, data, aantal personen, formule, locatie, opbouw, afbouw, contactpersoon, budget) en een "Programma per dag". Daarna bullet-secties Infrastructuur, Ceremonie, Food, Drank, Deco & extra's, een kop "Openstaande punten" met 8 bullets, en een vrij inspiratieblok. Eén bijlage (PNG, ~2,1 MB). Geen checklists, geen subtaken. Budget- en Locatie-velden leeg, terwijl de fiche diezelfde info wél bevat.

  Die fiche is trouwens het beste bewijs voor §9: **Jasper heeft het datamodel zelf al uitgevonden, alleen staat het als tabel in een tekstveld in plaats van als kolommen in een database.**

Die laatste is het pleidooi voor §9 in één voorbeeld: alles wat een echt veld hoort te zijn, staat er als tekst in.

---

## 7. Migratie-inventaris

Dit moet fysiek mee. Volumes zijn klein genoeg om in één keer te doen.

| Object | Aantal | Bron | Bijzonderheid |
|---|---|---|---|
| Taken | 780 | `GET /list/{id}/task?include_closed=true`, 100/pagina | beschrijving = markdown, moet integraal bewaard |
| Tijdregistraties | ~1.379 (~2.224 u) | time entries API | gekoppeld aan ~150 taken; billable-vlag mee |
| Docs | 20 docs / ~24 pagina's | docs API | rich text met checkboxes, @mentions, interne links |
| Bijlagen | 4 | task attachments | triviaal |
| Comments | enkele | task comments | zeldzaam maar inhoudelijk zwaar |
| Gebruikers | 5 actief + 2 vertrokken + 1 duplicaat | members API | dedupliceren en archiveren, niet verwijderen |
| Statusdefinities | 6 verschillende reeksen | list/space statuses | §4 |
| Tags | ~10 unieke, 2 betekenissen | task tags | ombouwen naar keuzelijsten |

**Datahygiëne bij de import:** taaknamen bevatten trailing spaties (bv. `"Trouw Niels en Inez "`), tags bestaan in dubbele spelling, en statusnamen wisselen van hoofdletter (`Open`/`to do`/`Closed`). Trim en normaliseer bij het inlezen, niet achteraf.

**Grootste tijdpost in de tijdregistratie:** een verzameltaak `Internal work` met 582 uur over 243 entries. Dat is geen taak, dat is een kostenplaats. In de nieuwe app hoort dat een *categorie* te zijn waarop je tijd kunt boeken zonder dossier, niet een nepdossier.

**Uitdrukkelijk NIET migreren:** het ClickUp-doc **"Wachtwoorden"** (laatst bijgewerkt jan 2026). Credentials horen in een password manager, niet in een zelfgebouwde applicatie. Dit apart met Jasper opnemen vóór de ClickUp-workspace afgesloten wordt.

**Ook niet migreren:** de ClickUp-boilerplate docs (Company Home, Welcome!, Getting Started Guide, Template Guide), de lege placeholder-docs in de space Ken je klanten, de twee lege lists, en de space Charish To do's.

---

## 8. Pijnpunten die de vervanger moet oplossen

Niet alleen "hetzelfde maar zelf gehost". Dit zijn de concrete gebreken van de huidige opzet:

1. **Gestructureerde data zit in vrije tekst.** Klant, datum, aantal personen, formule, prijs, locatie — het staat allemaal in de beschrijving van de taak. Gevolg: geen enkele lijst of rapport is mogelijk. Je kunt vandaag niet beantwoorden: "wat hebben we deze maand gefactureerd", "welke events staan er in oktober", "hoeveel pax hebben we dit jaar bediend".
2. **Budget- en Locatie-velden bestaan maar worden genegeerd.** Dat lost zich niet op met discipline; het lost zich op door die velden vereist te maken op het moment dat een aanvraag een offerte wordt.
3. **Eén list van 576 taken**, waarvan het overgrote deel `complete`. Geen scheiding tussen actief werk en archief.
4. **Tags met dubbele spelling** (`je concept` vs `jeconcept`).
5. **Facturatie-opvolging leunt op statussen** (`ready to invoice` → `invoiced`), zonder dat er een factuurnummer, bedrag of datum aan hangt.
6. **Requirements-list beschrijft een workflow die niet bestaat.** De listbeschrijving luidt: *"Move tasks to Approved to trigger Claude to implement."* Er ís geen status `Approved` — de statussen zijn `to do` / `on going` / `complete`. Bij de herbouw uitklaren of die trigger überhaupt moet blijven bestaan.
7. **Tijdregistratie en dossiers zijn losgekoppeld van facturatie.** 2.224 geregistreerde uren, waarvan het merendeel billable, en geen enkel pad van uur naar factuur.
8. **Vertrokken medewerkers blokkeren netheid**: hun werk staat er nog, zij niet meer.

---

## 9. Voorgesteld datamodel

De vertaling van "lists met taken" naar echte entiteiten. Dit is het hart van het voorstel: **geen generieke taken, maar typed dossiers.**

### Kern

**`event`** (vervangt Overview planning — 576 records)
- `id`, `naam`, `status` (de 9-stappen enum uit §4), `concept` (enum: Bar Vue / Meer / Maison Folie / Wintermoods / Feestbeest / Los event / STVV), `eventtype`
- `klant_naam`, `klant_email`, `klant_telefoon`
- `datum_start`, `datum_einde`, `aantal_pax`, `aantal_kinderen`
- `locatie` (adres + optioneel geo), `formule` (vrije tekst of referentie)
- `offerte_bedrag`, `voorschot_bedrag` (40% is vaste regel), `factuurnummer`, `factuurdatum`, `betaald_op`
- `dossier` (markdown — hier mag het vrije eventdossier blijven leven, want draaiboeken zijn nu eenmaal proza)
- `openstaande_punten` (lijst — dit blijkt uit de praktijk een terugkerende sectie in de beschrijvingen)
- `toegewezen_aan` (meerdere), `aangemaakt_op`, `bijgewerkt_op`

**`tijdregistratie`** (~1.379 records)
- `id`, `gebruiker_id`, `event_id` **of** `kostenplaats` (voor `Internal work` en soortgelijke), `start`, `eind`, `duur`, `billable` (bool), `omschrijving`
- start/stop-timer én handmatige invoer; beide worden vandaag gebruikt

**`gebruiker`**
- `id`, `naam`, `emails[]` (meervoud, wegens Anneleen), `rol`, `actief` (bool — vertrokken medewerkers blijven bestaan), `uurtarief_intern`

**`socialpost`** (vervangt Socials — 48 records)
- `id`, `titel`, `periode` (de huidige taken heten "JE Concept (September 13-19)"), `merk` (enum i.p.v. tag), `status` (5-stappen enum), `toegewezen_aan`
- bewust mager gehouden: de huidige taken zijn ook mager

**`requirement`** (vervangt Requirements — 19 records)
- `id`, `titel`, `beschrijving` (markdown), `prioriteit`, `status`
- dit mag gerust de lichtste entiteit van allemaal blijven; hij wordt door één persoon gebruikt

**`notitie`** (vervangt comments + docs — ~25 records)
- `id`, `titel`, `inhoud` (markdown met checkboxes), `gekoppeld_aan` (polymorf: event / los), `auteur`, `bijgewerkt_op`

**`bijlage`**
- `id`, `bestandsnaam`, `mimetype`, `grootte`, `gekoppeld_aan`, `opslagpad`

### Bewust weggelaten
Geen subtaken, geen dependencies, geen checklists als aparte entiteit (checkboxes in markdown volstaan), geen chat, geen reminders, geen whiteboards, geen automations. Nul van die dingen wordt vandaag gebruikt.

### De ene regel die het verschil maakt
**Verplicht `klant_naam`, `datum_start`, `aantal_pax` en `offerte_bedrag` bij de overgang `request` → `create offer`.** Dat is het enige moment waarop je die informatie sowieso in handen hebt, en het is precies de stap waar ze vandaag in de vrije tekst verdwijnt. Eén validatieregel maakt het verschil tussen "ClickUp maar zelf gehost" en een systeem waar eindelijk uit te rapporteren valt.

---

## 10. Technische context

Jasper heeft in andere projecten al keuzes gemaakt die hier meewegen. Neem ze mee als uitgangspunt, niet als dogma:

- **JE Concept-platform** (`jeconcept.be`, private repo `Kenjeklanten/je-concept`): React 18, Vite 5, Tailwind 3, React Router 6, Supabase JS v2; Vercel Hobby + Supabase (eu-west-1). Daarbovenop draait **Cue**, een multi-tenant SaaS met self-service signup en Stripe billing. Dit platform bevat al een **offertemotor met digitale handtekening**, een **materiaalbeschikbaarheidskalender**, **fotorapporten**, **crew GPS check-in**, **Mollie-betalingen**, **Billit e-facturatie** en **WhatsApp Business API-notificaties**.
- **Besteltool** (`stock.jeconcept.be`, repo `Kenjeklanten/stock`): PHP + MySQL, Cloudflare Pages, pincode-login voor tellers en Cloudflare Access met Google-account voor beheerders.
- Codebase mengt Nederlands (UI, `projecten`, `klanten`) en Engels (componenten, functies). Jasper werkt in het Nederlands.

**De belangrijkste vraag die hieruit volgt:** het JE Concept-platform doet al offertes, facturatie-integratie en materiaalplanning. De ClickUp-vervanger overlapt daar zwaar mee. **Bouw dit als module ín het bestaande JE Concept-platform in plaats van als losse applicatie** — tenzij Jasper bewust anders kiest. Een aparte app zou betekenen dat een event twee keer bestaat: één keer als ClickUp-opvolger, één keer als offerte in het platform. Dat is precies het probleem dat we proberen op te lossen.

---

## 11. Voorgestelde aanpak

1. **Beslissen: module of losse app.** (Zie §10 — aanbeveling is module.) Dit bepaalt alles daarna.
2. **Datamodel vastleggen** volgens §9, met Jasper de verplichte velden aftoetsen.
3. **Volledige export uit ClickUp** — 780 taken, ~1.379 tijdregistraties, 20 docs, 4 bijlagen. Ruw wegschrijven als JSON vóór je transformeert, zodat je kunt hertransformeren zonder opnieuw te exporteren. De API paginereert op 100; `include_closed=true` is essentieel, anders mis je 74% van Overview planning.
4. **Transformatie met de mens erbij.** De 576 eventbeschrijvingen bevatten gestructureerde data in proza. Klant, datum en pax zijn deels automatisch te extraheren (de titels volgen vaak het patroon `KLANT – omschrijving – datum`, en veel dossiers bevatten tabellen), maar dit wordt geen 100%-automatisering. Plan een handmatige nabewerkingsronde voor de ~50 actieve dossiers; laat de ~500 afgesloten events gerust met alleen titel + status + beschrijving landen in een archief.
5. **Bouwen**, in deze volgorde: events + statuspijplijn → tijdregistratie → rapportage → notities/docs → socials → requirements.
6. **Parallel draaien** gedurende minstens één volledige factuurcyclus vóór ClickUp afgesloten wordt.
7. **Wachtwoorden-doc apart afhandelen** (§7) vóór de workspace dichtgaat.

---

## 12. Open vragen voor Jasper

Deze kunnen niet uit de data beantwoord worden en bepalen de scope:

1. **Module in het bestaande JE Concept-platform, of losse applicatie?** (§10)
2. Moet **Persoonlijk J&E** (65 taken privé/huishouden) überhaupt mee, of stopt dat gewoon?
3. Mag de **STVV-map** (72 taken, slapend sinds mei–okt 2025) als platte archiefexport, of moet die werkbaar blijven?
4. Wat is de bedoeling van de `Approved`-status in de Requirements-list die niet bestaat? (§8.6)
5. Moet er een **koppeling naar facturatie** in (Billit is al in gebruik in het platform), of blijft `invoiced` een handmatige status?
6. Moet **Charish** blijven kunnen inloggen en tijd registreren in de nieuwe app? (zij is de enige actieve tijdregistrator sinds feb 2026)
7. Welk **hostingmodel**: Cloudflare Pages + PHP/MySQL zoals de besteltool, of Supabase zoals het platform?
8. Is de statusvolgorde in Socials (`ready for review` vóór `planning`) bewust, of moet die rechtgezet worden?

---

## Bijlage — snelle referentie van IDs

```
workspace           24317841

spaces              90050449043  JE Concept
                    90153118075  Persoonlijk J&E
                    90153328803  Ken je klanten
                    90159779833  Charish To do's (leeg)

kern-lists          901506892740  Overview planning   576 taken
                    901520618219  Socials              48 taken
                    901522286516  Requirements         19 taken

custom fields       13cc2c16-270c-4b0d-a497-0576edb84951  Budget    (currency EUR)
                    b81f06e9-a930-4098-b39e-da9970b65e67  Locatie   (location)
                    bf31084c-99ec-4c77-8f1f-e1c10f0048de  Progress Updates (AI text)

referentietaken     86c3tbx9y  rijkst eventdossier (Trouw Niels en Inez)
                    86c91j5m1  rijkste requirement (Architecture multi-tenant)
                    86cb0gp08  enige taak met substantiële comment (Blum)
                    86cbh9w0j  typische Socials-taak (vrijwel leeg)
```
