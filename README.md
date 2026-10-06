# JE Plan — planning.jeconcept.be

Interne planningstool voor JE Concept, als vervanger van ClickUp. De app heet **JE Plan**; de repo en het Firebase-project houden hun naam (`planning`, `je-planning`), want die staan in te veel geheimen en URL's om er iets mee op te schieten. Vier onderdelen:

- **Kanban** — borden per lijst, slepen tussen kolommen, groeperen op status, persoon of prioriteit, filters, lijstweergave, subtaken, reacties.
- **Social media kalender** — maandkalender over alle merken heen (JE Concept, Bar Vue, Meer — Het Vinne, Feestbeest, Maison Folie, Wintermoods). Per post een link naar het ontwerp, een **review** (vragen, goedkeuren, aanpassing vragen) met een logboek van elke beslissing, en posts kunnen aan een **project** hangen.
- **Openen & sluiten** — de dagelijkse checklist van de bistro, één lijst per dag waar het hele team in afvinkt. Zaalpersoneel krijgt een **beperkte login** die alleen deze lijst ziet. Bij elk vinkje staat wie het zette en wanneer; weekendpunten tellen alleen in het weekend mee; toegangscodes staan achter een klik.
- **Timetracking** — één timer in de bovenbalk, handmatige registraties, weekoverzicht, rapport per persoon / lijst / merk / dag, CSV-export.
- **Goals** — doelen met meetbare resultaten (aantal, bedrag, percentage, ja-nee, of automatisch het aantal afgewerkte taken van een lijst), met voortgang en check-in-geschiedenis.

Stack: React + Vite + Tailwind, Firebase (Firestore, Auth, Storage, Cloud Functions), Firebase Hosting.

---

## Waarom een apart Firebase-project

Firestore-rules en -indexes zijn **projectbreed** en worden vanuit één repo gedeployed. Zou deze repo naar hetzelfde project deployen als het Cue-platform (`Kenjeklanten/je-concept`), dan overschrijft elke deploy hier de rules daar. Daarom een eigen project: dezelfde stack, dezelfde Google-login, nul risico op het bestaande platform.

---

## Structuur

```
src/lib/          Firebase-client, datum-, formatteer- en rekenhulpjes (los van Firestore, dus testbaar)
src/data/         Alle Firestore-lees- en schrijfacties, per domein (tasks, time, social, goals, …)
src/context/      Auth, werkruimte (mensen/merken/lijsten), toasts
src/components/   ui/ (knoppen, velden, modals) · layout/ · board/ · social/
src/pages/        Dashboard, Mijn werk, Bord, Social kalender, Uren, Goals, Instellingen
functions/        Cloud Functions: toegangscontrole (wie mag binnen, en wie wordt eigenaar)
scripts/          seed.mjs (eerste opzet) en migrate-clickup.mjs (import uit ClickUp)
firestore.rules   Wie wat mag — de enige plek waar toegang wordt beslist
firestore.indexes.json  Samengestelde indexes voor de bord- en urenqueries
```

### Datamodel in het kort

Firestore kent geen joins, dus een document draagt zelf mee wat een lijstweergave nodig heeft. Daarnaast staat de **schijfcache** van Firestore aan (`persistentLocalCache`, met tabbladbeheer): een tweede bezoek leest de borden van schijf en vraagt alleen nog wat er sinds de vorige keer veranderde. Dat scheelt wachttijd op een telefoon én leesbewerkingen, die per stuk gefactureerd worden. Het kost ongeveer 20 kB extra in de bundel, éénmalig.

| Collectie | Opmerking |
|---|---|
| `profiles/{uid}` | Bestaat pas na goedkeuring. **Een profiel hebben = lid zijn**; de rules kijken naar niets anders. |
| `lists/{id}` | De bordkolommen (`statuses`) zitten **in** het lijstdocument: één read per bord in plaats van één per kolom. Te wijzigen op het bord zelf én in Instellingen → Ruimtes & lijsten. Verdwijnt er een kolom, dan vraagt de editor eerst waar de taken erin heen moeten en verhuist ze mee — anders wijzen ze naar een status die niet meer bestaat en staan ze in geen enkele kolom. |
| `customers/{id}` | Bedrijfsgegevens, adres en contactpersonen. Events verwijzen ernaar met `customerId` en dragen `customerName` mee; die kopie wordt server-side bijgewerkt als de klant hernoemd wordt. |
| `attachments/{id}` | Documenten: aan een klant (`customerId`) óf aan een event (`taskId`). Het bestand staat in de gedeelde Google Drive (`driveId`); deze rij is een gesynchroniseerde kopie met naam, type, grootte, link en voorvertoning. Alleen de functie `drive` schrijft hier. |
| `tasks/{id}` | Draagt een kopie van `statusName/statusColor/statusKind`, `listName` en `customerName`, plus `open` (niet afgerond) en de socialstand (`socialStage`, `socialWanted`). Daardoor hoeft geen enkele kaart een extra read te doen. Wordt bijgehouden door `src/data/tasks.js`; nergens anders met de hand zetten. |
| `timeEntries/{id}` | Draagt `day`, `week` en `month`. Daardoor is "uren van september" één indexquery in plaats van een range-scan met groeperen in de browser. |
| `runningTimers/{uid}` | De lopende timer, **op uid gesleuteld**: "één timer per persoon" is zo een eigenschap van de data, geen afspraak. |
| `goals/{id}` | Key results zitten in het goal-document (er zijn er een handvol, ze worden nooit apart opgevraagd). Check-ins staan los in `goalUpdates`, want die groeien oneindig. |
| `socialPosts/{id}` | Inclusief de link naar het ontwerp (`assetUrl`), de reviewstand (`reviewState`, `reviewRound`, `reviewerId`) en de kopie van het project (`taskId`, `taskTitle`, `taskListName`). |
| `checklists/{id}` | De lijsten zelf (openen, sluiten), met secties en punten. Beheerders bewerken ze; `src/lib/checklist-templates.js` is de bron voor de seed. |
| `checklistRuns/{id}` | Eén run per lijst per dag, met de vaste id `<lijst>_<jjjj-mm-dd>`. De stand staat in een map `items`, gesleuteld op punt-id. |
| `pushTokens/{token}` | Eén rij per toestel dat meldingen wil, gesleuteld op het token. Je beheert en leest alleen je eigen rijen; versturen doet een Cloud Function. |
| `mailQueue/{id}` | De postbak van de meldingen: één rij per e-mail die nog moet vertrekken, met zijn status (`wachtend`, `verstuurd`, `mislukt`). Dicht voor de app — er staan adressen en volledige teksten in. Schrijven doen de triggers in `functions/`, versturen doet `functions-mail/`, dat alleen uitgerold wordt als het geheim `SMTP_URL` bestaat. Zie `docs/e-mailmeldingen-aanzetten.md`. |
| `formules/{id}` | Vaste formules (winter bbq aan 29,90) met hun vragen (`opties`), de antwoorden erbij (`keuzes`) en de `bestelregels` die eruit volgen. Lezen: team, schrijven: beheerders. `src/lib/formule-templates.js` is de bron voor de seed en de demo; het rekenwerk staat in `src/lib/formules.js`. |
| `aapiShifts/{id}` | De planning uit AAPI, gesleuteld op de `Planning Id` die AAPI zelf meegeeft — dat is wat een herimport idempotent maakt en handmatige correcties beschermt. Wie, wanneer, welke afdeling, welk statuut, en bij Evenementen aan welk event het hangt (`linkStatus`: `auto`, `manual`, `ambiguous`, `unlinked`, `none`, `notApplicable`). Lezen: team. Schrijven: niemand vanuit de browser — de import loopt server-side, koppelen via de functie `aapiKoppel`. Zie `docs/aapi-planning.md`. |
| `aapiEmployees/{id}` | De mensen uit AAPI, gesleuteld op hun `Employee Id` — of, voor wie alleen in de personeelslijst staat, op hun e-mailadres (`mail-…`). Naam (genormaliseerd én ruw), statuut, afdeling, e-mail, gsm en sinds wanneer ze in dienst zijn. `active` gaat nooit vanzelf uit: wie een maand niet ingepland staat, is daarom niet vertrokken. Wat er uit de personeelslijst met opzet níét in komt — rijksregisternummer, rekeningnummer, adres, geboortedatum — staat opgesomd in `functions/aapi/personeel.js`. |
| `aapiImportRuns/{id}` | Eén rij per importbeurt: bron, bestand, venster, wat er aangemaakt, bijgewerkt, ongewijzigd en verdwenen is, hoeveel koppelingen vanzelf gingen en hoeveel er een keuze vragen, plus de overgeslagen rijen met hun reden. |
| `aapiImportQueue/{id}` | Bijlagen die per mail binnenkwamen en nog gelezen moeten worden. `functions-mail/` zet ze neer (die codebase kan de lezer niet importeren), een trigger in `functions/` verwerkt ze. Een xlsx die geen planning blijkt krijgt `afgewezen` met de reden erbij — geen storing, wel het antwoord op "waar is mijn planning". |
| `personeelCodes/{id}` | De cijfercode waarmee een medewerker zich aanmeldt, gesleuteld op zijn AAPI Employee Id, met de teller voor misse pogingen en het slot erbij. Geen enkel tabblad komt erbij — ook een beheerder niet; inkijken gaat via de functie `ploegCodeLezen`, die het in `personeelCodeGelezen` zet. Zie `docs/ploeg-aanmelden.md`. |
| `personeelCodeGelezen/{id}` | Wie welke code inkeek, en wanneer. Alleen de functie schrijft; beheerders lezen. Dat is wat "zichtbaar in de backoffice" draaglijk maakt: niet dat niemand kan kijken, maar dat kijken een spoor nalaat. |
| `linkVoorbeelden/{id}` | Het voorbeeldkaartje bij een link in een notitie: titel, omschrijving, plaatje en site, gesleuteld op een hash van het adres. De callable `linkVoorbeeld` haalt de pagina op en bewaart het antwoord veertien dagen — ook een mislukking, anders probeert elke lezer van die notitie het opnieuw. Lezen: team. Schrijven: niemand vanuit de browser; een kaartje dat een tabblad kan bewerken, is een val in plaats van een hulp. De bewaking tegen SSRF staat in `functions/og.js`. |
| `herhalingen/{id}` | Werk dat vanzelf terugkomt: titel, wie, welk bord, en het ritme (dagelijks, wekelijks met weekdagen, maandelijks met een dag van de maand — hoogstens de 28e). Lezen: team, beheren: beheerders. De taken zelf zet de geplande functie `herhalingen` elke nacht om 05:40 neer, met een vaste document-id per dag, zodat een tweede beurt niets verdubbelt. |
| `automations/{id}` | De business rules: op welke entiteit ze staan, wanneer ze vuren, onder welke voorwaarden en wat ze doen — een losse regel of een beslissingstabel. Beheerders bewerken ze in Instellingen; uitvoeren doet een Cloud Function. |
| `automationRuns/{id}` | Het logboek van de regels: welke regel vuurde, op welk document, en bij een tabel op welke rij. Alleen de server schrijft erin. |
| `postReviews/{id}` | Het logboek van de reviewbeslissingen: wie, wanneer, welke ronde en met welke opmerking. Wordt aangevuld, nooit gewijzigd. |

---

## De seed en bestaande gegevens

`scripts/seed.mjs` draait bij **elke** uitrol, en dat stelt één harde eis: niets overschrijven wat in de app te wijzigen is. Bordkolommen, de punten van een dagelijkse lijst, merknamen — dat staat in de app en dus in de database, en de repo is daar niet de baas over. De seed maakt aan wat ontbreekt en laat de rest met rust.

Dat was eerder niet zo. Alles ging met `merge: true`, en een merge vervangt een veld dat een lijst is *in zijn geheel*: elke uitrol zette de bordkolommen en de dagelijkse lijsten terug naar de versie uit de repo. Met de tool in gebruik is dat gegevensverlies, en het was niet zichtbaar tot iemand zijn wijziging kwijt was.

Alleen `config/access` wordt nog bijgewerkt: die staat nergens in de app, en een nieuw teamlid erbij moet via de repo kunnen.

---

## Eenmalige opzet

> **Zonder terminal:** [`docs/handover-claude-in-chrome.md`](docs/handover-claude-in-chrome.md) doet
> hetzelfde volledig in de browser — console, GitHub-geheimen, en de workflow **Go live** die rules,
> indexes, functions, basisgegevens en de applicatie in de juiste volgorde uitrolt.
> Met terminal: `./scripts/go-live.sh <project-id>`.

### 1. Firebase-project

```bash
npm install -g firebase-tools     # of gebruik npx
firebase login
firebase projects:create je-planning      # of maak het aan in de console
```

Zet in de Firebase-console aan:

- **Authentication → Sign-in method → Google**
- **Firestore Database** (productiemodus, regio `europe-west1`)
- **Storage**
- **Blaze-abonnement** — vereist voor Cloud Functions (de toegangscontrole); verbruik op jullie schaal blijft binnen het gratis quotum.

Pas daarna `.firebaserc` aan als je project anders heet dan `je-planning`.

### 2. Configuratie

```bash
cp .env.example .env.local
```

Vul de `VITE_FIREBASE_*`-waarden in uit **Projectinstellingen → Je apps → Web-app**. Dit zijn geen geheimen: de beveiliging zit volledig in `firestore.rules`.

### 3. Rules, indexes en functions uitrollen

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
cd functions && npm install && cd ..
firebase deploy --only functions
```

### 4. Vullen en aanmelden

```bash
# Service-account: Projectinstellingen → Serviceaccounts → Nieuwe private sleutel
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/seed.mjs
```

Dat zet de merken, de toegangsdomeinen en de twee borden klaar.

Meld daarna aan met Google. **De eerste persoon die binnenkomt wordt automatisch eigenaar** — anders zou niemand ooit iemand kunnen uitnodigen. `@jeconcept.be` en `@kenjeklanten.be` krijgen automatisch toegang; iedereen anders heeft een uitnodiging nodig via *Instellingen → Team*.

### 5. Domein

```bash
firebase target:apply hosting app je-planning
npm run build && firebase deploy --only hosting
```

Voeg in de Firebase-console (**Hosting → Aangepast domein**) `planning.jeconcept.be` toe en zet het opgegeven record in de DNS van `jeconcept.be`.

---

## De posts en hun review

Dit is de kalenderkant van **Socials** (de tabs *Kalender* en *Posts*); het eventbord staat verderop.

### De review

Een post kan **ter review gevraagd**, **goedgekeurd** of **teruggestuurd voor aanpassing** worden. De stand van de post en de regel in het logboek (`postReviews`) worden in één batch geschreven, zodat de kaart en de geschiedenis eronder nooit uit elkaar lopen. Het ontwerp zelf staat waar het team het maakt; de post bewaart er een link naar.

Wat er openstaat, staat op het dashboard onder **Wacht op review**, en op de kalender achter de filter met dezelfde naam.

### Posts aan projecten

Een post kan aan een taak hangen. Dat is wat de vraag *"wat gaat er buiten voor Blum?"* beantwoordbaar maakt naast *"wat gaat er deze week buiten?"*: de kalender filtert op project, de kaart toont het project, en het takenpaneel toont onderaan de posts die eraan hangen, met hun reviewstatus. De titel en de lijst van de taak reizen mee op de post — Firestore heeft geen join, en een kalendercel kan niet per kaart een taak gaan lezen.

---

## Rollen

| Rol | Ziet |
|---|---|
| `owner` / `admin` | alles, plus het beheer van mensen en lijsten |
| `member` | de volledige planning |
| `staff` | **alleen** openen & sluiten |
| `social` | **alleen** de socials, en geen enkel bedrag |
| `guest` | niet meer te kiezen — zie hieronder |

**`guest` is uit de keuzelijst gehaald.** De rol beperkte niets: in `firestore.rules` komt het woord niet voor, dus `isTeam()` liet een gast overal bij — de offertes, de klantgegevens, alle bedragen, het logboek. Tegelijk liet de interface hem juist weg uit de kiezers voor uitvoerders en uit de werklast, alsof het een buitenstaander was. Dat verschil was de valkuil: wie iemand op *Gast* zette, dacht te beperken en deed dat niet. Er stond niemand op, dus de optie is weg; uitnodigen gebeurde toch altijd als `member`. Stond er tóch ergens een gast, dan toont de keuzelijst zijn huidige rol nog, zodat die te wijzigen blijft. Wie de rol ooit echt wil, bouwt hem eerst in de regels — met dezelfde kale kopie als bij de socialrol, zodat "ziet geen bedragen" een eigenschap van de database is en geen belofte van het scherm — en zet hem daarna pas terug. `tests/rollen.test.js` houdt beide kanten vast.

Personeel is geen verborgen menu-item maar een eigen rol in de beveiligingsregels: `isTeam()` sluit `staff` uit, en elke planningscollectie hangt daaraan. De interface laat de rest weg omdat de database ze toch weigert — een verborgen knop is geen beveiliging. De app vraagt voor personeel ook geen borden, merken of timers meer op, anders vult hun scherm zich met rechtenfouten in plaats van met een lijst.

Uitnodigen gaat via *Instellingen → Team*, met **Personeel — alleen openen & sluiten** als rol.

---

## Openen en sluiten

De papieren checklist hing aan de muur met bovenaan één naam. In de app is het één lijst per dag waar iedereen in afvinkt: wie later binnenkomt ziet wat de vorige al deed en pakt de rest op.

Dat samen afvinken hangt aan twee keuzes. De run heeft een **vaste id** `<lijst>_<jjjj-mm-dd>`, dus wie de lijst opent opent dezelfde — geen zoeken, geen dubbele runs. En de stand staat in een **map** `items`, gesleuteld op punt-id, zodat een afvinking alleen zijn eigen sleutel schrijft; twee mensen die tegelijk een ander punt aanvinken overschrijven elkaar niet. Bij elk vinkje gaat de naam en het tijdstip mee, wat het papier niet kon.

**Weekendpunten** (de toiletten) staan er ook doordeweeks, zoals op papier, maar tellen dan niet mee in de voortgang — anders staat de lijst nooit op 100%.

**Toegangscodes** staan in het `hint`-veld met `secret: true`: de app toont ze pas na een klik, zodat ze niet zomaar op een scherm staan waar een gast op meekijkt. Een test bewaakt dat er nooit een code in een `label` sluipt, want dat staat altijd zichtbaar.

De lijsten staan in `src/lib/checklist-templates.js` — één bron voor de seed én de demo. Daarna is de database leidend: een beheerder past ze aan in de app en de seed overschrijft dat niet (`merge`).

---

## Klanten

Een klant stond tot nu in de titel van een event — "Trouw Niels en Inez", "Blum België" — en verder nergens. Daarmee is "wat deden we vorig jaar voor Blum", "waar staat hun btw-nummer" en "hebben we hun logo nog" geen van drieën te beantwoorden.

Nu staan ze apart, met bedrijfsgegevens, adres en zoveel contactpersonen als nodig. Een event wijst naar zijn klant en draagt de naam mee (zelfde reden als bij een lijstnaam: Firestore joint niet). Hernoemen gebeurt op één plek; een trigger trekt de nieuwe naam door naar alle events van die klant.

**Documenten** hangen aan een klant óf aan een event, en dat onderscheid is het hele punt: een logo en een huisstijlgids horen bij de klant en niet bij het feest van vorig jaar, een grondplan hoort wél bij dat ene event. Ze staan niet in Firebase Storage maar in een gedeelde Google Drive van JE Concept, met een map per event en een map per klant — zie *Documenten op Drive* hieronder.

### Documenten op Drive

Een grondplan, een offerte van de tentenbouwer, de huisstijlgids van een klant: dat zijn bestanden waar het team ook *buiten* JE Plan bij moet kunnen — op een telefoon op het terrein, in een mail naar een leverancier, door iemand zonder account. Een Storage-bucket achter beveiligingsregels kan dat niet; Google Drive wel, en het team zit er al in. Daarom gaan de documenten naar één **gedeelde Drive** met twee mappen: `Events/<YYYY-MM-DD — titel>` en `Klanten/<naam>`. De map wordt aangemaakt op het moment dat er voor het eerst iets bij dat event of die klant komt, en haar id blijft op het event (`driveFolderId`, `driveFolderLink`) zodat de knop **Map in Drive** altijd klopt, ook na een hernoeming.

De browser praat **niet zelf met Drive**. Een upload gaat als ruwe bytes naar de functie `drive` (`/api/drive/upload`, met het Firebase-ID-token), die het bestand onder de service-account van het project in de juiste map zet en de rij in `attachments` schrijft. Zo hoeft er geen Google-OAuth-scherm in de tool, zijn er geen Drive-rechten per gebruiker te beheren, en kan een rij in `attachments` nooit wijzen naar iets wat er niet staat: de functie schrijft de rij pas als Drive het bestand bevestigd heeft. **Vernieuwen** haalt de map opnieuw op en zet `attachments` gelijk — wat een collega rechtstreeks in Drive zette, staat dan ook op de fiche; wat in Drive verwijderd werd, verdwijnt eruit. Verwijderen vanuit JE Plan zet het bestand in de prullenbak van Drive, niet definitief weg.

**Consulteren** gebeurt in de tool: pdf's, afbeeldingen, Office-bestanden en Google-documenten tonen in een voorvertoning (Drive's eigen `/preview`), de rest opent in Drive. Daarvoor moet wie kijkt wel bij de Drive kunnen — vandaar een gedeelde Drive van de organisatie en niet de Drive van één persoon.

Eenmalig in te richten (ook in `docs/handover-chrome-configuratie.md`, A6): de **Google Drive API** aanzetten in het project `je-planning`; in Google Drive een gedeelde Drive maken ("JE Plan"); de runtime-service-account van de functies — `<projectnummer>-compute@developer.gserviceaccount.com`, te vinden onder Cloud Functions → `drive` → *Details* — toevoegen als **Contentmanager**; en de link van die Drive plakken onder **Instellingen → Documenten** (`config/drive.driveId`). Zonder die laatste stap zegt het documentenblok dat er nog niets ingesteld is en kan er niets geüpload worden; dat is bewust, want een upload die stilletjes nergens heen gaat is erger dan een die weigert. De functie draait in de standaardcodebase: ze heeft geen geheim nodig, enkel het recht van de service-account op de Drive.

Een klant wordt **uit gebruik genomen**, niet gewist, zolang er events aan hangen: anders staat er in de geschiedenis een naam zonder gegevens.

---

## De post van info@jeconcept.be

Een aanvraag komt binnen in een mailbox, en daar blijft ze — samen met de prijsvraag erna, het "kan het ook een week later" en de bevestiging. Wie het dossier overneemt, weet dan niet wat er afgesproken is. Daarom haalt JE Plan die post op en hangt ze aan het juiste event.

**`info@jeconcept.be` is een Google Groep, geen postbus.** Dat bepaalt de hele opzet, dus het staat vooraan: een groep heeft geen IMAP. Er valt niets in te loggen, want er staat niets — een groep bezorgt post aan haar leden en houdt zelf alleen een archief bij dat je enkel in de webinterface ziet.

JE Plan leest daarom niet de groep maar **een postbus die lid is van die groep**. Alles wat naar `info@jeconcept.be` gaat, wordt aan dat lid bezorgd, en dát is een gewone Gmail-postbus met IMAP. In de praktijk is dat `plan@jeconcept.be` — dezelfde postbus waarvandaan de tool verstuurt, dus één adres en één app-wachtwoord. Wat de tool zelf verstuurt komt in Verzonden en niet in Postvak IN, dus ze leest haar eigen berichten niet terug.

**Instellen (dit moet iemand één keer doen):**

1. Google Admin → Groepen → `info@jeconcept.be` → **Leden** → `plan@jeconcept.be` toevoegen, met bezorging **"Elke e-mail"**. Zonder dit komt er niets binnen en lijkt het alsof de ophaler stuk is.
2. In Gmail van `plan@jeconcept.be`: **Instellingen → Doorsturen en POP/IMAP → IMAP inschakelen**.
3. Een app-wachtwoord maken voor dat account en als geheim zetten:
   `firebase functions:secrets:set IMAP_URL --project je-planning` met
   `imaps://plan%40jeconcept.be:<app-wachtwoord>@imap.gmail.com:993`

**Ophalen** doet `functions-mail/postvak.js`, elke vijf minuten over IMAP. Dezelfde afweging als bij het versturen: geen nieuwe leverancier, geen tweede account, geen koppeling die stil kan verlopen. De Gmail-API met push is sneller maar vraagt een OAuth-client, een Pub/Sub-topic en een `watch` die elke week vernieuwd moet worden — en op een groep werkt die API net zomin.

De functie **raakt de mailbox niet aan**. Geen berichten als gelezen markeren, niets verplaatsen: het is een gedeelde postbus waar mensen in werken, en de eerste keer dat hun postvak overhoop ligt, is het vertrouwen weg. Ze onthoudt zelf waar ze gebleven was — het hoogste UID dat ze gezien heeft, in `instellingen/postvak`. Bij de allereerste keer gaat ze veertien dagen terug en niet verder: een postbus die jaren meegaat, bevat duizenden berichten die met geen enkel event te maken hebben.

**Koppelen** gebeurt in `functions/mail-koppeling.js`, en dat staat apart en getest omdat een mail bij het verkeerde event zetten erger is dan hem nergens zetten. De volgorde loopt van zeker naar waarschijnlijk:

1. **De draad.** `In-Reply-To` en `References` wijzen naar post die wij zelf naar de klant stuurden. Die koppen komen van het mailprogramma van de klant en overleven de tocht door de groep, dus dit is exact.
2. **Een plusadres.** Een adres van de vorm `plan+e<eventId>@jeconcept.be` draagt het event met zich mee. Let op: dit geldt alleen voor de postbus, niet voor de groep — Google Groups kent geen plusadressering en `info+e123@` bouncet. De regel staat er omdat ze gratis is, niet omdat we erop rekenen.
3. **De afzender.** Het adres hoort bij een klant (op de fiche of bij een contactpersoon) die precies één lopend dossier heeft. Heeft hij er meer, dan koppelen we niet — kiezen tussen twee dossiers van dezelfde klant is precies waar het misgaat.

Post die JE Plan naar een klant stuurt, krijgt `Reply-To: info@jeconcept.be`: het antwoord hoort in de groep, waar het team het ook wil zien. Het event hoeft niet in dat adres, want de draad draagt het al.

Wat overblijft staat in **Aanvragen**, onder Events. Meestal is dat een nieuwe klant die schrijft: er is nog geen event om het aan te hangen. Wat er uit de mail te lezen valt staat er al bij (zie hieronder), en met één knop wordt het een event met de mail erbij.

Op het event staat de hele draad onder het tabblad **Mail**: wat binnenkwam en wat JE Plan zelf naar de klant stuurde. De tekst wordt getoond zoals ze aankwam, zonder opmaak — HTML van een willekeurige afzender in je eigen scherm laden is precies hoe een mail meer doet dan tonen wat erin staat. Bijlagen worden genoemd maar niet gekopieerd; die blijven in de mailbox.

---

## De offerte

Een aanvraag komt binnen als proza — "mijn mama wordt op zaterdag 28 november 65 jaar, we denken aan een 40-tal personen, een gezellige winterbarbecue" — en daar zit alles in wat een dossier nodig heeft. **Nieuw event → Uit een mail** leest die tekst: datum, aantal, soort feest, de formule uit jullie eigen lijst, de eigen zaal als de klant er een noemt, de afzender, en de vragen die erin staan.

Dat lezen gebeurt in `src/lib/aanvraag.js`, zonder model en zonder sleutel, en dus te testen: dezelfde mail geeft altijd hetzelfde antwoord. De regels die ertoe doen staan daar met hun waarom — het aantal moet bij "personen" of "gasten" horen (anders wordt "65 jaar" vijfenzestig gasten), bij een vork nemen we het laagste, een vage tijdsaanduiding is geen datum, en alleen de eigen zalen tellen als locatie. Het scherm toont geen ingevuld formulier dat doet alsof het klopt, maar wát het gelezen heeft, met erbij wat het gókte. Een taalmodel mag daar later bovenop komen voor de nuance die een regel nooit vangt; de tool moet blijven draaien op een dag dat een API eruit ligt.

**De offerte zelf staat op het tabblad Offerte van een event, en ze staat er vanzelf.** Een offerte die je eerst moet aanmaken, wordt een offerte die je vergeet. Ze wordt uitgerekend uit de formule (die levert posten met hun eigen tarief: eten 12%, drank 21%) of, als er alleen een offertebedrag is, uit die ene prijs die dan gesplitst wordt — 70% spijzen, 30% dranken. Precies de regel waar het in de oude Canva-offertes misliep: één tarief op alles.

Het blijft een draft: elke lijn is aan te passen — omschrijving, rubriek, aantal, prijs, tarief — en het blad dat de klant krijgt staat er meteen onder, zodat je ziet wat een wijziging met het document doet.

**Eén layout, geen tweede waarheid.** `src/styles/offerte.css` is het blad: de app rendert het, de afdruk gebruikt het, en straks doet de publieke goedkeuringspagina dat ook. Het hangt met opzet niet aan de tokens van de rest van de app maar draagt zijn eigen, zodat het ook buiten de app klopt. `npm run offerte:voorbeeld` tekent niets zelf: het opent de app, laat haar een offerte renderen en knipt het blad eruit zoals het daar staat. Verandert het blad, dan verandert het voorbeeld mee — of het klopt niet meer en dat merk je meteen.

### Het conceptvoorstel

Een offertetabel beantwoordt één vraag: wat kost het. De vraag die de klant eerst stelt, is een andere — wat krijg ik dan. Daar wint of verliest JE Concept, want prijzen liggen bij elke cateraar in dezelfde buurt en het verhaal eromheen niet.

Elke offerte draagt daarom een **voorstel**: cover, *Wie zijn wij* met het voorstel in één oogopslag, de onderdelen twee per pagina, en achteraan de tabel met de btw. Dat is de opbouw van het Canva-sjabloon waar ze al jaren mee werken, dus elke klant die eerder iets kreeg, herkent ze.

Het is geen tweede document naast de offerte maar een andere lezing van dezelfde regels: een onderdeel zonder eigen prijs haalt zijn bedrag uit de offerteregels van dezelfde rubriek. Verander je een lijn in de tabel, dan verandert de pagina mee. Wie voor één onderdeel toch een eigen bedrag wil — een ontvangst en een hoofdgerecht die allebei onder catering vallen — vult dat veld in en dat gaat voor. De onderdelen staan in `onderdelen` op de offerte en worden bewerkt op hetzelfde tabblad; `src/lib/voorstel.js` doet het rekenwerk en de pagina-indeling.

> De klantenpagina opent pas **nadat de offerte verstuurd is**. Een concept weigert `functions/portaal.js` met opzet: een link die per ongeluk vertrekt, hoort geen bedragen te tonen waar nog aan gerekend wordt. De knoppen *Link kopiëren* en *Openen* staan daarom uit zolang de offerte een concept is, met de reden erbij.

> Let op bij het rekenwerk: `centen()` uit `formules.js` geeft **euro's** terug, afgerond op de cent — geen centen. De naam is verraderlijk. Wie daar nog eens door honderd deelt, zet €163,99 waar €16.399 hoort te staan.

---

## Werk dat vanzelf terugkomt

De tool kende twee soorten herhaling: de punten van een dagelijkse lijst (het poetsplan — die hangen aan een rol, niet aan een persoon) en de taken van een eventtemplate (die hangen aan de datum van een event). Wat ertussen viel, bestond niet: administratie die elke week of elke maand terugkomt en aan één persoon hangt. Dat werd onthouden, en wat onthouden wordt, wordt vergeten.

**Instellingen → Herhalingen.** Een herhaling is een recept, geen taak: titel, voor wie, op welk bord (of op de socials), en het ritme. Er staat telkens bij wanneer ze de volgende keer valt — "elke maandag" kan iedereen typen, of het ook maandag 6 oktober wordt is wat je wil weten voor je het scherm sluit. Uitzetten kan zonder weggooien, zodat een maand pauzeren niet betekent dat je ze opnieuw moet instellen.

De taken worden **'s nachts** neergezet door een geplande functie, en niet door de browser: een herhaling die pas verschijnt zodra iemand inlogt, komt te laat op precies de dag dat ze nodig was. Elk document krijgt een vast adres (`h-<herhaling>-<datum>`), dus een herstart of een tweede beurt schrijft hetzelfde document in plaats van een tweede taak.

De datumlogica staat twee keer — in `src/lib/herhaling.js` voor het scherm en in `functions/herhalingen.js` voor de planner, want de functies worden apart uitgerold en kunnen niet uit `src/` importeren. `tests/herhalingen.test.js` legt die twee een heel jaar lang naast elkaar; loopt er één uit de pas, dan valt die test om in plaats van iemands weekplanning.

Een dag van de maand gaat nooit boven de 28. Een herhaling op de 31e slaat februari over en vier maanden per jaar, en dan is het geen maandelijkse herhaling meer maar een herhaling die soms komt.

---

## De planning van een event

Naast de pijplijn staat een eigen veld: **Planning** — *nog te plannen · bezig · rond · niet nodig*. Het stond eerder als subtaak ("Personeelsplanning") in de templates, en dat werkte niet. Een taak is af of niet af, terwijl planning een toestand is die weken duurt; en een taak zie je alleen als je het event opent — precies niet waar je hem nodig hebt.

Het staat náást de pijplijn en niet erin, want die twee lopen niet gelijk: de pijplijn zegt waar het dossier tegenover de klant staat (aanvraag, offerte, akkoord, factuur), de planning zegt of het intern rond is. Een event kan gefactureerd zijn terwijl het personeel al lang geregeld was, en nog op "offerte verstuurd" staan terwijl het materiaal al besproken is.

De stand kies je op de fiche en ze komt terug op het bord, in de lijst, op het dashboard en als tweede stipje in de kalender. Er is géén standaardwaarde: zou elk event bij het aanmaken op "nog te plannen" staan, dan kreeg elk afgelopen dossier uit de migratie diezelfde badge en zei ze niets meer. De badge verschijnt zodra iemand ze zet — en dan betekent ze iets. Om diezelfde reden verschijnt het filter op de eventpagina pas wanneer er ergens een stand gezet is.

---

## Het magazijn

Verhuurmateriaal werkt niet als voorraad, en dat verschil zit in het datamodel. Een tent gaat niet op: ze is bezet van vrijdag tot maandag en daarna weer vrij. "Hoeveel tenten heb ik" is dus geen getal maar een getal per dag, en de vraag die iemand werkelijk stelt — *kan ik er twee op dat weekend* — lees je alleen af van een tijdbalk. Vandaar dat **Materiaal** een kalender is en geen lijst.

Twee collecties. `materiaal` is wat je bezit, met de prijsstaffel en een **uitlooptijd** per artikel: dagen na de huur waarop het stuk nog niet opnieuw inzetbaar is, want het komt vuil en op een camion terug. `reservaties` is wat erop vastligt, met `van`, `tot`, een aantal en een status (*vast* of *in optie*).

**Reservaties staan apart en niet als lijstje op het event.** Dat is de beslissing waar de hele module op rust: dezelfde voorraad wordt van twee kanten aangesproken — een eigen event, en straks een aanvraag van de verhuursite. Stond ze op het event, dan was er geen plek waar die twee samenkomen, en dan ziet niemand een dubbele boeking aankomen tot de camion half geladen is.

**Beschikbaarheid over een periode is het minimum over de dagen**, niet het gemiddelde en niet de eerste dag. Vier vrij op maandag en nul op dinsdag is niet "gemiddeld twee": het is niet beschikbaar. Dat klinkt vanzelfsprekend en is precies de fout die zo'n module stilletjes maakt; `tests/voorraad.test.js` houdt hem tegen.

Een **overboeking** wordt niet geweigerd. Wie tóch wil vastleggen moet dat kunnen — je huurt bij, of je belt de andere klant — want een slot dat niet opengaat, leidt tot een reservatie die iemand buiten de tool om maakt, en dan klopt de kalender zeker niet meer. Ze komt bovenaan het scherm te staan als iets wat iemand moet oplossen, met hoeveel er tekort is, en blijft daar tot het opgelost is.

**Geboekt en buiten zijn twee verschillende dingen.** Een reservatie loopt *in optie → vast → uit → terug*, dezelfde reeks als waar de tafelreservaties straks op draaien (zie het component Reservatiestand in het design system). Zonder *uit* zegt de kalender dat een tent vrij is terwijl ze op een veld staat. En komt een stuk vroeger terug dan geboekt, dan geeft *terug* de dagen ertussen weer vrij — de uitlooptijd begint dan te lopen vanaf de dag dat het echt binnenkwam. Te laat terug verlengt de reservatie niet; dat is een gesprek met de klant, geen reden om de kalender te laten schuiven.

Op de eventfiche staat een tabblad **Materiaal**: wat er voor dit dossier vastligt, met de knoppen om het buiten te zetten en terug te melden, en eronder een kiezer die vóór het vastleggen zegt of het past.

Een **optie** die verlopen is, laat vanzelf los. Zonder dat houdt één prijsvrager van vorig jaar een weekend bezet en belt er niemand over, want er lijkt niets mis.

Wat met opzet **niet** naar de verhuursite gaat: de inkoopwaarde en de leverancier. Die horen bij de inkoop en niet bij de klant. De publieke feed wordt daarom een selectie die een functie maakt, geen doorgeefluik van het document.

---

## Online afrekenen voor losse verhuur

Een deel van het magazijn kan een klant zelf huren: statafels, koelkasten, terrasverwarmers — wat iemand met een bestelwagen komt halen. Een partytent niet, want die moet geplaatst worden. Dat onderscheid staat **per artikel** (`directTeHuren`) en niet per bedrag, want niet alles wat goedkoop is, is eenvoudig. Zonder dagprijs kan het vinkje niet aan: er valt dan niets af te rekenen.

**De prijsstaffel heeft één regel die niemand verwacht: je betaalt nooit meer dan de eerstvolgende grotere staffel.** Zes dagen kost hoogstens een week, en een periode van drie dagen die in een weekend valt kost hoogstens het weekendtarief. De vanzelfsprekende som — dagen maal dagprijs — maakt zes dagen duurder dan zeven, en een klant die dat nareekent belt. Hij heeft gelijk. `src/lib/huurprijs.js` geeft daarom altijd de goedkoopste geldige combinatie, en in het artikelformulier staat een voorbeeldrij die laat zien wat 1, 3, 6 en 7 dagen kosten — zodat een verkeerd gezette weekprijs opvalt vóór ze online staat.

**De waarborg staat buiten de btw en buiten de omzet.** Het is geld dat je vasthoudt en teruggeeft, geen opbrengst. Bij het factuurbedrag optellen is een boekhoudkundige fout die pas bij de afsluiting opvalt. In de afrekening staat hij wél, als aparte regel met de btw ernaast — tel je de regels op, dan staat er precies wat er van de kaart gaat.

**De korting staat op de klant** (*Klanten → Korting verhuur*) en geldt alleen op materiaal; op catering is de marge te dun voor een vast percentage. Ze geldt ook wanneer die klant zelf op de verhuursite afrekent — anders is het antwoord op "wat kost dat" een ander naargelang wie het vraagt.

> **Eén open rand, met opzet zo gelaten.** De korting wordt online opgezocht op het e-mailadres dat de bezoeker intikt, en dat adres is nog niet bewezen. Wie het adres van een klant met korting kent, krijgt diens percentage. Het gaat om vijf tot vijftien procent op een huur die in de backoffice zichtbaar binnenkomt, dus de schade is klein en zichtbaar — maar het is een gat. Het sluit zodra de verhuursite het klantenlogin uit het ontwerp krijgt. De andere keuze, online géén korting geven, levert een prijs op die niet klopt met wat aan de telefoon gezegd wordt, en dát merkt de klant wél.

### Hoe het afrekenen loopt

De betaalfuncties staan in een **vierde codebase**, `functions-betaling/`, om dezelfde reden als de mail en het overleg: ze hangen aan een geheim, en een functions-uitrol faalt in zijn geheel op één ontbrekend geheim. Stond Stripe bij de andere functies, dan nam een ontbrekende sleutel het archief, de agendafeed, AAPI, het portaal en het inloggen van de ploeg mee. Nu staat alleen de knop "online huren" stil, en zegt de uitrol dat ook.

Twee geheimen, allebei nodig:

```
firebase functions:secrets:set STRIPE_SECRET --project je-planning
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project je-planning
```

De gang van zaken:

1. De verhuursite stuurt **artikelnummers, aantallen en een periode** — geen bedragen.
2. De server zoekt de prijzen zelf op, kijkt na of het past, en rekent zelf na. **Wat er uit de browser komt is een wens, geen bedrag.** Wie het formulier openzet in zijn browser kan elk veld veranderen dat meegestuurd wordt; zat de prijs daarbij, dan huurt iemand een tent voor één euro en heeft hij een geldig betaalbewijs.
3. Het materiaal gaat meteen **in optie**, met een vervaldatum een halfuur later. Reserveren pas ná de betaling zou betekenen dat in die minuten iemand anders dezelfde laatste tent koopt — en dan hebben er twee betaald voor één.
4. Stripe meldt de afloop via een webhook. Betaald → de optie wordt vast. Niet betaald → de optie vervalt, en de voorraad komt vanzelf terug.

**De handtekening op de webhook is het halve verhaal.** Dat adres is openbaar; zonder controle kan iedereen die het kent een "betaald" posten voor een order die nooit betaald is. En een geldige handtekening zegt alleen dat Stripe het stuurde, niet dat het juiste bedrag binnenkwam — klopt het bedrag niet met wat wij berekenden, dan gaat de order naar **Nakijken** in plaats van door. Liever een telefoontje dan een stille fout in de boekhouding.

**De kassa is strenger dan de backoffice, en dat is geen inconsistentie maar het punt.** In de backoffice mág je overboeken: je huurt bij of je belt de andere klant. Een vreemde op zijn telefoon kan geen van beide, dus daar is "te weinig" een weigering. Twee modules met opzet — `src/lib/voorraad.js` en `functions-betaling/vrij.js` — want het verschil zit niet in een instelling maar in wat het antwoord betekent. Wat wél gelijk moet blijven is het *tellen*, en `tests/betaalmotor.test.js` legt beide implementaties dezelfde gevallen voor. Die test heeft zich meteen terugbetaald: de serverversie liet een teruggebrachte tent zijn wasdag vallen en zou hem die dag verkocht hebben.

De prijsmotor staat twee keer op schijf — `src/lib/huurprijs.js` en `functions-betaling/huurprijs.js` — omdat een Cloud Functions-codebase niets uit `src/` mag halen. Dezelfde test eist dat de twee bestanden **letterlijk gelijk** zijn. Pas je er een aan, kopieer dan; pas ze niet allebei aan.

---

## Messaging: één ingang voor alles van buiten

Wintermoods, de verhuursite, en straks Bar Vue en Feestbeest sturen elk aanvragen, boekingen en betalingen naar JE Plan. Verwerkt elke bron dat op haar eigen manier, dan staan er na een jaar vijf manieren om "er is iets binnengekomen" te zeggen, en vijf plekken waar een bericht stil kan verdwijnen. Daarom is er **één ingang** en **één log**.

**De ingang** is `POST /api/messaging` op de backoffice-site (`functions-messaging/`). Elke bron stuurt dezelfde envelop: `bron`, `soort` (`reservatie.aangevraagd`, straks `huur.betaald`, `offerte.aangevraagd`, …), `sleutel` (het kenmerk aan de kant van de bron), optioneel `tijdstip` en `taal`, en een `inhoud` per soort. De ingang leest alleen de envelop; de inhoud is voor de verwerker van die soort. Het oude platte Wintermoods-formulier blijft op `/api/wintermoods` werken als alias en wordt daar in de envelop gestoken.

**De log** is de collectie `messaging`: document-id `<bron>-<sleutel>`, geschreven met `create`. Dezelfde inzending die twee keer vertrekt, levert één rij op en krijgt `herhaald: true` terug; de afzender hoeft niet te weten dat hij dubbel stuurde. Rijen veranderen nooit; alleen `verwerking.<naam>` wordt bijgewerkt. Niemand schrijft er vanuit de browser, een beheerder leest ze.

**De verwerkers** zijn Firestore-triggers op `messaging/{id}` in de standaardcodebase (`functions/messaging-verwerking.js`), elk met een eigen naam en een eigen stand op het bericht: `klaar` met wat hij maakte, `fout` met de reden en het aantal pogingen, of `overgeslagen` als de soort niet voor hem is. Een trigger kan twee keer vuren, dus elke verwerker kijkt eerst of hij al klaar is; herspelen is zijn stand wissen. De eerste verwerker is **event**: een `reservatie.aangevraagd` wordt meteen een kaart in de kolom *request* — geen aanvraagrij zoals bij de verhuur, want zo'n aanvraag ís al een datum met een aantal personen en een formule. De kaart heet `wm-<sleutel>` en wordt met `create` geschreven, zodat een kaart die het team intussen verplaatste niet terugspringt. Komt er een verwerker bij (melding, mail, logboek, Lightspeed, boekhouding), dan leest hij dezelfde log.

**Waarom geen broker.** Dit is wat Kafka of Pub/Sub zou doen — een duurzame log, losse consumers, replay, één rij per sleutel — zonder iets extra te draaien: het volume is een handvol per dag en Firestore-triggers zijn de consumers. Groeit het, of komen er consumers buiten JE Plan, dan komt Pub/Sub tussen de ingang en de log en blijven envelop en verwerkers dezelfde.

**Het geheim.** De afzenders zijn servers, geen mensen. Elke bron heeft haar eigen token, samen in één geheim `MESSAGING_TOKENS` (een JSON-object `{"wintermoods": "…"}`): een gelekt token legt één bron stil, en een bron erbij is een regel in een geheim, geen nieuwe uitrol. De vergelijking is tijdsconstant; een verkeerde token krijgt 401 en verder niets. Daarom staat de ingang in een **eigen codebase** en niet bij de standaardfuncties (zie *Waar je op stuk loopt* in CLAUDE.md): zolang het geheim niet bestaat, slaat de uitrol ze over met een waarschuwing en blijft de rest live. `tests/codebases.test.js` bewaakt dat elke codebase met een geheim in beide workflows achter `geheim.sh` staat; `tests/messaging.test.js` legt de envelop, de tokens en de kaart vast.

Aan de kant van Wintermoods (repo `Kenjeklanten/feestbeest`) heet de token `WM_JEPLAN_TOKEN` en het adres `WM_JEPLAN_URL`; de inrichting staat als stap A7 in `docs/handover-chrome-configuratie.md`.

**Als een verwerker faalt.** Een geplande functie probeert elk kwartier de berichten met stand `fout` opnieuw, zolang ze jonger zijn dan zeven dagen en nog geen drie pogingen hadden (`functions/messaging-stand.js` zegt wat herkansbaar is; de test legt het vast). Een eventlijst die even niet te lezen was, is een kwartier later meestal terug. Na de derde mislukking stopt de herkansing en krijgen de beheerders één melding (soort `messaging`, push én mail): een bericht dat drie keer faalt, heeft een mens nodig, en een vierde poging zonder mens is dezelfde fout voor de vierde keer. Herkansing en trigger raken elkaar niet: een bericht zonder stand is van de trigger, een bericht met `fout` van de herkansing.

**Instellingen → Messaging** toont de laatste honderd berichten met per verwerker de stand: klaar met een link naar de kaart, mislukt met de fout en het aantal pogingen, of niet van toepassing. De knop **Herspelen** laat de verwerker opnieuw lopen via de callable `messagingHerspelen` (alleen beheerders): de log zelf blijft onveranderlijk voor de browser, en dat hoort zo. Herspelen begint de telling opnieuw, ook voor een bericht dat al vastgelopen was.

---

## De verhuursite

`rental.jeconcept.be` is een eigen applicatie: `verhuur/` in deze repository, een eigen Vite-build (`npm run build:verhuur`), een eigen uitgang (`dist-verhuur`) en een tweede hosting-site. Ontwikkelen doe je met `npm run dev:verhuur` op poort 5174.

**Waarom één repository en twee builds.** JE Plan gaat er overal van uit dat wie kijkt erbij hoort; deze pagina is van iedereen. Eén bundel van beide zou de logica van onze marges, loonkosten en leveranciers meeleveren aan elke bezoeker — niet leesbaar als gegevens, wel als code, en dat is genoeg om er conclusies uit te trekken. Twee builds kunnen dat niet: wat niet geïmporteerd wordt, staat er niet in.

Maar een eigen repository zou betekenen dat het design system en de prijsmotor gekopieerd worden, en een kopie staat na een maand op twee manieren. Nu deelt de site `src/styles/je-ds.css` en `src/lib/huurprijs.js` rechtstreeks — precies de twee dingen die hetzelfde móéten zijn. **`tests/verhuur-bundel.test.js` is wat die keuze verantwoord maakt:** het weigert elke import uit `@data/`, `@components/`, `@context/` of `@ui/`, en elke verwijzing naar de Firebase-SDK.

**De site praat niet met Firestore.** Ze kent geen projectsleutel en heeft geen SDK aan boord. Ze stelt vragen aan `/api`, en de hosting-site schrijft die door naar de functies — dus alles is van dezelfde herkomst en er is geen CORS-lijst te onderhouden. Dat is geen stijlkeuze: een browser leest altijd een *heel* document, dus een directe Firestore-lezing zou de inkoopwaarde en de leverancier van elk artikel in het netwerkpaneel van elke bezoeker zetten, ook met de strengste regels — die gaan over documenten, niet over velden.

Welke velden het pand verlaten, staat op één plek: `functions/verhuur-aanbod.js`, als een **witte lijst**. Dat is met opzet de omgekeerde kant op van wat vanzelf gaat. Een zwarte lijst is één veld achter: zet iemand volgende maand `marge` op een artikel, dan staat dat de dag erna op een openbare pagina en merkt niemand het.

Drie adressen, allemaal in de standaard-codebase omdat er geen geheim aan hangt:

| | |
|---|---|
| `GET /api/verhuur/aanbod` | wat er los te huren is, gesorteerd op categorie |
| `GET /api/verhuur/beschikbaar?van=&tot=` | per artikel het aantal vrije stuks, het **minimum over de dagen** |
| `POST /api/verhuur/aanvraag` | een offerteaanvraag, voor alles wat niet zomaar de deur uit kan |

Ze staan er los van `functions-betaling/` omdat die aan Stripe-geheimen hangt: een verhuursite die níéts toont is erger dan een die toont maar nog niet laat afrekenen, en een offerteaanvraag is vaak het begin van een opdracht van duizenden euro's. Ontbreekt Stripe, dan blijft de etalage gewoon staan.

**Een vol artikel verdwijnt niet.** Het blijft in de lijst met "volzet op deze datum". Weg laten zou de bezoeker laten denken dat we het niet hébben, en dan belt hij niet eens — terwijl een andere datum of bijhuren vaak gewoon kan.

**Aanvragen komen in het postvak**, naast de losse mail, en niet op een eigen scherm: het is hetzelfde werk, namelijk bellen en er een dossier van maken als het doorgaat. Ze worden niet meteen een event — de meeste worden een telefoontje en een deel wordt niets, en een bord dat je moet wegfilteren gebruikt niemand meer.

Het formulier heeft een **lokvakje** in plaats van een captcha: een verborgen veld dat een mens nooit invult. Vult iets het toch in, dan zeggen we vriendelijk "dank u" en schrijven we niets weg — een bot die een fout krijgt, probeert het opnieuw met een andere vorm. Een captcha kost elke eerlijke bezoeker tijd, en voor dit volume is dat middel erger dan de kwaal. Loopt het uit de hand, dán is het moment om er een te zetten.

**Foto's** (vraag 9) upload je op het artikelformulier. Ze worden in de browser verkleind tot 1600 pixels en als JPEG opgeslagen onder `materiaal/<id>/foto.jpg` — in de browser en niet op de server, want dan gaat er 300 kB over de lijn in plaats van 12 MB, en op een telefoon in het magazijn is dat het verschil tussen "klaar" en "ik probeer het straks thuis". De site krijgt de download-URL met token, geen pad: ze heeft geen Storage-SDK en hoort die niet te krijgen. Zonder foto toont de site de categorie in de huisletter als plaatshouder — een keuze, geen gat.

**De waarborg terugstorten** (vraag 3) doe je met een knop op de betaalde order in het magazijnscherm, met een bedrag dat je inhoudt voor schade; de rest gaat in één keer terug naar dezelfde kaart. Een knop en geen automatisme bij "is terug": dát is het moment waarop iemand de tent uitrolt en de scheur ziet, en daar is de waarborg voor. Alleen een beheerder mag het — dit is de enige handeling in de tool die geld laat vertrekken — en het logboek legt vast wie het was. De server schrijft eerst het document en roept dan Stripe aan, niet omgekeerd: mislukt het schrijven ná een geslaagde terugstorting, dan is er geld bij de klant zonder spoor bij ons, en een tweede klik stort nog eens.

**De laadlijst** staat op het magazijnscherm: per dag wat buiten gaat en wat terugkomt, gegroepeerd per klant en niet per artikel — zes statafels voor Peeters en vier voor Blum zijn geen tien statafels maar twee stapels op twee plekken in de camion. Ze is printbaar: een telefoon in een nat magazijn is een telefoon die valt, een A4 op een klembord is wat er werkelijk gebruikt wordt.

**Na een betaling** gebeuren drie dingen buiten de transactie, en alleen als die werkelijk iets omzette (Stripe stuurt hetzelfde bericht gerust twee keer): de klant komt in het klantenboek als hij er nog niet staat, hij krijgt een bevestiging met kenmerk en afhaalafspraak, en de beheerders krijgen een mail. Alles via `mailQueue`, dus pas verstuurd zodra `SMTP_URL` er is — tot dan lees je ze daar.

Wat er daarna in JE Plan gebeurt, staat niet bij de betaling maar in `functions/verhuur-orders.js`, in de standaard-codebase: **een betaalde huur wordt een event in de kolom *planning ongoing***, met de reservaties op zijn tabblad Materiaal — er is geen aanvraag, offerte of akkoord meer af te wachten, er is betaald. En de beheerders krijgen een **pushmelding**, net als bij een aanvraag van de site (meldingsoort *Verhuursite*, standaard aan). Twee redenen om dat daar te zetten en niet bij Stripe: die codebase wordt overgeslagen zolang de sleutels ontbreken, en een aanvraag die dan geen melding oplevert is een gemiste opdracht; en het bord, zijn kolommen en de pushtokens zijn de wereld van de standaard-codebase.

**Snelheid.** De lettertypes staan in `verhuur/public/fonts/` en komen niet van Google: dat scheelt een DNS-opzoeking en een verbinding vóór er één letter staat, en het scheelt een privacyvraag. De pagina's na de catalogus laden pas wanneer iemand erheen gaat.

Gemeten, niet beweerd — `npm run smoke:verhuur` drukt het af bij elke run: eerste verf na **80 ms** op de testmachine, en **niets van buiten**. Over de lijn gaat gecomprimeerd zo'n 180 kB: 58 kB JavaScript (bijna alles React en de router; de eigen code is een paar kilobyte), 7 kB stijlen en 115 kB lettertypes. Die lettertypes zijn nu het grootste stuk, en dat is een bewuste afweging: de huisstijl heeft drie gewichten Oswald en twee Source Sans nodig, en ze blijven een jaar in de cache. Het cijfer dat de test zelf toont (284 kB) is zónder compressie, want de testserver doet die niet; Hosting wel.

Wat er nog te halen valt: de 30 kB stijlen van het design system, waarvan de site het meeste niet gebruikt. Bewust gelaten — een gesnoeide kopie is precies het soort kopie dat verloopt.

**Een preview om op te commenten** maak je met `npm run build:verhuur:demo`: dezelfde bundel, met `verhuur/src/lib/api.demo.js` in de plaats van de echte `/api` — zes artikelen, bezette dagen, een ingelogde klant (`/#/login/demo`) met twee huren en 10% korting, en een afrekening die niet naar Stripe gaat. Hekje-routes en relatieve paden, zodat het als artifact onder een willekeurig pad werkt. Het is de echte site tegen een nagebootste server, niet een tekening ervan.

`npm run smoke:verhuur` loopt de site door zoals een klant dat doet — catalogus, artikel, mand, afrekenen, de aanvraag — met een nagebouwde `/api` die precies de vorm teruggeeft die de functies geven, want die vorm is het contract. De laatste vijf tests doen hetzelfde op 390 pixels: deze site wordt vaker in een tuin op een telefoon geopend dan achter een bureau.

---

## Wat een event opbracht, en wat het kostte

Van elk dossier stond vast wat het opbracht en van geen enkel wat het kostte. Daardoor was "verdient een BBQ van veertig personen eigenlijk iets" een gesprek over gevoel. Op de fiche staat nu, onder de velden, **Opbrengst en kosten**: het offertebedrag min de ploeg, de inkoop en de eigen uren, alles exclusief btw.

De drie kosten komen uit gegevens die er al stonden. **De ploeg** zijn de shifts uit AAPI die aan het event hangen, per statuut opgeteld en vermenigvuldigd met een uurkost die je zet in *Instellingen → Marge*. **De inkoop** is de bestellijst maal de inkoopprijs per besteleenheid, een veld dat nu bij elke bestelregel staat, samen met de leverancier. **De eigen uren** zijn wat het team op dit event boekte, tegen het uurtarief op hun profiel.

**Een ontbrekend bedrag telt niet als nul.** Dat is de regel waar het hele blok op staat. Een bestellijstregel zonder inkoopprijs kost niet niets — we weten alleen niet wat ze kost. Zou ze als nul meetellen, dan ziet een half ingevuld dossier er winstgevender uit dan een volledig ingevuld, en dat is precies de kant op waarin niemand de fout merkt. Dus telt ze niet mee, heet het blok *Onvolledig*, en staat de marge er als **"hoogstens"** met eronder wat er ontbreekt en waar je het zet.

**De loonkost is een raming, geen loonstaat.** De uurkost per statuut is een kengetal — wat een uur van een flexi de zaak kost, alles inbegrepen — en geen bedrag dat iemand uitbetaald krijgt. Daarom staat het altijd per statuut opgeteld en nooit per persoon, en daarom staat er standaard niets ingevuld: een verzonnen uurkost geeft een marge die eruitziet als een meting. Wie wat verdient staat in AAPI en blijft daar.

Het blok is zichtbaar voor beheerders. Uurkosten liggen dicht genoeg bij personeelsgegevens om ze niet voor het hele team open te zetten; wil je dat anders, dan is dat één regel in `EventDetail.jsx`.

---

## Personeel komt uit AAPI, en alleen daaruit

**Beschikbaarheid, contracten, statuten, Dimona, arbeidsuren en loon horen in AAPI.** JE Plan leest die gegevens en toont ze; het schrijft ze niet, rekent ze niet opnieuw uit en biedt er geen eigen invulscherm voor.

Dat is een harde regel en geen voorkeur. Twee bronnen voor dezelfde vraag betekent dat er een dag komt waarop ze verschillen, en dan is niet meer te zeggen wie gelijk had. Bij een planningsconflict kost dat een misverstand; bij een contract of een Dimona-aangifte kost het een boete, en dan staat er in twee systemen iets anders over wat iemand gewerkt heeft.

In de code: `aapiShifts`, `aapiEmployees`, `aapiImportRuns` en `aapiImportQueue` staan op `allow write: if false` — schrijven doet alleen de import, server-side. Er komt geen collectie voor beschikbaarheid, contracten, uurroosters, Dimona of loon bij. `tests/aapi-grens.test.js` bewaakt allebei, en `CLAUDE.md` legt uit waarom, zodat de volgende die het handig vindt eerst de reden leest.

Wat JE Plan wél doet: tonen wie er volgens AAPI gepland staat, daar een event aan koppelen (via een functie, met wie het koppelde in het log), en de **loonkost van een event ramen** op basis van wat AAPI zegt. Ramen is niet vastleggen — de marge hieronder is een planningscijfer, geen loonstaat.

De tijdsregistratie in JE Plan gaat over *waar* iemand aan gewerkt heeft — welk event, welke taak. Dat is een planningsgegeven, geen prestatiestaat, en het wordt niet naar AAPI geschreven.

---

## De locatie van een event

Het locatieveld is een tekstveld met Google Maps eronder. Typen mag altijd — "bij de klant thuis" en "nog te bepalen" zijn geldige antwoorden — maar wie een echt adres kiest, koppelt de plek eraan vast. Naast de tekst komen dan `locationPlaceId`, `locationLat` en `locationLng` op het event te staan, en opent de knop *Op de kaart* exact die zaal in plaats van de eerste met dezelfde naam. Typt iemand de tekst daarna met de hand over, dan gaan die drie mee weg: coördinaten die niet meer bij de tekst horen, sturen het team naar het verkeerde adres.

De tekst blijft de bron voor de offerte, de agenda-uitnodiging en de zoekbalk; de coördinaten zijn er alleen voor de kaart. Ook de socialrol krijgt ze mee (`functions/social-projectie.js`) — wie de beelden maakt, moet er geraken.

Er wordt geen Maps-SDK geladen: de Places API (New) antwoordt op een gewone `fetch`, dus vraagt `src/lib/kaart.js` de adressen zelf op en tekent het scherm de lijst met dezelfde bouwstenen als de rest van de tool. Een verzoek vertrekt pas na 260 ms stilte en vanaf drie letters; wordt de sleutel geweigerd (4xx), dan stopt het veld met vragen en is het weer gewoon tekst.

**Aanzetten.** Google Cloud Console → *APIs & Services* → **Places API (New)** aanzetten → *Credentials* → **Create API key**, en die sleutel beperken tot HTTP-verwijzers (`https://planning.jeconcept.be/*`). Daarna als GitHub-secret **`VITE_GOOGLE_MAPS_API_KEY`** zetten en opnieuw uitrollen. Zonder de sleutel bouwt en draait alles gewoon: geen adressenlijst, wel gewoon typen, en de kaartknop zoekt dan op de tekst.

---

## Het archief

Een afgesloten event gaat van het bord af en nergens anders heen. Er wordt niets verplaatst en zeker niets gewist: een dossier draagt offertebedragen en facturatiegegevens, en die horen te blijven bestaan, ook als niemand ze nog nodig heeft. "Archief" is hier alleen een uitspraak over waar iets getoond wordt.

De regel is met opzet twee regels, want "klaar" gebeurt op twee manieren. Iemand zet het event op **`complete`** — dat is een uitspraak, en die volgen we meteen. Of er is **gefactureerd** en de factuur is ouder dan zestig dagen: zo gaat het in de praktijk, er wordt gefactureerd en daarna kijkt niemand er nog naar. Een factuur staat op dertig dagen; na het dubbele daarvan is een openstaande betaling een zaak voor de boekhouding en geen planningswerk meer. `ready to invoice` staat er niet tussen, hoe oud het ook is — daar moet nog iemand iets doen, en dat verstoppen zou de factuur verstoppen. Bij een meerdaags event telt de **laatste** dag: een festival van drie dagen is niet voorbij omdat het begonnen is.

**De server beslist dat, niet de browser.** Dat was eerst andersom, en dan moest de app élk event ophalen — ook het trouwfeest van twee jaar geleden, met al zijn taken — om er daarna de helft van te verbergen. Dat werkt bij tachtig events en niet bij vijfhonderd: een tragere start, meer geheugen op een telefoon, en Firestore rekent per gelezen document, elke keer dat iemand de app opent.

Nu schrijft de server het antwoord op het document (`afgesloten`, `afgeslotenJaar`) en vraagt de app alleen nog wat daar níét op staat. Twee functies doen dat, en dat is geen verdubbeling: `archiveerBijWijziging` reageert meteen wanneer iemand een event afsluit, en `archiveerDagelijks` loopt om 05:10 alles na, want "de factuur is zestig dagen oud" is iets wat gebeurt zonder dat er iemand op een knop drukt. De subtaken van een event krijgen dezelfde stand mee; zouden alleen de events het veld dragen, dan bleven hun taken wél binnenkomen en was er niets gewonnen.

Het archiefscherm vraagt per jaar op wanneer je het opent, en weet welke jaren er zijn uit `config/archief` — één document met de jaren en het aantal, bijgehouden door diezelfde twee functies. Zo kost de link *Archief (123)* onder de lijst één leesbeurt in plaats van het hele archief.

De regel staat in `functions/archief-stand.js` en nergens anders; wat de app ervan nodig heeft is het getal in de uitlegzin, en `tests/archief.test.js` houdt die twee gelijk.

**De eerste uitrol vult het veld bij.** Firestore vindt een document niet met `where('afgesloten', '==', false)` zolang dat veld er niet op staat, dus zou elk event van voor deze verandering onzichtbaar zijn — niet weg, maar voor wie ermee werkt is dat hetzelfde. `scripts/seed.mjs` zet daarom de stand op alles wat er al is. Die seed draait in de uitrol vóór de nieuwe app gepubliceerd wordt, en ze is herhaalbaar: wat al klopt wordt niet geschreven, en de tweede uitrol doet niets meer.

---

## Socials

Twee dingen die uit elkaar gehaald horen te worden: de **content per event** en de **posts per dag**.

De tab **Events** is een bord van elk event dat content moet opleveren, in drie stappen:

| Stap | Betekent |
|---|---|
| Social content delivery | beeld en tekst moeten nog binnenkomen |
| Social content ready | klaar om te plaatsen |
| Social content posted | staat online |

Een event komt daar vanzelf op te staan zodra het op **ready to invoice** komt (en blijft staan bij *invoiced* en *complete*). Niet elk event levert content op — een vergaderzaal voor tien man meestal niet — dus staat er in het event zelf een schakelaar om het uit te zetten, of net eerder aan.

Dat "vanzelf" gebeurt zonder migratie en zonder trigger: het bord kijkt naar de status én naar de stand, en een event zonder stand begint in de eerste kolom. Wat vandaag op *invoiced* staat, staat er dus meteen op — er hoeft niets aan bestaande gegevens veranderd te worden.

De tabs **Kalender** en **Posts** zijn de contentkalender zoals die was: posts per merk, met de reviewronde eraan.

---

## Business rules

Alles wat op *ready to invoice* komt is werk voor Elke, en voor niemand anders. Dat met de hand doortrekken werkt tot iemand het vergeet, en een taak die bij de verkeerde persoon blijft hangen wordt niet gefactureerd. In **Instellingen → Business rules** staat die afspraak als regel: *als* er iets wijzigt (of iets aangemaakt wordt), *alleen als* de voorwaarden kloppen, *dan* dit.

**Waarover.** Niet alleen taken en events: ook klanten, social posts, afvinklijsten, urenboekingen en profielen. Wat er per entiteit bestaat — de velden waar je een voorwaarde op kunt zetten en de acties die uitgevoerd worden — staat op één plek, in `functions/rule-schema.js`. Het beheerscherm bouwt zichzelf daaruit op, zodat een actie niet wél te kiezen kan zijn en níét uitgevoerd worden.

**Voorwaarden.** Een boom van EN, OF en GEEN, met groepen die in elkaar mogen zitten, en vergelijkingen die bij het soort veld passen: tekst bevat of is, getal groter dan, datum voor of na, lijst bevat, leeg of ingevuld. *Een aanvraag boven de 10 000 euro óf met meer dan 150 gasten* is één regel.

**Beslissingstabellen.** In de geest van [GoRules](https://gorules.io/): in plaats van tien losse als-dan-regels die elkaar overschrijven zet je één tabel met de voorwaarden als kolommen en één rij per geval, van boven naar beneden gelezen tot er een rij past. Een lege cel betekent "maakt niet uit". Dat leest als een tabel op papier — en dat is het punt: wie de zaak runt moet kunnen nalezen wat er gebeurt, zonder programmeur.

**Datums, vast of relatief.** Een vervaldag, een startdag of een publicatiemoment kan "+3 dagen vanaf vandaag" zijn of een dag op de kalender. Hetzelfde geldt in een voorwaarde (*vervalt binnen een week*), en een label kan de datum meedragen — *opvolgen 02-10*.

**Uitlegbaar.** Elke keer dat een regel iets wijzigt, schrijft de server een rij in `automationRuns`: welke regel, op welk document, welke velden, en bij een tabel welke rij. Onderaan het beheerscherm staat dat logboek. Een regel draait met beheerdersrechten en verandert werk van collega's — dan hoort achteraf na te lezen te zijn welke regel dat was.

De regels draaien **op de server**, in een trigger per collectie. Dat is bewust: een taak verandert ook van status op het bord van een collega en vanuit de overlegfunctie, en een regel die alleen in de browser van wie ze instelde zou draaien, geldt dan niet. De wijziging komt een seconde later vanzelf binnen.

**Wat een regel niet mag.** De motor voert alleen uit wat in `rule-schema.js` als actie beschreven staat. Bij een profiel is dat de afdeling, en verder niets: `role`, `active` en `email` staan er bewust niet bij, want een regel die een rol kan zetten is een regel die zichzelf meer rechten geeft. Op welke collectie een regel mag staan, grenst `firestore.rules` af; wie een regel mag schrijven is een beheerder.

Drie dingen die de trigger veilig houden, en die een test bewaakt:

- Een regel vuurt **op het binnenkomen** van de wijziging, niet zolang de waarde er staat. Wie na de wissel bewust iemand anders toewijst, ziet dat niet bij de volgende bewerking teruggedraaid.
- De trigger schrijft haar eigen resultaat weg en wordt daardoor **opnieuw wakker**. Wat haar laat stoppen is de lege patch: wat al zo staat, wordt niet geschreven. Daarnaast ondertekent ze haar eigen schrijfbeurt met `ruleStamp` en herkent ze die terug voor er één regel gelezen is.
- Veranderde er niets waar een regel iets over kan zeggen, dan wordt de regelcollectie niet eens gelezen.

**De bestaande regels.** Die staan er nog in de oude, enkelvoudige vorm in (`{ kind: 'status', status: '…' }` plus een `listId`) en worden gewoon zo gelezen: bij het lezen omgezet naar wat ze altijd al betekenden, niet gemigreerd. Pas wanneer iemand zo'n regel bewerkt en bewaart, staat de nieuwe vorm erin. Er is geen moment waarop een regel stilvalt omdat een migratie nog moest lopen.

Een regel hangt aan de *naam* van een status, niet aan een id — dezelfde naam op twee borden betekent hier hetzelfde. De prijs daarvan is dat een kolom hernoemen de regel losmaakt, en dat zie je nergens gebeuren; daarom staat de waarschuwing (*deze status bestaat niet — de regel vuurt nooit*) naast de regel zelf. Het rekenwerk staat puur in `functions/automations.js` en `functions/rule-schema.js`, zodat elke regel in een test na te rekenen is: dit is de enige code die ongevraagd andermans werk aanpast.

---

## Op de telefoon

De tool is een app op je beginscherm, geen snelkoppeling: eigen icoon, eigen venster, geen adresbalk, en ze opent ook met één streepje bereik.

**Installeren.** Android/Chrome zet zelf een balk onderaan; staat die er niet meer, dan staat er *Installeren op dit toestel* in het accountmenu rechtsboven. Op iPhone kan dat alleen via Safari: deelknop → *Zet op beginscherm*. Apple laat geen knop in de pagina toe.

**Offline.** De service worker (`public/sw.js`) bewaart de schil en haalt hem uit de cache wanneer het netwerk wegvalt — een leeg scherm op een festivalterrein is erger dan een oud scherm. De gegevens zelf komen altijd van Firestore; die worden nooit gecachet, want een planning die stilstaat zonder dat iemand het ziet, is gevaarlijker dan een foutmelding.

De schil is alles wat het beginscherm nodig heeft plus het scherm *Openen & sluiten*, en die lijst wordt bij het bouwen dichtgerekend: wat een bestand uit de schil zelf nog binnenhaalt, gaat mee. `version.json` draagt die lijst én het buildnummer, en beide komen uit dezelfde build — anders meldt de app bij iedereen dat er een nieuwe versie klaarstaat terwijl er niets veranderd is. De browsertest controleert allebei.

**Caching.** De gehashte bestanden in `/assets/` staan een jaar vast en de rest op `no-store`. In `firebase.json` staat de algemene regel daarom vóór `/assets/**`: Hosting past álle regels toe die op een pad passen, in volgorde, dus wint bij dezelfde koptekst de laatste. Andersom overschrijft `no-store` het jaar en haalt elk toestel de hele app bij elk bezoek opnieuw op.

> Let op bij het aanpassen van de service worker: een kapotte versie blijft op het toestel van iedereen staan, ook na een goede deploy. De uitweg is `public/sw.js` vervangen door alleen `self.registration.unregister()` en dat uitrollen; elk toestel ruimt zichzelf dan op bij het volgende bezoek.

**Meldingen.** Twee dingen sturen er een: je krijgt een taak toegewezen, en er wordt jou een review van een social post gevraagd. Nooit van je eigen klik — daarvoor schrijft de app `updatedBy` mee op elke taakwijziging.

Aanzetten gebeurt per toestel, in het accountmenu. Eerst moet het certificaat er zijn:

1. Firebase Console → **Project settings → Cloud Messaging → Web configuration → Generate key pair**.
2. Die sleutel als GitHub-secret **`VITE_FIREBASE_VAPID_KEY`** zetten (Settings → Secrets and variables → Actions).
3. Opnieuw uitrollen. Zonder de sleutel bouwt en draait alles gewoon, maar blijft de knop *Meldingen aanzetten* uitgeschakeld — een knop die niets doet is erger dan een knop die zegt dat hij nog niet klaar is.

De iconen staan in `public/icons/` en worden gemaakt met `node scripts/make-icons.mjs`: het JE-monogram, in de huisletter nagebouwd uit rechthoeken en een boog — dikke stammen, dunne dwarsstreken — met daaronder de drie balken van de favicon. Een echt logobestand bestaat niet; het merk ís die twee letters. Het gaat zonder beeldbibliotheek, want een letterteken uit acht vormen is geen build-afhankelijkheid waard.

De favicon blijft de drie balken alleen: op 16 pixels valt een schreefletter uit elkaar.

---

## Onderhoud op de live gegevens

Soms moet er iets rechtgezet worden dat niet via een scherm kan: een veld dat
op honderd events tegelijk moet wijzigen, een business rule die met
terugwerkende kracht geldt. Dat vraagt de servicesleutel, en die hoort nergens
anders te bestaan dan in de uitrol.

Daarom is er een aparte actie: **Actions → Onderhoud → Run workflow**. Je kiest
een script uit de lijst en of het echt mag schrijven.

Drie dingen houden het veilig, en ze hangen samen:

1. **Er draait alleen wat in de repo staat.** Een script moet geschreven,
   gelezen en gecommit zijn voor het in die keuzelijst verschijnt. Er is geen
   manier om vanaf de knop een opdracht mee te geven.
2. **Standaard schrijft het niets.** Een droogloop leest alles, rekent alles
   uit en zegt regel per regel wat hij zou doen — maar raakt geen enkel
   document aan. Pas met *schrijven: ja* gaat het echt. Draai altijd eerst
   droog: de enige manier om zeker te weten dat een filter klopt, is hem laten
   opsommen wat hij gevonden heeft.
3. **Het staat in de log.** Wie het startte, wanneer, met welke keuze, en wat
   eruit kwam.

De scripts staan in `scripts/onderhoud/`. Wat ze gemeen hebben — verbinden,
een profiel opzoeken, het verslag — staat in `_hulp.mjs`.

| Script | Wat het doet |
|---|---|
| `te-factureren-verantwoordelijke` | Zet elk event in *ready to invoice* op één verantwoordelijke (standaard Elke). De business rule doet dat bij een statuswijziging; dit past hem toe op wat er al stond toen die regel gemaakt werd. Raakt alleen `assignees`; de ploeg in `medewerkers` blijft staan. |

---

## Back-ups

**Die draaien**, elke maandagochtend, via `.github/workflows/back-up.yml`: point-in-time
recovery (zeven dagen terug tot op de minuut) en een volledige export naar Cloud Storage
die zichzelf na een jaar opruimt. De gegevens staan bij Google, dus een kapotte schijf is
het probleem niet — een fout van ons is dat wel, en daar helpt redundantie niet tegen.
Zie `docs/back-ups.md` voor het terugzetten.

Wat er moet gebeuren en hoe, staat in [`docs/back-ups.md`](docs/back-ups.md): eerst
point-in-time recovery (één commando, zeven dagen terug tot op de minuut), daarna een
wekelijkse export naar Cloud Storage voor wat langer terug moet kunnen.

---

## Het design system

Alle kleuren, letters, maten en componentstijlen staan in `src/styles/je-ds.css`.
Buiten de `:root`-blokken daarin hoort geen enkele letterlijke kleur of maat te
staan — niet in dat bestand, en zo weinig mogelijk in `app.css`.

**Componenten lezen alleen de semantische laag** (`canvas`, `surface-1`,
`text-1`, `accent`, `border-hairline`). De schaal eronder (`navy-700`,
`slate-500`) stelt die laag samen. Een component die `navy-700` rechtstreeks
leest, kantelt niet mee in de nachtschil.

### Contrast is uitgerekend, niet geschat

`src/lib/kleur.js` doet het rekenwerk, met tests erop. Dat is nodig omdat het
team zelf kleuren kiest — voor een bordkolom, een merk, een label — en die
kleuren daarna als badge terugkomen. Vroeger stond daar altijd wit op, wat de
kolomnaam op het oude oranje (`#f59e0b`) op 2,15 bracht waar 4,5 nodig is.
`badgeKleuren()` neemt nu de inkt die wél leest, en verdiept de vulling als
geen van beide inkten de drempel haalt.

Daarom hoeft geen enkele kleur die al in de database staat aangepast te worden.
Het palet dat je bij een nieuwe kolom te kiezen krijgt (`PALET`) is wel
vervangen: negen kleuren uit de huisstijl, elk nagerekend.

Twee tokens zijn bijgesteld omdat ze hun drempel niet haalden: `--amber-600`
van `#B4761B` naar `#946115` (3,59 → 5,01 op papier) en `--border-strong` van
42% naar 52% dekking (2,41 → 3,14, en dat is de rand van elk vinkje).
`tests/kleur.test.js` houdt die twee vast.

### De breekpunten staan op één plek

Vier: 560, 860, 1000 en 1240. Ze staan als `--bp-*` in `je-ds.css` en als
`BREEKPUNTEN` in `src/lib/schermmaat.js`, want een media query leest geen
CSS-variabele. Er stonden er acht, en `useNarrow` stond op weer een andere —
daardoor sprong de zijkolom op een andere breedte weg dan het rooster. De test
vergelijkt beide lijsten en de stylesheets.

Hetzelfde geldt voor `--z-*`: zes lagen met een naam, in plaats van de getallen
1 tot 70 verspreid over drie stylesheets.

### Het beeldmerk

`public/favicon.svg` en de vier PNG's in `public/icons/` komen uit dezelfde
zeshoek; `node scripts/iconen.mjs` tekent ze opnieuw. **Het echte logo zit niet
in de repo.** `Logotype` toont zonder `VITE_LOGO_URL` het getekende zeshoekje
met JE erin, en doet geen aanvraag. Zet die variabele zodra het echte bestand
er is.

---

## Nederlands en Engels

De tool staat in het Nederlands en in het Engels. De keuze staat in het
accountmenu, onder *Taal*, en hangt aan je profiel — dus ze volgt mee naar je
telefoon en naar de tablet in de keuken. Datums, maanden en dagnamen gaan mee,
en de e-mails en meldingen die de server stuurt komen in de taal van de
ontvanger aan.

De taal van je browser wordt met opzet niet overgenomen. Een deel van het team
heeft Windows of Chrome in het Engels staan, en dat zegt niets over de taal
waarin ze willen werken; die zouden op een ochtend een andere tool openen dan
gisteren zonder zelf iets veranderd te hebben. Iedereen begint in het
Nederlands; wie Engels wil, kiest het. De knop heet *English*, in het Engels,
zodat wie geen Nederlands leest hem herkent.

Twee dingen blijven Nederlands, wat je ook kiest: wat het team zelf in de
database schreef (namen van events, klanten, taken en afvinkpunten), en de
FAVV-maandrapportage — een controleur van de voedselinspectie leest Nederlands,
en een officieel rapport dat per gebruiker van taal verandert is geen rapport.

Een tekst toevoegen of wijzigen: [`docs/vertalen.md`](docs/vertalen.md).

---

## Migratie uit ClickUp

```bash
export CLICKUP_TOKEN=pk_…            # ClickUp → Settings → Apps → API token
export CLICKUP_TEAM_ID=24317841
export GOOGLE_APPLICATION_CREDENTIALS=./service-account.json

node scripts/migrate-clickup.mjs --dry-run          # lezen, niets schrijven
node scripts/migrate-clickup.mjs                    # echt importeren
node scripts/migrate-clickup.mjs --spaces="JE Concept"
node scripts/migrate-clickup.mjs --skip-comments --skip-time
```

Wat meekomt: ruimtes, mappen, lijsten, kolommen (inclusief het type open/bezig/afgerond/gesloten), taken en subtaken, omschrijvingen, prioriteiten, data, ramingen, budget en locatie, labels, reacties en tijdsregistraties.

Elk geïmporteerd document krijgt een vast id (`cu-task-86cbh9v0p`), dus **het script mag zo vaak draaien als je wil**: een tweede run werkt bij wat veranderd is in plaats van te dupliceren. Dat is ook de bedoelde werkwijze — een paar drooglopen, een echte import, en op de ochtend van de overstap nog een laatste bijwerking.

**Toewijzingen** worden gekoppeld op e-mailadres. Wie nog nooit in JE Plan is aangemeld, heeft nog geen profiel; het script laat die taken zonder toegewezene en zet die mensen onderaan in de rapportage. Laat hen aanmelden en draai opnieuw.

---

## Ontwikkelen

```bash
npm install
npm run dev              # http://localhost:5173

npm run lint
npm test                 # unit tests op de rekenlogica
npm run smoke            # de echte app in een echte browser
npm run mobiel           # elk scherm op een telefoon: past het, en kun je het raken
npm run taalcheck        # elk scherm in het Engels, wat is er nog Nederlands
npm run build

npm run controleer       # alles hierboven, in één keer — draai dit voor een uitrol

npm run test:rules       # firestore.rules tegen de emulator (heeft Java nodig)
npm run offerte:voorbeeld # het offerteblad als los bestand, om te delen
npm run emulators        # zet VITE_USE_EMULATORS=1 in .env.local
```

### Testen

Twee lagen, met een duidelijke taakverdeling.

**`npm test`** dekt de logica die stil kan breken: de volgorde van kaarten op een bord (inclusief het punt waarop floats hun precisie verliezen), de ISO-weeknummering rond de jaarwisseling, de voortgang bij dalende doelen, wanneer een business rule vuurt en wie er een melding krijgt.

**`npm run smoke`** doet wat geen unittest kan: elke pagina echt openen in Chromium, op de demobuild. Geen wit scherm, niets in de console, en op elk scherm één handeling die er hoort te werken — een taak openen, een punt afvinken, een agendapunt toevoegen, het verloop van een doel uitklappen. Plus de twee dingen die de tool onbruikbaar maken zonder dat er iets "stuk" is: personeel dat meer ziet dan zijn eigen lijst, en een pagina die na een uitrol niet meer laadt.

Dat laatste staat er omdat het gebeurd is. Wie een tabblad open had staan terwijl er uitgerold werd, kreeg bij de volgende klik een **wit scherm**: de pagina vroeg een bestandsnaam op die na de uitrol niet meer bestond, React haalde de hele boom weg en er bleef niets over. Nu vangt een foutgrens dat op, ruimt de cache op en herlaadt één keer; lukt dat niet, dan staat er een uitleg met een knop in plaats van niets. De test speelt precies dat na door een bestand te laten verdwijnen.

**`npm run mobiel`** loopt elk scherm af op een iPhone-formaat en meet twee dingen die je met kijken niet vindt: steekt er iets buiten het scherm dat je niet kunt bereiken, en zijn de knoppen groot genoeg om met een duim te raken. "Is het mobielvriendelijk" is namelijk geen vraag die je met kijken beantwoordt — je bekijkt drie schermen, ze zien er goed uit, en het vierde heeft een tabel die honderd pixels uitsteekt.

De eerste keer dat hij draaide: één van de zevenentwintig schermen was in orde. Niet door kapotte layouts maar door raakvlakken — tabs van 26 pixels, een zoekveld van 22, plusjes van 24. Dat werkt met een muis, want een muis heeft één punt; een duim is een vlek van een centimeter. De grens ligt op 32 pixels, en wat te klein is wordt groter gemaakt onder `@media (pointer: coarse)` — dus alleen op een toestel dat je aanraakt, niet op een smal venster met een muis ernaast.

Wat wél breder mag zijn dan het scherm — een bord met negen kolommen, een weekrooster — staat met naam in het script. Een tabel die niet schuift maar afgesneden wordt, is wél een fout: dan bestaat de helft van je gegevens wel en kan niemand ze lezen.

De meting draait zonder webfonts, en dat is geen slordigheid. De eerste versie was groen op één machine en rood in CI: een tab met "Mail" erin was daar zevenentwintig pixels en hier vierendertig, want welke letters er getekend worden hangt af van welke Chromium en welke lettertypes er op die machine staan. Een tripwire die daarvan afhangt, meldt dingen die niemand ziet en mist dingen die iemand wél ziet. Het echte antwoord was de knoppen een ondergrens geven die niet van een woord afhangt; het blokkeren van de fonts is wat overblijft, zodat elke machine hetzelfde én het ongunstigste geval meet.

**`npm run test:rules`** draait `firestore.rules` tegen de emulator — het echte bestand, geen kopie. Dat kwam er later bij en om een vervelende reden: de regels stonden in geen enkele test, dus een fout erin kwam pas in productie aan het licht, op een tool waar klantgegevens en bedragen in staan. Wat er getest wordt zijn de gevallen waar het om gaat: komt personeel bij de bedragen, blijft de vorm van een bedrag kloppen, kan iemand andermans notitie wissen, kan het logboek aangevuld worden, zet iemand zijn eigen rol. Zonder emulator slaan die tests zichzelf over en staan ze als *skipped* — niet als geslaagd. Een test die stilletjes slaagt terwijl hij niet gedraaid heeft, leest als bewijs en is er geen.

**De demo heeft een eigen klok.** De voorbeeldgegevens staan vast rond maandag 28 september 2026: het rooster toont "deze week", de socials "deze week", het magazijn "vanaf vandaag", en de smoke-tests weten wat er dan te zien hoort te zijn. Zolang de echte dag in diezelfde week viel, klopte dat vanzelf; de maandag erna was de week leeg en faalden vier tests zonder dat er iets kapot was. Daarom leest de app in de demo niet de echte klok maar die van `demo/klok.js`: ze staat op de demodag en loopt van daar door, zodat een timer gewoon tikt. Alleen `new Date()` zonder argument en `Date.now()` worden omgebogen; een datum uit gegevens blijft wat ze is. De echte build raakt dit niet aan.

**De regels draaien ook mee in de demo.** De fout die in dit project bleef terugkomen is dat de client iets opvraagt wat `firestore.rules` weigert: dat komt niet terug als een leeg antwoord maar als een fout, en die strandt een heel scherm — of ze wordt opgevangen en je houdt een teller over die altijd nul zegt. De demo had geen regels, dus de browsertest zei groen over schermen die live half stukliepen. Sinds `demo/regels.js` weigert de demo wat de regels weigeren en houdt ze bij wát er geweigerd werd; `scripts/smoke.mjs` loopt elke rol (`?rol=owner|admin|member|guest|personeel|social`) langs elk scherm en eist dat die lijst leeg blijft. Dat de tabel in de demo hetzelfde zegt als `firestore.rules`, bewaakt `tests/rollen.test.js` — die leest het regelbestand en vergelijkt het regel voor regel.

### Deploy

Elke push naar `main` doet lint + unittests + browsertest + build via GitHub Actions, en rolt uit zodra deze secrets bestaan:

| Secret | Waarde |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | volledige JSON van een service-account met *Firebase Admin* |
| `FIREBASE_PROJECT_ID` | bv. `je-planning` |
| `VITE_FIREBASE_*` | dezelfde zes waarden als in `.env.local` |

Zonder `FIREBASE_SERVICE_ACCOUNT` blijft CI groen en wordt de deploy overgeslagen.

Handmatig: `npm run deploy`.

### Hoeveel er over de lijn gaat

Wie de tool opent, haalt de schil op plus de pagina waar hij op staat: samen ongeveer **200 kB gecomprimeerd**, waarvan Firebase het grootste deel is. Elk scherm komt daarna apart binnen — Instellingen is het zwaarst met 23 kB en dat betaalt alleen wie het opent.

**De klantenpagina's zijn een andere applicatie.** `/offerte/<sleutel>` en `/klant/<sleutel>` laden geen aanmelding, geen werkruimte en **geen Firebase**: ze praten met één functie en verder met niets. Dat scheelt ruim een halve megabyte op een pagina die één voorstel moet tonen, en het maakt ze bestand tegen een link die rondgaat — er is geen database-abonnement dat openblijft, alleen een HTTP-verzoek dat de CDN een minuut vasthoudt. De functie zelf staat op tachtig gelijktijdige verzoeken per instantie met een plafond van twintig: niet omdat we dat verwachten, maar omdat een publiek adres zonder plafond een factuur is die iemand anders kan bepalen.

**De vertalingen komen met hun eigen scherm mee.** Ze zaten volledig in de eerste download: zesentwintig bestanden, beide talen, samen 137 kB — 40 kB gecomprimeerd, opgehaald door iedereen die de tool opent en door elke klant die op een offertelink klikt. Daar zat het hele eventscherm in voor wie alleen zijn uren komt boeken, en de hele instellingenmodule voor wie een afvinklijst doet.

Nu zit alleen de kern in de eerste download: de schil (zijbalk, zoekbalk, timer, assistent, meldingen), het aanmeldscherm met de code, en de woordenlijsten van modules die altijd meedraaien — het activiteitenlog, de afvinksjablonen, de formules, de socialstanden en de statuspijplijn. De rest hangt per scherm in de routetabel in `src/AppPrive.jsx` en wordt tegelijk met dat scherm opgehaald, zodat er geen tweede wachttijd bij komt. De eerste download ging daarmee van 186 kB naar 75 kB, en gecomprimeerd van 55 kB naar 23 kB.

De fout die zo'n tabel maakt is stil: een vergeten woordenlijst geeft geen foutmelding maar een scherm waarop elk label een kale sleutel is. `tests/taalbundels.test.js` volgt daarom per scherm de hele boom van imports, zoekt op welke sleutels dat scherm opvraagt — ook de samengestelde, zoals `` t(`pijplijn.${key}`) `` — en meldt het wanneer er één niet gedekt is. Ook het omgekeerde: een woordenlijst die een scherm niet gebruikt, hoort er niet bij te staan, anders groeit de tabel vanzelf terug naar "alles".

Wat daarbij opviel: de zoekbalk, de timer en het assistentpaneel hadden hun teksten bij hún scherm staan — in `instellingen.js`, `team.js`, `bistro.js` — terwijl ze op élk scherm staan. Die zijn naar `schil.js` verhuisd. Anders had de hele uren- en dashboardcatalogus mee gemoeten om een timer in de zijbalk te kunnen tekenen.

---

## Wat nog niet in deze versie zit

Bewust buiten scope gehouden:

- **Automatisch publiceren** naar Instagram/Facebook. De kalender plant en keurt goed; posten gebeurt nog met de hand. Meta's Graph API kan dit, maar vraagt app-review en een gekoppelde bedrijfspagina.
- **Documenten/wiki**, zoals ClickUp Docs.
- **Antwoorden op een mail vanuit de tool.** De draad staat op het event, maar beantwoorden doe je in Gmail. Dat vraagt zorgvuldigheid met het afzenderadres en de threading, en tot nu weegt dat niet op tegen één keer wisselen van tabblad.
- **Een tweede omgeving.** Elke uitrol gaat rechtstreeks naar productie. Zolang er veel verandert is dat een bewuste keuze; zodra het rustiger wordt, is een testproject een halve dag werk.

### Wat op een sleutel wacht

Alles hieronder is gebouwd en getest, maar doet pas iets zodra het geheim gezet is. Zonder die sleutel draait de rest gewoon door — dat is met opzet zo gebouwd.

| Sleutel | Wat het aanzet |
|---|---|
| `SMTP_URL` | Uitgaande post: meldingen, de ochtendlijst, de offerte naar de klant |
| `IMAP_URL` | Inkomende post van info@jeconcept.be ophalen |
| `VITE_FIREBASE_VAPID_KEY` | Meldingen op de telefoon |
| `VITE_GOOGLE_MAPS_API_KEY` | Adressen kiezen op de kaart bij een event |
| `ANTHROPIC_API_KEY` | De assistent, de samenvatting van een teamoverleg |
