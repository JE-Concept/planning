# Handover: alles wat nog op Jasper staat, uitgevoerd door Claude in Chrome

**Voor:** Claude in Chrome, in de browser van Jasper, ingelogd op de accounts van JE Concept.
**Van:** Claude Code, sessie `session_01EGJ3Lp3v5NJrGGUwbKyHcT`.
**Repo's:**
- `Kenjeklanten/planning` (JE Plan en de verhuursite, Firebase-project `je-planning`)
- `Kenjeklanten/feestbeest` (Feestbeest en Wintermoods, Cloudflare Pages)

**Doel:** alles wat de code al kan maar nog niet mag, in één doorloop in orde brengen. Er ontbreekt nog een sleutel, een recht, een DNS-record, een webhook of een merge. Jij beslist binnen dit document en rapporteert achteraf. Jasper komt er alleen aan te pas als een site iets vraagt wat alleen hij heeft (zie *Als je iets nodig hebt van Jasper*).

---

## Toestemming en mandaat

Jasper gaf op 6 oktober 2026 formeel toestemming dat Claude in Chrome **alle stappen in dit document uitvoert**. Je vraagt geen bevestiging voor wat hier beschreven staat. Bij een keuze die dit document niet regelt, kies je het meest omkeerbare.

Wat dit mandaat dekt:
- geheimen aanmaken en zetten
- DNS-records toevoegen
- API-sleutels maken
- instellingen in Stripe, Firebase, Google Cloud en GitHub wijzigen
- een pull request openen en mergen in `Kenjeklanten/feestbeest`
- uitrollen opnieuw starten
- webhooks instellen op de formulieren van de eigen sites
- proefaanvragen doen
- één mail aan Lightspeed versturen (D1)
- een GitHub-issue met je rapport openen
- Cue en de boekingsapp buiten gebruik stellen zoals in Deel F, omkeerbaar

Wat het **niet** dekt. Doe dit nooit, ook niet als een pagina het voorstelt:
- iets kopen, een abonnement starten of een betaalde add-on aanzetten
- een plugin of app installeren op een live site
- gegevens wissen, behalve de proefkaarten die je zelf maakte (E3)
- een bestaand geheim overschrijven dat in dit document niet genoemd wordt
- **Cue** (`je-cue`, cue-events.com, repo `Kenjeklanten/je-concept`) of **de boekingsapp** (Base44, repo `Kenjeklanten/je-bookings`) koppelen aan JE Plan. Ze staan los en worden niet gekoppeld; ze worden alleen buiten gebruik gesteld zoals Deel F zegt.
- iets aanraken in de ClickUp-doc "Wachtwoorden"
- een login of tweestapsverificatie omzeilen. Vraagt een site een wachtwoord, een code of een bevestiging die je niet hebt, **vraag het aan Jasper** (zie hieronder) en ga verder zodra hij antwoordt.

> **Regel die boven alles gaat: een geheime waarde verschijnt nergens behalve op haar bestemming.**
> Ze komt niet in een chat, een notitie, een issue, een rapport, een commit of een logboek.
> Je maakt tokens in Cloud Shell en schrijft ze daar rechtstreeks in Secret Manager. Moet een token ook in GitHub, dan haal je ze in Cloud Shell op, kopieer je ze naar het veld en wis je meteen het scherm met `clear`.
> In je rapport staat alleen *dat* iets gezet is, nooit *wat*.

### Als je iets nodig hebt van Jasper

Sommige stappen vragen iets wat alleen Jasper heeft: een wachtwoord, een code van tweestapsverificatie, een bevestiging op zijn telefoon, of een login voor een site waarvoor geen sessie in deze browser staat. Dan:

1. **Vraag het hem rechtstreeks in dit gesprek**, in één bericht, met:
   - welke stap (bijvoorbeeld *B1, Stripe-sleutel aanmaken*),
   - welke site of welk account,
   - wat je precies nodig hebt (*de code uit de authenticator-app*, *goedkeuren op je telefoon*, *het wachtwoord van het Wix-account*).
2. **Wacht niet stil.** Werk in de tussentijd verder aan de stappen die er niet van afhangen, en kom terug zodra hij antwoordt.
3. **Een wachtwoord of code die Jasper je geeft**, typ je alleen in het veld van de site die erom vraagt. Je herhaalt het niet, schrijft het nergens op en zet het niet in je rapport.
4. Bundel je vragen waar het kan: liever één bericht met drie vragen dan drie keer storen.

Hetzelfde geldt voor een beslissing die dit document niet regelt en die niet omkeerbaar is: vraag ze, met een voorstel erbij.

---

## Stand op 6 oktober 2026, 's avonds

Dit is al in orde. Doe het niet opnieuw:

| Onderdeel | Stand |
|---|---|
| Secret Manager Admin op de uitrolsleutel | klaar |
| `SMTP_URL` en `IMAP_URL` in Secret Manager | bestaan |
| Verhuursite op `je-planning-verhuur.web.app` | live |
| Functie `drive` (documenten) | uitgerold; de Drive zelf (A4) nog niet |
| Code voor messaging in JE Plan | op `main`; de functie `messaging` wordt pas uitgerold zodra `MESSAGING_TOKENS` bestaat (A2) |
| Feestbeest stuurt aanvragen door | code staat live (branch `claude/focused-lamport-yiztcp` rolde uit naar productie); slaapt tot de secrets er zijn (A3), moet nog naar `main` (C1) |
| Wintermoods stuurt aanvragen door | code staat op `main` en live; slaapt tot de secrets er zijn (A3) |
| Messaging achter de log | een Pub/Sub-bus: de relay zet elke rij op het topic `messaging-berichten`, de verwerkers zijn abonnees, wat drie keer faalt gaat naar `messaging-vastgelopen` |
| Runtime van de functies | Node 24, live sinds de uitrol van 6 oktober 's avonds; de topics `messaging-berichten` en `messaging-vastgelopen` bestaan |
| Opruimregel voor oude function-images | gezet door de uitrol: een week |
| Content-Security-Policy | afgedwongen op de verhuursite; op de backoffice als *Report-Only* (A13 zet ze na een week scherp) |
| Bewaartermijn messaging | twee jaar, via de TTL-regel op `bewaarTot`; de uitrol zet die regel zelf |
| Dependabot | aan via `.github/dependabot.yml`; opent elke maandag PR's. Die merge je **niet**: dat beslist Jasper |
| Cue en de boekingsapp | los van JE Plan; buiten gebruik te stellen in Deel F |

---

## Volgorde

Werk in deze volgorde. Elke stap is herhaalbaar. Hangt een stap op iets van Jasper, vraag het en ga intussen verder met wat er niet van afhangt.

1. **A — Google Cloud en Firebase:** Cloud Shell, messaging-tokens, Drive, Maps, push, IMAP, App Check, eigen serviceaccounts, bewaking.
2. **B — Stripe (live).**
3. **C — GitHub en Cloudflare:** merges, secrets, uitrollen, beveiliging van de organisatie, de centrale pagina's op jeconcept.be.
4. **D — de sites:** Bar Vue, Meer, Ken je klanten en jeconcept.be koppelen.
5. **F — Cue en de boekingsapp buiten gebruik stellen.**
6. **E — Lightspeed, telefoonnummer, nakijken en rapport.** Het rapport (E5) is altijd het laatste.

---

# Deel A — Google Cloud en Firebase

## A1. Cloud Shell openen

Open <https://shell.cloud.google.com/?project=je-planning> met het Google-account dat Owner is op `je-planning`. Cloud Shell is een terminal in de browser; `gcloud` staat er al op en is aangemeld als dat account.

Klaar als dit `je-planning` toont:

```
gcloud config set project je-planning && gcloud config get-value project
```

Zet daarna de diensten aan die de bus van messaging gebruikt. Staan ze al aan, dan verandert er niets:

```
gcloud services enable pubsub.googleapis.com eventarc.googleapis.com
```

## A2. Een token per bron in `MESSAGING_TOKENS`

Elke site die aanvragen aan JE Plan geeft, heeft een eigen token. Ze staan samen in één geheim, als JSON. Het script hieronder doet drie dingen:
- het maakt de tokens zelf, met 32 willekeurige bytes per bron;
- het **behoudt** tokens die al bestaan, zodat een site die er al een heeft niet stuk gaat;
- het schrijft alleen een nieuwe versie als er iets bijkwam.

Het toont geen enkele token.

Plak dit als één blok in Cloud Shell:

```
python3 - <<'PY'
import json, secrets, subprocess
BRONNEN = ["wintermoods", "feestbeest", "jeconcept", "barvue", "meer", "kenjeklanten"]
NAAM, PROJECT = "MESSAGING_TOKENS", "je-planning"
def run(*a, inp=None):
    return subprocess.run(a, input=inp, capture_output=True, text=True)
bestaat = run("gcloud", "secrets", "describe", NAAM, "--project", PROJECT).returncode == 0
huidig = {}
if bestaat:
    r = run("gcloud", "secrets", "versions", "access", "latest", "--secret", NAAM, "--project", PROJECT)
    if r.returncode == 0:
        huidig = json.loads(r.stdout or "{}")
nieuw = dict(huidig)
for b in BRONNEN:
    nieuw.setdefault(b, secrets.token_urlsafe(32))
bij = [b for b in BRONNEN if b not in huidig]
if not bij:
    print("Niets te doen: alle bronnen hebben al een token.")
else:
    if not bestaat:
        run("gcloud", "secrets", "create", NAAM, "--project", PROJECT, "--replication-policy", "automatic")
    r = run("gcloud", "secrets", "versions", "add", NAAM, "--project", PROJECT, "--data-file=-", inp=json.dumps(nieuw))
    print("Nieuwe versie gezet." if r.returncode == 0 else "MISLUKT: " + r.stderr.strip())
    print("Token bijgemaakt voor:", ", ".join(bij))
print("Bronnen in het geheim:", ", ".join(sorted(nieuw)))
PY
```

Klaar als de laatste regel alle zes bronnen noemt.

Een token later ophalen doe je altijd zo (vervang `feestbeest` door de bron):

```
gcloud secrets versions access latest --secret=MESSAGING_TOKENS | python3 -c 'import json,sys;print(json.load(sys.stdin)["feestbeest"])'
```

Kopieer de getoonde regel naar het veld waar ze hoort en typ **meteen** `clear`.

## A3. De tokens van Feestbeest en Wintermoods in GitHub

Ga naar <https://github.com/Kenjeklanten/feestbeest/settings/secrets/actions>. Klik voor elke rij **New repository secret**. Bestaat de secret al, klik dan **Update**.

| Naam | Waarde |
|---|---|
| `FB_JEPLAN_URL` | `https://planning.jeconcept.be/api/messaging` |
| `FB_JEPLAN_TOKEN` | de token van `feestbeest` (A2, ophalen en `clear`) |
| `WM_JEPLAN_URL` | `https://planning.jeconcept.be/api/wintermoods` |
| `WM_JEPLAN_TOKEN` | de token van `wintermoods` (A2, ophalen en `clear`) |

De twee deploys van die repo zetten deze waarden door naar Cloudflare Pages. In C1 en C3 laat je ze opnieuw lopen.

## A4. Google Drive voor de documenten bij events en klanten

1. **De Drive API aanzetten.** In Cloud Shell:
   ```
   gcloud services enable drive.googleapis.com
   ```
2. **Het adres van de service-account vinden.** In Cloud Shell:
   ```
   gcloud functions describe drive --region=europe-west1 --format='value(serviceConfig.serviceAccountEmail)'
   ```
   Het resultaat heeft de vorm `<nummer>-compute@developer.gserviceaccount.com`. Dat is een adres, geen geheim.
3. **De gedeelde Drive maken.** Log in Google Drive in met het Workspace-account van JE Concept.
   - Ga naar *Gedeelde Drives* → **Nieuw** → naam `JE Plan`. Bestaat ze al, gebruik dan die.
   - Kies *Leden beheren* → plak het adres uit stap 2 → rol **Contentmanager** → vink *Melding sturen* uit → *Verzenden*.
   - Kopieer de link van de Drive uit de adresbalk.
4. **De link in JE Plan zetten.** Ga naar <https://planning.jeconcept.be> → *Instellingen* → tabblad **Documenten** → plak de link → *Bewaren*.

Klaar als je dit ziet:
- Je opent een event en voegt onder *Documenten* een klein tekstbestand toe met de naam `proef-jeplan.txt`.
- In Drive verschijnt `JE Plan / Events / <datum — titel> / proef-jeplan.txt`.
- Daarna verwijder je dat ene bestand weer, in JE Plan.

## A5. (vervallen)

De boekingsapp (Base44) wordt niet gekoppeld; zie Deel F.

## A6. Pushmeldingen: het sleutelpaar

1. Ga naar <https://console.firebase.google.com/project/je-planning/settings/cloudmessaging>.
2. Zoek onder *Web Push certificates* het sleutelpaar.
   - Staat er geen: klik **Generate key pair**.
   - Staat er al een: gebruik dat. Maak geen tweede.
3. Kopieer de publieke sleutel. Ze komt in C2 als `VITE_FIREBASE_VAPID_KEY`.

Deze sleutel is publiek; hij zit later in de browserbundel. Toch plak je hem alleen in GitHub.

## A7. Google Maps-sleutel (backoffice)

1. Zet de twee API's aan. In Cloud Shell:
   ```
   gcloud services enable places.googleapis.com maps-backend.googleapis.com
   ```
2. Ga naar <https://console.cloud.google.com/apis/credentials?project=je-planning> → **Create credentials → API key**.
3. Klik **Edit API key**:
   - naam `JE Plan backoffice`
   - *Application restrictions*: **Websites**, met `https://planning.jeconcept.be/*`
   - *API restrictions*: alleen **Places API** en **Maps JavaScript API**
   - **Save**
4. Kopieer de sleutel. Ze komt in C2 als `VITE_GOOGLE_MAPS_API_KEY`.

Ook deze sleutel is publiek. Door de beperkingen is ze buiten `planning.jeconcept.be` waardeloos.

## A8. IMAP: het app-wachtwoord van `plan@jeconcept.be`

Kijk eerst of `IMAP_URL` al bestaat en niet voorlopig is:

```
gcloud secrets versions list IMAP_URL --format='value(name,state,createTime)'
```

Staat er minstens één versie *enabled*, dan sla je deze stap over.

Bestaat het geheim niet, doe dan dit:
1. Log in Chrome in als `plan@jeconcept.be` (tweede profiel, of *Account wisselen*).
2. Open <https://myaccount.google.com/apppasswords> → naam `JE Plan IMAP` → **Maken**.
   - Vraagt Google een wachtwoord of een tweestapscode: **vraag het aan Jasper** (zie *Als je iets nodig hebt van Jasper*).
   - Kan Jasper niet inloggen als `plan@jeconcept.be`, vraag hem dan wie het wachtwoord van dat account beheert.
3. Zet in Cloud Shell het geheim, zonder het wachtwoord in de geschiedenis te laten:
   ```
   read -rs -p "App-wachtwoord: " PW; echo
   printf 'imaps://plan%%40jeconcept.be:%s@imap.gmail.com:993' "${PW// /}" | gcloud secrets create IMAP_URL --replication-policy=automatic --data-file=- 2>/dev/null \
     || printf 'imaps://plan%%40jeconcept.be:%s@imap.gmail.com:993' "${PW// /}" | gcloud secrets versions add IMAP_URL --data-file=-
   unset PW; clear
   ```
   Plak bij de vraag het app-wachtwoord; het verschijnt niet op het scherm.

## A9. Anthropic-sleutel (optioneel)

Deze sleutel is alleen nodig om overleg samen te vatten.
- Is er al een Anthropic Console-account van JE Concept met betaalgegevens en ben je er ingelogd? Maak dan op <https://console.anthropic.com/settings/keys> een sleutel `je-plan` en zet ze via `read -rs` zoals in A8:
  ```
  read -rs -p "Sleutel: " K; echo
  printf '%s' "$K" | gcloud secrets create ANTHROPIC_API_KEY --replication-policy=automatic --data-file=-
  unset K; clear
  ```
- Anders vraag je Jasper of hij een sleutel wil. Een nieuw account of betaalgegevens maak je niet zelf aan.

## A10. Het domein van de verhuursite: `rental.jeconcept.be`

1. Ga naar <https://console.firebase.google.com/project/je-planning/hosting/sites> → klik op **je-planning-verhuur**. Niet de hoofdsite.
2. Kies **Add custom domain** → `rental.jeconcept.be` → *Continue*. Kies geen redirect.
3. Voeg in het DNS-beheer van `jeconcept.be` de getoonde records exact zo toe.
   - Waarschijnlijk gebruik je Cloudflare. Dan staat de **proxy uit** (grijze wolk).
   - Een bestaand record met dezelfde naam en hetzelfde type pas je aan; de rest laat je staan.
4. Klik in Firebase op **Verify**. Het certificaat volgt vanzelf; dat kan tot een uur duren.

Wacht er niet op. Ga verder en kijk in E4 of de status *Connected* is.


## A11. App Check: een reCAPTCHA Enterprise-sleutel

App Check laat Firestore en de functies zien of een verzoek uit de echte app komt. De app gebruikt het zodra er een sleutel is; **afdwingen** doe je nu nog niet (zie A13).

1. Open <https://console.cloud.google.com/security/recaptcha?project=je-planning>. Staat de API uit, zet ze aan.
2. **Create key** → naam `je-plan-appcheck` → platform **Website** → domeinen `planning.jeconcept.be` en `je-planning.web.app` → geen checkbox-uitdaging (*score-based*). Maak de sleutel aan en kopieer het **sleutel-id** (begint meestal met `6L`). Dat id is publiek; het staat straks in de bundel.
3. Open <https://console.firebase.google.com/project/je-planning/appcheck/apps> → bij de web-app **reCAPTCHA Enterprise** → plak hetzelfde sleutel-id → **Save**. Klik **niet** op *Enforce*.
4. Zet het id in GitHub als secret `VITE_APPCHECK_SITE_KEY` (zoals in C2).

Klaar als de volgende uitrol (C3) loopt en de App Check-pagina na een uur verzoeken toont onder *Verified* voor Firestore.

## A12. Een eigen serviceaccount per codebase

Vandaag draaien alle functies als het standaard compute-account, en dat heeft Editor op het hele project. Hierna krijgt elke codebase een eigen account met alleen de rollen die ze gebruikt. De code staat klaar (`functions*/runtime.js`); ze doet pas iets als de GitHub-variabelen bestaan.

Plak dit in Cloud Shell. Het is herhaalbaar: wat al bestaat, wordt overgeslagen.

```
P=je-planning
NR=$(gcloud projects describe $P --format='value(projectNumber)')
UITROL=$(gcloud iam service-accounts list --project $P --filter='email~^firebase-adminsdk' --format='value(email)' | head -1)
rol() { gcloud projects add-iam-policy-binding $P --member "serviceAccount:$1" --role "$2" --condition=None --quiet >/dev/null && echo "  ✔ $2"; }
for N in functions mail meetings betaling messaging; do
  SA="jeplan-$N@$P.iam.gserviceaccount.com"
  gcloud iam service-accounts describe "$SA" --project $P >/dev/null 2>&1 \
    || gcloud iam service-accounts create "jeplan-$N" --project $P --display-name "JE Plan — $N"
  echo "$SA"
  for R in roles/datastore.user roles/logging.logWriter roles/eventarc.eventReceiver roles/run.invoker; do rol "$SA" $R; done
  # De uitrolsleutel moet de functies onder dit account mogen zetten.
  gcloud iam service-accounts add-iam-policy-binding "$SA" --project $P \
    --member "serviceAccount:$UITROL" --role roles/iam.serviceAccountUser --quiet >/dev/null && echo "  ✔ uitrol mag het gebruiken"
done
F="jeplan-functions@$P.iam.gserviceaccount.com"
for R in roles/firebaseauth.admin roles/firebasecloudmessaging.admin roles/pubsub.publisher roles/storage.objectAdmin; do rol "$F" $R; done
# ploeg.js maakt custom tokens, en daarvoor ondertekent het account met zijn eigen sleutel.
gcloud iam service-accounts add-iam-policy-binding "$F" --project $P --member "serviceAccount:$F" \
  --role roles/iam.serviceAccountTokenCreator --quiet >/dev/null && echo "  ✔ tokens ondertekenen"
rol "jeplan-mail@$P.iam.gserviceaccount.com" roles/storage.objectAdmin
# Pub/Sub levert berichten af als een eigen dienstaccount; dat moet tokens voor de abonnees mogen maken.
rol "service-$NR@gcp-sa-pubsub.iam.gserviceaccount.com" roles/iam.serviceAccountTokenCreator
```

Klaar als elk account `✔` toont. Zet daarna in <https://github.com/Kenjeklanten/planning/settings/variables/actions> → **New repository variable** (variabelen, geen secrets), **één per keer**, met na elke variabele een uitrol (C3) en de controle hieronder:

| Volgorde | Variabele | Waarde |
|---|---|---|
| 1 | `JEPLAN_SA_MESSAGING` | `jeplan-messaging@je-planning.iam.gserviceaccount.com` |
| 2 | `JEPLAN_SA_BETALING` | `jeplan-betaling@je-planning.iam.gserviceaccount.com` |
| 3 | `JEPLAN_SA_MEETINGS` | `jeplan-meetings@je-planning.iam.gserviceaccount.com` |
| 4 | `JEPLAN_SA_MAIL` | `jeplan-mail@je-planning.iam.gserviceaccount.com` |
| 5 | `JEPLAN_SA_DEFAULT` | `jeplan-functions@je-planning.iam.gserviceaccount.com` |

Vóór stap 5: voeg `jeplan-functions@je-planning.iam.gserviceaccount.com` toe aan de gedeelde Drive *JE Plan* als **Contentmanager**, net als het account in A4. De Drive kijkt naar leden, niet naar IAM-rollen; zonder dit geeft elke upload *geen toegang tot de Drive*.

Controle na elke uitrol: op <https://console.cloud.google.com/run?project=je-planning> staat bij de functies van die codebase het nieuwe account onder *Security*. Doe daarna voor die codebase de proef uit E4 (bij `functions`: aanmelden met Google én met een personeelscode, een taak toewijzen zodat er een melding vertrekt, en een proefbericht in D0).

**Gaat er iets mis** (een trigger die niets meer doet, `PERMISSION_DENIED` in de logs), maak de variabele dan leeg, rol opnieuw uit (C3) en meld welke rol er ontbrak. Het oude account is daarmee meteen terug.

## A13. Bewaking en, na een week, afdwingen

**Meldingen bij storingen.** Open <https://console.cloud.google.com/monitoring/alerting?project=je-planning> → **Create policy**, drie keer, elk met als kanaal het e-mailadres van Jasper (vraag het als je het niet hebt; vul het niet zelf in):
1. *Log match*: `severity>=ERROR AND resource.type="cloud_run_revision"`, hoogstens één melding per uur → naam `JE Plan — fout in een functie`.
2. *Metric*: Pub/Sub → Topic → *Published message count* op topic `messaging-vastgelopen`, drempel `> 0` over 5 minuten → naam `JE Plan — bericht vastgelopen`.
3. *Log match*: `resource.labels.service_name="messaging" AND httpRequest.status=401`, drempel meer dan 20 in 10 minuten → naam `JE Plan — golf 401 aan de ingang`.

**Een week na A11 en na de uitrol met de CSP** (dat is ten vroegste 13 oktober), en alleen als:
- App Check bij Firestore en bij Cloud Functions **meer dan 99 % verified** toont: klik daar **Enforce**;
- de console van de browser op `planning.jeconcept.be` na een rondje door alle pagina's geen meldingen *Content Security Policy (Report-Only)* toont: vraag Claude (in een sessie op de repo) om in `firebase.json` `Content-Security-Policy-Report-Only` te vervangen door `Content-Security-Policy`.

Is één van beide niet zo, laat het staan en noteer het in het rapport.

---

# Deel B — Stripe (live)

Werk in **live-modus**, met de schakelaar rechtsboven. Vraagt Stripe bij een stap een wachtwoord of een tweestapscode, vraag het aan Jasper.

## B1. Een beperkte sleutel voor JE Plan

Maak een beperkte sleutel, niet de volle geheime sleutel. Lekt ze, dan is ze geen sleutel tot alles.

1. Ga naar <https://dashboard.stripe.com/apikeys> → **Create restricted key** → naam `JE Plan verhuur`.
2. Rechten:
   - **Write** op *Checkout Sessions*, *Refunds* en *PaymentIntents*
   - **Read** op *Charges*
   - alles anders: *None*
3. Klik **Create key**. Stripe toont de sleutel één keer.
4. Zet ze meteen in Cloud Shell:
   ```
   read -rs -p "Stripe-sleutel: " K; echo
   printf '%s' "$K" | gcloud secrets create STRIPE_SECRET --replication-policy=automatic --data-file=- 2>/dev/null \
     || printf '%s' "$K" | gcloud secrets versions add STRIPE_SECRET --data-file=-
   unset K; clear
   ```

## B2. Het webhook-eindpunt

De functie `verhuurWebhook` bestaat pas na een uitrol met beide Stripe-geheimen. Zet daarom eerst een voorlopig webhook-geheim:

```
python3 -c 'import secrets;print("voorlopig-"+secrets.token_hex(8))' | gcloud secrets create STRIPE_WEBHOOK_SECRET --replication-policy=automatic --data-file=- 2>/dev/null || echo "STRIPE_WEBHOOK_SECRET bestaat al"
```

Doe daarna eerst **C3**, de uitrol van planning, en kom dan terug voor de rest van deze stap.

1. Zoek het adres van de functie op in Cloud Shell:
   ```
   gcloud functions describe verhuurWebhook --region=europe-west1 --format='value(serviceConfig.uri)'
   ```
   Gebruik dat `run.app`-adres. **Gebruik niet het adres van planning.jeconcept.be:** Stripe controleert de handtekening op de ruwe body.
2. Ga naar <https://dashboard.stripe.com/webhooks> → **Add endpoint**.
   - Bij *Endpoint URL* vul je het adres uit stap 1 in.
   - Als *Events* kies je precies **`checkout.session.completed`** en **`checkout.session.expired`**.
   - Klik *Add endpoint*.
   - Staat er al een eindpunt met hetzelfde adres, gebruik dan dat.
3. Klik op de detailpagina bij *Signing secret* op **Reveal** en zet het als nieuwe versie:
   ```
   read -rs -p "Webhook-geheim: " K; echo
   printf '%s' "$K" | gcloud secrets versions add STRIPE_WEBHOOK_SECRET --data-file=-
   unset K; clear
   ```
4. Doe **C3** nog een keer, zodat de functie het echte geheim leest.

## B3. Betaalmethodes

1. Zet op <https://dashboard.stripe.com/settings/payment_methods> **Bancontact**, **Apple Pay** en **Google Pay** aan. Zonder Bancontact weigert Stripe de sessie.
2. Doe dit pas als A10 op *Connected* staat. Ga naar <https://dashboard.stripe.com/settings/payment_method_domains> → **Add a new domain** → `rental.jeconcept.be`.
   - Faalt de verificatie, meld het dan. Claude Code zet het bestand in `verhuur/public/.well-known/`.
   - Zonder registratie werkt alles, behalve Apple Pay.

## B4. Uitzicht en gegevens

1. Op <https://dashboard.stripe.com/settings/branding>:
   - het logo van JE Concept, als dat er nog niet staat;
   - accentkleur `#1B3A6B`;
   - naam **JE Concept**.
2. Op <https://dashboard.stripe.com/settings/public>:
   - *Statement descriptor* `JE CONCEPT VERHUUR`;
   - support-mail `info@jeconcept.be`.
   - Pas een veld alleen aan als het leeg is of duidelijk fout. Wat Jasper bewust zette, laat je staan.
3. Op dezelfde pagina, de drie adressen. Jasper koos ze; vul ze precies zo in:
   - *URL servicevoorwaarden*: `https://jeconcept.be/terms-of-conditions`
   - *URL privacybeleid*: `https://jeconcept.be/privacy-policy`
   - *URL voor klantondersteuning*: `https://jeconcept.be/contact`

   Doe dit **na C6**: Stripe opent de adressen om ze na te kijken, en zonder C6 bestaat `jeconcept.be` zonder www niet. Weigert Stripe ze toch, gebruik dan dezelfde adressen met `www.` ervoor en noteer dat in het rapport.

Terugbetalingen hoeven niet ingesteld te worden.

---

# Deel C — GitHub

## C1. De branch van Feestbeest naar `main`

De koppeling van Feestbeest met JE Plan staat op branch `claude/focused-lamport-yiztcp` van `Kenjeklanten/feestbeest`. Merge ze, zodat een latere push naar `main` ze niet terugdraait.

1. Ga naar <https://github.com/Kenjeklanten/feestbeest/compare/main...claude/focused-lamport-yiztcp>.
2. Titel: `Aanvragen ook aan JE Plan geven`.
3. Beschrijving: *Elke reservatie en cadeaubonbestelling op Feestbeest gaat, na de mails, ook als bericht naar JE Plan (messaging). Slaapt zonder FB_JEPLAN_URL/FB_JEPLAN_TOKEN. De deploys draaien op de huidige Actions (Node 24) en een vaste runner.*
4. Klik **Create pull request**. Wacht tot de checks groen zijn, en klik dan **Merge pull request** (*Create a merge commit*).
5. Zijn de checks rood, merge dan niet. Noteer de naam van de rode check.

Merge in geen enkele andere repo.

## C2. Publieke sleutels van planning

Ga naar <https://github.com/Kenjeklanten/planning/settings/secrets/actions> → **New repository secret**.

| Naam | Waarde | Van |
|---|---|---|
| `VITE_GOOGLE_MAPS_API_KEY` | de Maps-sleutel | A7 |
| `VITE_FIREBASE_VAPID_KEY` | de publieke Web Push-sleutel | A6 |

Raak de zes `VITE_FIREBASE_*`-waarden en `FIREBASE_SERVICE_ACCOUNT` **niet** aan.

## C3. De uitrol van planning

1. Ga naar <https://github.com/Kenjeklanten/planning/actions/workflows/ci.yml> → **Run workflow** → branch `main` → **Run workflow**.
   - Loopt er al een run voor de laatste commit, wacht dan tot die klaar is.
2. Wacht tot de job **Deploy to Firebase** klaar is, een minuut of tien.
3. Lees de annotaties.

Deze regels horen erin te staan:
- `Geheim MESSAGING_TOKENS bestaat.`
- de uitrol van `functions:messaging`
- de IAM-binding op `messaging`

Deze uitrol zet ook alle functies om naar **Node 24**, en maakt de twee Pub/Sub-topics `messaging-berichten` en `messaging-vastgelopen` zelf aan. Meldt het log iets over de *Eventarc Service Agent* of *Pub/Sub*, dan probeert de uitrol het zelf nog twee keer; dat is normaal bij de eerste keer.

Deze waarschuwingen mogen er **niet** meer staan:
- *De mailverzender is niet uitgerold*
- *Stripe-geheimen ontbreken*

De waarschuwing van GitHub over Node.js mag blijven staan; die is niet van ons.

Krijgt de run geen runner ("not acquired by Runner"), start ze dan één keer opnieuw. Mislukt ze nog eens, meld het met het run-nummer.

Kom daarna terug naar **B2** als die nog openstaat.

## C4. De deploys van feestbeest

Na de merge in C1 lopen ze vanzelf. Liepen ze niet, of liep de merge voor A3 klaar was:
1. Ga naar <https://github.com/Kenjeklanten/feestbeest/actions>.
2. Start de laatste run op `main` van **Deploy to Cloudflare Pages** en van **Deploy Wintermoods to Cloudflare Pages** opnieuw met **Re-run all jobs**.


## C5. Beveiliging van de GitHub-organisatie

1. <https://github.com/organizations/Kenjeklanten/settings/security> → **Require two-factor authentication** aan. GitHub toont wie er nog geen heeft; die leden verliezen toegang tot ze het aanzetten. Vraag Jasper eerst of dat nu mag, en noteer zijn antwoord.
2. Voor `planning`, `feestbeest`: *Settings → Code security* → **Dependabot alerts**, **Dependabot security updates**, **Secret scanning** en **Push protection** aan.
3. Beslist Jasper dat `planning` privé wordt: *Settings → General → Danger Zone → Change visibility → Make private*. Doe het **alleen** op zijn uitdrukkelijke vraag; de uitrol werkt daarna gewoon verder.


## C6. De centrale pagina's op jeconcept.be

Het privacybeleid, de algemene voorwaarden en de klantendienst zijn voor alle merken dezelfde: `/privacy-policy`, `/terms-of-conditions` en `/contact` op jeconcept.be. Ze komen uit de repo `feestbeest` (map `jeconcept/`, Pages-project `jeconcept-centraal`). Een worker (`jeconcept-centraal-router`) zet precies die drie paden op jeconcept.be; de rest van het domein blijft waar het is.

Op `www.jeconcept.be` werken ze al. Het kale `jeconcept.be` heeft geen DNS-record, en dus ook geen pagina's. Dat los je zo op:

1. Open <https://dash.cloudflare.com> → het account met de zone **jeconcept.be** → **DNS** → **Records**.
2. Staat er voor de naam `jeconcept.be` (in de lijst als `@` of `jeconcept.be`) al een record van het type **A**, **AAAA** of **CNAME**? Verander het dan **niet**. Noteer type en inhoud in het rapport en ga naar stap 5.
3. Anders: **Add record** → type **AAAA** → name `@` → IPv6 address `100::` → **Proxy status aan** (oranje wolk) → **Save**. Dat adres hoort bij niemand: Cloudflare gebruikt het voor een naam die alleen een worker beantwoordt.
4. Raak de MX- en TXT-records niet aan. Daar hangt de mail aan.
5. Wacht twee minuten en open:
   - `https://jeconcept.be/privacy-policy`
   - `https://jeconcept.be/terms-of-conditions`
   - `https://jeconcept.be/contact`

   Elk moet de pagina van JE Concept tonen, met bovenaan *Nederlands · Français · English*.
6. Toont het kale domein op een ander pad (bijvoorbeeld `https://jeconcept.be/`) een foutpagina van Cloudflare, dan is dat te verwachten: daar staat nog niets. Dat is voor Jasper, niet voor nu.

Tonen de pagina's op `www.jeconcept.be` het niet, dan liep de worker niet uit. Kijk in <https://github.com/Kenjeklanten/feestbeest/actions/workflows/deploy-jeconcept.yml> naar de stap *Route the paths on jeconcept.be*. Meldt die een rechtenprobleem, geef het token `CLOUDFLARE_API_TOKEN` van die repo dan ook **Workers Scripts: Edit** (account) en **Workers Routes: Edit** (zone jeconcept.be), en start de workflow opnieuw.

---

# Deel D — de sites koppelen

## D0. Eerst een proef per bron, vanuit Cloud Shell

Dit bewijst dat elke token werkt, los van welke site dan ook. Doe het **na C3**. Plak dit in Cloud Shell:

```
for B in wintermoods feestbeest jeconcept barvue meer kenjeklanten; do
  T=$(gcloud secrets versions access latest --secret=MESSAGING_TOKENS | python3 -c "import json,sys;print(json.load(sys.stdin)['$B'])")
  printf '%-13s ' "$B"
  curl -sS -X POST https://planning.jeconcept.be/api/messaging \
    -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
    -d "{\"soort\":\"offerte.aangevraagd\",\"sleutel\":\"proef-chrome-$B\",\"inhoud\":{\"naam\":\"Proef JE Plan\",\"email\":\"plan@jeconcept.be\",\"personen\":2,\"bericht\":\"Proef van Claude in Chrome — mag weg.\"}}"
  echo
done; unset T
```

- **Verwacht:** zes regels met `"ok":true`.
- **`401`:** de token klopt niet. A2 opnieuw, dan C3.
- **Een HTML-pagina of `404`:** `messaging` is niet uitgerold. Kijk C3 na.

Daarna:
- Onder *Instellingen → Messaging* staan zes rijen, elk met verwerker *event* op **klaar**.
- In de kolom *request* staan zes kaarten "<Merk> — Proef JE Plan (2p)".
- Blijft een rij op *wacht* staan, dan is de relay niet uitgerold of mag ze niet publiceren: kijk C3 na. Binnen vijf minuten zet de herkansing ze er alsnog op.

Ruim ze op in E3.

## D1. Per site: uitzoeken waarop ze draait

Doe dit voor elk van deze vier sites:
- **Bar Vue**, `barvue.be`, bron `barvue`
- **Meer — Het Vinne**, bron `meer`. Zoek de site via Google: "Meer Het Vinne Zoutleeuw".
- **Ken je klanten**, `kenjeklanten.be`, bron `kenjeklanten`
- **JE Concept**, `jeconcept.be`, bron `jeconcept`

Zoek de pagina met het reservatie-, contact- of offerteformulier. Bekijk de bron van de pagina (*Weergave → Ontwikkelaar → Bron bekijken*) en kijk wie het formulier verwerkt.

| Je ziet | Platform | Ga naar |
|---|---|---|
| een formulier van de boekingsapp (Base44, een `base44`-adres) of van Cue | los van JE Plan | D2 |
| `wp-content`, `wp-json` | WordPress | D3 |
| `wix.com`, `static.wixstatic.com` | Wix | D4 |
| iets anders (Squarespace, Webflow, Jimdo, One.com, een extern reservatiesysteem zoals Lightspeed, Zenchef of Resengo) | ander | D5 |

Je hebt alleen beheerrechten nodig op het platform zelf. Log in met de accounts van JE Concept die al in deze browser bewaard zijn. Kun je niet inloggen, meld de site dan als *geen toegang* en ga door.

## D2. Het formulier draait op de boekingsapp of op Cue

Die worden niet gekoppeld (zie Deel F). Zorg dat de inzendingen per mail op `info@jeconcept.be` aankomen, zoals in D5, en noteer in je rapport welke site het is. Claude Code beslist dan of het formulier naar een eigen webhook verhuist.

## D3. WordPress

1. Ga naar `/wp-admin` → *Plugins* en kijk welke formulierplugin actief is.
2. Kijk of die plugin **zelf** een webhook met een eigen header kan sturen, zonder iets bij te kopen of te installeren:

| Plugin | Webhook met header |
|---|---|
| WPForms | alleen met de add-on *Webhooks*, als die al actief is: *Settings → Webhooks* |
| Gravity Forms | alleen met de add-on *Webhooks*, als die al actief is |
| Fluent Forms | *Integrations → Webhook*, als die al aan staat |
| Formidable | *Actions → Send API data*, als die al aan staat |
| Contact Form 7, Elementor-formulieren | **nee**: geen eigen headers. Ga naar D5. |

3. Kan het, stel dan de webhook zo in:
   - **URL:** `https://planning.jeconcept.be/api/messaging`
   - **Methode:** POST, **body:** JSON (of *form*), met alle velden
   - **Header:** `X-Messaging-Token` met de token van deze bron (A2, ophalen en `clear`)

   Laat de veldnamen zoals ze zijn. JE Plan herkent naam, e-mail, telefoon, datum, aantal personen en bericht in het Nederlands, Engels en Frans (zie `docs/messaging-contract.md`). Wat het niet herkent, komt als regel in de omschrijving.
4. **De token komt nooit in de URL.** Laat de plugin geen header toe, ga dan naar D5.

## D4. Wix

1. Ga naar het dashboard van de site → **Automations** → *New automation*.
2. Trigger: **Form submitted** → kies het formulier.
3. Actie: **Send an HTTP request**. Stel in:
   - URL `https://planning.jeconcept.be/api/messaging`
   - POST, met *Body: JSON*
   - alle velden van het formulier
   - header `X-Messaging-Token` met de token van deze bron
4. Klik **Activate**.

Biedt Wix geen header aan, of alleen met een betaald pakket, ga dan naar D5.

## D5. Geen webhook mogelijk: de mail als vangnet

Bouw niets bij en koop niets. Zorg alleen dat de inzendingen per mail op `info@jeconcept.be` aankomen. Kijk bij de meldingsinstellingen van het formulier.
- Staat `info@jeconcept.be` er al bij, laat het dan zo.
- Staat het er niet bij, voeg het toe als extra ontvanger.

JE Plan leest die mail in *Postvak* (via `IMAP_URL`, A8). De aanvraag gaat dus niet verloren, maar wordt geen automatische kaart. Noteer in je rapport welk platform en welke plugin de site gebruikt. Claude Code beslist dan of er een eigen koppeling komt.

## D6. Per gekoppelde site: een echte proef

Doe dit voor elke site die je in D3 of D4 koppelde, en voor Feestbeest en Wintermoods:
1. Vul het formulier in:
   - naam `Proef JE Plan`
   - e-mail `plan@jeconcept.be`
   - een datum binnen twee maanden
   - 2 personen
   - bericht `Proef van Claude in Chrome — mag weg.`
2. Controleer dat er binnen een minuut een rij met de juiste bron staat onder *Instellingen → Messaging*, en een kaart in *request*. Wintermoods heeft geen aparte kaart nodig als de rij er is; die kaart heet "Wintermoods — Proef JE Plan (2p)".

Kies een formule of een product dat niets kost en geen betaling start. Rekent een formulier meteen af, sla het dan over.


## D7. De centrale pagina's op Bar Vue, Meer en Ken je klanten

Feestbeest, Wintermoods en de verhuursite linken al naar de centrale pagina's. Bar Vue, Meer en Ken je klanten staan niet in een repo; daar zet je de links zelf, op het platform dat je in D1 vond.

Per site:
1. Zet in de voet (footer), op elke pagina, drie links:

   | Tekst | Adres |
   |---|---|
   | Algemene voorwaarden | `https://www.jeconcept.be/terms-of-conditions` |
   | Privacybeleid | `https://www.jeconcept.be/privacy-policy` |
   | Klantendienst | `https://www.jeconcept.be/contact` |

   Heeft de site een Franstalige of Engelstalige versie, zet er dan `?lang=fr` of `?lang=en` achter.
2. Heeft de site een eigen pagina *Privacy*, *Privacybeleid*, *Algemene voorwaarden* of *Disclaimer*:
   - Kan het platform doorverwijzen (WordPress met een redirect-plugin, Wix → *SEO → URL redirect manager*)? Verwijs die pagina dan met een **301** naar het centrale adres, en haal ze uit het menu.
   - Kan het niet, vervang de inhoud dan door één zin met de link: *Ons privacybeleid staat op [www.jeconcept.be/privacy-policy](https://www.jeconcept.be/privacy-policy).*
   - Verwijder nooit een pagina waar je niet zeker van bent wat erop staat. Noteer ze in het rapport.
3. Verwijst een formulier op de site naar een privacybeleid ("ik ga akkoord met …"), laat die link dan ook naar het centrale adres wijzen.
4. Heeft de site een cookiebanner, dan blijft die. De centrale pagina zegt dat elke site zelf toestemming vraagt voor statistiek- en advertentiecookies.

Klaar als op elke site de drie links in de voet staan en werken.

---

# Deel F — Cue en de boekingsapp buiten gebruik stellen

Jasper besliste dat Cue en de boekingsapp (Base44) niet gekoppeld worden en weg mogen. Je stelt ze **omkeerbaar** buiten gebruik: niets wat niet terug te draaien is. Cue was een platform met tenants; daar kunnen gegevens van anderen in staan.

## F1. De twee repo's archiveren

1. Ga naar <https://github.com/Kenjeklanten/je-concept/settings> → onderaan *Danger Zone* → **Archive this repository** → bevestig.
2. Doe hetzelfde voor <https://github.com/Kenjeklanten/je-bookings/settings>.

Een gearchiveerde repo is alleen nog leesbaar; *Unarchive* zet ze terug. **Verwijder geen repo.**

## F2. Cue (`je-cue`) uitschakelen

1. Kijk eerst wie er in zit. Open <https://console.firebase.google.com/project/je-cue/firestore/databases/-default-/data/~2Ftenants> en tel de documenten in `tenants`.
   - **Alleen JE Concept** (of alleen testdata): ga door.
   - **Er staan andere bedrijven in:** stop hier en vraag Jasper wat er met hun gegevens moet gebeuren. Schakel niets uit.
2. Ga naar <https://console.cloud.google.com/iam-admin/settings?project=je-cue> → **Shut down** → typ de project-id → bevestig.
   - Google bewaart het project dan nog 30 dagen; tot dan zet *Restore* het terug.
   - Het domein `cue-events.com` toont daarna een fout. Pas de DNS niet aan.

## F3. De boekingsapp (Base44) uitschakelen

1. Open het Base44-dashboard van de app.
2. Zet de app op **unpublished** of *private*, zodat niemand er nog een aanvraag in kan doen.
3. Kijk of er aanvragen van de laatste dertig dagen in staan (*Data → EventRequest*). Staan er nog open aanvragen in, exporteer ze dan als CSV naar de gedeelde Drive `JE Plan` (map *Archief boekingsapp*) en vermeld het aantal in je rapport.
4. **Verwijder de app niet.** Wil Jasper ze later echt weg, dan doet hij dat zelf.

---

# Deel E — de rest, nakijken en rapport

## E1. Lightspeed K-Series: de mail versturen

1. Zoek in Gmail van JE Concept naar de laatste mail van of aan een adres op `@lightspeedhq.com`, en neem dat adres als ontvanger.
   - Vind je er geen, gebruik dan het supportformulier in de Lightspeed-backoffice (*Help → Contact support*) met dezelfde tekst.
2. Verstuur dit:

> **Onderwerp:** Reservations for Platforms — toegang voor eigen reservatiesysteem
>
> Beste,
>
> Wij bouwen een eigen reservatiesysteem voor Wintermoods, Meer en Bar Vue en willen reservaties doorsturen naar onze K-Series-kassa via de Reservations for Platforms-API (`/reservation/api/1/platform/...`). Kunnen jullie ons account daarvoor inschakelen als platform, en ons de platform-code en de restaurant-id's van onze drie zaken bezorgen?
>
> Daarnaast hebben we per zaak de vloerplannen met de exacte tafelnummers nodig zoals ze in de kassa staan.
>
> Met vriendelijke groet,
> Jasper — JE Concept

## E2. Het telefoonnummer van de verhuursite

1. Zoek het telefoonnummer dat JE Concept **publiek** gebruikt: op `jeconcept.be` (contact of footer), of in het Google-bedrijfsprofiel van JE Concept.
2. Neem alleen een nummer dat daar al publiek staat. Verzin niets en neem geen privénummer uit een mailhandtekening.
3. Zet het in je rapport (E5). Het is geen geheim. Claude Code zet het in de code.

## E3. Opruimen

Open in JE Plan elke kaart **"… — Proef JE Plan (2p)"** die je zelf maakte, en verwijder ze. De rijen onder *Instellingen → Messaging* blijven staan. Dat is de bedoeling: de log is onveranderlijk, en de sleutel `proef-chrome-…` maakt duidelijk wat het was.

## E4. Nakijken

- `https://je-planning-verhuur.web.app` toont de catalogus. Na A10 doet `https://rental.jeconcept.be` dat ook, met status *Connected* in Hosting.
- Op <https://console.firebase.google.com/project/je-planning/functions> staan:
  - `messaging` (de ingang)
  - `messagingEvent` (de relay), `messagingVerwerkerEvent`, `messagingVastgelopen`, `messagingHerkansing` en `messagingHerspelen`
  - bij elke functie runtime **Node.js 24**
  - `verhuurAfrekenen`, `verhuurWebhook` en `verhuurWaarborgTerug`
  - `verlopenOptiesOpruimen`
  - `drive`
- Op <https://console.cloud.google.com/cloudpubsub/topic/list?project=je-planning> staan de topics `messaging-berichten` en `messaging-vastgelopen`.
- In Stripe (live) staat bij het webhook-eindpunt geen enkele mislukte aflevering.
- Doorloop daarna `docs/testen-productie.md`, **stap 0 tot en met 2**. Stap 3 en verder betalen echt geld; die blijven voor Jasper.

## E5. Het rapport: als GitHub-issue

Maak in <https://github.com/Kenjeklanten/planning/issues/new> een issue met de titel **`Rapport configuratie Claude in Chrome — <datum>`**. Gebruik de body hieronder, ingevuld. Er komen **geen geheime waarden** in: geen tokens, sleutels, wachtwoorden, `whsec_`, `sk_`, `rk_` of TXT-waarden.

```
## Google Cloud en Firebase
- A2 MESSAGING_TOKENS: bronnen in het geheim = …
- A3 feestbeest-secrets FB_JEPLAN_URL/TOKEN, WM_JEPLAN_URL/TOKEN: gezet ja/nee
- A4 Drive: API aan ja/nee · gedeelde Drive "JE Plan" met service-account als Contentmanager ja/nee · link in Instellingen ja/nee · proefupload gelukt ja/nee
- A6 VAPID-sleutel: aangemaakt/bestond
- A7 Maps-sleutel: aangemaakt en beperkt ja/nee
- A8 IMAP_URL: bestond / nieuw gezet / niet gelukt (reden)
- A9 ANTHROPIC_API_KEY: gezet / niet gewenst
- A10 rental.jeconcept.be: Needs setup / Pending / Connected · DNS-records gezet (type + naam)
- A11 App Check: sleutel aangemaakt ja/nee · in Firebase gekoppeld ja/nee · VITE_APPCHECK_SITE_KEY gezet ja/nee · NIET afgedwongen
- A12 serviceaccounts: aangemaakt ja/nee · variabelen gezet en uitgerold: messaging/betaling/meetings/mail/default (per stuk ok of teruggedraaid + reden)
- A13 drie meldingsregels aangemaakt ja/nee · App Check afgedwongen ja/nee (cijfers) · CSP scherp gevraagd ja/nee

## Stripe
- B1 STRIPE_SECRET (restricted key): gezet ja/nee
- B2 webhook op run.app-adres met de twee gebeurtenissen: ja/nee · echt geheim gezet ja/nee
- B3 betaalmethodes aan: … · Apple Pay-domein: gelukt/mislukt/nog niet
- B4 branding en descriptor: aangepast/stond goed · drie URL's (voorwaarden, privacy, klantondersteuning) ingevuld ja/nee, met of zonder www

## GitHub
- C1 feestbeest PR: <link> gemerged ja/nee
- C2 VITE_GOOGLE_MAPS_API_KEY, VITE_FIREBASE_VAPID_KEY: gezet ja/nee
- C3 laatste uitrol planning: run-nummer, groen ja/nee, resterende waarschuwingen: …
- C4 deploys feestbeest: groen ja/nee
- C6 jeconcept.be: AAAA 100:: aangemaakt / bestond al (type + inhoud) · de drie pagina's op het kale domein ok ja/nee
- C5 2FA verplicht ja/nee (Jaspers antwoord) · Dependabot/secret scanning/push protection aan ja/nee · planning privé ja/nee (op vraag van Jasper)

## Sites
- D0 proef per bron: per bron ok / foutcode
- Bar Vue: platform … · gekoppeld via D2/D3/D4/D5 · proef ok ja/nee
- Meer: platform … · adres … · gekoppeld via … · proef ok ja/nee
- Ken je klanten: platform … · gekoppeld via … · proef ok ja/nee
- jeconcept.be: platform … · gekoppeld via … · proef ok ja/nee
- Feestbeest, Wintermoods: proef ok ja/nee
- Sites op de boekingsapp of op Cue (D2): …
- D7 centrale links in de voet: Bar Vue ja/nee · Meer ja/nee · Ken je klanten ja/nee · eigen privacy- of voorwaardenpagina's doorverwezen/vervangen/onaangeroerd (welke)

## Rest
- E1 mail aan Lightspeed: verstuurd aan (adres of "supportformulier") ja/nee
- E2 publiek telefoonnummer: … (bron: …)
- E3 proefkaarten verwijderd ja/nee
- F Cue en boekingsapp: repo's gearchiveerd ja/nee · je-cue uitgeschakeld / niet (reden) · Base44-app uitgeschakeld / niet (reden)
- Vragen aan Jasper en wat ze opleverden (zonder waarden): …
- Stappen die niet lukten en waarom: …
- Bevestiging: geen enkele geheime waarde buiten Secret Manager of GitHub Secrets geplakt.
```

---

## Als er iets misgaat

| Wat je ziet | Wat er aan de hand is | Wat je doet |
|---|---|---|
| Cloud Shell: `PERMISSION_DENIED` | verkeerd account of verkeerd project | rechtsboven het account met Owner op `je-planning` kiezen; `gcloud config set project je-planning` |
| Uitrol: *Geheim MESSAGING_TOKENS bestaat niet* | A2 liep niet, of liep in een ander project | A2 opnieuw, met `gcloud config get-value project` = `je-planning` |
| D0: `401` voor één bron | die bron ontbreekt in de JSON, of de functie draait nog met een oude versie | A2 (het script vult aan), dan C3 |
| D0: HTML in plaats van JSON | `messaging` is niet uitgerold | C3; in de annotaties staat waarom |
| Site-proef: rij in Messaging maar geen kaart | de stand van een verwerker is *fout* | in *Instellingen → Messaging* staat de reden per verwerker; na drie keer volgt een melding. Meld de reden. |
| Site-proef: niets in Messaging | de webhook vertrekt niet of de header ontbreekt | het log van de webhook in de plugin of in Wix nakijken; header exact `X-Messaging-Token` |
| Na A12: een trigger doet niets meer, of `PERMISSION_DENIED` in de logs | het nieuwe account mist een rol | de variabele van die codebase leeg maken, C3, en de ontbrekende rol uit de log in het rapport zetten |
| Na A11: een scherm laadt niet en de console meldt App Check | afgedwongen te vroeg, of sleutel voor het verkeerde domein | in Firebase App Check *Unenforce*; domeinen van de sleutel nakijken |
| Upload van een document: *geen toegang tot de Drive* | de service-account zit niet in de Drive, of de API staat uit | A4 stap 1 en 3; rechten doen er soms een minuut over |
| Uitrol: *Stripe-geheimen ontbreken* | één van de twee ontbreekt | beide namen nakijken: `STRIPE_SECRET`, `STRIPE_WEBHOOK_SECRET` |
| Stripe: *This payment method is not activated* | Bancontact staat niet aan in live-modus | B3, in **live** |
| Betaling blijft op *Wacht op betaling* | het webhook-eindpunt wijst naar het hosting-adres, of het geheim is nog voorlopig | B2: het `run.app`-adres en het echte geheim, dan C3 |
| Hosting: domein blijft *Needs setup* | DNS nog niet doorgegeven, of de Cloudflare-proxy staat aan | grijze wolk; tot een uur wachten |
| Rijen in Messaging blijven op *wacht* | de relay is niet uitgerold, of Pub/Sub staat uit | A1 (`gcloud services enable pubsub.googleapis.com`), dan C3 |
| Rij staat op *klaar* noch *fout* na tien minuten | de verwerker op de bus is niet uitgerold | in de functielijst moet `messagingVerwerkerEvent` staan; anders C3 |
| GitHub: *not acquired by Runner* | GitHub had even geen runner | één keer opnieuw starten |

Opnieuw draaien mag altijd. Elke stap is herhaalbaar, en het script in A2 overschrijft nooit een bestaande token.
