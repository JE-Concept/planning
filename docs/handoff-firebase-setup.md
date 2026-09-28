# Handoff — zet planning.jeconcept.be live

**Voor:** Claude in Chrome (of wie dan ook met browsertoegang tot de Google- en DNS-accounts van JE Concept)
**Van:** Claude Code, sessie `session_01EGJ3Lp3v5NJrGGUwbKyHcT`
**Repo:** `Kenjeklanten/planning`
**Doel:** een eigen Firebase-project aanmaken en `planning.jeconcept.be` erop laten wijzen, zodat de tool zichtbaar is.

---

## Wat dit is en wat het niet is

JE Planning is een **losstaande** applicatie. Ze deelt **niets** met het Cue/JE Concept-platform:
een eigen Firebase-project, eigen Firestore, eigen login, eigen factuur. Dat is een bewuste keuze
van Jasper (samenvoegen kan later; uit elkaar trekken achteraf is veel duurder).

> **Waarom een apart Firebase-project en niet het bestaande `je-cue`?**
> Firestore-rules en -indexes zijn **projectbreed** en worden vanuit één repo gedeployed. Zou deze
> repo naar `je-cue` deployen, dan overschrijft elke deploy de beveiligingsregels van het live
> platform. Nooit doen.

Jij doet in dit document **alleen het browserwerk**. Alles wat een terminal nodig heeft staat in
deel B en is voor Jasper op zijn eigen machine. Het browserwerk moet eerst.

---

## Wat je nodig hebt

- Google-account met rechten om Firebase-projecten aan te maken voor JE Concept
- Toegang tot het DNS-beheer van `jeconcept.be` (waarschijnlijk Cloudflare — controleer, zie stap A7)
- Een betaalmiddel op het Google Cloud-account (Blaze is verplicht voor Cloud Functions; het verbruik
  van deze tool valt ruim binnen het gratis quotum, maar er moet een kaart aan hangen)

---

# Deel A — browserwerk

## A1. Maak het Firebase-project

1. Ga naar <https://console.firebase.google.com/>
2. **Add project** → naam: `je-planning`
   - Als die project-ID bezet is, kies iets als `je-planning-jc` en **noteer de echte project-ID** —
     die moet straks terug naar Jasper, want ze staat in `.firebaserc`.
3. Google Analytics: **uit**. Niet nodig, en het scheelt een toestemmingslaag.
4. Wacht tot het project klaar is → **Continue**.

## A2. Zet het abonnement op Blaze

1. Linksonder in de console: het plan-label → **Upgrade** → **Blaze (pay as you go)**
2. Koppel een factureringsaccount.
3. **Stel een budgetalarm in op €10/maand.** Dat is geen limiet maar een waarschuwing; bij dit
   gebruik (5 mensen, enkele duizenden documenten) blijft de rekening normaal op €0.

Zonder Blaze kan je geen Cloud Functions deployen, en dan werkt de Canva-koppeling niet.

## A3. Zet Google-login aan

1. **Build → Authentication → Get started**
2. Tabblad **Sign-in method** → **Google** → **Enable**
3. Project support email: `jasper@jeconcept.be`
4. **Save**
5. Tabblad **Settings → Authorized domains** → **Add domain** → `planning.jeconcept.be`
   (`localhost` en `<project>.firebaseapp.com` staan er al; laat die staan)

## A4. Maak de Firestore-database

1. **Build → Firestore Database → Create database**
2. **Production mode** (niet test mode — de repo levert eigen beveiligingsregels)
3. Locatie: **`eur3 (europe-west)`** of **`europe-west1`**.
   ⚠️ **Dit is definitief.** Een Firestore-locatie kan achteraf niet meer gewijzigd worden.
4. **Create**

## A5. Zet Storage aan

1. **Build → Storage → Get started**
2. **Production mode**, zelfde regio als Firestore
3. **Done**

## A6. Registreer de web-app en haal de configuratie op

1. **Project settings** (tandwiel linksboven) → tabblad **General**
2. Onder *Your apps*: het **web-icoon `</>`**
3. App nickname: `JE Planning` — **vink Firebase Hosting NIET aan** (dat doen we via de CLI)
4. **Register app**
5. Er verschijnt een `firebaseConfig`-blok. **Kopieer alle zes de waarden.** Ze zijn publiek — geen
   geheimen — de beveiliging zit volledig in de Firestore-rules.

Noteer ze in precies dit formaat, want zo gaan ze in de build:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## A7. Zoek uit waar de DNS van jeconcept.be staat

Voor je een domein koppelt, moet je weten waar de records beheerd worden.

1. Ga naar <https://dnschecker.org/ns-lookup.php>, vul `jeconcept.be` in.
2. Wijzen de nameservers naar `*.ns.cloudflare.com` → **Cloudflare**, log in op
   <https://dash.cloudflare.com/> en zoek de zone `jeconcept.be`.
3. Wijzen ze ergens anders (Combell, One.com, Vercel, TransIP…) → daar moet je zijn.
4. **Noteer waar je uitkomt en meld dat terug.**

## A8. Koppel het domein in Firebase Hosting

> Doe dit **na** deel B stap 4 (de eerste deploy). Een domein koppelen aan een hosting-site waar nog
> niets op staat kan wel, maar dan zie je een 404 en weet je niet of het aan de DNS ligt of aan de app.

1. **Build → Hosting → Get started** (of **Add custom domain** als hosting al bestaat)
2. **Add custom domain** → `planning.jeconcept.be`
3. Firebase toont nu **twee A-records** (twee IP-adressen). Soms vraagt het eerst om een
   TXT-record ter verificatie.
4. Zet in het DNS-paneel uit A7:
   - Type `A`, naam `planning`, waarde = het **eerste** IP van Firebase
   - Type `A`, naam `planning`, waarde = het **tweede** IP van Firebase
   - **Op Cloudflare: zet de proxy (het oranje wolkje) UIT — grijs.** Firebase levert zijn eigen
     TLS-certificaat; met de Cloudflare-proxy ertussen loopt de certificaatuitgifte vast.
5. Terug in Firebase → **Verify**.
6. Het certificaat komt er binnen enkele minuten tot 24 uur. Status **Connected** = klaar.

## A9. Meld terug aan Jasper

Stuur exact dit door:

- De zes `VITE_FIREBASE_*`-waarden uit A6
- De echte project-ID (als die afwijkt van `je-planning`)
- Waar de DNS van `jeconcept.be` beheerd wordt (A7)
- Of het domein op **Connected** staat (A8)

---

# Deel B — terminalwerk (voor Jasper, niet voor de browser)

Dit kan Claude in Chrome niet doen. Vanaf een gekloonde `Kenjeklanten/planning`:

```bash
npm install
cp .env.example .env.local        # vul de zes waarden uit A6 in

# Wijkt de project-ID af van je-planning? Pas .firebaserc aan.
npx firebase login
npx firebase use <project-id>
npx firebase target:apply hosting app <project-id>

# 1. Beveiligingsregels en indexes eerst — zonder indexes werkt geen enkel overzicht
npx firebase deploy --only firestore:rules,firestore:indexes,storage

# 2. Cloud Functions (toegangscontrole + de Canva-koppeling)
cd functions && npm install && cd ..
npx firebase deploy --only functions

# 3. Basisgegevens: merken, toegangsdomeinen, de borden
#    Service-account: Project settings → Service accounts → Generate new private key
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/seed.mjs

# 4. De applicatie zelf
npm run build && npx firebase deploy --only hosting
```

Meld daarna aan met Google. **De eerste persoon die binnenkomt wordt automatisch eigenaar** —
anders kan niemand ooit iemand uitnodigen. `@jeconcept.be` en `@kenjeklanten.be` krijgen
automatisch toegang; ieder ander heeft een uitnodiging nodig via *Instellingen → Team*.

## Optioneel — de Canva-koppeling

Alleen nodig voor de social media kalender.

1. Maak een app op <https://www.canva.com/developers/integrations>
2. Redirect-URL: `https://planning.jeconcept.be/api/canva/callback`
3. Scopes: `profile:read`, `design:meta:read`, `design:content:read`, `design:content:write`,
   `asset:read`, `brandtemplate:meta:read`, `brandtemplate:content:read`, `folder:read`,
   `comment:read`, `comment:write`
   (`folder:read` is nodig om de mappen van het team te tonen bij *Uit Canva*; `comment:*` om een
   reviewbeslissing als reactie op het ontwerp te zetten en het antwoord terug te halen)
4. ```bash
   npx firebase functions:secrets:set CANVA_CLIENT_ID
   npx firebase functions:secrets:set CANVA_CLIENT_SECRET
   npx firebase functions:secrets:set CANVA_REDIRECT_URI
   npx firebase deploy --only functions
   ```

---

## Als er iets misgaat

| Symptoom | Oorzaak | Wat te doen |
|---|---|---|
| Witte pagina, console zegt `VITE_FIREBASE_* ontbreken` | `.env.local` niet gevuld vóór `npm run build` | vullen en opnieuw builden — Vite bakt ze in bij de build, niet bij het laden |
| `Dit account heeft geen toegang` | het e-maildomein staat niet in `config/access` en er is geen uitnodiging | zie `scripts/seed.mjs`, of laat een bestaande beheerder uitnodigen |
| Domein blijft op *Needs setup* | Cloudflare-proxy staat aan | wolkje op grijs zetten (A8 stap 4) |
| Borden laden traag of geven een index-fout | indexes niet gedeployed | `firebase deploy --only firestore:indexes` |
| `HTTP Error: 400, Billing account` bij functions | project staat nog op Spark | Blaze activeren (A2) |

---

## Zie ook

- **[`handover-claude-in-chrome.md`](handover-claude-in-chrome.md)** — hetzelfde browserwerk, maar
  geschreven als opdracht die je in één keer aan Claude in Chrome kan geven.
- **`scripts/go-live.sh`** — deel B als één commando, in de juiste volgorde en met leesbare fouten.
