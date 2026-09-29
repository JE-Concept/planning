# Push-notificaties aanzetten

Alles aan de kant van de app staat er al: de service worker, het bewaren van een
token per toestel in `pushTokens`, het uitzetten per toestel, en de Cloud
Functions die een melding versturen bij een toewijzing of een verzoek om na te
lezen. Wat ontbreekt is één sleutel.

Zolang die sleutel er niet is, verbergt de app de knop "Meldingen aanzetten" in
plaats van er een te tonen die niets doet — `pushIngesteld()` in
`src/lib/push.js` is daar de schakelaar. Er gaat dus niets stuk zonder; er komt
alleen niets binnen.

## Waarom een aparte sleutel

Webpush werkt met VAPID: de browser van je medewerker wil weten wie de afzender
is voor hij een melding aanneemt. Firebase noemt dat sleutelpaar in de console
het **Web Push-certificaat**. De publieke helft zit in de app, de private helft
blijft bij Google. Het is geen geheim in de strikte zin — hij staat in de bundel
die iedere bezoeker downloadt — maar hij hoort wel bij dit project en bij geen
ander, en daarom staat hij bij de rest van de buildvariabelen.

## Stap 1 — de sleutel ophalen

1. Ga naar de [Firebase-console](https://console.firebase.google.com/) en kies
   het project van JE Plan.
2. Tandwiel linksboven → **Project settings**.
3. Tabblad **Cloud Messaging**.
4. Onder **Web configuration** → **Web Push certificates**.
5. Staat er nog geen sleutelpaar: **Generate key pair**. Staat er al een: die is
   het, er hoeft geen tweede bij.
6. Kopieer de waarde onder **Key pair**. Het is één lange regel die met `B`
   begint, ongeveer tachtig tekens, zonder spaties.

Kom je op dat tabblad een melding tegen dat de **Cloud Messaging API (V1)**
uitstaat, zet die dan eerst aan via de link ernaast. Zonder die API kan de Cloud
Function niets versturen, ook niet met een geldige sleutel.

## Stap 2 — de sleutel in de build zetten

De sleutel wordt in de app gebakken tijdens het uitrollen, dus hij moet bij de
GitHub-geheimen staan en niet in de code.

1. Ga naar
   <https://github.com/Kenjeklanten/planning/settings/secrets/actions>.
2. **New repository secret**.
3. Naam: `VITE_FIREBASE_VAPID_KEY` — exact zo, met streepjes en in kapitalen.
4. Waarde: wat je in stap 1 kopieerde, zonder aanhalingstekens en zonder witruimte
   ervoor of erna.
5. **Add secret**.

De workflows verwijzen er al naar (`.github/workflows/go-live.yml` en `ci.yml`),
dus er hoeft niets in de code te veranderen.

## Stap 3 — opnieuw uitrollen

Een geheim werkt pas bij de volgende build: de vorige is al gemaakt zonder.

<https://github.com/Kenjeklanten/planning/actions/workflows/go-live.yml> →
**Run workflow**, met **Wat uitrollen** op `alles`. "Basisgegevens zetten" mag
uit: die staan er al, en de app is in gebruik.

## Stap 4 — nakijken of het werkt

1. Open <https://planning.jeconcept.be> op je telefoon of laptop, in een browser
   waarin je aangemeld bent.
2. Klik op je naam onderaan de zijbalk. Daar staat nu **Meldingen aanzetten**;
   stond die er eerder niet, dan is dat het bewijs dat de sleutel is
   aangekomen.
3. Klik erop en geef de browser toestemming.
4. Laat iemand anders een taak aan jou toewijzen, of doe het zelf vanaf een
   ander account. Je eigen wijzigingen sturen met opzet geen melding — anders
   krijg je een bericht over je eigen klik.

Blijft het stil, kijk dan in de Firebase-console bij **Functions** → logs van
`notifyAssignment`. Twee meldingen komen daar vaker voor:

- `registration-token-not-registered` — een oud toestel. Die rij wordt
  automatisch opgeruimd; niets aan te doen.
- `SenderId mismatch` — de sleutel hoort bij een ander Firebase-project dan waar
  de app tegen praat. Controleer dat `VITE_FIREBASE_MESSAGING_SENDER_ID` en de
  sleutel uit hetzelfde project komen.

## Wat iOS wel en niet doet

Op een iPhone werkt webpush alleen wanneer JE Plan eerst aan het beginscherm is
toegevoegd. Safari → deelknop → **Zet op beginscherm**, en daarna de app vanaf
dat icoon openen. In Safari zelf blijft de knop zonder effect; dat is een keuze
van Apple en niet iets dat aan onze kant op te lossen is. Op Android en op een
laptop werkt het in de browser zelf.
