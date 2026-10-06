# Messaging: hoe een site een aanvraag aan JE Plan geeft

Eén adres voor elke site van JE Concept. Wat hier binnenkomt, staat in Instellingen → Messaging en wordt een kaart in de kolom *request*. Zie de README (*Messaging*) voor waarom het zo gebouwd is.

## Adres en toegang

```
POST https://planning.jeconcept.be/api/messaging
Authorization: Bearer <token van deze site>
Content-Type: application/json            (ook application/x-www-form-urlencoded mag)
```

Kan een formulier-plugin geen `Authorization` zetten, dan mag `X-Messaging-Token: <token>`. **Nooit** de token in de URL of in code die in de browser draait: dan is ze publiek. Een site stuurt vanaf haar server (een serverfunctie, een webhook van het formulier), nooit vanuit de browser van de bezoeker.

De token bepaalt de bron. Elke site heeft er haar eigen; ze staan samen in het geheim `MESSAGING_TOKENS` (zie handover, stap A7).

| Bron | Site |
|---|---|
| `wintermoods` | wintermoods.jeconcept.be |
| `feestbeest` | feest-beest.be |
| `jeconcept` | jeconcept.be |
| `jebookings` | de boekingsapp (Base44) |
| `barvue` | barvue.be |
| `meer` | de site van Meer — Het Vinne |
| `kenjeklanten` | kenjeklanten.be |

`verhuur` bestaat ook, maar schrijft rechtstreeks in de log; ze heeft geen token.

**Platformen.** De boekingsapp (`jebookings`) host meer dan één site. Haar token mag in `bron` zeggen voor welke site het bericht is, maar alleen voor de bronnen in `SPREEKT_VOOR` (in `functions-messaging/envelop.js`): barvue, meer, kenjeklanten, feestbeest en jeconcept. Cue staat los van JE Plan en heeft geen token. De log noteert dan `via` met het platform. Elke andere waarde van `bron` wordt genegeerd: de token beslist.

## Twee vormen

**1. De envelop** — voor een site waar we zelf code op draaien:

```json
{
  "soort": "offerte.aangevraagd",
  "sleutel": "0f1c2a…",
  "tijdstip": "2026-10-06T18:22:00Z",
  "taal": "nl",
  "inhoud": { "naam": "An Peeters", "email": "an@example.be", "datum": "2026-11-07", "personen": 35, "bericht": "…" }
}
```

- `soort`: `reservatie.aangevraagd` (een concrete datum en een aantal) of `offerte.aangevraagd` (een vraag om een voorstel). Beide worden een kaart.
- `sleutel`: een eigen kenmerk per inzending, bijvoorbeeld een UUID. Dezelfde sleutel twee keer geeft één rij en één kaart.
- `inhoud`: de velden van het formulier.

**2. Een plat formulier** — voor een webhook van WordPress, Wix of een andere bouwer: stuur gewoon de velden. Zonder `inhoud` wordt al de rest de inhoud, zonder `soort` geldt `offerte.aangevraagd`, en zonder `sleutel` maakt JE Plan er een uit de inhoud zelf.

```
naam=An Peeters&email=an@example.be&datum=07/11/2026&aantal personen=35&bericht=Verjaardag
```

## Welke veldnamen JE Plan herkent

Hoofdletters, spaties en underscores tellen niet. Wat niet in deze lijst staat, gaat niet verloren: het komt als regel `Veld: waarde` in de omschrijving van de kaart.

| Plek op de kaart | Herkende namen |
|---|---|
| naam | naam, name, your-name, volledige naam, contactpersoon, nom — of voornaam + achternaam (first name, last name, prénom, nom de famille) |
| e-mail | email, e-mail, mail, your-email, e-mailadres, courriel |
| telefoon | telefoon, phone, tel, gsm, your-phone, téléphone |
| datum | datum, date, gewenste datum, datum event — als `2026-11-07`, `7/11/2026` of `07.11.2026` |
| personen | personen, aantal personen, aantal, pax, guests, gasten, aantal kinderen, personnes |
| bericht | bericht, message, your-message, opmerking, vraag |
| moment | moment, tijdstip, uur, time |
| formule | formule, formula, pakket, package |
| gelegenheid | gelegenheid, occasion, type, soort feest, type event |
| dieet | dieet, diet, allergieën |
| locatie | locatie, location, adres, plaats |

## Antwoorden

| Status | Betekenis | Wat de site doet |
|---|---|---|
| `200 {"ok":true,"berichtId":"…","herhaald":false}` | Aangekomen | Niets |
| `200 {"ok":true,…,"herhaald":true}` | Kwam al eerder binnen | Niets |
| `400 {"fout":"geen_inhoud" \| "geen_soort" \| "geen_sleutel" \| "te_groot"}` | Het bericht klopt niet | Loggen; de mail aan het team is al weg |
| `401` | Verkeerde of geen token | Loggen |

**Een site laat haar bezoeker nooit wachten op JE Plan.** De bevestigingsmail vertrekt eerst; daarna wordt het bericht gestuurd met een korte time-out (4 seconden), en een fout wordt gelogd, niet aan de bezoeker getoond. Een storing bij JE Plan mag nooit een boeking kosten.

## Proberen

```
curl -sS -X POST https://planning.jeconcept.be/api/messaging \
  -H "authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d '{"soort":"offerte.aangevraagd","sleutel":"proef-1","inhoud":{"naam":"Proef","email":"proef@example.be","personen":10}}'
```

Verwacht: `{"ok":true,"berichtId":"<bron>-proef-1","herhaald":false}`, een rij onder Instellingen → Messaging, en een kaart "<Merk> — Proef (10p)" in de kolom *request*. Een tweede keer: `herhaald: true` en geen tweede kaart.
