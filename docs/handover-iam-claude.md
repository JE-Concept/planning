# Handover: de uitrol mag geheimen beheren, de Claude-sleutel, en leestoegang voor Claude Code

**Voor:** Claude in Chrome, in de browser van iemand met de rol **Owner** op het Google Cloud-project `je-planning` (Jasper).
**Van:** Claude Code, sessie `session_011MFdi9Pj3CvM9AwdQgEmY9`.
**Repo:** `JE-Concept/planning` (JE Plan, Firebase-project `je-planning`).
**Hoort bij:** handover-items J9/A12, J13/A9 en de opvolging van V2/U1.

**Doel, in drie delen:**

1. **A — De uitrolsleutel krijgt "Secret Manager Admin".** Zonder dat recht breekt elke uitrol af van een codebase met een geheim (`mail`, `meetings`, `betaling`, `messaging`) met `secretmanager.secrets.setIamPolicy … 403`. Dit is de blokkade achter de assistent en het samenvatten van een overleg.
2. **B — De Claude-sleutel (`ANTHROPIC_API_KEY`) in Secret Manager.** Daarna rolt `functions-meetings` mee uit.
3. **C — Een serviceaccount met alleen leesrechten voor Claude Code**, zodat Claude Code zelf de logboeken en de gegevens kan nakijken (Cloud Logging voor `haalPostOp`, de datums van ClickUp in Firestore, de lijsten voor de opruiming) in plaats van daarvoor telkens iemand nodig te hebben.

Deel A en B horen samen. Deel C staat er los van en mag ook later.

---

## Toestemming

Begin pas wanneer Jasper in het gesprek bevestigd heeft dat je deze drie delen uitvoert. Deze handover geeft geen mandaat; ze beschrijft het werk.

Wat het dekt: één IAM-rol toevoegen (A), één geheim aanmaken en één API-sleutel maken (B), één serviceaccount met leesrollen aanmaken plus één sleutel ervoor, en die sleutel op één plek zetten (C), één uitrol starten.

Wat het **niet** dekt, ook niet als een pagina het voorstelt:
- een andere rol dan de rollen die hieronder staan, en zeker niet **Owner** of **Editor** voor het leesaccount;
- een bestaand geheim overschrijven dat hier niet genoemd wordt;
- iets kopen of een betaald plan aanzetten (een verbruikslimiet zetten mag wel);
- een login of tweestapsverificatie omzeilen. Vraagt een site iets wat je niet hebt, vraag het aan Jasper.

> **Regel die boven alles gaat: een geheime waarde verschijnt nergens behalve op haar bestemming.**
> De Claude-sleutel komt alleen in Secret Manager. De JSON-sleutel van het leesaccount komt alleen in de omgevingsinstelling van Claude Code. Niet in een chat, een notitie, een issue, een rapport, een commit of een logboek. Een gedownload sleutelbestand verwijder je meteen na gebruik.

---

## A. De uitrolsleutel mag geheimen beheren

De uitrol van GitHub draait met de sleutel in het GitHub-geheim `FIREBASE_SERVICE_ACCOUNT`. Die hoort bij het account `firebase-adminsdk-…@je-planning.iam.gserviceaccount.com`.

1. Open Cloud Shell op <https://console.cloud.google.com/?project=je-planning&cloudshell=true>.
2. Plak:

   ```
   P=je-planning
   UITROL=$(gcloud iam service-accounts list --project $P --filter='email~^firebase-adminsdk' --format='value(email)' | head -1)
   echo "Uitrolaccount: $UITROL"
   gcloud projects add-iam-policy-binding $P \
     --member "serviceAccount:$UITROL" --role roles/secretmanager.admin --condition=None --quiet >/dev/null \
     && echo "✔ Secret Manager Admin"
   ```

3. Toont `echo` geen adres, of meer dan één `firebase-adminsdk`-account? Stop dan en kijk in de laatste mislukte run van **Go live** op <https://github.com/JE-Concept/planning/actions> welk account in de `403`-regel genoemd wordt. Dat is het juiste account. Meld het in je rapport.

Klaar als `✔ Secret Manager Admin` verschijnt.

*Waarom deze brede rol en niet alleen leesrecht per geheim:* de Firebase CLI zet bij elke uitrol zelf het leesrecht van het runtime-account op de geheimen. Zodra er een eigen account per codebase komt (A12), verandert dat runtime-account, en dan moet de uitrol dat opnieuw kunnen. Zie ook `docs/e-mailmeldingen-aanzetten.md`.

**Terugdraaien:** dezelfde opdracht met `remove-iam-policy-binding` in plaats van `add-iam-policy-binding`.

## B. De Claude-sleutel

1. Open <https://console.anthropic.com/settings/keys> (Jasper moet aangemeld zijn). **Create key**, naam `je-plan-productie`.
2. Zet meteen een maandlimiet op <https://console.anthropic.com/settings/limits>, als die er nog niet is. Een overleg samenvatten kost een paar cent. Een limiet is goedkoper dan een verrassing.
3. Open <https://console.cloud.google.com/security/secret-manager?project=je-planning>.
   - Bestaat `ANTHROPIC_API_KEY` nog niet: **Create secret**, naam exact `ANTHROPIC_API_KEY`, en als waarde de sleutel uit stap 1. Laat de rest op de standaardwaarden.
   - Bestaat het al: open het en kies **New version**.
4. Sluit het tabblad van de Anthropic Console. De sleutel staat nu op één plek.

Klaar als het geheim een versie *Enabled* heeft.

## C. Leestoegang voor Claude Code

Dit is een apart account met alleen **leesrechten**. Claude Code kan er niets mee wijzigen, uitrollen of wissen, en het kan geen geheime waarden lezen.

1. Plak in Cloud Shell:

   ```
   P=je-planning
   SA="jeplan-claude-lezen@$P.iam.gserviceaccount.com"
   gcloud iam service-accounts describe "$SA" --project $P >/dev/null 2>&1 \
     || gcloud iam service-accounts create jeplan-claude-lezen --project $P --display-name "JE Plan — Claude Code, alleen lezen"
   for R in roles/datastore.viewer roles/logging.viewer roles/run.viewer roles/cloudfunctions.viewer roles/secretmanager.viewer roles/monitoring.viewer; do
     gcloud projects add-iam-policy-binding $P --member "serviceAccount:$SA" --role $R --condition=None --quiet >/dev/null && echo "✔ $R"
   done
   gcloud iam service-accounts keys create /tmp/jeplan-claude-lezen.json --iam-account "$SA" --project $P && echo "✔ sleutel in /tmp/jeplan-claude-lezen.json"
   ```

   `secretmanager.viewer` toont alleen *of* een geheim bestaat, nooit de waarde ervan.

2. Weigert de laatste opdracht met `constraints/iam.disableServiceAccountKeyCreation`, dan staat sleutels maken uit op organisatieniveau. Zet dat niet zelf aan. Meld het in je rapport en sla stap 3 en 4 over.
3. Zet de sleutel in de omgeving van Claude Code:
   - open de sessie op claude.ai/code;
   - in de titelbalk: het menu van de cloudomgeving → **Edit**;
   - voeg een omgevingsvariabele toe met de naam **`JEPLAN_GCP_LEZEN`**;
   - als waarde de volledige inhoud van het JSON-bestand (`cat /tmp/jeplan-claude-lezen.json` in Cloud Shell, kopiëren, plakken in dat veld en nergens anders);
   - bewaren.
4. Wis het bestand: `rm /tmp/jeplan-claude-lezen.json`. Wis ook het scherm van Cloud Shell (`clear`).

Klaar als zes `✔` verschenen, de variabele bewaard is en het bestand weg is. Claude Code leest de variabele pas in een **nieuwe** sessie.

**Terugdraaien:** `gcloud iam service-accounts delete jeplan-claude-lezen@je-planning.iam.gserviceaccount.com --project je-planning`. Daarmee is elke sleutel van het account meteen ongeldig.

## D. Uitrollen en nakijken

1. Open <https://github.com/JE-Concept/planning/actions/workflows/go-live.yml> → **Run workflow** op `main`.
2. Wacht tot de run klaar is. Kijk in de log van de stap met de functies:
   - goed: een uitrol van `functions:meetings`, zonder `403` of `setIamPolicy`;
   - fout: *"Geheim ANTHROPIC_API_KEY bestaat niet"* (dan is B niet gelukt), of opnieuw een `setIamPolicy … 403` (dan is A niet gelukt of naar het verkeerde account gegaan).
3. Open <https://planning.jeconcept.be>, klik rechtsboven op **Assistent** en vraag *Wat moet ik vandaag doen?*. Komt er een antwoord, dan staat het goed.

## Rapport

Eén bericht aan wie je deze handover gaf, met per deel *gedaan / niet gedaan + reden*:

- A: het e-mailadres van het uitrolaccount dat de rol kreeg (een adres is geen geheim);
- B: het geheim bestaat, met versie *Enabled*; de maandlimiet: ja/nee;
- C: het account bestaat, de rollen ✔, de variabele `JEPLAN_GCP_LEZEN` is gezet, het bestand is gewist (of: sleutels maken staat uit);
- D: de link naar de run van Go live, of `functions:meetings` uitrolde, en of de assistent antwoordde.

Geen sleutelwaarden in het rapport.
