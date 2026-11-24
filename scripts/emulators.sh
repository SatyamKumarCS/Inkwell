#!/usr/bin/env sh
# Starts the Firebase Emulator Suite for local development. Data persists in .emulator-data between runs.
set -e
cd "$(dirname "$0")/.."

# Dev-only secrets for the Functions emulator (OTP pepper etc.). Real values live in Secret Manager.
if [ ! -f functions/.secret.local ]; then
  cp functions/.secret.local.example functions/.secret.local
  echo "Created functions/.secret.local from the example (dev-only values)."
fi

pnpm --filter @inkwell/functions build

IMPORT=""
if [ -f .emulator-data/firebase-export-metadata.json ]; then
  IMPORT="--import ./.emulator-data"
fi

exec firebase emulators:start --project demo-inkwell --export-on-exit ./.emulator-data $IMPORT
