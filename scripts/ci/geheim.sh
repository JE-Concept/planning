#!/usr/bin/env bash
#
# Moet de codebase die aan dit geheim hangt uitgerold worden?
#
#   scripts/ci/geheim.sh SMTP_URL je-planning && ... uitrollen ...
#
# ── Waarom dit een eigen script is ──────────────────────────────────────────
# Hier stond `gcloud secrets describe X >/dev/null 2>&1`, en dat is fout op een
# manier die niemand ziet: dat commando faalt óók wanneer het geheim gewoon
# bestaat maar het serviceaccount er niet in mag kijken. Secret Manager-lezen
# zit niet in de rechten die een Firebase-beheersleutel standaard krijgt — dat
# account mag elders in deze uitrol al geen IAM-rollen uitdelen, om dezelfde
# reden.
#
# Het gevolg was stil en vervelend: de mailverzender werd overgeslagen met de
# melding "geheim bestaat niet", terwijl het geheim er al weken stond. Er werd
# niet gemaild, en de log beweerde dat dat de bedoeling was.
#
# Dus: alleen overslaan wanneer we zéker weten dat het geheim er niet is. Mogen
# we niet kijken, dan rollen we uit en laat de uitrol zelf maar zeggen of het
# geheim er is — die mag er wél bij, want dat is waarvoor hij hem nodig heeft.
set -uo pipefail

naam="$1"
project="$2"

uit=$(gcloud secrets describe "$naam" --project "$project" 2>&1)
code=$?

if [ $code -eq 0 ]; then
  echo "Geheim $naam bestaat." >&2
  exit 0
fi

# NOT_FOUND is het enige antwoord dat echt "er is niets" betekent.
if printf '%s' "$uit" | grep -qiE 'NOT_FOUND|was not found|does not exist'; then
  echo "Geheim $naam bestaat niet." >&2
  exit 1
fi

echo "::notice::Kon niet nakijken of $naam bestaat (${uit%%$'\n'*}). We rollen uit; de uitrol zegt zelf of het geheim er is." >&2
exit 0
