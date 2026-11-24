# CLAUDE.md

Project: "Inkwell" — notes, docs, tasks and AI assistant mobile app. Full spec: `SPEC.md`.

## Rules
- Follow `SPEC.md`. Work one phase at a time; plan first, then build, then summarize.
- TypeScript strict everywhere. No `any` unless commented with a reason.
- Shared Firestore types and zod schemas live in `packages/shared` — never redefine them elsewhere.
- Develop against the Firebase Emulator Suite. Never point local dev at production.
- No secrets in code or commits. Use `.env` + `.env.example`, and Functions secrets for server keys.
- All AI/model calls go through Cloud Functions. Never call an AI provider from the app.
- Every screen handles loading, empty, error and offline states, and supports dark mode.
- Use design tokens from `src/theme` — no hard-coded colors or font sizes in components.
- Use reference screenshots in `./design/` for layout and flow only; don't copy the reference app's
  name, logo, icons or brand colors.
- Before finishing any task run: `pnpm typecheck && pnpm lint && pnpm test` and fix failures.
- Any change to Firestore access must come with updated `firestore.rules` and rules tests.
- Check current official docs before using Expo, React Native Firebase, Firebase or Genkit APIs.
- If unsure, ask instead of guessing.

## Commands
Use Node 24 (`nvm use`). JDK 17 for Android builds; JDK 21+ for the Firebase emulators (see README).

- Install: `pnpm install`
- Emulators: `pnpm emulators` (UI at http://localhost:4000, project `demo-inkwell`)
- Run Android / iOS dev build: `pnpm android` / `pnpm ios`; Metro only: `pnpm mobile`
- Checks: `pnpm typecheck && pnpm lint && pnpm test` (`test` includes rules tests via `firebase emulators:exec`)
- Rules tests only: `pnpm test:rules`
- Add a mobile dependency: `cd apps/mobile && npx expo install <pkg>`
- Build functions: `pnpm --filter @inkwell/functions build`; deploy (real project only): `npx firebase deploy --only functions`

## Phase 0 decisions
- Routes live in `apps/mobile/src/app` (Expo SDK 58 default) instead of `apps/mobile/app`.
- Styling: Unistyles 3 (theme tokens as typed objects, adaptive light/dark without re-renders).
- Non-RN packages (shared, rules tests) use Vitest; the mobile app uses Jest + RNTL as specified.
