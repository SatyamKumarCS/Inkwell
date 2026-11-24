# Inkwell

Notes, docs, tasks, daily calendar and an AI assistant, for Android and iOS. Built with Expo (React Native) and
Firebase. The product spec is in [`SPEC.md`](SPEC.md); working rules for contributors and agents are in
[`CLAUDE.md`](CLAUDE.md).

## Repository layout

```
apps/mobile        Expo app (Expo Router, routes in src/app)
functions          Cloud Functions (TypeScript, bundled with esbuild)
packages/shared    Firestore model types + zod schemas shared by app, functions and web
tests/rules        Firestore / Storage security rules tests (run inside the emulators)
design             Reference screenshots, grouped by flow (layout reference only)
firestore.rules, storage.rules, firestore.indexes.json, firebase.json
```

## Prerequisites

| Tool           | Version                                                       | Notes                                                  |
| -------------- | ------------------------------------------------------------- | ------------------------------------------------------ |
| Node           | 24 LTS (`.nvmrc`)                                             | `nvm use` — Node 25 is not supported by firebase-tools |
| pnpm           | 10                                                            | `corepack enable`                                      |
| Java           | **17** for Android builds, **21+** for the Firebase emulators | see "Java" below                                       |
| Android Studio | SDK 35+, an emulator image                                    | `ANDROID_HOME` set                                     |
| Xcode          | latest + CocoaPods                                            | iOS only, macOS only                                   |

### Java

Gradle builds use JDK 17 and the Firebase emulators need JDK 21 or newer. On macOS:

```sh
export JAVA_HOME=$(/usr/libexec/java_home -v 17)   # before building Android
export JAVA_HOME=$(/usr/libexec/java_home -v 21+)  # before starting emulators / running rules tests
```

## Setup

```sh
nvm use
pnpm install
cp .env.example apps/mobile/.env
```

No Firebase project is needed for local development: everything runs against the **Firebase Emulator Suite** using
the `demo-inkwell` project id (demo projects can never reach production). The app ships demo Firebase configs in
`apps/mobile/firebase/` for this.

## Run it

```sh
pnpm emulators              # terminal 1 — Auth, Firestore, Storage, Functions; UI at http://localhost:4000
pnpm android                # terminal 2 — builds the dev client and opens it on the Android emulator/device
pnpm ios                    # or: iOS simulator
pnpm mobile                 # later runs: just start Metro for an already-installed dev build
```

This app uses native modules (React Native Firebase, Unistyles), so it needs a **development build** — Expo Go
won't work. The first `pnpm android` / `pnpm ios` takes several minutes.

**On a physical phone:** connect it by USB (Android) or select it in `expo run:ios --device`, keep it on the same
Wi-Fi as your computer, and the app finds the emulators via the Metro host automatically. Override with
`EXPO_PUBLIC_EMULATOR_HOST` in `apps/mobile/.env` if needed. Cloud builds: `npx eas-cli@latest build --profile development`.

## Quality checks

```sh
pnpm typecheck && pnpm lint && pnpm test   # test = unit tests + security rules tests in the emulators
pnpm test:rules                            # rules tests only
pnpm format                                # prettier
```

## Real Firebase project (later)

When a real project exists, download its `google-services.json` / `GoogleService-Info.plist` (git-ignored), point
`GOOGLE_SERVICES_JSON` / `GOOGLE_SERVICES_PLIST` at them, and set `EXPO_PUBLIC_USE_FIREBASE_EMULATORS=false` only
for builds that should talk to it. Server keys go in Functions secrets (`firebase functions:secrets:set`), never in
the app or the repo.
