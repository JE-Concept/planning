#!/usr/bin/env bash
#
# firebase deploy, met een fout die zegt wat je moet doen.
#
# De Firebase CLI controleert voor elke deploy of de bijbehorende Google-API
# aanstaat, en dat vraagt een recht dat de standaard Firebase-servicesleutel
# niet heeft. Het resultaat is een kale 403 op serviceusage.googleapis.com die
# nergens vermeldt dat het om een IAM-rol gaat. Deze wrapper vangt dat op en
# noemt de rol.
#
#   scripts/ci/deploy.sh <project-id> <--only ...>
#
set -uo pipefail

PROJECT="$1"; shift

POGINGEN=3
WACHT=90

log=$(mktemp)

# Wat er deze ronde uitgerold wordt. Begint als wat de workflow vroeg; na een
# image-race alleen nog de functies die faalden (zie hieronder).
ARGS=("$@")

for poging in $(seq 1 "$POGINGEN"); do
  npx --yes firebase-tools@15 deploy --project "$PROJECT" --non-interactive "${ARGS[@]}" 2>&1 | tee "$log"
  status=${PIPESTATUS[0]}
  [ "$status" -eq 0 ] && exit 0

  # De eerste Firestore-trigger in een project loopt vast op Eventarc: de
  # service agent bestaat wel, maar zijn rechten zijn nog niet doorgesijpeld.
  # Google zegt het zelf in de fout — "retry the deployment in a few minutes" —
  # en dat is precies wat hier gebeurt, in plaats van een rode build die alleen
  # betekent dat iemand op een knop moet drukken.
  if grep -qi 'Eventarc Service Agent\|first time using 2nd gen' "$log" \
     && [ "$poging" -lt "$POGINGEN" ]; then
    echo "::warning::Eventarc is nog niet klaar met zichzelf (poging $poging van $POGINGEN). Over ${WACHT}s opnieuw." >&2
    sleep "$WACHT"
    continue
  fi

  # Sinds firebase-tools 15 bouwt de CLI één image per codebase en hangen alle
  # functies eraan (het heet naar de eerste functie: …__aapi_koppel:version_1).
  # Cloud Run begint soms aan een functie voor dat image er staat ("Image … not
  # found", "Container import failed"); die functies houden hun vorige versie,
  # de rest is bijgewerkt. Zo faalden in CI #129 spreadCustomerRename,
  # spreadListRename, verhuurAanvraagBinnen en verhuurOrderBetaald.
  #
  # De volgende ronde rolt alleen díe functies opnieuw uit, als
  # functions:<codebase>:<naam>. Dat is sneller, raakt de rest niet opnieuw aan,
  # en geeft ze een eigen build in plaats van een verwijzing naar hetzelfde
  # ontbrekende image. Een echte fout in de code geeft een andere melding en
  # valt hier niet onder.
  if grep -qi "Container import failed\|Image '[^']*' not found" "$log" \
     && [ "$poging" -lt "$POGINGEN" ]; then
    codebase=$(printf '%s\n' "${ARGS[@]}" | grep -o 'functions:[a-z0-9-]*' | head -1 | cut -d: -f2)
    mislukt=$(sed -n '/Functions deploy had errors with the following functions:/,/^[^[:space:]]/p' "$log" \
      | grep -oE '^[[:space:]]+([a-z]+:)?[A-Za-z0-9_-]+\(' | tr -d ' \t(' | sed 's/^[a-z]*://' | sort -u)
    if [ -n "$codebase" ] && [ -n "$mislukt" ]; then
      ARGS=(--only "$(printf "functions:$codebase:%s," $mislukt | sed 's/,$//')")
      echo "::warning::Image-race bij $(echo $mislukt | wc -w) functie(s): $(echo $mislukt | tr '\n' ' ')— alleen die opnieuw (poging $((poging + 1)) van $POGINGEN), over 60s." >&2
    else
      echo "::warning::Cloud Run vond het nieuwe image nog niet (poging $poging van $POGINGEN). Over 60s alles opnieuw." >&2
    fi
    sleep 60
    continue
  fi

  # De CLI zet na een geslaagde uitrol een opruimregel op de oude images, en
  # zonder --force (dat we niet geven: het laat de CLI ook functies wissen)
  # maakt ze er een rode build van terwijl alles live staat. De workflow zet
  # die regel vooraf zelf; lukt dat niet, dan is dit een waarschuwing en
  # geen mislukte uitrol.
  if grep -qi 'Functions successfully deployed but could not set up cleanup policy' "$log" \
     && ! grep -qi 'Functions deploy had errors' "$log"; then
    echo "::warning::Functies staan live, maar de opruimregel voor oude images ontbreekt. Zie functions:artifacts:setpolicy." >&2
    exit 0
  fi

  break
done

# Een codebase die aan geheimen hangt (functions-mail, functions-meetings)
# wordt door de CLI voorafgegaan door "ensuring … access to secret …": ze zet
# zelf de leesrechten voor het runtime-account. Mag de uitrolsleutel dat niet,
# dan breekt ze af vóór er één functie geüpload is — en dan staat er niets van
# die codebase live terwijl het geheim gewoon bestaat. Dat is precies hoe de
# mailverzender maanden niet gedraaid heeft.
if grep -qi 'secretmanager.secrets.setIamPolicy\|access to secret' "$log" && grep -qi '403\|denied' "$log"; then
  cat <<MSG >&2
::error::Het geheim bestaat, maar de uitrolsleutel mag er geen leesrecht op uitdelen.
::error::De Firebase CLI probeert het runtime-account toegang te geven tot de
::error::geheimen van deze codebase, en dat vraagt secretmanager.secrets.setIamPolicy.
::error::Geef de servicesleutel de rol "Secret Manager Admin":
::error::
::error::  gcloud projects add-iam-policy-binding $PROJECT \\
::error::    --member serviceAccount:<firebase-adminsdk-…@$PROJECT.iam.gserviceaccount.com> \\
::error::    --role roles/secretmanager.admin
::error::
::error::Of, enger: geef het runtime-account zelf alvast leesrecht op elk geheim,
::error::dan is de stap hierboven een formaliteit:
::error::
::error::  gcloud secrets add-iam-policy-binding SMTP_URL --project $PROJECT \\
::error::    --member serviceAccount:<nummer>-compute@developer.gserviceaccount.com \\
::error::    --role roles/secretmanager.secretAccessor
MSG
elif grep -q 'serviceusage.googleapis.com.*403\|Permission denied to get service' "$log"; then
  cat <<'MSG' >&2
::error::De servicesleutel mag de Google-API's van dit project niet uitlezen.
::error::Ga naar Google Cloud → IAM, zoek de service account uit de sleutel
::error::(firebase-adminsdk-…@<project>.iam.gserviceaccount.com) en geef hem
::error::de rol "Service Usage Admin". Voor de Cloud Functions zijn daarnaast
::error::"Cloud Functions Admin", "Cloud Run Admin", "Artifact Registry
::error::Administrator", "Cloud Build Editor", "Service Account User",
::error::"Cloud Scheduler Admin", "Eventarc Admin" en "Secret Manager Admin"
::error::nodig — of in één keer "Editor" naast "Firebase Admin".
MSG
elif grep -qi 'Eventarc Service Agent' "$log"; then
  echo "::error::Eventarc weigert de trigger nog steeds na $POGINGEN pogingen." >&2
  echo '::error::Kijk in Google Cloud → IAM (met "Door Google verstrekte roltoewijzingen opnemen" aan)' >&2
  echo '::error::of service-…@gcp-sa-eventarc.iam.gserviceaccount.com de rol "Eventarc Service Agent" heeft.' >&2
elif grep -qi 'cloudbilling.googleapis.com' "$log"; then
  echo '::error::De Cloud Billing API staat niet aan in dit project. Zet hem aan op' >&2
  echo "::error::https://console.cloud.google.com/apis/library/cloudbilling.googleapis.com?project=$PROJECT en draai opnieuw." >&2
elif grep -qi 'billing account\|Spark plan\|requires Blaze' "$log"; then
  echo '::error::Het project staat nog op het gratis Spark-plan. Zet Blaze aan (stap 2 van de handover) en draai opnieuw.' >&2
fi

exit "$status"
