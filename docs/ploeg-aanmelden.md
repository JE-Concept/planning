# Aanmelden met een cijfercode

Het bureau meldt zich aan met Google. De ploeg niet: studenten en flexi's die
één zaterdag per maand komen werken, maken daar geen Google-account voor aan.
Zij kiezen hun naam en typen vier cijfers.

## Hoe het werkt

Op het aanmeldscherm staat onder de Google-knop **Ik kom werken**. Daarachter:
je naam zoeken, kiezen, en je code typen. De eerste keer kies je die code zelf.

De namenlijst komt uit **AAPI** — dezelfde mensen als op Team → Medewerkers.
Wie daar niet in staat, kan zich niet aanmelden; de weg naar binnen loopt dus
via de personeelslijst en niet via een uitnodiging.

## Wat die vier cijfers beschermen

Je eigen uren, en de events waarop je staat met hun tijd en plaats. Geen
bedragen, geen offertes, geen gegevens van collega's — de regels in
`firestore.rules` laten een code-account daar niet bij, en dat is wat de
drempel zo laag mag maken.

Wat er wél omheen staat:

- **Een slot na vijf misse pogingen**, een kwartier lang. Zonder dat zijn
  tienduizend mogelijkheden met een script in een uur door te lopen.
- **Geen code die iedereen eerst probeert.** 1234, 0000, 1111 en de omgekeerde
  reeksen worden geweigerd. Niet omdat ze zwakker zijn — elke vier cijfers zijn
  even waarschijnlijk — maar omdat ze dat juist níét zijn: dit is wat mensen
  kiezen en dus wat een ander eerst probeert.
- **De code staat in `personeelCodes`**, een collectie die geen enkel tabblad
  mag openen (`allow read, write: if false`). Alleen de Cloud Functions komen
  erbij.

## De code inkijken, en de keerzijde daarvan

Op **Team → Medewerkers** staat per persoon een knop *Code tonen*. Dat is
bewust een knop en geen kolom: vier cijfers zijn de vorm van een bankcode, en
dit scherm blijft openliggen terwijl er iemand meekijkt.

**Wie kijkt, laat een spoor na** in `personeelCodeGelezen`. Dat is wat
"zichtbaar in de backoffice" draaglijk maakt: niet dat niemand kan kijken, maar
dat kijken niet onzichtbaar is.

En daarom staat er bij het kiezen van een code, en nog eens bij het wijzigen
ervan: **neem niet de code van je bankkaart.** Mensen hergebruiken vier cijfers,
en deze zijn inkijkbaar.

> Wil je dat liever anders, dan is de alternatieve vorm: de code versleuteld
> bewaren en in de backoffice alleen *"code ingesteld"* tonen met een knop om
> hem te resetten. Dan kan niemand hem inkijken — ook jij niet — en moet iemand
> die zijn code vergeten is een nieuwe kiezen. Dat is één dag werk en een
> andere afweging, geen betere of slechtere.

## Welk account iemand krijgt

`ploeg-<Employee Id>`, afgeleid van AAPI en niet willekeurig. Daardoor bestaat
het al voordat iemand zich één keer aangemeld heeft — en dat is wat de import
toelaat hem nu al op een event te zetten: `medewerkers` op het event draagt
deze id's, en de regels laten hem daarmee precies die events zien zodra hij
binnenkomt.

De rol staat vast op `staff`. Die komt uit de functie en niet uit een
keuzelijst: een code-account hoort nooit meer te kunnen dan de ploeg.

## Wie er op een event staat

Sinds AAPI de enige bron is, wordt `medewerkers` op een event niet meer met de
hand gevuld maar door de import: wie op een shift van dat event staat, staat in
dat veld. Afgezegde shifts en shifts die uit AAPI verdwenen zijn tellen niet
mee — die persoon komt niet, en hoort het event dus ook niet te kunnen openen.

Dat gebeurt na elke import en na elke handmatige koppeling, voor het oude én
het nieuwe event: wie van event wisselt, moet van het ene af en bij het andere
bij.

## Wat iemand met een code ziet en kan

- **Mijn events** — de events waarop hij staat, uit de kale kopie zonder één
  bedrag erin. Bovenaan staan **zijn eigen diensten** zoals ze in AAPI staan:
  wanneer, waar, hoe lang en met welke pauze. Alleen lezen — zou hij ze hier
  kunnen verzetten, dan staan er twee waarheden over dezelfde dienst en hangt
  er loon aan welke er klopt.
- **Uren** — zijn eigen tijdsregistratie. Alleen de zijne: de regels laten hem
  de uren van een collega niet zien, en hij boekt op de events waarop hij
  staat en niet op de hele lijst.
- **Openen & sluiten** — de dagelijkse lijsten, zoals voorheen.
- **Zijn profiel** — zijn foto, zijn naam en zijn code wijzigen.

- **Voor jou** — de notities waarin iemand hem met `@` aangesproken heeft.
  Alleen díé notities, niet de hele draad. Taggen zonder dat de getagde de zin
  kan lezen, is een melding die naar een gesloten deur wijst — dan is de
  vermelding geen vermelding maar een kennisgeving.

Wat hij niet ziet: bedragen, offertes, klanten, het bord, de planning van
anderen, en de eventnotities waarin hij niet genoemd is. Dat staat niet in een filter op het
scherm maar in `firestore.rules` — een filter bepaalt wat je ziet, een regel
bepaalt wat je krijgt.
