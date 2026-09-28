#!/usr/bin/env bash
#
# Zet JE Planning live op een vers Firebase-project.
#
# De volgorde is niet willekeurig: rules en indexes eerst, want een applicatie
# die deployt voor haar indexes bestaan geeft lege overzichten en fouten die
# eruitzien als bugs. Functions daarna, omdat de Canva-routes erop rekenen. De
# applicatie als laatste, zodat wie hem opent meteen iets werkends ziet.
#
#   ./scripts/go-live.sh <project-id>
#
set -euo pipefail

PROJECT="${1:-}"
if [[ -z "$PROJECT" ]]; then
  echo "Gebruik: ./scripts/go-live.sh <project-id>   (bijvoorbeeld je-planning)" >&2
  exit 1
fi

stap() { printf '\n\033[1;34m→ %s\033[0m\n' "$*"; }
fout() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[[ -f .env.local ]] || fout ".env.local ontbreekt. Kopieer .env.example en vul de zes VITE_FIREBASE_*-waarden in."
grep -q 'VITE_FIREBASE_API_KEY=.\+' .env.local || fout ".env.local is nog niet ingevuld."

stap "Aanmelden bij Firebase"
npx firebase login

stap "Project instellen op $PROJECT"
npx firebase use --add "$PROJECT" 2>/dev/null || npx firebase use "$PROJECT"

stap "Beveiligingsregels, indexes en storage"
npx firebase deploy --only firestore:rules,firestore:indexes,storage \
  || fout "Rules of indexes zijn niet gedeployed. Zonder indexes werkt geen enkel overzicht."

stap "Cloud Functions (toegangscontrole en de Canva-koppeling)"
( cd functions && npm install )
npx firebase deploy --only functions \
  || fout "Functions faalden. Staat het project op Blaze? Spark laat geen functions toe."

stap "Basisgegevens (merken, toegangsdomeinen, de borden)"
if [[ -f service-account.json ]]; then
  GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/seed.mjs
else
  echo "  service-account.json ontbreekt — overgeslagen."
  echo "  Haal er een op via Project settings → Service accounts → Generate new private key,"
  echo "  en draai daarna: GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/seed.mjs"
fi

stap "De applicatie bouwen en publiceren"
npm run build
npx firebase deploy --only hosting

printf '\n\033[1;32m✓ Live.\033[0m Open https://%s.web.app en meld je aan met Google.\n' "$PROJECT"
echo "  De eerste die inlogt wordt eigenaar van de werkruimte — doe dat zelf."
echo "  Koppel daarna planning.jeconcept.be via Hosting → Add custom domain (stap 9 van de handover)."
