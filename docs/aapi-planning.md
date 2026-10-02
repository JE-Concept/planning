# De planning uit AAPI in JE Plan

De personeelsplanning staat in AAPI (socsec.aapi.be). JE Plan leest ze mee: wie
wanneer werkt, en bij Evenementen ook bij welk event dat hoort. JE Plan schrijft
niets terug — AAPI blijft de baas over de planning.

## Wat je ziet

**Team → Planning** toont per dag wie er werkt, met de afdeling als kleur en het
statuut (student, flexi, vast, zelfstandig, extern) erbij. Week of maand,
filters op afdeling en persoon, en een filter voor "enkel wat aandacht vraagt".

**Op een event** staat een eigen tab *Personeel*: wie er komt, hoeveel uren samen
(met de pauze eraf), de uitsplitsing per statuut, en daaronder wat er mogelijk
nog bij hoort — shifts van die dag die nergens aan hangen of waar de koppeling
twijfelde.

Op de tab zelf staat een bolletje, zodat je de planning niet hoeft te openen om
te weten of ze rond is:

| Kleur | Wat het zegt |
| --- | --- |
| 🟢 groen | Er staat volk en er valt niets te beslissen. |
| 🟠 oranje | Er staat volk, maar er is een vraag open: een koppeling waarover getwijfeld werd, een shift van die dag die nergens bij hoort, of iemand die afzegde zonder vervanging. |
| 🔴 rood | Er staat niemand, of er staat een dienst open. |
| *geen* | AAPI komt bij dit event niet aan te pas. Dan is er niets om over te oordelen, en liegt elke kleur. |

**Bij een meerdaags event** wordt de ploeg per dag opgedeeld, met per dag een
eigen telling — "staat er zaterdag genoeg volk" is een vraag per dag, en één
getal over de hele reeks beantwoordt ze niet. Een dag zonder volk staat er met
zoveel woorden bij; dat is net de dag die je wil zien. De dag vóór het event
krijgt zijn eigen kop, want wie de tent zet werkt een andere dag dan wie
bedient.

**Diensten die nog niet ingevuld zijn** staan bovenaan dat tabblad. Dat zijn
rijen uit AAPI met een Planning Id maar zonder Employee Id: ingepland, nog
niemand op. Ze tellen niet mee in het aantal of in de uren — er komt niemand —
en invullen doe je in AAPI, want daar hangt de Dimona aan.

Geannuleerde shifts blijven staan, doorgestreept. Shifts die uit AAPI verdwenen
zijn ook, met het label *Niet meer in AAPI*. Ze verdwijnen nooit uit JE Plan:
"er stond iemand en die is afgezegd" is informatie, een lege plek is dat niet.

## Hoe de planning binnenkomt

### Met de hand

Exporteer in AAPI de **Planning Overview** als xlsx en zet hem neer op
**Team → Planning → Import**. Je ziet eerst wat erin zit — aantal rijen, periode,
aantal mensen, hoeveel shifts bij Evenementen — en pas als je op *Importeren*
klikt, gebeurt er iets.

Alleen beheerders kunnen importeren.

### Per mail

Stuur het bestand naar **info@jeconcept.be**. Elke xlsx-bijlage die daar
binnenkomt wordt opgepakt; blijkt het geen planning te zijn, dan staat dat als
*Geen planning* in de lijst en gebeurt er verder niets. Lukt het wel, dan krijgen
de beheerders een melding — maar alleen wanneer er echt iets veranderde.

Dit werkt pas wanneer `functions-mail` uitgerold is; zie
`docs/e-mailmeldingen-aanzetten.md`.

### De personeelslijst

Naast de planning kun je de **personeelslijst** uit AAPI neerzetten, op hetzelfde
vak en hetzelfde mailadres. De tool kijkt zelf welk van de twee ze gekregen
heeft: een planning heeft de kolommen *Planning Id* en *Start Datetime*, een
personeelslijst *Naam* en *Dimona type*.

Daarmee krijgt iedereen zijn afdeling, zijn statuut, zijn e-mailadres en zijn
gsm-nummer in JE Plan — ook wie nog nooit ingepland stond. Je vindt ze terug op
**Team → Medewerkers**, onder *In dienst volgens AAPI*.

**Wat er met opzet níét uit overgenomen wordt:** het rijksregisternummer, het
rekeningnummer en de betalingswijze, het thuisadres, de geboortedatum en
-plaats, de leeftijd, het geslacht, de nationaliteit, de burgerlijke staat, het
aantal kinderen ten laste en de verplaatsingsvergoeding.

Dat is geen onvermogen maar een keuze. JE Plan is een planningstool waarin het
hele kantoor meeleest; een rijksregisternummer heeft daar geen enkele functie,
en elke kopie ervan is er een die ooit ergens belandt waar niemand hem gezocht
heeft. Wat de personeelsadministratie nodig heeft, staat in AAPI, en dat blijft
de plek. Het importrapport somt na afloop op wat het heeft laten liggen.

Heb je iets daarvan tóch nodig in JE Plan, zeg dan wélk veld en waarvoor — dan
komt dat er gericht bij, en niet alles tegelijk.

**Eén beperking om te kennen:** de personeelslijst bevat geen `Employee Id`, de
planningsexport wel. Iemand uit de twee bestanden aan elkaar knopen gebeurt dus
op e-mailadres en anders op naam. Dat werkte op de lijst van oktober voor alle
veertien mensen die in beide bestanden stonden. Kan AAPI de personeelslijst ooit
mét die id exporteren, dan wordt het exact.

### Later: rechtstreeks uit AAPI

De plek staat klaar (`functions/aapi/bron.js`): er hoeft alleen een `ApiBron`
naast de `XlsxBron` te komen die dezelfde rijen levert. Al de rest — valideren,
normaliseren, upserten, matchen, rapporteren — verandert dan niet.

## Hetzelfde bestand twee keer importeren

Dat mag, en er gebeurt niets. De shifts worden bijgehouden op de GUID die AAPI
zelf meegeeft, dus een herimport herkent elke rij en laat ongewijzigde rijen met
rust. Het rapport zegt dan netjes "43 ongewijzigd".

Dat is ook wat je correcties beschermt: een koppeling die jij met de hand
gelegd hebt, of waarvan je gezegd hebt dat ze bij geen event hoort, wordt **nooit**
door een import overschreven.

## Hoe een shift aan een event komt

Alleen shifts in de afdeling **Evenementen**. Er wordt gekeken naar tijd, niet
naar plaats: in AAPI staat alles onder *Meer-Bistro Het Vinne*, ook een event in
Kortessem.

Hoe scherp er gekeken kan worden, hangt van het event af:

1. **Staat het draaiboek ingevuld**, dan is dat het venster — van de eerste regel
   tot de laatste, dus van opbouw tot afbraak.
2. **Anders een echt beginuur** op het event, plus zes uur.
3. **Anders alleen de dag.** Dan telt alleen nog hoeveel events er die dag zijn.

Rond elk venster komt drie uur speling voor en na. Scoort één event hoog genoeg
en duidelijk hoger dan het volgende, dan wordt het gekoppeld. Anders komt de
shift op *Welk event?* te staan, met de kandidaten en hun score, zodat jij er met
één klik een kiest.

Events in de verkoopfase (aanvraag, offerte maken, offerte verstuurd) doen niet
mee: zolang er geen offerte aanvaard is, is er geen event maar een kans.

**Staat het event er nog niet** op het moment van importeren, dan blijven die
shifts ongekoppeld — en pakt de vólgende import ze alsnog op. Er wordt bijgehouden
wanneer er voor het laatst naar gekeken is.

## Als er iets misgaat

- **"Dit bestand mist de kolom …"** — de export is niet compleet. Exporteer
  opnieuw als *Planning Overview* met alle kolommen.
- **Een rij overgeslagen** — het rapport zegt welke rij en waarom. De rest is wel
  geïmporteerd.
- **"Nieuwe kolommen in de export"** — AAPI heeft er iets bij gezet. Geen
  probleem, het is genegeerd; laat het weten als het iets is wat we moeten lezen.
- **Shifts die niemand koppelde** — filter de kalender op *enkel wat aandacht
  vraagt*.

## Wat hier bewust niet gebeurt

- **JE Plan schrijft niets naar AAPI.** Twee systemen die allebei de waarheid
  mogen schrijven, is hoe je niet meer weet welke klopt.
- **De tijden, namen en statuten zijn hier niet aan te passen.** Die horen in
  AAPI gewijzigd te worden; de volgende import neemt het over.
- **Het weekrooster in JE Plan (`/rooster`) blijft bestaan.** Dat is met de hand
  gemaakt en hangt aan profielen van deze tool; dit komt uit AAPI en hangt aan
  mensen die hier meestal geen account hebben. Dat die twee op termijn dubbel
  werk zijn, klopt — welke blijft, is een beslissing van wie ermee plant.
