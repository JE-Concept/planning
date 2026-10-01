# E-mailmeldingen aanzetten

JE Plan stuurt vier soorten berichten: bij een toewijzing, bij een reactie op je
taak, de avond vóór een deadline, en 's ochtends een lijstje met wat er op je
naam over tijd staat. Elk bericht kan langs twee kanalen — een melding op je
toestel en een e-mail — en iedereen zet per soort en per kanaal zelf aan wat hij
wil, via **Welke meldingen ik krijg** in het menu onder je naam.

Het rekenwerk erachter (wie krijgt dit, en wie juist niet) staat in
`functions/notify.js`, met tests in `tests/meldingen.test.js`.

Voor het pushkanaal is er een aparte sleutel nodig; die staat beschreven in
[push-notificaties-aanzetten.md](./push-notificaties-aanzetten.md). Dit document
gaat over het e-mailkanaal.

## Waarom SMTP van de eigen Workspace

Er is bewust geen maildienst bijgekomen. SendGrid, Mailgun of Postmark is
telkens een leverancier erbij, een account erbij, een verwerkersovereenkomst
erbij en een gratis niveau dat kan verdwijnen.

JE Concept heeft al Google Workspace op `jeconcept.be`. Een adres voor de tool
en een app-wachtwoord daarbij kost niets extra, de post vertrekt van een adres
dat het bedrijf zelf bezit, en SPF en DKIM staan voor dat domein al goed — dus
geen domeinverificatie, en de mails komen niet in de spam terecht.

De Firebase-extensie *Trigger Email from Firestore* doet precies hetzelfde en
heeft óók een SMTP-server nodig. De code hier heeft met opzet dezelfde vorm als
die extensie — schrijven naar een collectie, een verzender die erop luistert —
zodat ze later door de extensie te vervangen is zonder één trigger aan te raken.

## Waarom er niets stukgaat zonder de sleutel

Een functions-uitrol faalt in zijn geheel op een ontbrekend geheim. Dat heeft
hier ooit `ensureProfile` meegesleept, en toen kon niemand meer inloggen.

Daarom staat de verzender in een eigen codebase, `functions-mail/`, net als de
overlegfuncties in `functions-meetings/`. De triggers zelf staan in `functions/`
en kennen geen geheim: zij schrijven alleen een rij in `mailQueue`. Is de
sleutel er niet, dan wordt `functions-mail` overgeslagen, blijven die rijen op
`wachtend` staan, zegt het uitrollogboek waarom, en werkt de rest van de tool
gewoon door.

## Stap 1 — een afzenderadres en een app-wachtwoord

1. Maak in Google Workspace een adres aan voor de tool, bijvoorbeeld
   `plan@jeconcept.be`. Een gedeeld adres, geen persoonlijk: post van "JE Plan"
   hoort niet uit de mailbox van één iemand te komen.
2. Zet op dat account tweestapsverificatie aan — zonder dat bestaan
   app-wachtwoorden niet.
3. Ga naar [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords),
   aangemeld als dat adres, en maak een app-wachtwoord met een herkenbare naam
   (`je-plan-meldingen`).
4. Kopieer de zestien tekens. De spaties ertussen mogen weg.

## Stap 2 — het geheim bij het project zetten

Het is één connectiestring, geen vijf losse waarden: één ding dat fout kan
staan, en de fout is meteen te zien.

```
firebase functions:secrets:set SMTP_URL --project je-planning
```

De waarde ziet er zo uit:

```
smtps://plan%40jeconcept.be:appwachtwoord@smtp.gmail.com:465
```

Let op de `%40`: de `@` in het gebruikersnaam-gedeelte moet URL-gecodeerd zijn,
anders leest de server het adres verkeerd.

Zonder terminal kan het ook via **Google Cloud → Security → Secret Manager →
Create secret**, met als naam exact `SMTP_URL`.

Wil je van een ander adres versturen dan wat in de code staat, zet dan de
omgevingsvariabele `MAIL_FROM` op de functie (bijvoorbeeld
`JE Plan <plan@jeconcept.be>`).

## Stap 3 — opnieuw uitrollen

De uitrol kijkt of het geheim bestaat. Bestaat het, dan wordt `functions:mail`
meegenomen; bestaat het aantoonbaar niet, dan slaat hij het over met een
waarschuwing en gaat de rest gewoon live.

*Aantoonbaar* is hier het sleutelwoord, en het is één keer misgegaan. De
servicesleutel van de uitrol mag Secret Manager niet lezen — dat recht zit niet
in de rollen die een Firebase-beheersleutel standaard krijgt. Het nakijken
faalde dus óók toen het geheim er wél stond, en maandenlang zei de log
"bestaat niet" terwijl de echte reden "ik mag niet kijken" was. Sindsdien slaat
`scripts/ci/geheim.sh` alleen over bij een echte `NOT_FOUND`; kan hij het niet
nakijken, dan rolt hij uit en laat hij de uitrol zelf oordelen — die mag er wél
bij.

Wil je dat de log weer het exacte antwoord geeft, geef het account
`firebase-adminsdk-…@je-planning.iam.gserviceaccount.com` dan de rol
**Secret Manager Viewer** in [IAM](https://console.cloud.google.com/iam-admin/iam).
Nodig is het niet.

Draai de go-live workflow of push naar `main`. In het logboek staat daarna
ofwel de uitrol van `functions:mail`, ofwel de regel *"Geheim SMTP_URL bestaat
niet in dit project — er wordt niet gemaild, alleen gepusht."*

## Stap 4 — nakijken of er echt post vertrekt

**Actions → Onderhoud → `meldingen-nakijken`** leest de live gegevens en zegt
hoeveel rijen er in `mailQueue` staan, met welke stand, en wanneer er voor het
laatst iets verstuurd is. Dat script schrijft niets.

Blijft alles op `wachtend` staan terwijl `functions:mail` wél uitgerold is, dan
is het geheim er maar klopt de inhoud niet — meestal de ontbrekende `%40` of
een app-wachtwoord dat ingetrokken is. De mislukte rijen dragen dan de reden.

## Nakijken of het werkt

Wijs jezelf een taak toe vanaf een ander account. In Firestore komt er een rij
in `mailQueue` bij. Ging ze de deur uit, dan staat er `status: verstuurd` met
een `messageId`; lukte het niet, dan staat er `status: mislukt` met de reden van
de mailserver erbij. Die collectie is met opzet voor niemand leesbaar vanuit de
app — er staan adressen en volledige berichtteksten van het hele team in — dus
kijken doe je in de Firebase-console.
