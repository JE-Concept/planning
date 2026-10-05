# Handover — alle openstaande configuratie van JE Plan en de verhuursite

**Voor:** Claude in Chrome (of wie dan ook met browsertoegang tot de Google-, Stripe-, GitHub- en DNS-accounts van JE Concept)
**Van:** Claude Code, sessie `session_01EGJ3Lp3v5NJrGGUwbKyHcT`
**Repo:** `Kenjeklanten/planning` · **Firebase-project:** `je-planning`
**Doel:** alles wat de code al kan maar nog niet mág — omdat er een sleutel, een recht of een DNS-record ontbreekt — in één keer in orde brengen, zodat Jasper daarna `docs/testen-productie.md` kan doorlopen.

---

## Wat dit is en wat het niet is

Alles hieronder is **browserwerk**. Er is geen terminal nodig: de uitrol (GitHub Actions) doet zelf alles wat een terminal zou doen, zodra de rechten en de geheimen er zijn. Jij zet ze, en drukt daarna één keer op *Re-run* in GitHub.

De eerdere handover (`docs/handover-claude-in-chrome.md`) zette het project en `planning.jeconcept.be` live; die is klaar. Dit document gaat over wat daarna is blijven liggen en wat de verhuursite erbij vraagt.

> **Regel die boven alles gaat: plak nooit een geheime waarde in een bericht, een notitie, een chat of een logboek.**
> Niet de Stripe-sleutel, niet het webhook-geheim, niet het IMAP-wachtwoord, niet het servicesleutel-bestand. Je zet ze op de plek waar ze horen (Secret Manager of GitHub Secrets) en meldt daarna alleen *dat* ze gezet zijn. Een geheim dat één keer in een chat stond, is geen geheim meer.

---

## Wat je nodig hebt

- Google-account met **Owner** op het Google Cloud-project `je-planning` (IAM, Secret Manager, Firebase Hosting)
- Toegang tot het **Stripe-account** van JE Concept, in **live-modus** (Jasper besliste: geen testronde, zie `docs/vragen-productie.md` vraag 1)
- Toegang tot **DNS-beheer** van `jeconcept.be` (waarschijnlijk Cloudflare — zie de vorige handover, stap A7)
- **Admin op de GitHub-repo** `Kenjeklanten/planning` (Settings → Secrets), en voor A7 ook op `Kenjeklanten/feestbeest`
- Het **Google Workspace-account** van JE Concept dat gedeelde Drives mag aanmaken (voor de documenten, A6)
- Het **app-wachtwoord** van `plan@jeconcept.be` voor IMAP (of het recht om er een te maken in Google Workspace)
- Optioneel: een Anthropic-account voor de overlegfuncties, en een Google Maps-sleutel

Doe de stappen in volgorde. **A1 eerst**: zolang dat recht ontbreekt, helpt geen enkel geheim.

---

# Deel A — Google Cloud en Firebase

## A1. Het recht dat alles tegenhoudt: Secret Manager Admin voor de uitrolsleutel

Dit is de oorzaak van de waarschuwingen in élke uitrol tot nu toe ("De mailverzender is niet uitgerold"). De Firebase CLI probeert bij het uitrollen van een functie-met-geheim het runtime-account leesrecht op dat geheim te geven, en dat vraagt `secretmanager.secrets.setIamPolicy`. De uitrolsleutel heeft dat recht niet.

1. Ga naar <https://console.cloud.google.com/iam-admin/iam?project=je-planning>
2. Zoek de principal die begint met **`firebase-adminsdk-`** en eindigt op `@je-planning.iam.gserviceaccount.com`. Dat is de uitrolsleutel die in GitHub staat.
3. Potlood → **Add another role** → **Secret Manager Admin** (`roles/secretmanager.admin`) → **Save**.
4. Controleer: in de rollenlijst van die principal staat nu ook *Secret Manager Admin*.

> **Waarom niet de engere variant?** Je kunt ook per geheim het runtime-account (`<nummer>-compute@developer.gserviceaccount.com`) de rol *Secret Manager Secret Accessor* geven. Dat werkt, maar dan moet je het bij elk nieuw geheim opnieuw doen en vergeet iemand het een keer. De uitrol doet het zelf zodra ze het mag.

## A2. De geheimen in Secret Manager

Ga naar <https://console.cloud.google.com/security/secret-manager?project=je-planning>. Voor elk geheim hieronder: **Create secret** → naam exact zoals hier (hoofdlettergevoelig) → waarde → **Create**. Bestaat het al (`SMTP_URL` bestaat), dan **New version** als de waarde moet veranderen.

| Naam | Wat erin moet | Waar het vandaan komt | Zonder dit |
|---|---|---|---|
| `STRIPE_SECRET` | de **live** geheime sleutel, begint met `sk_live_` | Deel B, stap B1 | geen online afrekenen |
| `STRIPE_WEBHOOK_SECRET` | het ondertekeningsgeheim van het webhook-eindpunt, begint met `whsec_` | Deel B, stap B2 | een betaling wordt nooit "betaald" |
| `IMAP_URL` | `imaps://plan%40jeconcept.be:<app-wachtwoord>@imap.gmail.com:993` | zie hieronder | mail van klanten komt niet in het postvak |
| `ANTHROPIC_API_KEY` | een sleutel van <https://console.anthropic.com/> | optioneel | overleg samenvatten werkt niet; al de rest wel |
| `SMTP_URL` | bestaat al — niet aanraken tenzij het wachtwoord veranderde | — | — |

**Het app-wachtwoord voor IMAP** maak je in het Google-account van `plan@jeconcept.be`: <https://myaccount.google.com/apppasswords> (vereist tweestapsverificatie op dat account). Google toont het met spaties; die mogen eruit. Een `@` in de gebruikersnaam wordt `%40`. Eén connectiestring en geen vijf losse waarden: één ding dat fout kan staan, en de fout is meteen te zien — zie de kop van `functions-mail/index.js`.

Doe `STRIPE_*` pas **na** Deel B; de andere kun je nu zetten.

## A3. Het domein van de verhuursite

De tweede hosting-site `je-planning-verhuur` bestaat al (de uitrol maakte ze aan) en staat op <https://je-planning-verhuur.web.app>. Nu het echte adres (vraag 16: `rental.jeconcept.be`).

1. <https://console.firebase.google.com/project/je-planning/hosting/sites> → klik op **je-planning-verhuur** (niet op de hoofdsite!)
2. **Add custom domain** → `rental.jeconcept.be` → **Continue**. Kies *niet* "redirect".
3. Firebase toont één of twee DNS-records (een TXT voor de verificatie en een A- of CNAME-record). Laat dit scherm open.
4. In het DNS-beheer van `jeconcept.be`: voeg die records toe, exact zoals getoond. Staat het op Cloudflare: **proxy uit** (grijze wolk) voor dit record, anders blijft de status op *Needs setup*.
5. Terug in Firebase: **Verify**. Het certificaat volgt vanzelf; dat kan een uur duren. Status hoort op *Connected* te komen.

De site is al vindbaar voor zoekmachines (vraag 17, beslist). Het domein hoeft dus niet "stil" gezet te worden.

## A4. Google Maps-sleutel (optioneel, backoffice)

Zonder deze sleutel is het locatieveld op een event een gewoon tekstveld. Met: een adressenlijst terwijl je typt.

1. <https://console.cloud.google.com/apis/credentials?project=je-planning> → **Create credentials → API key**
2. **Edit** de sleutel: *Application restrictions* → **Websites** → `https://planning.jeconcept.be/*`; *API restrictions* → alleen **Places API** en **Maps JavaScript API** (beide eerst aanzetten onder *Enabled APIs*).
3. Deze sleutel is **publiek** (ze zit in de browserbundel) en hoort dus niet in Secret Manager maar in GitHub: Deel C, stap C1, als `VITE_GOOGLE_MAPS_API_KEY`.

## A5. Pushmeldingen (optioneel, maar beslist: vraag 15)

Jasper wil een pushmelding bij een online huur of aanvraag. Daarvoor ontbreekt één sleutel; de volledige uitleg staat in `docs/push-notificaties-aanzetten.md`. Kort: Firebase Console → Project settings → **Cloud Messaging** → *Web Push certificates* → **Generate key pair** → de getoonde sleutel wordt de GitHub-secret `VITE_FIREBASE_VAPID_KEY` (Deel C). Ook publiek, dus GitHub en niet Secret Manager.

## A6. Google Drive voor de documenten bij events en klanten

De bestanden bij een event of een klant staan niet in Firebase Storage maar in een gedeelde Google Drive. JE Plan maakt daar per event en per klant een map in. Drie dingen zijn nodig, in deze volgorde:

1. **Drive API aanzetten.** Google Cloud Console → project `je-planning` → *APIs & Services* → *Library* → zoek **Google Drive API** → **Enable**.
2. **De service-account vinden.** Cloud Console → *Cloud Functions* (of *Cloud Run*) → functie **drive** → tabblad *Details* → noteer de **service-account** (vorm `<nummer>-compute@developer.gserviceaccount.com`). Dat is geen geheim; het is een adres.
3. **Een gedeelde Drive maken en die account toevoegen.** Google Drive (ingelogd als het Workspace-account van JE Concept) → *Gedeelde Drives* → **Nieuw** → naam `JE Plan`. Open ze → *Leden beheren* → plak het adres uit stap 2 → rol **Contentmanager** → melding uitvinken → *Verzenden*. Kopieer daarna de link van de Drive uit de adresbalk (`https://drive.google.com/drive/folders/0A…`).
4. **De link in JE Plan zetten.** planning.jeconcept.be → *Instellingen* → tabblad **Documenten** → plak de link → *Bewaren*. Het paneel toont de herkende id.

Controle: open een event, voeg onder *Documenten* een klein bestand toe. In Drive verschijnt `JE Plan / Events / <datum — titel> / <bestand>`, en in JE Plan opent de naam een voorvertoning. Mislukt de upload met *geen toegang tot de Drive*, dan is stap 3 niet (goed) gezet of de API van stap 1 nog niet aan — rechten doen er soms een minuut over.

Als de functie **drive** niet in de lijst staat, is de uitrol van na 5 oktober nog niet gelopen: eerst C2.

## A7. Het gedeelde geheim voor Wintermoods-aanvragen

Elke reservatie-aanvraag op wintermoods.jeconcept.be wordt een event in de kolom *request* van JE Plan — zodra beide kanten hetzelfde geheim kennen. Eén waarde, twee plekken, en nergens anders.

1. **Een waarde maken.** Een wachtwoordbeheerder of een generator volstaat: minstens 32 willekeurige tekens, alleen letters en cijfers. Bewaar ze één keer in de wachtwoordkluis van JE Concept onder "WINTERMOODS_TOKEN". Plak ze nooit in een chat, een notitie of een logboek.
2. **In Secret Manager van `je-planning`.** Google Cloud Console → project `je-planning` → *Security* → *Secret Manager* → **Create secret** → naam exact `WINTERMOODS_TOKEN` → bij *Secret value* de waarde plakken → **Create**. (Het uitrol-serviceaccount geeft de functie daarna zelf leesrecht, zoals bij de mailgeheimen in het uitrol-log te zien is.)
3. **In GitHub, repo `Kenjeklanten/feestbeest`.** Settings → Secrets and variables → Actions → **New repository secret**: `WM_JEPLAN_TOKEN` met dezelfde waarde, en `WM_JEPLAN_URL` met `https://planning.jeconcept.be/api/wintermoods`. De deploy van die repo zet ze door naar Cloudflare Pages.
4. **De uitrol van `Kenjeklanten/planning` opnieuw draaien** (Deel C2). In het log hoort nu `Geheim WINTERMOODS_TOKEN bestaat.` te staan, gevolgd door de uitrol van `functions:wintermoods` en de IAM-binding op `wintermoods`. Daarna ook de deploy van `Kenjeklanten/feestbeest` opnieuw draaien, zodat de site de twee nieuwe waarden krijgt.

Controle: doe een proefaanvraag op de Wintermoods-site. Binnen enkele seconden staat er een kaart "Wintermoods — <naam> (<aantal>p)" in de kolom *request* op planning.jeconcept.be. Een tweede inzending met dezelfde aanvraag-id maakt geen tweede kaart. Zolang stap 2 niet gebeurd is, zegt de uitrol `Geheim WINTERMOODS_TOKEN bestaat niet` als waarschuwing en mailt de site gewoon verder, zonder kaart.

---

# Deel B — Stripe (live)

Werk in **live-modus** (schakelaar rechtsboven in het Stripe-dashboard). Alles wat je in testmodus zet, geldt niet live — en omgekeerd.

## B1. De API-sleutel

1. <https://dashboard.stripe.com/apikeys> → onder *Standard keys* → **Secret key** → *Reveal live key*.
2. Zet ze als `STRIPE_SECRET` in Secret Manager (A2). Niet kopiëren naar iets anders.

> Liever een **restricted key** dan de volle geheime sleutel? Mag: *Create restricted key* met **Write** op *Checkout Sessions*, *Refunds* en *PaymentIntents*, en **Read** op *Charges*. Meer heeft de code niet nodig (`functions-betaling/index.js`). Dan is een gelekte sleutel geen sleutel tot alles.

## B2. Het webhook-eindpunt

De functie heet `verhuurWebhook` en staat in regio `europe-west1`. Haar adres vind je in de Firebase Console: <https://console.firebase.google.com/project/je-planning/functions> → rij **verhuurWebhook** → de URL in de kolom *Trigger* (een `…run.app`-adres). **Gebruik dat adres en niet het hosting-adres**: de handtekening wordt op de ruwe body gecontroleerd, en die hoort rechtstreeks binnen te komen.

> Staat `verhuurWebhook` er niet? Dan is `functions:betaling` nog niet uitgerold — dat gebeurt pas zodra A1 én beide `STRIPE_*`-geheimen er zijn. Zet dan eerst `STRIPE_SECRET` en een **voorlopig** `STRIPE_WEBHOOK_SECRET` (willekeurige tekst), draai de uitrol (Deel C, stap C2), kom hier terug voor het echte adres, en zet daarna het echte webhook-geheim als nieuwe versie.

1. <https://dashboard.stripe.com/webhooks> → **Add endpoint**
2. *Endpoint URL*: het adres van hierboven
3. *Events to send*: **`checkout.session.completed`** en **`checkout.session.expired`** — precies die twee
4. **Add endpoint** → op de detailpagina: *Signing secret* → **Reveal** → zet het als `STRIPE_WEBHOOK_SECRET` in Secret Manager (A2; nieuwe versie als er al een voorlopige stond).

## B3. Betaalmethodes (vraag 2: kaart, Bancontact, Apple Pay en Google Pay)

1. <https://dashboard.stripe.com/settings/payment_methods> → zet **Bancontact** aan. Zonder Bancontact weigert Stripe de Checkout-sessie, want de code vraagt er uitdrukkelijk om.
2. **Apple Pay** en **Google Pay** aanzetten in dezelfde lijst. Stripe toont ze vanzelf op toestellen die ze kunnen.
3. Voor Apple Pay moet het domein geregistreerd zijn: <https://dashboard.stripe.com/settings/payment_method_domains> → **Add a new domain** → `rental.jeconcept.be` (pas nadat A3 op *Connected* staat). Stripe controleert een bestand op dat domein; Firebase Hosting serveert dat niet vanzelf. **Lukt de verificatie niet, meld het** — dan voegt Claude Code het bestand toe aan `verhuur/public/.well-known/`. Zonder registratie werkt alles behalve Apple Pay.

## B4. Hoe de betaalpagina eruitziet

<https://dashboard.stripe.com/settings/branding>: logo van JE Concept, accentkleur `#1B3A6B` (het navy van het design system), bedrijfsnaam **JE Concept**. Dit is wat de klant ziet tussen de mand en de bedankpagina; het hoort op de site te lijken.

Controleer ook <https://dashboard.stripe.com/settings/public>: *Statement descriptor* op iets wat een klant op zijn rekeninguittreksel herkent (`JE CONCEPT VERHUUR`), en een support-mailadres (`info@jeconcept.be`).

## B5. Terugbetalingen

Niets in te stellen: de knop *Waarborg terugstorten* in JE Plan doet een gedeeltelijke refund via de API. Maar weet dat Stripe de **kosten van de oorspronkelijke betaling niet terugbetaalt** bij een refund. Dat is geen fout van de tool.

---

# Deel C — GitHub

## C1. De publieke sleutels als repository secrets

<https://github.com/Kenjeklanten/planning/settings/secrets/actions> → **New repository secret**:

| Naam | Waarde | Van |
|---|---|---|
| `VITE_GOOGLE_MAPS_API_KEY` | de Maps-sleutel | A4 |
| `VITE_FIREBASE_VAPID_KEY` | het Web Push-sleutelpaar | A5 |

Deze twee zijn publiek (ze zitten in de browserbundel); daarom horen ze hier en niet in Secret Manager. De zes `VITE_FIREBASE_*`-waarden en `FIREBASE_SERVICE_ACCOUNT` staan er al — **niet aanraken**.

## C2. De uitrol opnieuw draaien

Pas nadat A1, A2 en B1–B2 klaar zijn:

1. <https://github.com/Kenjeklanten/planning/actions/workflows/ci.yml> → de bovenste run → **Re-run all jobs**.
2. Wacht tot hij klaar is (een minuut of acht). Open de job **Deploy to Firebase** en lees de **annotaties** bovenaan de samenvatting.

Wat je wilt zien: **geen** van deze drie waarschuwingen meer:
- *De mailverzender is niet uitgerold* → A1 niet goed, of `SMTP_URL`/`IMAP_URL` ontbreekt
- *Stripe-geheimen ontbreken* → B1/B2 niet in Secret Manager, of de naam wijkt af
- *Geheim ANTHROPIC_API_KEY bestaat niet* → alleen als je die bewust zette

Wat er wél mag blijven staan: de waarschuwing over Node.js 20 van GitHub zelf. Die is niet van ons.

3. Na een groene run staan in <https://console.firebase.google.com/project/je-planning/functions> ook `verhuurAfrekenen`, `verhuurWebhook`, `verhuurWaarborgTerug` en `verlopenOptiesOpruimen`. Kom dan terug naar **B2** als je daar nog een voorlopig webhook-geheim had gezet.

---

# Deel D — wat jij níét kunt, maar wel kunt klaarzetten

## D1. Lightspeed K-Series — partnerinschakeling voor reservaties

Voor het vervangen van de reservatiemodule (Wintermoods, Meer, Bar Vue) moet Lightspeed de *Reservations for Platforms*-API voor dit account openzetten. Dat gaat via de accountmanager, niet via een instelling. Zet deze mail klaar voor Jasper (verstuur ze niet zelf):

> **Aan:** de Lightspeed-accountmanager van JE Concept
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

## D2. Het telefoonnummer van de verhuursite (vraag 10)

Jasper geeft het later. Zodra hij het heeft: het staat op twee plekken in de code (`verhuur/src/lib/instellingen.js` en `functions-betaling/order.js`) en is werk voor Claude Code, niet voor de browser. Noteer het nummer alleen in je rapport als Jasper het je geeft.

---

# Deel E — nakijken

Loop na een groene run **`docs/testen-productie.md`** door, stap 0 tot 8. Dat draaiboek is geschreven voor Jasper, maar stap 0 en stap 1–2 kun jij doen; vanaf stap 3 (echt betalen met een eigen kaart) is het aan hem.

Kort, wat moet kloppen:
- <https://je-planning-verhuur.web.app> en, na A3, <https://rental.jeconcept.be> tonen de catalogus (leeg tot Jasper artikelen op *los te huren* zet — dat is juist).
- In JE Plan → Materiaal → een artikel openen: het vinkje *Mag zonder offerte gehuurd worden* en het fotoveld staan er.
- Een offerteaanvraag op de site komt binnen één minuut in JE Plan → Events → envelopje, mét een mail aan de beheerders (die vertrekt pas als `SMTP_URL` werkt).

---

## Wat je terugrapporteert aan Jasper

Alleen feiten, geen waarden:

1. **A1**: staat *Secret Manager Admin* op `firebase-adminsdk-…`? (ja/nee)
2. **A2**: welke van de vijf geheimen bestaan nu in Secret Manager? (namen, geen waarden)
3. **A3**: status van `rental.jeconcept.be` in Hosting (*Needs setup* / *Pending* / *Connected*) en welke DNS-records je zette (type en naam, niet de waarde van de TXT)
4. **B2**: staat het webhook-eindpunt in Stripe op het `run.app`-adres, met precies de twee gebeurtenissen?
5. **B3**: welke betaalmethodes staan aan, en lukte de domeinregistratie voor Apple Pay?
6. **C2**: is de uitrol groen, en welke waarschuwingen staan er nog?
7. **D1**: staat de mail aan Lightspeed klaar?
8. **A6**: is de Drive API aan, bestaat de gedeelde Drive `JE Plan` met de service-account als Contentmanager, en staat de link in Instellingen → Documenten?
9. **A7**: bestaat `WINTERMOODS_TOKEN` in Secret Manager en staan `WM_JEPLAN_TOKEN` en `WM_JEPLAN_URL` in de GitHub-secrets van feestbeest? (ja/nee, geen waarden)
10. Bevestiging dat je **nergens** een geheime waarde geplakt hebt buiten Secret Manager en GitHub Secrets.

---

## Als er iets misgaat

| Wat je ziet | Wat er aan de hand is | Wat je doet |
|---|---|---|
| Uitrol: *Permission 'secretmanager.secrets.setIamPolicy' denied* | A1 is niet (goed) gezet | IAM nakijken: juiste principal (`firebase-adminsdk-…`), rol *Secret Manager Admin*, opgeslagen. Rechten doen er soms een minuut over. |
| Upload van een document: *geen toegang tot de Drive* | de service-account zit niet in de gedeelde Drive, of de Drive API staat uit | A6 stap 1 en 3 nakijken; het adres moet dat van de functie **drive** zijn, rol Contentmanager |
| Uitrol: *Geheim X bestaat niet* | naam wijkt af of verkeerd project | naam hoofdlettergevoelig vergelijken met de tabel in A2; project `je-planning` |
| Uitrol: *Stripe-geheimen ontbreken* terwijl ze er staan | één van de twee ontbreekt — allebei zijn nodig | beide namen nakijken |
| Stripe: *This payment method is not activated* bij afrekenen | Bancontact staat niet aan in live-modus | B3, in **live**-modus |
| Stripe-webhook: *Signing secret mismatch* / betaling blijft op *Wacht op betaling* | het webhook-geheim hoort bij een ander eindpunt (test vs. live) of is de voorlopige | B2: nieuw geheim als nieuwe versie zetten, uitrol opnieuw |
| Betaling blijft op *Wacht op betaling* en de webhook toont `400 handtekening klopt niet` | het eindpunt wijst naar het hosting-adres in plaats van de functie | B2: het `run.app`-adres gebruiken |
| Hosting: domein blijft *Needs setup* | DNS nog niet doorgegeven, of Cloudflare-proxy aan | grijze wolk; tot een uur wachten |
| Apple Pay-domein: *Verification failed* | het verificatiebestand staat niet op de site | melden — Claude Code zet het in `verhuur/public/.well-known/` |
| `verhuurWebhook` staat niet in de functielijst | `functions:betaling` werd overgeslagen | A1 + beide `STRIPE_*` zetten, C2 opnieuw |
| Mails blijven in `mailQueue` op *wachtend* | mailverzender niet uitgerold | A1, dan C2; zie ook `docs/e-mailmeldingen-aanzetten.md` |

Opnieuw draaien mag altijd. Elke stap van de uitrol is herhaalbaar.
