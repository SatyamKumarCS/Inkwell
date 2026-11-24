# Product Spec — "Inkwell" (working name)

A mobile app for notes, docs, tasks and a daily calendar, with a built-in AI assistant.
Think of it as a Craft-style workspace: block-based documents, task lists, daily notes,
shared spaces, publishing docs to the web, and an AI assistant that knows the user's content.

> **Rename "Inkwell"** everywhere once a final name is chosen (app.json, bundle IDs, UI strings).

---

## 0. How to work on this project (read first)

- Build in the **phases** listed in section 10. Finish one phase completely before starting the next.
- At the start of each phase: write a short plan (files to create, packages to add, open questions), then build.
- At the end of each phase: run the type checker, linter and tests, fix all errors, then give me a summary
  of what was built, what's left, and how to test it on my phone. Commit with a clear message.
- If something in this spec is ambiguous or a library doesn't work as expected, **stop and ask** rather
  than guessing or silently switching approach.
- Check the **current official docs** for Expo, React Native Firebase, Firebase and Genkit before using an
  API — versions and APIs change. Use the latest stable versions at the time you start.
- Never commit secrets. Put config in `.env` (git-ignored) and keep an up-to-date `.env.example`.

### Design reference
- Screenshots of the reference app's screens are in `./design/` (grouped by flow, e.g. `design/onboarding/`,
  `design/editing-a-document/`). Look at the relevant folder before building each screen.
- Online reference (97 screens, 25 flows): https://motvin.com/inspirations/app/craft
- Match the **layout, flow and interaction patterns**, but **do not copy** the reference app's name, logo,
  icons, illustrations or exact brand colors. Create our own design system (section 4).

---

## 1. Tech stack

| Area | Choice |
|---|---|
| App | React Native + **Expo** (latest stable SDK), **TypeScript strict**, **Expo Router** (file-based routing) |
| Build | **Expo dev build** (not Expo Go — native Firebase modules need it), EAS Build |
| Backend | **Firebase**: Auth, Cloud Firestore, Cloud Storage, Cloud Functions (2nd gen, Node/TypeScript), Cloud Messaging, Remote Config, Crashlytics, Analytics, App Hosting |
| Firebase SDK in app | **@react-native-firebase/** packages (native SDK — needed for reliable offline persistence) |
| Editor | **Tiptap** running inside a WebView via **10tap-editor** (`@10play/tentap-editor`), with Tiptap's UniqueID extension so every block has a stable ID |
| AI | **Genkit** inside Cloud Functions; provider plugins for Anthropic, OpenAI and Google models; Firestore **vector search** for retrieval over the user's docs |
| State | **Zustand** (UI/local state); Firestore realtime listeners for server data (wrapped in typed hooks) |
| UI | **Unistyles** or **NativeWind** (pick one, justify it in the Phase 0 plan), **Reanimated**, **Gesture Handler**, **@gorhom/bottom-sheet**, **expo-haptics**, **expo-image** |
| Device | expo-notifications, expo-calendar, expo-image-picker, expo-secure-store, expo-localization |
| Published docs website | **Next.js** (App Router) deployed on Firebase App Hosting |
| Search | Typesense or Algolia via its Firebase extension (Phase 6) |
| Payments | RevenueCat (Phase 7) |
| Quality | ESLint + Prettier, Jest + React Native Testing Library, `@firebase/rules-unit-testing` for security rules, **Firebase Emulator Suite** for all local development |

---

## 2. Repository structure

Use a pnpm workspace monorepo:

```
/apps/mobile          Expo app
  /app                Expo Router routes
  /src/components     shared UI components
  /src/features       feature folders: auth, docs, editor, tasks, calendar, ai, spaces, settings
  /src/lib            firebase setup, hooks, utils
  /src/theme          design tokens
/apps/web             Next.js site for published docs
/functions            Cloud Functions (TypeScript): auth OTP, AI, notifications, triggers
/packages/shared      shared TypeScript types (Firestore models), zod schemas, constants
/firestore.rules
/firestore.indexes.json
/storage.rules
/firebase.json        includes emulator config
/design               reference screenshots (read-only)
```

---

## 3. Firestore data model

All documents include `createdAt` and `updatedAt` (server timestamps). Define every model as a TypeScript
type + zod schema in `/packages/shared` and use them in app, functions and web.

```
users/{uid}
  displayName, email, photoURL, defaultSpaceId, settings {theme, startOfWeek, ...}, fcmTokens[]

users/{uid}/stars/{docId}            starredAt
users/{uid}/recents/{docId}          openedAt
users/{uid}/aiChats/{chatId}         title, model, docId?
users/{uid}/aiChats/{chatId}/messages/{msgId}   role, content, createdAt

spaces/{spaceId}
  name, icon, ownerId, memberIds[], roles {uid: "owner"|"editor"|"viewer"}

docs/{docId}
  spaceId, title, icon, cover?, folderId?, ownerId,
  sharedWith[] (uids), linkSharing: "off"|"view"|"edit",
  published: bool, publicSlug?, isDailyNote: bool, dailyDate? ("YYYY-MM-DD"),
  deleted: bool (soft delete / trash)

docs/{docId}/blocks/{blockId}
  type ("paragraph"|"heading"|"todo"|"bullet"|"numbered"|"quote"|"code"|"image"|"divider"|"toggle"|"page-link"),
  content (Tiptap JSON for this node), order (fractional index string), parentId?, updatedBy

docs/{docId}/chunks/{chunkId}        text, embedding (vector)   ← written by a function, for AI search

folders/{folderId}                   spaceId, name, parentId?, order

taskLists/{listId}                   spaceId, name, icon, order
tasks/{taskId}
  spaceId, listId?, title, notes?, done, doneAt?, dueDate?, scheduledDate?, reminderAt?,
  docId?, blockId? (when the task lives inside a doc), order

publicDocs/{slug}                    docId, spaceId, title, renderedHtml?, updatedAt
                                     ← written only by a function when a doc is published

config/aiModels                      list of selectable models (id, label, provider, isPro)
```

### Editor ↔ Firestore sync (important)
- Every Tiptap top-level node gets a stable `blockId` (UniqueID extension).
- On edit, debounce ~800 ms, diff the editor's top-level nodes against the last saved state by `blockId`,
  and write only added / changed / deleted blocks in a single batched write.
- Ordering uses fractional indexing (e.g. the `fractional-indexing` package) so moving a block rewrites one doc.
- Load a doc by listening to its `blocks` subcollection ordered by `order`, then build the Tiptap document.
- Conflict handling for v1: last write wins **per block**. Live character-level co-editing (Yjs + a
  Hocuspocus server on Cloud Run) is Phase 8 — design the editor module so that swap is possible later.

### Security rules (must be tested)
- A user can read/write a space only if they are in `memberIds`; only owners change membership/roles.
- A user can read a doc if they are a member of its space **or** in `sharedWith`; write if their role allows.
- Blocks/chunks inherit access from the parent doc.
- `users/{uid}/**` is private to that user.
- `publicDocs` is world-readable, never client-writable. `config/*` is readable by signed-in users only.
- Write rules unit tests covering allowed **and** denied cases for every collection.

Add composite indexes to `firestore.indexes.json` for every query you write.

---

## 4. Design system

- Create tokens in `/src/theme`: colors (light + dark), spacing scale, radii, typography scale, shadows.
- Our own palette: calm neutral background, one accent color, soft rounded cards. Full **dark mode**.
- Typography: system font (SF Pro / Roboto) with a clear hierarchy; large titles on home and doc screens.
- Reusable components: Button, IconButton, TextField, ListRow, SectionHeader, Card, BottomSheet,
  EmptyState, Avatar, Toast, Skeleton loader, ContextMenu (long-press).
- Interactions: haptics on toggles and completions, spring animations, swipe actions on rows,
  bottom sheets for most secondary actions (matching the reference's heavy use of sheets/modals).
- Icons: an open-source icon set (e.g. Lucide or Phosphor).
- Every screen handles **loading, empty, error and offline** states.
- Accessibility: dynamic type support, labels on icon buttons, 44 pt minimum hit targets.

---

## 5. Screens & flows

Map each flow to the matching `./design/<flow>/` folder.

**Onboarding & auth** — Welcome screen → sign in with **Apple**, **Google**, or **email code**.
- Email code: user enters email → Cloud Function generates a 6-digit code, stores its hash with expiry
  (10 min, max 5 attempts), emails it (Resend or SendGrid; key in Functions secrets) → user enters code →
  function verifies and returns a Firebase **custom token** → app signs in. Show loading and error states
  (wrong code, expired code, too many attempts).
- New users: "What's your name?" screen → create `users/{uid}` + a default personal space.
- App tour: 6–8 swipeable intro cards, skippable.
- Ask for notification permission with a pre-permission explanation sheet first.

**Home** — greeting, quick actions (new doc, new task, today's note, ask AI), recent docs,
tabs/sections for All docs, Starred, Shared with me. Bottom tab bar: Home, Tasks, Calendar, Assistant, Space.

**Browsing docs** — list/grid toggle, sort (updated, created, title), folders, long-press context menu
(star, share, move, duplicate, delete), trash with restore. Empty states for Starred and Shared.

**Doc editor** — title + icon/cover, block editor with: headings, paragraphs, bullet/numbered lists,
to-dos, quote, code, divider, toggle, image (upload to Storage), links to other docs.
"/" slash menu to insert blocks, formatting toolbar above the keyboard, drag to reorder,
AI actions on selected text (summarize, rewrite, fix grammar, translate, continue writing).
Share sheet: invite by email, role picker, link sharing toggle, publish to web toggle.

**Tasks** — task lists (Inbox + user lists), switch lists, add task inline, edit task sheet
(title, notes, due date, reminder, list), complete with animation, empty states per list.
To-do blocks in docs that are marked as tasks also appear here (sync via `tasks.docId/blockId`).

**Calendar & daily notes** — month/week strip + day view showing that day's tasks and its daily note;
add a task to a specific day; "Create daily note" creates a doc with `isDailyNote: true` for that date;
optionally show device calendar events (expo-calendar, with permission).

**AI assistant** — chat screen with streaming replies, model picker sheet (from `config/aiModels`),
chat history list, "ask about this doc" mode, and answers grounded in the user's docs (show which
docs were used, tappable). Assistant settings screen (default model, response style).

**Spaces** — space switcher, space settings (name, icon, members, roles, invite), published content list,
leave/delete space.

**Settings** — profile, appearance (light/dark/system), start of week, notifications, AI settings,
connected AI tools (Phase 8), subscription (Phase 7), export data, delete account, log out (with confirm).

---

## 6. AI backend (Cloud Functions + Genkit)

- **All model calls happen server-side.** API keys live in Firebase Functions secrets — never in the app.
- `aiChat` — callable or HTTPS function; verifies the Firebase ID token; streams tokens back to the app.
  Use Genkit streaming with callable functions if React Native Firebase supports reading the stream;
  if not, use an HTTPS endpoint with Server-Sent Events and send the ID token in the Authorization header.
  Check current docs and tell me which approach you chose.
- `aiTransform` — non-chat text actions (summarize, rewrite, etc.) for the editor.
- **Retrieval**: a Firestore trigger on block changes (debounced per doc, e.g. via a Cloud Tasks queue)
  re-chunks the doc text, creates embeddings, and writes `docs/{docId}/chunks`. Use Genkit's Firestore
  retriever / Firestore vector search, filtered to docs the user can access.
- Model list comes from `config/aiModels` so models can be added or removed without an app release.
- Rate-limit per user (e.g. a counter doc per user per day) and log token usage for future billing.

---

## 7. Other Cloud Functions

- `onDocPublished` — when `published` flips true, write/refresh `publicDocs/{slug}`; remove when false.
- `sendTaskReminders` — scheduled every minute/5 min; sends FCM pushes for tasks whose `reminderAt` has passed.
- `onShareInvite` — when someone is added to `sharedWith` or a space, send a push/email.
- `deleteAccount` — deletes the user's data, Storage files, and auth user.

---

## 8. Published docs website (`/apps/web`)

- Route `/p/[slug]` reads `publicDocs/{slug}` (via the Admin SDK on the server) and renders the doc
  as clean, fast, SEO-friendly HTML with Open Graph tags. 404 if not published.
- Same design tokens as the app (light/dark).

---

## 9. Offline & performance

- Firestore offline persistence on; the app must open, show docs/tasks and allow edits with no network,
  syncing when back online. Show a subtle offline indicator.
- Paginate long lists; use FlashList for large lists.
- Cache images with expo-image; compress uploads before sending to Storage.

---

## 10. Phases & acceptance criteria

**Phase 0 — Setup**
Monorepo, Expo dev build running on iOS simulator and Android emulator, Firebase project wired to the
**Emulator Suite**, shared types package, theme tokens, base components, lint/test scripts, `.env.example`, README
with setup steps.
✅ App launches showing a themed placeholder screen; `pnpm lint`, `pnpm typecheck`, `pnpm test` pass.

**Phase 1 — Auth & onboarding**
Apple, Google and email-code sign-in; name screen; default space creation; app tour; notification pre-permission.
✅ A new user can sign up, land on Home, kill the app and stay signed in; wrong/expired code errors show correctly.

**Phase 2 — Docs & editor**
Doc CRUD, home sections, browsing/sorting/folders, star, trash, block editor with block-level sync, images.
Security rules + tests for spaces/docs/blocks.
✅ Create a doc offline with several block types, go online, see it on a second device/emulator.

**Phase 3 — Tasks & calendar**
Task lists, task editing, reminders (local + FCM), calendar day view, daily notes, task blocks synced to tasks.
✅ A task with a reminder triggers a notification; a to-do block in a doc appears in the Tasks tab.

**Phase 4 — AI assistant**
Genkit functions, streaming chat, model picker, editor AI actions, embeddings + retrieval with sources.
✅ Asking "what did I write about X?" returns an answer citing the right doc; no API key exists in the app bundle.

**Phase 5 — Sharing, spaces & publishing**
Invite members, roles, shared-with-me, space settings, publish to web + Next.js site.
✅ A viewer can read but not edit; a published doc opens at `/p/[slug]` in a browser without signing in.

**Phase 6 — Search & settings**
Full-text search across docs and tasks, all settings screens, export data, delete account.

**Phase 7 — Monetization & release prep**
RevenueCat paywall (AI limits for free tier), Crashlytics, Analytics events, app icons/splash,
store metadata checklist, EAS production builds.

**Phase 8 — Later**
Live co-editing with Yjs + Hocuspocus on Cloud Run; an **MCP server** (Cloud Run, OAuth) so external AI
assistants can read/write the user's docs and tasks ("Connect AI tools" screen); iPad and web app.
