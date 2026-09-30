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
| `attachments/{id}` | Documenten: aan een klant (`customerId`) óf aan een event (`taskId`). Het bestand staat in Storage; deze rij houdt naam, type, grootte en de link bij. |
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
| `guest` | vandaag: hetzelfde als `member` — zie hieronder |

**`guest` betekent nog niets.** De rol staat in de keuzelijst bij *Instellingen → Team*, maar in `firestore.rules` komt het woord niet voor: `isTeam()` sluit alleen `staff` en `social` uit, dus een gast is een volwaardig teamlid met een ander etiket — inclusief de offertes, de klantgegevens en het logboek. De interface zegt iets anders: in de kiezers voor uitvoerders en in de werklast wordt een gast juist weggelaten, alsof het een buitenstaander is. Dat verschil is de valkuil: wie iemand op *Gast* zet, denkt te beperken en doet dat niet. Uitnodigen gebeurt altijd als `member`, dus een gast ontstaat alleen door die keuzelijst. Wat de rol wél zou moeten mogen, is een beslissing die nog genomen moet worden; `tests/rollen.test.js` legt de huidige stand vast zodat het niet ongemerkt blijft staan of ongemerkt verschuift.

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

**Documenten** hangen aan een klant óf aan een event, en dat onderscheid is het hele punt: een logo en een huisstijlgids horen bij de klant en niet bij het feest van vorig jaar, een grondplan hoort wél bij dat ene event. De Storage-SDK wordt pas ingeladen op het moment dat er echt een bestand gaat — wie nooit iets uploadt, betaalt er ook geen laadtijd voor.

Een klant wordt **uit gebruik genomen**, niet gewist, zolang er events aan hangen: anders staat er in de geschiedenis een naam zonder gegevens.

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

> Let op bij het aanpassen van de service worker: een kapotte versie blijft op het toestel van iedereen staan, ook na een goede deploy. De uitweg is `public/sw.js` vervangen door alleen `self.registration.unregister()` en dat uitrollen; elk toestel ruimt zichzelf dan op bij het volgende bezoek.

**Meldingen.** Twee dingen sturen er een: je krijgt een taak toegewezen, en er wordt jou een review van een social post gevraagd. Nooit van je eigen klik — daarvoor schrijft de app `updatedBy` mee op elke taakwijziging.

Aanzetten gebeurt per toestel, in het accountmenu. Eerst moet het certificaat er zijn:

1. Firebase Console → **Project settings → Cloud Messaging → Web configuration → Generate key pair**.
2. Die sleutel als GitHub-secret **`VITE_FIREBASE_VAPID_KEY`** zetten (Settings → Secrets and variables → Actions).
3. Opnieuw uitrollen. Zonder de sleutel bouwt en draait alles gewoon, maar blijft de knop *Meldingen aanzetten* uitgeschakeld — een knop die niets doet is erger dan een knop die zegt dat hij nog niet klaar is.

De iconen staan in `public/icons/` en worden gemaakt met `node scripts/make-icons.mjs`: het JE-monogram, in de huisletter nagebouwd uit rechthoeken en een boog — dikke stammen, dunne dwarsstreken — met daaronder de drie balken van de favicon. Een echt logobestand bestaat niet; het merk ís die twee letters. Het gaat zonder beeldbibliotheek, want een letterteken uit acht vormen is geen build-afhankelijkheid waard.

De favicon blijft de drie balken alleen: op 16 pixels valt een schreefletter uit elkaar.

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
npm run build

npm run emulators        # zet VITE_USE_EMULATORS=1 in .env.local
```

### Testen

Twee lagen, met een duidelijke taakverdeling.

**`npm test`** dekt de logica die stil kan breken: de volgorde van kaarten op een bord (inclusief het punt waarop floats hun precisie verliezen), de ISO-weeknummering rond de jaarwisseling, de voortgang bij dalende doelen, wanneer een business rule vuurt en wie er een melding krijgt.

**`npm run smoke`** doet wat geen unittest kan: elke pagina echt openen in Chromium, op de demobuild. Geen wit scherm, niets in de console, en op elk scherm één handeling die er hoort te werken — een taak openen, een punt afvinken, een agendapunt toevoegen, het verloop van een doel uitklappen. Plus de twee dingen die de tool onbruikbaar maken zonder dat er iets "stuk" is: personeel dat meer ziet dan zijn eigen lijst, en een pagina die na een uitrol niet meer laadt.

Dat laatste staat er omdat het gebeurd is. Wie een tabblad open had staan terwijl er uitgerold werd, kreeg bij de volgende klik een **wit scherm**: de pagina vroeg een bestandsnaam op die na de uitrol niet meer bestond, React haalde de hele boom weg en er bleef niets over. Nu vangt een foutgrens dat op, ruimt de cache op en herlaadt één keer; lukt dat niet, dan staat er een uitleg met een knop in plaats van niets. De test speelt precies dat na door een bestand te laten verdwijnen.

**De regels draaien mee in de demo.** De fout die in dit project bleef terugkomen is dat de client iets opvraagt wat `firestore.rules` weigert: dat komt niet terug als een leeg antwoord maar als een fout, en die strandt een heel scherm — of ze wordt opgevangen en je houdt een teller over die altijd nul zegt. De demo had geen regels, dus de browsertest zei groen over schermen die live half stukliepen. Sinds `demo/regels.js` weigert de demo wat de regels weigeren en houdt ze bij wát er geweigerd werd; `scripts/smoke.mjs` loopt elke rol (`?rol=owner|admin|member|guest|personeel|social`) langs elk scherm en eist dat die lijst leeg blijft. Dat de tabel in de demo hetzelfde zegt als `firestore.rules`, bewaakt `tests/rollen.test.js` — die leest het regelbestand en vergelijkt het regel voor regel.

### Deploy

Elke push naar `main` doet lint + unittests + browsertest + build via GitHub Actions, en rolt uit zodra deze secrets bestaan:

| Secret | Waarde |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | volledige JSON van een service-account met *Firebase Admin* |
| `FIREBASE_PROJECT_ID` | bv. `je-planning` |
| `VITE_FIREBASE_*` | dezelfde zes waarden als in `.env.local` |

Zonder `FIREBASE_SERVICE_ACCOUNT` blijft CI groen en wordt de deploy overgeslagen.

Handmatig: `npm run deploy`.

---

## Wat nog niet in deze versie zit

Bewust buiten scope gehouden, in volgorde van wat het meest gevraagd zal worden:

- **Automatisch publiceren** naar Instagram/Facebook. De kalender plant en keurt goed; posten gebeurt nog met de hand. Meta's Graph API kan dit, maar vraagt app-review en een gekoppelde bedrijfspagina.
- **Terugkerende taken** en sjablonen voor een standaard-event.
- **Notificaties** (e-mail of push) bij toewijzing of naderende deadline.
- **Documenten/wiki**, zoals ClickUp Docs.
- **Gastentoegang voor klanten** op één project.
