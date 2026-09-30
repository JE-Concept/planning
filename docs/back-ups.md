# Back-ups van de gegevens

De planning, de klanten, de offertes en de afvinklijsten staan in Firestore. Er is
vandaag **geen back-up ingesteld**. Dat is het grootste openstaande risico van deze
tool, en het is in een half uur op te lossen.

Wat er nu al wél is: de gegevens staan bij Google, dus een kapotte schijf is niet het
probleem. Het probleem is een fout van ons — een script dat te veel wist, een regel die
te ruim staat, iemand die een lijst verwijdert. Daar helpt redundantie niet tegen, alleen
een kopie van gisteren.

## Twee dingen, en ze doen iets anders

**Point-in-time recovery (PITR)** laat je de database terugzetten naar elk moment in de
afgelopen zeven dagen, tot op de minuut. Dat is wat je wil bij "iemand heeft om kwart
over drie iets gedaan wat niet kon". Aanzetten is één commando en het kost een fractie
van de opslagprijs.

```bash
gcloud firestore databases update --database='(default)' \
  --enable-pitr --project <PROJECT-ID>
```


**Geplande exports** zetten een volledige kopie in Cloud Storage. Die blijft zolang je
wil — dus ook langer dan zeven dagen — en je kunt hem in een ander project terugzetten om
iets te bekijken zonder de echte database aan te raken. Dat is wat je wil bij "hoe zag de
prijslijst er in maart uit".

```bash
# Eén keer: een bak om ze in te zetten, in dezelfde regio als de database.
gcloud storage buckets create gs://<PROJECT-ID>-backups --location=europe-west1

# En dan wekelijks, via Cloud Scheduler:
gcloud scheduler jobs create http firestore-export \
  --schedule="0 3 * * 0" --time-zone="Europe/Brussels" \
  --uri="https://firestore.googleapis.com/v1/projects/<PROJECT-ID>/databases/(default):exportDocuments" \
  --oauth-service-account-email=<SERVICE-ACCOUNT> \
  --message-body='{"outputUriPrefix":"gs://<PROJECT-ID>-backups"}' \
  --location=europe-west1
```

Het serviceaccount heeft daarvoor de rol **Cloud Datastore Import Export Admin** nodig,
en schrijfrecht op de bak.

## Wat ik zou doen

Allebei, in deze volgorde: eerst PITR (één commando, meteen bescherming tegen de fout van
vandaag), dan de wekelijkse export (voor de vraag van over een half jaar). Zet op de bak
een levensduurregel van bijvoorbeeld een jaar, anders groeit die stil door.

## Terugzetten

Hoop dat je dit nooit nodig hebt, en lees het één keer voor het zover is.

- **Met PITR**: `gcloud firestore databases restore` maakt een *nieuwe* database met de
  toestand van dat moment. Je zet niet terug over de bestaande heen — je krijgt een
  tweede, en dan kopieer je eruit wat je nodig hebt. Dat is expres zo: terugzetten over
  een draaiende tool heen maakt van één fout er twee.
- **Met een export**: `gcloud firestore import gs://...` kan wel over de bestaande heen.
  Doe dat alleen wanneer je zeker weet dat je alles wil, en zeg het team dat ze even
  niets doen — wat ze tijdens het importeren schrijven, is weg.

## Wat er níét in een back-up zit

De bestanden in Cloud Storage (bijlagen bij taken en klanten) staan apart. Die hebben hun
eigen versioning nodig:

```bash
gcloud storage buckets update gs://<PROJECT-ID>.appspot.com --versioning
```
