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

log=$(mktemp)
npx --yes firebase-tools@13 deploy --project "$PROJECT" --non-interactive "$@" 2>&1 | tee "$log"
status=${PIPESTATUS[0]}
[ "$status" -eq 0 ] && exit 0

if grep -q 'serviceusage.googleapis.com.*403\|Permission denied to get service' "$log"; then
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
elif grep -qi 'billing account\|Spark' "$log"; then
  echo '::error::Het project staat nog op het gratis Spark-plan. Zet Blaze aan (stap 2 van de handover) en draai opnieuw.' >&2
fi

exit "$status"
