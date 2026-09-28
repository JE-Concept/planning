# Handoff — zet planning.jeconcept.be live vanuit de browser

**Voor:** Claude in Chrome, in de browser van Jasper
**Repo:** `Kenjeklanten/planning` · **Doel:** `https://planning.jeconcept.be` werkend
**Duur:** ongeveer een half uur, plus wachttijd op het TLS-certificaat

Alles hieronder kan in de browser. Er is **geen terminal nodig**: de enige stap die er anders een
zou vragen — het deployen — zit als knop in GitHub Actions (`Go live`). Wie liever de terminal
gebruikt, draait `./scripts/go-live.sh <project-id>` en slaat stap 7 en 8 over.

---

## Lees dit eerst

**Wat je mag beslissen:** knoppen indrukken, formulieren invullen, namen kiezen die dit document
voorschrijft.

**Wat je niet alleen beslist — vraag het Jasper, hij zit erbij:**
- een betaalmiddel of factureringsaccount koppelen (stap 2)
- de Firestore-locatie, als `eur3` er niet tussen staat (stap 4) — die keuze is **definitief**
- iets doen in het DNS-beheer van `jeconcept.be` (stap 9)

**Verzin nooit een waarde.** Wat je niet op het scherm ziet, meld je als "niet gevonden".
Wijkt een scherm af van de beschrijving, stop dan en beschrijf wat je ziet: Google verzet de
knoppen in deze console een paar keer per jaar. De volgorde klopt, de labels misschien niet.

**Geheimen:** de zes `VITE_FIREBASE_*`-waarden zijn publiek — ze staan straks gewoon in de
JavaScript van de site, en de beveiliging zit in de Firestore-rules. De **servicesleutel** (stap 6)
is dat niet. Plak die alleen in het GitHub-geheimenveld, nooit in een chat, een document of een
commit.

---

## 1. Firebase-project

<https://console.firebase.google.com/> → **Add project** → naam **`je-planning`**.

- Is die project-ID bezet: neem `je-planning-jc` en **noteer de echte ID**. Je hebt hem nog vier
  keer nodig.
- Google Analytics: **uit**.

→ noteer: **project-ID**

## 2. Blaze aanzetten

Linksonder staat het plan-label → **Upgrade** → **Blaze (pay as you go)**.

**Vraag Jasper welk factureringsaccount.** Koppel het, en stel daarna een **budgetalarm van €10 per
maand** in via Google Cloud → **Billing → Budgets & alerts**. Dat is een waarschuwing, geen limiet.

Blaze is nodig omdat Cloud Functions niet op het gratis Spark-plan draaien. Bij vijf gebruikers
blijft de rekening in de praktijk €0.

→ noteer: **staat Blaze aan, staat het alarm op €10**

## 3. Google-login

**Build → Authentication → Get started** → tabblad **Sign-in method** → **Google** → **Enable**.
Support-e-mail: `jasper@jeconcept.be` → **Save**.

Daarna **Settings → Authorized domains → Add domain** → `planning.jeconcept.be`.
Laat `localhost` en `<project>.firebaseapp.com` staan.

## 4. Firestore

**Build → Firestore Database → Create database** → **Production mode** (niet test mode: de repo
levert eigen beveiligingsregels) → locatie **`eur3 (europe-west)`**.

⚠️ **Deze locatie is definitief.** Ze kan later niet meer gewijzigd worden. Staat `eur3` er niet
tussen, stop en vraag het Jasper.

## 5. Storage

**Build → Storage → Get started** → **Production mode** → dezelfde regio → **Done**.

## 6. Web-app registreren en de servicesleutel ophalen

**a) De web-app.** **Project settings** (tandwiel) → **General** → onder *Your apps* het
web-icoon **`</>`** → nickname `JE Planning` → **vink Firebase Hosting NIET aan** → **Register app**.

Er verschijnt een `firebaseConfig`-blok met zes waarden. Noteer ze zo:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

**b) De servicesleutel.** **Project settings → Service accounts → Generate new private key** →
**Generate key**. Er wordt een JSON-bestand gedownload. Open het en kopieer **de volledige inhoud**,
van de eerste `{` tot de laatste `}`.

Dit bestand geeft volledige toegang tot het project. Het gaat zo meteen één keer in een
GitHub-geheim en daarna verwijder je de download.

**c) Geef die service account de juiste rollen.** Dit is de stap die het vaakst wordt overgeslagen,
en de uitrol valt er meteen over met een kale `403` op `serviceusage.googleapis.com`. De sleutel
hoort bij `firebase-adminsdk-…@<project>.iam.gserviceaccount.com`, en die mag standaard de
Google-API's van het project niet eens uitlezen.

Ga naar <https://console.cloud.google.com/iam-admin/iam> (juiste project bovenaan), zoek die
service account, **Edit principal → Add another role**:

| Snel | Precies |
|---|---|
| **Editor** naast de bestaande rollen | **Service Usage Admin**, **Cloud Functions Admin**, **Cloud Run Admin**, **Artifact Registry Administrator**, **Cloud Build Editor**, **Service Account User**, **Cloud Scheduler Admin**, **Eventarc Admin**, **Secret Manager Admin** |

*Editor* is breder dan nodig, maar de sleutel staat alleen in de geheimen van jullie eigen repo en
wordt alleen door deze twee workflows gebruikt. Wie het scherper wil, neemt de rechterkolom.
Zonder **Service Usage Admin** komt geen enkele deploy voorbij de eerste stap.

### 6d. De sleutel voor meldingen

Nog steeds in **Project settings**, tabblad **Cloud Messaging**. Onderaan staat
**Web configuration → Web Push certificates**. Klik **Generate key pair** en
kopieer de sleutel die verschijnt (een lange reeks letters en cijfers).

Dit is wat meldingen op de telefoon mogelijk maakt. Ontbreekt hij, dan werkt de
tool gewoon, maar blijft de knop "Meldingen aanzetten" uitgeschakeld.

## 7. De geheimen in GitHub zetten

Ga naar <https://github.com/Kenjeklanten/planning/settings/secrets/actions> →
**New repository secret**, één per keer:

| Naam | Waarde |
|---|---|
| `FIREBASE_PROJECT_ID` | de project-ID uit stap 1 |
| `FIREBASE_SERVICE_ACCOUNT` | de volledige JSON uit stap 6b |
| `VITE_FIREBASE_API_KEY` | uit stap 6a |
| `VITE_FIREBASE_AUTH_DOMAIN` | uit stap 6a |
| `VITE_FIREBASE_PROJECT_ID` | uit stap 6a |
| `VITE_FIREBASE_STORAGE_BUCKET` | uit stap 6a |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | uit stap 6a |
| `VITE_FIREBASE_APP_ID` | uit stap 6a |
| `VITE_FIREBASE_VAPID_KEY` | zie stap 6d |

Controleer dat er negen geheimen staan voor je verdergaat. Verwijder daarna het gedownloade
JSON-bestand van stap 6b uit de downloadmap.

## 8. Uitrollen

<https://github.com/Kenjeklanten/planning/actions/workflows/go-live.yml> → **Run workflow**:

- **Firebase project-ID**: de ID uit stap 1
- **Wat uitrollen**: `alles`
- **Basisgegevens zetten**: aangevinkt

→ **Run workflow**. Het draait ongeveer vijf tot acht minuten. Open de run en volg hem.

Wat er gebeurt, in deze volgorde: beveiligingsregels en indexes, dan Cloud Functions, dan de
basisgegevens (merken, toegangsdomeinen, de twee borden), dan de applicatie. Die volgorde is niet
willekeurig — een bord dat zoekt op een veld waarvoor nog geen index bestaat, geeft lege kolommen
en een fout die op een bug lijkt.

Groen? Open **`https://<project-id>.web.app`**. Je zou het aanmeldscherm moeten zien.

Eigenaar van de werkruimte is `jasper@kenjeklanten.be` — dat adres staat als `bootstrapOwnerEmail`
in `config/access`, dus wie er ook als eerste inlogt, de eigenaarsrol blijft voor hem. Wil je dat
op een ander adres zetten, draai dan
[Actions → Beheerder instellen](https://github.com/Kenjeklanten/planning/actions/workflows/admin.yml)
met dat adres en rol `owner`; dat werkt ook voor iemand die nog nooit heeft ingelogd.

`@jeconcept.be` en `@kenjeklanten.be` komen daarna automatisch binnen; ieder ander heeft een
uitnodiging nodig via *Instellingen → Team*.

⚠️ **Kies bij de eerste uitrol echt `alles`.** Met *alleen rules en indexes* of *alleen de
applicatie* worden de Cloud Functions overgeslagen, en zonder die functies krijgt niemand een
profiel — inloggen lukt dan niet en de foutmelding zegt alleen "geen toegang".

## 9. Het domein koppelen

Pas nu, want een domein koppelen aan een lege site geeft een 404 en dan weet je niet of het aan de
DNS ligt of aan de applicatie.

**a) Zoek waar de DNS staat.** <https://dnschecker.org/ns-lookup.php> → `jeconcept.be`.
Nameservers `*.ns.cloudflare.com` → Cloudflare. Iets anders (Combell, One.com, TransIP…) → daar.
**Meld waar je uitkomt en wacht op Jasper voor je inlogt.**

**b) In Firebase.** **Build → Hosting → Add custom domain** → `planning.jeconcept.be`.
Firebase toont **twee A-records**, en soms eerst een TXT-record ter verificatie.

**c) In het DNS-paneel.** Twee A-records, naam `planning`, één per IP-adres.

> **Staat het op Cloudflare: zet het oranje wolkje UIT (grijs).** Firebase geeft zijn eigen
> TLS-certificaat uit; met de Cloudflare-proxy ertussen loopt dat vast en blijft het domein op
> *Needs setup* hangen. Dit is de fout die hier het vaakst gemaakt wordt.

**d)** Terug in Firebase → **Verify**. Status **Connected** = klaar. Het certificaat duurt enkele
minuten tot 24 uur.

**e) Maak er het enige adres van.** Firebase blijft de site ook op `je-planning.web.app` serveren.
Elk adres heeft zijn eigen aanmeldsessie, dus wie op het verkeerde binnenkomt, logt apart in. Zet
daarom, **pas als het domein op Connected staat**, het GitHub-geheim `VITE_CANONICAL_HOST` op
`planning.jeconcept.be` en draai **Go live** met *alleen de applicatie*. Daarna stuurt `web.app`
door naar het eigen domein, met pad en query intact.

→ noteer: **waar de DNS beheerd wordt, en de status in Firebase Hosting**

## Terugmelden aan Jasper

1. De echte **project-ID**
2. De zes **`VITE_FIREBASE_*`**-waarden (publiek, mogen gewoon in een bericht)
3. Staat **Blaze** aan, en staat het **budgetalarm** op €10?
4. Staat de **Go live**-run op groen? Zo niet: de naam van de stap die faalde en de foutregel
5. Waar de **DNS** van `jeconcept.be` beheerd wordt, en de status van het domein in Hosting
6. Bevestiging dat het gedownloade **servicesleutel-bestand verwijderd** is

---

## Als er iets misgaat

| Wat je ziet | Wat er aan de hand is | Wat je doet |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT ontbreekt` | een geheim staat er niet of heet anders | stap 7 nalopen; hoofdlettergevoelig |
| `De servicesleutel is geen geldige JSON` | er is maar een stuk van het bestand geplakt | opnieuw plakken, van `{` tot `}` |
| `HTTP Error: 400, Billing account` | project staat nog op Spark | Blaze aanzetten (stap 2), dan opnieuw draaien |
| `Permission denied to get service` / `403` op `serviceusage` | de service account mist **Service Usage Admin** | rollen toekennen (stap 6c), daarna opnieuw draaien |
| `Permission denied while using the Eventarc Service Agent` | de allereerste Firestore-trigger van dit project; Google heeft een paar minuten nodig | niets doen — de uitrol probeert het drie keer. Blijft het staan, dan opnieuw draaien |
| `Permission denied` bij functions of Firestore | de servicesleutel hoort bij een ander project | sleutel opnieuw genereren in het juiste project (stap 6b) |
| Witte pagina, console zegt `VITE_FIREBASE_* ontbreken` | de geheimen stonden er nog niet tijdens de build | geheimen zetten, **Go live** opnieuw draaien met *alleen de applicatie* |
| Borden traag of een index-fout in de console | indexes nog niet klaar | Firestore bouwt ze in de achtergrond af; enkele minuten wachten |
| Domein blijft op *Needs setup* | Cloudflare-proxy staat aan | wolkje op grijs (stap 9c) |
| `Dit account heeft geen toegang` na inloggen | e-maildomein staat niet in `config/access` | **Go live** draaien met *Basisgegevens zetten* aan, of laten uitnodigen |

Draait **Go live** opnieuw? Dat mag altijd. Elke stap is herhaalbaar: de rules worden overschreven,
de basisgegevens worden samengevoegd op vaste id's, en de applicatie wordt opnieuw gepubliceerd.
