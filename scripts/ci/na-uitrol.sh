#!/usr/bin/env bash
#
# Na de uitrol: zijn de publieke adressen ook echt publiek?
#
# Een functie die op "Require authentication" staat, geeft voor elk verzoek een
# 403 van Cloud Run, nog voor de code draait. Zo toonde rental.jeconcept.be
# "Het aanbod is nu even niet op te halen" na een groene uitrol: niets in CI
# keek ernaar. Dit kijkt ernaar, van buitenaf, zoals een bezoeker.
#
# Een 403 van Cloud Run is iets anders dan een antwoord van de functie zelf:
# /api/drive zonder token hoort een 401 van de functie te geven. Daarom kijkt
# dit ook naar de tekst van Google ("does not have permission").
#
#   scripts/ci/na-uitrol.sh <project-id>
#
set -uo pipefail

PROJECT="$1"
POGINGEN=6     # Een nieuwe IAM-binding doet er soms een minuut over.
WACHT=15
fout=0

# controleer <url> <methode> <omschrijving> [verwacht]
controleer() {
  local url="$1" methode="$2" wat="$3" verwacht="${4:-}"
  local code body
  for poging in $(seq 1 "$POGINGEN"); do
    body=$(mktemp)
    code=$(curl -sS -o "$body" -w '%{http_code}' -X "$methode" -m 20 "$url" 2>/dev/null || echo 000)
    if [ "$code" = "403" ] || grep -qi 'does not have permission\|Error: Forbidden' "$body"; then
      [ "$poging" -lt "$POGINGEN" ] && { sleep "$WACHT"; continue; }
      echo "::error::$wat: $url geeft $code van Cloud Run (Require authentication). Zet invoker: 'public' op de functie, zie tests/publieke-functies.test.js."
      fout=1; return
    fi
    if [ -n "$verwacht" ] && [ "$code" != "$verwacht" ]; then
      [ "$poging" -lt "$POGINGEN" ] && { sleep "$WACHT"; continue; }
      echo "::warning::$wat: $url geeft $code, verwacht $verwacht. $(head -c 200 "$body" | tr '\n' ' ')"
      return
    fi
    echo "✓ $wat: $code"
    return
  done
}

controleer "https://rental.jeconcept.be/api/verhuur/aanbod" GET "Verhuursite, aanbod" 200
controleer "https://$PROJECT-verhuur.web.app/api/verhuur/aanbod" GET "Verhuursite op web.app, aanbod" 200
controleer "https://planning.jeconcept.be/api/drive/sync" POST "Documenten zonder aanmelding" 401
controleer "https://planning.jeconcept.be/api/portaal/geen-sleutel" GET "Klantenportaal zonder geldige sleutel"

exit "$fout"
