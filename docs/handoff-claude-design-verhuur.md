# Handoff aan Claude Design — de verhuursite

Voor wie dit leest in Claude Design: dit is wat de verhuursite van JE Concept vandaag is, wat er
ontworpen mag worden en wat vastligt. De site staat live op <https://je-planning-verhuur.web.app>
(straks `rental.jeconcept.be`) en is gebouwd met het **JE Concept Design System** dat ook de
backoffice JE Plan draagt. Het ontwerpwerk is: van een werkende, sobere etalage een site maken waar
een klant *graag* huurt — zonder het systeem eronder los te laten.

Dit document hoort bij `docs/design-je-concept.md` (het design van de backoffice) en gebruikt
dezelfde opbouw: wat er is, waar het staat, wat de keuzes waren.

---

## Waar je naar kijkt

| | |
|---|---|
| Design system (bron) | <https://claude.ai/artifact/6955mbX4UCq4uqwLdmpHjQ> — JE Concept Design System, met de groep **Reserveren** (Reservatiestand, Beschikbaarheidsbalk, Dagtijdlijn, Reservatieregel, Conflictmelding) |
| Goedgekeurd design van de backoffice | <https://claude.ai/artifact/KHG6SpnBQcqhWYixT19VtR> |
| **Werkende preview van de verhuursite met voorbeelddata** | <https://claude.ai/artifact/MbJhaQvQrWLUJiUs4VdjEq> — klik erdoor; de mand, het afrekenen en het inloggen werken met nepgegevens (`/#/login/demo` logt in als Lies Vandeputte, 10% korting) |
| Live | <https://je-planning-verhuur.web.app> |
| Code | map `verhuur/` in `Kenjeklanten/planning`; stijl in `verhuur/src/styles/verhuur.css`, tokens in `src/styles/je-ds.css` |

De preview is de plek om op te reageren: elke opmerking kan daar als commentaar bij het scherm.

---

## Wie dit gebruikt, en waarvoor

JE Concept (Sint-Truiden) verhuurt feestmateriaal dat iemand zelf komt halen: statafels,
koelkasten met glasdeur, terrasverwarmers, een mobiele bar. Een tent of een volledige
feestopstelling wordt geplaatst en gaat via een offerte. Twee bezoekers dus:

1. **De particulier of vereniging** met een bestelwagen, die zaterdag een tuinfeest heeft en vrijdag
   zes statafels en een koelkast wil ophalen. Betaalt meteen met kaart of Bancontact. Komt vooral op
   een telefoon, 's avonds.
2. **De bedrijfsklant of de klant met een groot feest**, die een partytent, een volledige bar of
   "iets voor 200 man" zoekt. Vraagt een offerte aan; het team belt terug.

Beide moeten binnen een minuut weten: *is het er, kan het op mijn datum, wat kost het, en wat moet
ik doen.* De site is geen catalogus om in te bladeren maar een kassa met een etalage ervoor.

---

## De schermen zoals ze nu zijn

Alle routes staan in `verhuur/src/App.jsx`; de pagina's in `verhuur/src/pages/`.

| Scherm | Route | Bestand | Wat er staat |
|---|---|---|---|
| Catalogus | `/` | `Catalogus.jsx` | Kop "Huren bij JE Concept" met één zin; **periodekiezer** (van / tot) bovenaan, want zonder datum heeft "beschikbaar" geen betekenis; filterchips per categorie; raster van kaarten met foto (of een plaatshouder in de huisletter), naam, korte omschrijving, dagprijs en het aantal vrij op die periode; onderaan een blok "Staat wat je zoekt er niet bij?" dat naar de offerteaanvraag leidt |
| Artikel | `/artikel/:id` | `Artikel.jsx` | Grote foto, omschrijving, prijsstaffel (dag / weekend / week), waarborg, aantal kiezen, "In de mand" — of "Vraag een offerte" voor wat niet direct te huren is |
| Mand | `/mand` | `Mand.jsx` | Regels met aantal en bedrag, de som (ex btw, btw 21%, waarborg, totaal), gegevens van de klant (naam, e-mail, telefoon), knop "Afrekenen" naar Stripe Checkout; als je ingelogd bent staat de korting erbij |
| Offerteaanvraag | `/offerte` | `Offerte.jsx` | Formulier: wat, wanneer, voor hoeveel mensen, waar, contactgegevens; verzenden geeft een bevestiging; een verborgen lokvakje houdt bots tegen (geen captcha) |
| Afloop | `/gelukt`, `/afgebroken` | `Afloop.jsx` | Na Stripe: "Gelukt, je krijgt een mail" met het kenmerk en de afhaalafspraak; of "Afgebroken, je mand staat er nog" |
| Inloggen | `/login`, `/login/:token` | `Login.jsx` | Eén veld: e-mailadres; je krijgt een link per mail (15 minuten geldig); geen wachtwoord |
| Mijn huren | `/mijn` | `Mijn.jsx` | Lopende en voorbije huren van de ingelogde klant, met status en bedrag; uitloggen |

Vaste onderdelen: `onderdelen/Periode.jsx` (de datumkiezer, met het boekingsvenster: minstens twee
dagen vooraf, hoogstens een jaar; last minute via mail), `onderdelen/Prijs.jsx` (bedragen in euro,
Belgische notatie), `onderdelen/Foto.jsx` (foto of plaatshouder). Kop en voet staan in `App.jsx`:
merknaam + "verhuur", links Catalogus / Mand (met teller) / Inloggen of Mijn huren; voet met
`info@jeconcept.be` — **geen telefoonnummer**, dat komt later (`CONTACT.telefoon` is bewust `null`).

---

## Wat vastligt

Dit is de grens tussen ontwerp en systeem. Alles links van de streep mag anders; alles rechts niet.

**Het design system is de taal.** Navy `#1B3A6B` als accent, Oswald voor koppen, Source Sans 3 voor
tekst (alleen 400/500/600; geen cursief — de bestanden staan in `verhuur/public/fonts/`), kleine
afrondingen (2 en 4 px), lijnen in plaats van schaduwen, de tokens uit `je-ds.css`. Een letterlijke
kleur of maat buiten de tokens hoort er niet in. De nachtschil (`.je-night`) bestaat; de site
gebruikt ze nog niet, en dat mag zo blijven.

**De breekpunten** zijn 560, 860, 1000 en 1240 px. De site moet op 390 px breed volledig werken,
met tikdoelen van minstens 32 px (de smoke-test meet dat), en zonder horizontaal scrollen.

**Wat de site nooit mag doen.** Ze stuurt artikel-id's, aantallen en een periode naar de server;
**nooit een bedrag**. Elke prijs die je op het scherm zet, komt uit `src/lib/huurprijs.js` (gedeeld
met de server, letterlijk hetzelfde bestand) — toon ze, verander de rekenregel niet. De site heeft
geen Firebase aan boord en importeert niets uit de backoffice; `tests/verhuur-bundel.test.js`
weigert zo'n import. Externe links, Google Fonts, trackers: niet. Alles wat laadt, laadt van de
eigen hosting.

**De inhoud van het aanbod** komt van de server (`GET /api/verhuur/aanbod`): naam, categorie,
omschrijving, dagprijs, weekendprijs, weekprijs, waarborg, foto, of het direct te huren is. Geen
inkoopprijs, geen leverancier, geen marge — die velden bestaan voor de site niet. Een ontwerp dat
"vergelijkbare artikelen" of "vaak samen gehuurd" wil tonen, kan dat alleen met wat er is.

**Een vol artikel verdwijnt niet.** Het blijft staan met "volzet op deze datum", want weglaten laat
de bezoeker denken dat we het niet hebben, terwijl een andere datum vaak kan.

**Korting bestaat alleen voor wie ingelogd is.** Geen kortingscodes, geen "eerste bestelling -10%".

---

## Wat we van het ontwerp vragen

In volgorde van belang:

1. **De catalogus als etalage.** Nu is het een lijst met een datumkiezer. Een eerste scherm dat
   meteen vertrouwen geeft: dit is een echt bedrijf met echt materiaal, zo werkt het (kies je datum →
   kies je spullen → betaal → haal op). Waar staat de periodekiezer zodat een bezoeker hem niet
   overslaat, maar ook niet eerst een datum *moet* kiezen om te kijken?
2. **De kaart en de productpagina.** Foto's zijn er (1600 px, JPEG, uit de backoffice). Hoe toon je
   dagprijs, weekendprijs en waarborg zonder dat het een tarieventabel wordt? Hoe staat "nog 3 vrij
   op jouw datum" erbij zodat het helpt en niet opjaagt?
3. **De mand en het afrekenen.** De som heeft vier regels (ex btw, btw, waarborg, totaal). De
   waarborg is het moeilijkste om uit te leggen: het is geld dat terugkomt. Na "Afrekenen" gaat de
   bezoeker naar een pagina van Stripe in de huisstijl (`#1B3A6B`) en komt daarna terug op `/gelukt`.
4. **De offerteaanvraag** voor wie meer wil dan losse stukken. Dat is vaak het begin van een
   opdracht van duizenden euro's; het formulier mag dat uitstralen zonder langer te worden.
5. **Inloggen en Mijn huren.** Een e-mail-link, geen wachtwoord; het scherm moet uitleggen dat dat
   de bedoeling is. "Mijn huren" is nu een tabel; het mag een overzicht worden waar je het volgende
   weekend al klaarzet.
6. **De telefoon eerst.** De meeste bezoekers komen 's avonds op een telefoon. Alles hierboven in
   390 px breed, met de mand bereikbaar zonder scrollen.

Wat níét gevraagd wordt: een nieuw logo, een nieuwe kleur, een ander lettertype, een "over ons",
een blog. De site is een kassa.

---

## Hoe het terugkomt in de code

- Lever een Claude Design-project met de schermen hierboven, gebouwd op het JE Concept Design
  System (zelfde tokens en componenten; nieuwe componenten als aanvulling op het systeem, met een
  naam, en niet als losse stijl op één scherm).
- Benoem per scherm de **staten**: leeg (geen aanbod, lege mand, geen huren), ladend, fout (server
  antwoordt niet), volzet, ingelogd / niet ingelogd, en de bevestigingen.
- Elke tekst op een scherm is Nederlands (Vlaams, u-vorm vermijden: de site zegt "je"). Prijzen in
  euro met komma, bijvoorbeeld "€ 12,50 per dag".
- Nieuwe stijlregels komen in `verhuur/src/styles/verhuur.css` met het voorvoegsel `vh__`; nieuwe
  tokens of componenten in het systeem zelf (`src/styles/je-ds.css`, `src/components/ds/`), zodat de
  backoffice ze ook krijgt. Tests die daarop letten: `tests/kleur.test.js` (contrast, breekpunten),
  `tests/verhuur-bundel.test.js` (geen backoffice-imports, geen externe links),
  `scripts/verhuur-smoke.mjs` (25 doorlopen incl. telefoonbreedte en tikdoelen).
- De omzetting naar code doet Claude Code in dezelfde repository; dit document is de brug. Wat in het
  design afwijkt van "Wat vastligt", wordt niet overgenomen maar teruggelegd met de reden.

---

## Voorbeeldgegevens in de preview

Zes artikelen (statafel zwart Ø 80, klapstoel wit, koelkast glasdeur 380 l, terrasverwarmer gas,
tapinstallatie 1 kraan, vuurkorf cortenstaal), met prijzen, waarborg en een bezetting zodat
"nog 2 vrij" en "volzet" allebei voorkomen; twee ervan hebben een foto, de rest de plaatshouder. Eén klant met korting (Lies Vandeputte, 10%) om de ingelogde toestand te
zien. Alles nep; niets ervan komt uit de echte database.
