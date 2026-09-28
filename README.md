# JE Planning — planning.jeconcept.be

Interne planningstool voor JE Concept, als vervanger van ClickUp. Vier onderdelen:

- **Kanban** — borden per lijst, slepen tussen kolommen, groeperen op status, persoon of prioriteit, filters, lijstweergave, subtaken, reacties.
- **Social media kalender** — maandkalender over alle merken heen (JE Concept, Bar Vue, Meer — Het Vinne, Feestbeest, Maison Folie, Wintermoods). De ontwerpen komen **uit Canva**: bladeren door het Canva-account en importeren als post. Een post kan ter **review** gaan, en die beslissing vloeit terug naar Canva als reactie op het ontwerp — met de antwoorden van de ontwerper terug deze kant op. Posts kunnen aan een **project** hangen.
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
functions/        Cloud Functions: toegangscontrole + de volledige Canva Connect-koppeling
scripts/          seed.mjs (eerste opzet) en migrate-clickup.mjs (import uit ClickUp)
firestore.rules   Wie wat mag — de enige plek waar toegang wordt beslist
firestore.indexes.json  Samengestelde indexes voor de bord- en urenqueries
```

### Datamodel in het kort

Firestore kent geen joins, dus een document draagt zelf mee wat een lijstweergave nodig heeft:

| Collectie | Opmerking |
|---|---|
| `profiles/{uid}` | Bestaat pas na goedkeuring. **Een profiel hebben = lid zijn**; de rules kijken naar niets anders. |
| `lists/{id}` | De bordkolommen (`statuses`) zitten **in** het lijstdocument: één read per bord in plaats van één per kolom. |
| `tasks/{id}` | Draagt een kopie van `statusName/statusColor/statusKind` en `listName`, plus `open` (niet afgerond). Daardoor hoeft geen enkele kaart een extra read te doen. Wordt bijgehouden door `src/data/tasks.js`; nergens anders met de hand zetten. |
| `timeEntries/{id}` | Draagt `day`, `week` en `month`. Daardoor is "uren van september" één indexquery in plaats van een range-scan met groeperen in de browser. |
| `runningTimers/{uid}` | De lopende timer, **op uid gesleuteld**: "één timer per persoon" is zo een eigenschap van de data, geen afspraak. |
| `goals/{id}` | Key results zitten in het goal-document (er zijn er een handvol, ze worden nooit apart opgevraagd). Check-ins staan los in `goalUpdates`, want die groeien oneindig. |
| `socialPosts/{id}` | Inclusief de Canva-velden (`canvaDesignId`, edit-url, thumbnail), de reviewstand (`reviewState`, `reviewRound`, `reviewerId`), de draden waarin de review in Canva loopt (`canvaThreadIds`, `canvaComments`) en de kopie van het project (`taskId`, `taskTitle`, `taskListName`). |
| `postReviews/{id}` | Het logboek van de reviewbeslissingen: wie, wanneer, welke ronde, en of de beslissing in Canva belandde. Wordt aangevuld, nooit gewijzigd. |
| `canvaConnections/{uid}` | OAuth-tokens. **De rules verbieden elke toegang vanuit de browser**; alleen de Cloud Functions lezen ze. |

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
- **Blaze-abonnement** — vereist voor Cloud Functions (de Canva-koppeling); verbruik op jullie schaal blijft binnen het gratis quotum.

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

## Canva-koppeling

De koppeling gebeurt **per persoon**, met OAuth 2.0 en PKCE. De code verifier blijft server-side en wordt weggegooid zodra de callback hem inwisselt; de tokens komen in `canvaConnections/{uid}`, waar de rules elke browsertoegang verbieden.

1. Maak een app aan op <https://www.canva.com/developers/integrations> (type: *Public* of *Team*).
2. Zet als redirect-URL: `https://planning.jeconcept.be/api/canva/callback`
3. Vink de scopes aan: `profile:read`, `design:meta:read`, `design:content:read`, `design:content:write`, `asset:read`, `brandtemplate:meta:read`, `brandtemplate:content:read`, `folder:read`, `comment:read`, `comment:write`.
4. Zet de geheimen:

```bash
firebase functions:secrets:set CANVA_CLIENT_ID
firebase functions:secrets:set CANVA_CLIENT_SECRET
firebase functions:secrets:set CANVA_REDIRECT_URI    # de URL uit stap 2
firebase deploy --only functions
```

5. Koppel je account via *Instellingen → Canva*.

Daarna kan je per post een ontwerp **maken** (in het juiste formaat, of uit een merksjabloon), een **bestaand ontwerp koppelen** door de Canva-link te plakken, het **voorbeeld verversen** en **exporteren naar PNG**. Een geplande taak ververst elke ochtend de thumbnails van de posts van de komende zes weken — Canva-thumbnail-URL's zijn ondertekend en verlopen.

Merksjablonen (`brand-templates`) zijn een Canva Enterprise-functie. Zonder Enterprise werkt alles behalve die ene knop; de app laat hem dan gewoon weg.

### Canva als bron van de kalender

De ontwerpen worden in Canva gemaakt — daar werkt het team al — dus vult de kalender zich door ze **op te halen** in plaats van ze hier opnieuw in te typen. **Uit Canva** op de kalender toont wat er in het Canva-account staat, gefilterd op map of op titel; een ontwerp dat al op de kalender staat wordt als zodanig getoond en niet nog eens aangeboden.

Dat laatste hangt aan twee dingen tegelijk: een geïmporteerde post krijgt de deterministische id `canva-<designId>`, en de bladerlijst zoekt daarnaast op `canvaDesignId`, zodat ook een ontwerp dat iemand met de hand aan een post plakte niet opnieuw wordt aangeboden. Twee keer hetzelfde importeren levert dus één post op, niet twee.

### De review, en de weg terug

Een post kan **ter review gevraagd**, **goedgekeurd** of **teruggestuurd voor aanpassing** worden. Die beslissing wordt altijd eerst hier opgeslagen en daarna als **reactie op het Canva-ontwerp** gezet, zodat de ontwerper ze ziet waar die werkt. Lukt dat tweede niet — Canva plat, koppeling verlopen, scope vergeten — dan blijft de beslissing staan en zegt de melding dat ze niet in Canva is gezet. Een goedkeuring mag nooit verdwijnen omdat Canva even niet antwoordt.

De andere richting werkt ook: **Reacties uit Canva halen** trekt de antwoorden in de draad terug in de post, en de ochtendtaak doet dat automatisch voor alles wat op review staat te wachten. Canva geeft alleen draden terug waarvan je de id kent, dus dit ziet de draad die deze tool zelf geopend heeft — niet losse opmerkingen die iemand elders op het ontwerp plaatste.

Wat er openstaat, staat op het dashboard onder **Wacht op review**, en op de kalender achter de filter met dezelfde naam.

### Posts aan projecten

Een post kan aan een taak hangen. Dat is wat de vraag *"wat gaat er buiten voor Blum?"* beantwoordbaar maakt naast *"wat gaat er deze week buiten?"*: de kalender filtert op project, de kaart toont het project, en het takenpaneel toont onderaan de posts die eraan hangen, met hun reviewstatus. De titel en de lijst van de taak reizen mee op de post — Firestore heeft geen join, en een kalendercel kan niet per kaart een taak gaan lezen.

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

**Toewijzingen** worden gekoppeld op e-mailadres. Wie nog nooit in JE Planning is aangemeld, heeft nog geen profiel; het script laat die taken zonder toegewezene en zet die mensen onderaan in de rapportage. Laat hen aanmelden en draai opnieuw.

---

## Ontwikkelen

```bash
npm install
npm run dev              # http://localhost:5173

npm run lint
npm test                 # 47 unit tests op de rekenlogica
npm run build

npm run emulators        # zet VITE_USE_EMULATORS=1 in .env.local
```

De testen dekken bewust de logica die stil kan breken: de volgorde van kaarten op een bord (inclusief het punt waarop floats hun precisie verliezen), de ISO-weeknummering rond de jaarwisseling, de voortgangsberekening bij dalende doelen, en het uitlezen van Canva-links.

### Deploy

Elke push naar `main` doet lint + test + build via GitHub Actions, en rolt uit zodra deze secrets bestaan:

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
- **Losse Canva-opmerkingen lezen.** De review haalt de draad terug die deze tool zelf opende. Canva Connect geeft geen lijst van alle draden op een ontwerp, dus een opmerking die iemand rechtstreeks in Canva plaatst komt hier niet binnen.
- **Terugkerende taken** en sjablonen voor een standaard-event.
- **Notificaties** (e-mail of push) bij toewijzing of naderende deadline.
- **Documenten/wiki**, zoals ClickUp Docs.
- **Gastentoegang voor klanten** op één project.
