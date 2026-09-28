# Handover voor Claude in Chrome — zet planning.jeconcept.be live

**Wat dit is:** een opdracht die je in één keer aan Claude in Chrome kan geven. Alles hieronder
gebeurt in de browser, in de Google- en DNS-accounts van JE Concept. De terminalstappen staan
onderaan en zijn voor Jasper — die kan Claude in Chrome niet uitvoeren.

**Waarom niet automatisch:** het aanmaken van een Firebase-project en het aanzetten van Blaze
vraagt om een ingelogd Google-account met een betaalmiddel, en het domein koppelen vraagt om
toegang tot het DNS-beheer van `jeconcept.be`. Geen van beide bestaat in de omgeving waarin deze
code geschreven is. De browser van Jasper heeft ze wel.

---

## De opdracht — plak dit in Claude in Chrome

> Je zet een nieuwe webapplicatie live op `planning.jeconcept.be`. Werk de stappen op volgorde af.
> Na elke stap noteer je het resultaat; aan het eind lever je één rapportje op met alles wat ik
> hieronder onder **Terugmelden** vraag.
>
> Regels:
> - **Vraag het mij** voor je een betaalmiddel koppelt, een prijsplan wijzigt, of iets kiest dat
>   definitief is. Ik zit erbij.
> - **Verzin geen waarden.** Wat je niet op het scherm ziet staan, meld je als "niet gevonden".
> - Kom je een scherm tegen dat afwijkt van de beschrijving, stop dan en beschrijf wat je ziet.
>   Google verzet de knoppen in deze console een paar keer per jaar; de volgorde klopt, de
>   exacte labels misschien niet.
>
> ### 1. Firebase-project
> Ga naar <https://console.firebase.google.com/> en maak een project met de naam **`je-planning`**.
> Is die project-ID bezet, neem dan `je-planning-jc` en **noteer de echte ID** — die is later nodig.
> Zet **Google Analytics uit**.
>
> ### 2. Blaze aanzetten
> Linksonder staat het plan-label. Klik **Upgrade** → **Blaze (pay as you go)** en koppel een
> factureringsaccount. **Vraag mij eerst** welk factureringsaccount of welke kaart.
> Stel daarna een **budgetalarm van €10 per maand** in (Google Cloud → Billing → Budgets & alerts).
> Dat is een waarschuwing, geen limiet. Bij vijf gebruikers blijft de rekening in de praktijk €0;
> Blaze is alleen nodig omdat Cloud Functions niet op het gratis plan draaien.
>
> ### 3. Google-login
> **Build → Authentication → Get started** → tabblad **Sign-in method** → **Google** → **Enable**.
> Support-e-mail: `jasper@jeconcept.be`. **Save**.
> Daarna **Settings → Authorized domains → Add domain** → `planning.jeconcept.be`.
> Laat `localhost` en `<project>.firebaseapp.com` staan.
>
> ### 4. Firestore
> **Build → Firestore Database → Create database** → **Production mode** →
> locatie **`eur3 (europe-west)`**.
> ⚠️ Deze locatie is **definitief** en kan later niet meer gewijzigd worden. Kies niets anders,
> en vraag het mij als `eur3` er niet tussen staat.
>
> ### 5. Storage
> **Build → Storage → Get started** → **Production mode** → dezelfde regio. **Done**.
>
> ### 6. Web-app registreren
> **Project settings** (tandwiel) → **General** → onder *Your apps* het web-icoon **`</>`**.
> Nickname `JE Planning`. **Vink Firebase Hosting NIET aan.** → **Register app**.
> Er verschijnt een `firebaseConfig`-blok met zes waarden. Kopieer ze allemaal, in dit formaat:
>
> ```
> VITE_FIREBASE_API_KEY=
> VITE_FIREBASE_AUTH_DOMAIN=
> VITE_FIREBASE_PROJECT_ID=
> VITE_FIREBASE_STORAGE_BUCKET=
> VITE_FIREBASE_MESSAGING_SENDER_ID=
> VITE_FIREBASE_APP_ID=
> ```
>
> Deze waarden zijn **publiek** — ze staan straks in de JavaScript van de site. De beveiliging zit
> in de Firestore-rules, niet in deze sleutel. Je mag ze dus gewoon doorsturen.
>
> ### 7. Waar staat de DNS van jeconcept.be?
> Ga naar <https://dnschecker.org/ns-lookup.php> en zoek `jeconcept.be` op.
> - Nameservers `*.ns.cloudflare.com` → Cloudflare, <https://dash.cloudflare.com/>, zone `jeconcept.be`
> - Iets anders (Combell, One.com, TransIP, Vercel…) → daar moet je zijn
>
> **Meld waar je uitkomt en log nog niet in.** Ik zeg je of je verder mag.
>
> ### 8. Canva-app aanmaken
> Ga naar <https://www.canva.com/developers/integrations> en maak een integratie
> **JE Planning**. Zet:
> - Redirect-URL: `https://planning.jeconcept.be/api/canva/callback`
> - Scopes: `profile:read`, `design:meta:read`, `design:content:read`, `design:content:write`,
>   `asset:read`, `brandtemplate:meta:read`, `brandtemplate:content:read`, `folder:read`,
>   `comment:read`, `comment:write`
>
> Noteer **Client ID** en **Client secret**. De secret zie je maar één keer — kopieer hem meteen
> en zet hem in de kluis, niet in een chatbericht of een document.
>
> ### 9. Domein koppelen — **pas ná de eerste deploy**
> Wacht tot ik zeg dat de site gedeployed is. Dan:
> **Build → Hosting → Add custom domain** → `planning.jeconcept.be`.
> Firebase geeft **twee A-records** (en soms eerst een TXT-record ter verificatie). Zet in het
> DNS-paneel uit stap 7 twee A-records met naam `planning`, één per IP.
> **Staat het op Cloudflare: zet het oranje wolkje UIT (grijs).** Firebase geeft zijn eigen
> TLS-certificaat uit; met de Cloudflare-proxy ertussen loopt dat vast en blijft het domein op
> *Needs setup* hangen.
> Terug in Firebase → **Verify**. Status **Connected** = klaar. Het certificaat duurt enkele
> minuten tot 24 uur.
>
> ### Terugmelden
> 1. De echte project-ID
> 2. De zes `VITE_FIREBASE_*`-waarden
> 3. Staat Blaze aan, en staat het budgetalarm op €10?
> 4. Waar de DNS van `jeconcept.be` beheerd wordt
> 5. De Canva **Client ID** (de secret apart, via de kluis)
> 6. De status van het domein in Firebase Hosting

---

## Daarna: één commando voor Jasper

Zodra de zes waarden binnen zijn, in een gekloonde `Kenjeklanten/planning`:

```bash
npm install
cp .env.example .env.local     # vul de zes VITE_FIREBASE_*-waarden in
./scripts/go-live.sh <project-id>
```

Dat script logt in, zet het project, deployt rules → indexes → storage → functions → basisgegevens
→ de applicatie, in die volgorde, en stopt bij de eerste fout met een leesbare uitleg. Wat het doet
en waarom staat in het script zelf.

De Canva-geheimen erbij (kan ook later):

```bash
npx firebase functions:secrets:set CANVA_CLIENT_ID
npx firebase functions:secrets:set CANVA_CLIENT_SECRET
npx firebase functions:secrets:set CANVA_REDIRECT_URI   # https://planning.jeconcept.be/api/canva/callback
npx firebase deploy --only functions
```

**De eerste persoon die daarna inlogt wordt eigenaar** van de werkruimte — anders zou niemand ooit
iemand kunnen uitnodigen. Log dus zelf als eerste in. `@jeconcept.be` en `@kenjeklanten.be` komen
daarna automatisch binnen; ieder ander heeft een uitnodiging nodig via *Instellingen → Team*.

---

## Wat er misgaat, en waaraan je het ziet

| Wat je ziet | Wat er aan de hand is | Wat je doet |
|---|---|---|
| Witte pagina, console zegt `VITE_FIREBASE_* ontbreken` | `.env.local` was leeg tijdens `npm run build` | vullen en opnieuw builden — Vite bakt ze in bij de build |
| `HTTP Error: 400, Billing account` bij functions | project staat nog op Spark | Blaze aanzetten (stap 2) |
| Domein blijft op *Needs setup* | Cloudflare-proxy staat aan | wolkje op grijs (stap 9) |
| `Dit account heeft geen toegang` | domein niet in `config/access` en geen uitnodiging | `scripts/seed.mjs`, of laten uitnodigen |
| Borden laden traag of geven een index-fout | indexes niet gedeployed | `npx firebase deploy --only firestore:indexes` |
| Canva zegt `invalid_scope` | de app mist `folder:read` of `comment:*` | scopes aanvullen (stap 8) en opnieuw koppelen |
