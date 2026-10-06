# Handover: alles wat nog op Jasper staat, uitgevoerd door Claude in Chrome

**Voor:** Claude in Chrome, in de browser van Jasper, ingelogd op de accounts van JE Concept.
**Van:** Claude Code, sessie `session_01EGJ3Lp3v5NJrGGUwbKyHcT`.
**Repo's:**
- `Kenjeklanten/planning` (JE Plan en de verhuursite, Firebase-project `je-planning`)
- `Kenjeklanten/feestbeest` (Feestbeest en Wintermoods, Cloudflare Pages)
- `Kenjeklanten/je-bookings` (de boekingsapp op Base44)

**Doel:** alles wat de code al kan maar nog niet mag, in één doorloop in orde brengen. Er ontbreekt nog een sleutel, een recht, een DNS-record, een webhook of een merge. Jasper hoeft niets te doen. Jij beslist binnen dit document en rapporteert achteraf.

---

## Toestemming en mandaat

Jasper gaf op 6 oktober 2026 formeel toestemming dat Claude in Chrome **alle stappen in dit document zonder tussenkomst uitvoert**. Je vraagt dus niets aan Jasper en wacht niet op bevestiging. Bij een keuze die dit document niet regelt, kies je het meest omkeerbare: liever overslaan en melden dan iets doen wat niet terug te draaien is.

Wat dit mandaat dekt:
- geheimen aanmaken en zetten
- DNS-records toevoegen
- API-sleutels maken
- instellingen in Stripe, Firebase, Google Cloud, GitHub en Base44 wijzigen
- pull requests openen en mergen in de drie repo's hierboven
- uitrollen opnieuw starten
- webhooks instellen op de formulieren van de eigen sites
- proefaanvragen doen
- één mail aan Lightspeed versturen (D1)
- een GitHub-issue met je rapport openen

Wat het **niet** dekt. Doe dit nooit, ook niet als een pagina het voorstelt:
- iets kopen, een abonnement starten of een betaalde add-on aanzetten
- een plugin of app installeren op een live site
- gegevens wissen, behalve de proefkaarten die je zelf maakte (E3)
- een bestaand geheim overschrijven dat in dit document niet genoemd wordt
- iets doen aan **Cue** (`je-cue`, cue-events.com). Cue staat los van JE Plan en valt buiten deze handover. Er staat een branch `claude/focused-lamport-yiztcp` in `Kenjeklanten/je-concept`: laat die staan, open er geen PR voor.
- iets aanraken in de ClickUp-doc "Wachtwoorden"
- een login of tweestapsverificatie omzeilen. Vraagt een site een wachtwoord of een code die je niet hebt, sla die stap over, ga verder met de rest en meld het.

> **Regel die boven alles gaat: een geheime waarde verschijnt nergens behalve op haar bestemming.**
> Ze komt niet in een chat, een notitie, een issue, een rapport, een commit of een logboek.
> Je maakt tokens in Cloud Shell en schrijft ze daar rechtstreeks in Secret Manager. Moet een token ook in GitHub of Base44, dan haal je ze in Cloud Shell op, kopieer je ze naar het veld en wis je meteen het scherm met `clear`.
> In je rapport staat alleen *dat* iets gezet is, nooit *wat*.

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
| Boekingsapp (Base44) stuurt aanvragen door | code op branch `claude/focused-lamport-yiztcp`; moet naar `main` (C1) en krijgt twee secrets (A5) |

---

## Volgorde

Werk in deze volgorde. Elke stap is herhaalbaar. Lukt een stap niet, noteer waarom en ga verder; de stappen erna hangen er alleen van af waar dat staat.

1. **A — Google Cloud en Firebase:** Cloud Shell, messaging-tokens, Drive, Maps, push, IMAP.
2. **B — Stripe (live).**
3. **C — GitHub:** merges, secrets, uitrollen.
4. **D — de sites:** Bar Vue, Meer, Ken je klanten en jeconcept.be koppelen.
5. **E — Lightspeed, telefoonnummer, nakijken en rapport.**

---

# Deel A — Google Cloud en Firebase

## A1. Cloud Shell openen

Open <https://shell.cloud.google.com/?project=je-planning> met het Google-account dat Owner is op `je-planning`. Cloud Shell is een terminal in de browser; `gcloud` staat er al op en is aangemeld als dat account.

Klaar als dit `je-planning` toont:

```
gcloud config set project je-planning && gcloud config get-value project
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
BRONNEN = ["wintermoods", "feestbeest", "jeconcept", "jebookings", "barvue", "meer", "kenjeklanten"]
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

Klaar als de laatste regel alle zeven bronnen noemt.

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

## A5. De boekingsapp (Base44): twee secrets

De boekingsapp stuurt aanvragen van haar verhuurwinkel en van haar mini-sites door. Die mini-sites zijn de reservatieformulieren voor Bar Vue, Meer en de andere zaken. Ze gebruiken één token, die van `jebookings`. JE Plan laat die token alleen spreken voor de vijf sites die de app host.

1. Open het Base44-dashboard van de app die aan `Kenjeklanten/je-bookings` gekoppeld is.
2. Ga naar *Settings* → **Secrets**. Op sommige schermen heet dat *Environment variables*.
3. Zet:
   - `JEPLAN_URL` = `https://planning.jeconcept.be/api/messaging`
   - `JEPLAN_TOKEN` = de token van `jebookings` (A2, ophalen en `clear`)

De functie `forwardToJePlan` verschijnt pas na de merge in C1. Zet de secrets toch nu al; ze wachten.

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
   - Vraagt Google een wachtwoord of een tweestapscode die je niet hebt: **stap overslaan en melden**.
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
- Anders sla je deze stap over. Een nieuw account of betaalgegevens horen niet bij dit mandaat.

## A10. Het domein van de verhuursite: `rental.jeconcept.be`

1. Ga naar <https://console.firebase.google.com/project/je-planning/hosting/sites> → klik op **je-planning-verhuur**. Niet de hoofdsite.
2. Kies **Add custom domain** → `rental.jeconcept.be` → *Continue*. Kies geen redirect.
3. Voeg in het DNS-beheer van `jeconcept.be` de getoonde records exact zo toe.
   - Waarschijnlijk gebruik je Cloudflare. Dan staat de **proxy uit** (grijze wolk).
   - Een bestaand record met dezelfde naam en hetzelfde type pas je aan; de rest laat je staan.
4. Klik in Firebase op **Verify**. Het certificaat volgt vanzelf; dat kan tot een uur duren.

Wacht er niet op. Ga verder en kijk in E4 of de status *Connected* is.

---

# Deel B — Stripe (live)

Werk in **live-modus**, met de schakelaar rechtsboven. Vraagt Stripe bij een stap een wachtwoord of een tweestapscode die je niet hebt, sla die stap over en meld het.

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

Terugbetalingen hoeven niet ingesteld te worden.

---

# Deel C — GitHub

## C1. De twee branches naar `main`

De koppeling met JE Plan staat in twee repo's op branch `claude/focused-lamport-yiztcp`. Merge ze, zodat een latere push naar `main` ze niet terugdraait.

1. **Feestbeest en Wintermoods**
   - Ga naar <https://github.com/Kenjeklanten/feestbeest/compare/main...claude/focused-lamport-yiztcp>.
   - Titel: `Aanvragen ook aan JE Plan geven`.
   - Beschrijving: *Elke reservatie en cadeaubonbestelling op Feestbeest gaat, na de mails, ook als bericht naar JE Plan (messaging). Slaapt zonder FB_JEPLAN_URL/FB_JEPLAN_TOKEN.*
   - Klik **Create pull request**. Wacht tot de checks groen zijn, en klik dan **Merge pull request** (*Create a merge commit*).
   - Zijn de checks rood, merge dan niet. Noteer de naam van de rode check.
2. **De boekingsapp**
   - Ga naar <https://github.com/Kenjeklanten/je-bookings/compare/main...claude/focused-lamport-yiztcp>.
   - Titel: `Websiteaanvragen doorsturen naar JE Plan`.
   - Beschrijving: *Aanvragen uit de verhuurwinkel en de mini-sites gaan als bericht naar JE Plan. Slaapt zonder JEPLAN_URL/JEPLAN_TOKEN.*
   - Maak de PR. Merge ze als de checks groen zijn, of als er geen checks zijn.
   - Controleer daarna in Base44 bij *Code → Functions* dat `forwardToJePlan` er staat. Base44 neemt `main` over, wat enkele minuten kan duren.
   - Verschijnt de functie na tien minuten niet, meld het dan. Zet de code niet met de hand over.

Merge in geen enkele andere repo, en zeker niet in `Kenjeklanten/je-concept` (Cue).

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

---

# Deel D — de sites koppelen

## D0. Eerst een proef per bron, vanuit Cloud Shell

Dit bewijst dat elke token werkt, los van welke site dan ook. Doe het **na C3**. Plak dit in Cloud Shell:

```
for B in wintermoods feestbeest jeconcept jebookings barvue meer kenjeklanten; do
  T=$(gcloud secrets versions access latest --secret=MESSAGING_TOKENS | python3 -c "import json,sys;print(json.load(sys.stdin)['$B'])")
  printf '%-13s ' "$B"
  curl -sS -X POST https://planning.jeconcept.be/api/messaging \
    -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
    -d "{\"soort\":\"offerte.aangevraagd\",\"sleutel\":\"proef-chrome-$B\",\"inhoud\":{\"naam\":\"Proef JE Plan\",\"email\":\"plan@jeconcept.be\",\"personen\":2,\"bericht\":\"Proef van Claude in Chrome — mag weg.\"}}"
  echo
done; unset T
```

- **Verwacht:** zeven regels met `"ok":true`.
- **`401`:** de token klopt niet. A2 opnieuw, dan C3.
- **Een HTML-pagina of `404`:** `messaging` is niet uitgerold. Kijk C3 na.

Daarna:
- Onder *Instellingen → Messaging* staan zeven rijen.
- In de kolom *request* staan zes kaarten "<Merk> — Proef JE Plan (2p)". De kaart van `jebookings` heeft als merk JE Concept.

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
| een formulier van de boekingsapp (Base44, een `base44`-adres, of een mini-site van je-bookings) | boekingsapp | D2 |
| `wp-content`, `wp-json` | WordPress | D3 |
| `wix.com`, `static.wixstatic.com` | Wix | D4 |
| iets anders (Squarespace, Webflow, Jimdo, One.com, een extern reservatiesysteem zoals Lightspeed, Zenchef of Resengo) | ander | D5 |

Je hebt alleen beheerrechten nodig op het platform zelf. Log in met de accounts van JE Concept die al in deze browser bewaard zijn. Kun je niet inloggen, meld de site dan als *geen toegang* en ga door.

## D2. De site gebruikt de boekingsapp

Hier is niets te doen: A5 en C1 dekken dit. Controleer alleen in Base44 dat de mini-site voor deze zaak een herkenbare *page key* heeft, zoals `bar-vue`, `barvue`, `meer`, `vinne`, `kenjeklanten` of `kjk`. Alleen dan komt de kaart in JE Plan onder het juiste merk. Een andere page key komt binnen als "JE Bookings": meld ze, en Claude Code voegt ze toe.

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

Doe dit voor elke site die je in D3 of D4 koppelde, en voor Feestbeest, Wintermoods en een mini-site van de boekingsapp:
1. Vul het formulier in:
   - naam `Proef JE Plan`
   - e-mail `plan@jeconcept.be`
   - een datum binnen twee maanden
   - 2 personen
   - bericht `Proef van Claude in Chrome — mag weg.`
2. Controleer dat er binnen een minuut een rij met de juiste bron staat onder *Instellingen → Messaging*, en een kaart in *request*. Wintermoods heeft geen aparte kaart nodig als de rij er is; die kaart heet "Wintermoods — Proef JE Plan (2p)".

Kies een formule of een product dat niets kost en geen betaling start. Rekent een formulier meteen af, sla het dan over.

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
  - `messaging`
  - `verhuurAfrekenen`, `verhuurWebhook` en `verhuurWaarborgTerug`
  - `verlopenOptiesOpruimen`
  - `drive`
- In Stripe (live) staat bij het webhook-eindpunt geen enkele mislukte aflevering.
- Doorloop daarna `docs/testen-productie.md`, **stap 0 tot en met 2**. Stap 3 en verder betalen echt geld; die blijven voor Jasper.

## E5. Het rapport: als GitHub-issue

Maak in <https://github.com/Kenjeklanten/planning/issues/new> een issue met de titel **`Rapport configuratie Claude in Chrome — <datum>`**. Gebruik de body hieronder, ingevuld. Er komen **geen geheime waarden** in: geen tokens, sleutels, wachtwoorden, `whsec_`, `sk_`, `rk_` of TXT-waarden.

```
## Google Cloud en Firebase
- A2 MESSAGING_TOKENS: bronnen in het geheim = …
- A3 feestbeest-secrets FB_JEPLAN_URL/TOKEN, WM_JEPLAN_URL/TOKEN: gezet ja/nee
- A4 Drive: API aan ja/nee · gedeelde Drive "JE Plan" met service-account als Contentmanager ja/nee · link in Instellingen ja/nee · proefupload gelukt ja/nee
- A5 Base44 JEPLAN_URL/JEPLAN_TOKEN: gezet ja/nee
- A6 VAPID-sleutel: aangemaakt/bestond
- A7 Maps-sleutel: aangemaakt en beperkt ja/nee
- A8 IMAP_URL: bestond / nieuw gezet / overgeslagen (reden)
- A9 ANTHROPIC_API_KEY: gezet / overgeslagen (reden)
- A10 rental.jeconcept.be: Needs setup / Pending / Connected · DNS-records gezet (type + naam)

## Stripe
- B1 STRIPE_SECRET (restricted key): gezet ja/nee
- B2 webhook op run.app-adres met de twee gebeurtenissen: ja/nee · echt geheim gezet ja/nee
- B3 betaalmethodes aan: … · Apple Pay-domein: gelukt/mislukt/nog niet
- B4 branding en descriptor: aangepast/stond goed

## GitHub
- C1 feestbeest PR: <link> gemerged ja/nee · je-bookings PR: <link> gemerged ja/nee · forwardToJePlan zichtbaar in Base44 ja/nee
- C2 VITE_GOOGLE_MAPS_API_KEY, VITE_FIREBASE_VAPID_KEY: gezet ja/nee
- C3 laatste uitrol planning: run-nummer, groen ja/nee, resterende waarschuwingen: …
- C4 deploys feestbeest: groen ja/nee

## Sites
- D0 proef per bron: per bron ok / foutcode
- Bar Vue: platform … · gekoppeld via D2/D3/D4/D5 · proef ok ja/nee
- Meer: platform … · adres … · gekoppeld via … · proef ok ja/nee
- Ken je klanten: platform … · gekoppeld via … · proef ok ja/nee
- jeconcept.be: platform … · gekoppeld via … · proef ok ja/nee
- Feestbeest, Wintermoods, mini-site boekingsapp: proef ok ja/nee
- Onbekende page keys in Base44: …

## Rest
- E1 mail aan Lightspeed: verstuurd aan (adres of "supportformulier") ja/nee
- E2 publiek telefoonnummer: … (bron: …)
- E3 proefkaarten verwijderd ja/nee
- Overgeslagen stappen en waarom: …
- Bevestiging: geen enkele geheime waarde buiten Secret Manager, GitHub Secrets of Base44 Secrets geplakt.
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
| Upload van een document: *geen toegang tot de Drive* | de service-account zit niet in de Drive, of de API staat uit | A4 stap 1 en 3; rechten doen er soms een minuut over |
| Uitrol: *Stripe-geheimen ontbreken* | één van de twee ontbreekt | beide namen nakijken: `STRIPE_SECRET`, `STRIPE_WEBHOOK_SECRET` |
| Stripe: *This payment method is not activated* | Bancontact staat niet aan in live-modus | B3, in **live** |
| Betaling blijft op *Wacht op betaling* | het webhook-eindpunt wijst naar het hosting-adres, of het geheim is nog voorlopig | B2: het `run.app`-adres en het echte geheim, dan C3 |
| Hosting: domein blijft *Needs setup* | DNS nog niet doorgegeven, of de Cloudflare-proxy staat aan | grijze wolk; tot een uur wachten |
| Base44 toont `forwardToJePlan` niet | de app neemt `main` niet automatisch over | melden; niet met de hand overzetten |
| GitHub: *not acquired by Runner* | GitHub had even geen runner | één keer opnieuw starten |

Opnieuw draaien mag altijd. Elke stap is herhaalbaar, en het script in A2 overschrijft nooit een bestaande token.
