#!/usr/bin/env sh
# Starts the Firebase Emulator Suite for local development. Data persists in .emulator-data between runs.
set -e
cd "$(dirname "$0")/.."

pnpm --filter @inkwell/functions build

IMPORT=""
if [ -f .emulator-data/firebase-export-metadata.json ]; then
  IMPORT="--import ./.emulator-data"
fi

exec firebase emulators:start --project demo-inkwell --export-on-exit ./.emulator-data $IMPORT
