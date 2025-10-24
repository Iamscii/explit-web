# Explit Web – AI Maintainer Guide

This guide gives downstream AI agents the context they need to work effectively on the project without breaking critical guarantees.

> **Reminder**: Any significant logic or architectural change must include a fresh pass over `agents.md`—update or append sections so future maintainers stay aligned.

## 1. Architecture Snapshot
- **Framework**: Next.js (App Router) with server components where practical.
- **Styling**: Tailwind CSS + shadcn/ui. Reuse existing component primitives under `components/ui`. Template styles are hydrated from JSON via `parseStyleJson` (`lib/templates/styles.ts`)—extend the selector alias maps there when adding new card or field targets so DeckStudyClient continues to render styles correctly.
- **Data layer**: Prisma (`lib/prisma.ts`) connected to MongoDB, plus a Dexie IndexedDB cache (`lib/db-dexie.ts`) for offline-first study data covering cards, decks, templates, fields, field preferences, user progress, and user preferences. Deck DTOs are now flattened (`SafeDeck`) to keep TypeScript recursion in check; reach for `SafeDeckTree` when a nested view is necessary. Comment DTOs strip nested `replies` in favor of `replyIds` so Immer reducers avoid recursive drafts. Client flows hydrate from Dexie via `readDexieCollections` and treat MongoDB as the eventual-sync source of truth exposed through `/api/sync`. Dexie tables are now user-scoped (records and pending operations carry `userId`) so multiple accounts can share the same device without leaking data.
- **Auth**: next-auth configured with the Prisma adapter in `lib/auth.ts`, currently wired for GitHub and Google OAuth. Session strategy is JWT; `session.user.id` is guaranteed via callbacks (see `types/next-auth.d.ts`).
  - Client dialogs (auth and dashboard creation flows) live under `components/dialog/` and expose Zustand stores in `hooks/dialog/` (e.g., `use-login-dialog.ts`, `use-add-card-dialog.ts`) so any page can control open/close state.
  - `events.createUser` triggers `lib/auth/user-provisioning.ts` to seed default decks, templates, user preferences, and update-log metadata immediately after a new account is persisted. Provisioning retries once with an extended transaction timeout to dodge Prisma `P2028` (interactive transaction timeout) against Atlas.
  - `SessionStateBridge` in `AppProviders` mirrors the next-auth session into Redux (`userSlice`) and resets sync queue totals when a user signs out so Dexie queues stay per-account.
- **Sync engine**: Dexie stores queue pending ops + metadata. `lib/sync/manager.ts` orchestrates POST `/api/sync` requests, applies responses transactionally, and exposes queue helpers.
  - Auto-sync (see `hooks/use-auto-sync.ts`) is only enabled once the user session is authenticated to prevent anonymous clients from hammering the stubbed `/api/sync` endpoint.
  - `SyncRuntime` inside `AppProviders` hydrates Redux slices from Dexie as soon as a session is available, so pages can assume local cache is ready without duplicating bootstrap logic.
  - FSRS reviews (`hooks/useFsrsAlgorithm.ts`) update progress locally and enqueue hot operations through `useSyncOperations`, so spaced-repetition ratings stay in the Dexie queue.
- **State management**: Redux Toolkit store defined in `redux/store.ts` with slices for user, deck, card, template, field, field preference, study, study session, user card progress, user preferences, and sync state. Serializable checks are disabled because Dexie objects are non-serializable.
- **Internationalization**: next-intl. Messages live under `messages/{locale}.json`. Root layout reads `NEXT_LOCALE` cookie to choose the bundle.
  - `AppProviders` now sets `NextIntlClientProvider` with a default time zone (configurable via `NEXT_PUBLIC_DEFAULT_TIME_ZONE`, defaulting to `UTC`) to avoid environment fallbacks during hydration.
  - `/app/api/locale/route.ts` stores the locale cookie; the client `LanguageSwitch` component posts here before refreshing the router.
- **Media uploads**: `/app/api/s3-upload/route.ts` generates pre-signed S3 URLs. All AWS credentials must remain on the server.
- **Serialization utilities**: `lib/utils/serialization.ts` exposes a recursive `dateToStrings` helper to convert Prisma `Date` fields before sending to the client. Safe DTOs are declared in `types/data.ts`.
- **AI providers**: `lib/ai` centralizes model adapters for OpenRouter (text) and FAL (image). OpenRouter catalog entries share the `OPENROUTER_TEXT_PARAMETERS` schema (top_p, penalties, tool-calling controls)—extend this list when adding new OpenRouter models so the AI Lab form stays in sync, and set `OPENROUTER_SITE_URL`/`OPENROUTER_SITE_TITLE` env vars to populate the required OpenRouter headers. Vision-language entries also expose an `image_urls` array that the `/api/ai/llm` handler converts into multimodal chat content before invoking OpenRouter. `/app/api/ai/route.ts` uses the registry to execute tasks and can persist generated assets to S3 via `lib/storage/s3.ts`. Image-size presets for FAL models are described in `lib/ai/image-size.ts`, which translates UI aspect ratio picks into provider-compliant `{ width, height }` payloads.

## 2. Project Layout Cheatsheet
| Path | Responsibility |
| --- | --- |
| `app/` | Next.js routes. `layout.tsx` wires global providers. `page.tsx` resolves the session/search params before rendering `HomePage`. |
| `app/page.tsx` | Server entry that hands the parsed `category` search param and session `userId` to `HomePage`. |
| `app/deck/page.tsx` | Server entry for the study view that forwards `deckId`/`cardIndex` into `DeckStudyClient`. |
| `app/dashboard/page.tsx` | Thin server wrapper that resolves the session and hands `userId` to the dashboard; hydration now comes from `SyncRuntime`. |
| `components/home/HomePage.tsx` | Client switcher that shows `HomeHero` for guests and `DeckExplorer` when authenticated. |
| `components/home/HomeHero.tsx` | Client component using translations + shadcn button primitives. |
| `components/deck/DeckExplorer.tsx` | Offline-friendly deck browser that lists cards and links into `/deck?deckId=...&cardIndex=...`. |
| `components/deck/DeckStudyClient.tsx` | Study surface that renders cards through `CardRenderer`, wires template-aware quiz controls, and advances FSRS ratings via the sync queue. |
| `components/study/QuizComponent.tsx` | Template switchboard that selects quiz UIs (basic, choice, cloze, spelling, reading) and funnels completions back to the study flow. |
| `components/study/quiz-types/` | Individual quiz presenters; `BasicQuiz` applies FSRS scheduling updates and queues hot sync operations, while others provide progressive placeholders. |
| `components/card-renderer/CardRenderer.tsx` | Client component that injects CSS and replaces template placeholders with card field values. |
| `components/dialog/` | Shared dialog components (auth, deck/card/template creation) driven by Zustand stores in `hooks/dialog/`. |
| `redux/` | Store, slices, and hooks for RTK. `studySlice` consumes the shared sync manager; `syncSlice` tracks queue/cursor state while feature-specific slices (cards, decks, templates, fields, field preferences, study session, user card progress, user preferences) expose normalized selectors. |
| `hooks/dialog/` | Zustand stores exposing `onOpen`/`onClose` helpers for each dialog so pages can trigger modals without prop drilling. |
| `lib/` | Shared infrastructure (Prisma singleton, Dexie instance, sync manager + types, auth config, serialization helpers). |
| `lib/templates/groups.ts` | Shared field-order helper used by template dialogs and the study experience. |
| `lib/templates/card-values.ts` | Normalises card `fieldValues` arrays into `{ fieldId: value }` maps. |
| `lib/templates/styles.ts` | Converts template/style JSON payloads into React `CSSProperties`. |
| `lib/ai/` | Model catalog + registry/adapters for OpenRouter and FAL. Add new models in `model-catalog.ts` (use `upstreamId` for provider identifiers, and declare `options.parameters` for dynamic inputs). |
| `lib/storage/s3.ts` | Memoized S3 client factory and helpers for uploading generated assets. |
| `prisma/schema.prisma` | MongoDB data model. Many relations already defined—consult before changing types. |
| `public/docs/guide.md` | High-level architectural requirements supplied by the user. Treat as source of truth. |
| `app/api/ai/route.ts` | Unified AI execution endpoint (text + image) with optional S3 persistence for generated imagery. |
| `app/ai-lab/page.tsx` | Client playground that groups models by modality → provider → model, surfacing parameter schemas and payload templates. |
| `app/api/ai/llm/route.ts` | Modality-specific text endpoint. Resolves model dynamically and invokes the OpenRouter adapters using catalog-driven parameters. |
| `app/api/ai/text-to-image/route.ts` | Modality-specific image generation endpoint (text prompts). Normalises provider parameters based on catalog metadata. |
| `app/api/ai/image-to-image/route.ts` | Image-to-image endpoint built on the shared media handler. Normalises catalog parameters and dispatches through the FAL adapter. |
| `app/api/ai/text-to-video/route.ts` | Text-to-video endpoint that resolves providers via the catalog and streams requests through the FAL video adapter. |
| `app/api/ai/image-to-video/route.ts` | Image-to-video endpoint for animating source imagery using catalogue metadata and the FAL video adapter. |

## 3. Operational Guidelines
1. **Preserve Content/Format/Style separation**: Data (card content), templates, and styling must remain decoupled. Card rendering should always use the dedicated renderer.
2. **Safe DTOs**: When moving Prisma entities to the client, run them through `dateToStrings` and map them into the safe types so Dates become ISO strings.
3. **Dexie sync**: Batch all sync mutations through `useSyncQueue` / `useSyncOperations`. These helpers write into Dexie first so UI stays responsive while the queue waits for `/api/sync`, and they annotate each pending operation with the active `userId`. `performSync` in `lib/sync/manager.ts` handles transactional writes and queue cleanup—never bypass it.
4. **Auth-aware routes**: Use `getAuthSession` from `lib/auth.ts` in server actions or API routes that require authentication. Always verify `session?.user.id`.
5. **Internationalization**: When adding UI, fetch translations with `useTranslations` (client) or `getTranslations` (server). Do not hardcode copy—extend the locale files instead.
6. **Secrets**: `.env` currently contains real credentials. Never log or commit these values. Prefer referencing `process.env` directly and validate presence server-side.
7. **Testing & linting**: Use `npm run lint` for static checks. Add targeted tests before major refactors; remove any scaffolding scripts before handing back to the user.
8. **Shadcn components**: Prefer composition via existing primitives. When generating new components, keep styling consistent with Tailwind 4 utility classes already in use.
9. **Database migrations**: Prisma with MongoDB does not use SQL migrations. Schema changes require updating the schema file and running `npx prisma generate`.

## 4. Common Tasks & Tips
- **Adding a new page**: Create the route in `app/`. Wrap client components with necessary providers only once in layout. Use server components for data fetching when possible.
- **Implementing API routes**: Place handlers under `app/api/.../route.ts`. Reuse Prisma client from `lib/prisma.ts`. Handle JSON parsing errors gracefully.
- **Extending Redux state**: Define new slices under `redux/slices/` and register them in `redux/store.ts`. Keep reducers pure; offload async logic to thunks or RTK Query later. Sync-related logic should live in the shared manager or hooks, not per-slice custom code.
- **Handling uploads**: Call the `/api/s3-upload` route from the client, then upload directly to S3 with the returned URL. Do not expose AWS keys to the browser.
- **Invoking AI models**: POST `/api/ai` with a registered `modelId`. Text requests expect chat messages; image requests can opt into S3 persistence (`persist.provider = "s3"`). Use `GET /api/ai` to list supported models before invoking.
- **Offline-first features**: Queue entity mutations via `useSyncOperations`. The auto-sync runtime (`useAutoSync`) handles intervals, visibility, and network events; leave it mounted in `AppProviders`.

## 5. Style & Quality Bar
- Stick to TypeScript strictness. Avoid `any`; prefer `unknown` with runtime refinement.
- Keep comments short and purposeful—explain non-obvious logic, not trivial operations.
- Respect existing ESLint/Prettier formatting (project uses ESLint + Next defaults).
- When in doubt, re-read `public/docs/guide.md` to align with the product vision.

## 6. Future Enhancements (from current scaffolding)
- Replace the placeholder `/api/sync` handler with real MongoDB read/write logic (respect categories + versioning).
- Flesh out study and decks pages using `CardRenderer` and Dexie-powered flows.
- Integrate charts via `echarts-for-react` in a future `stats` feature.
- Expand i18n coverage and locale switching UI.

## 7. Data Sync Deep Dive

### 7.1 Flow Overview
1. **Queue** – Components call `useSyncOperations` (e.g., `enqueueCardUpsert`). This records a pending operation in Dexie via `useSyncQueue`.
2. **Trigger** – `SyncRuntime` in `AppProviders` fires an initial sync and delegates cadence to `useAutoSync` (interval-based, visibility change, network re-connect).
3. **Execute** – `performSync` collects pending items + cursors/device metadata and POSTs them to `/api/sync`.
4. **Server** – The real implementation must execute operations inside a MongoDB session, detect conflicts, and return authoritative entities + new cursors.
5. **Apply** – Client runs a Dexie transaction to upsert returned entities, clear applied operations, and store updated metadata. `studySlice`/`syncSlice` receive the final snapshot.

### 7.2 Data Categories & Frequency
| Category | Entities | Default cadence | Notes |
| --- | --- | --- | --- |
| `cold` | Decks, templates, styles | Bootstrap + explicit edit | Low churn, pull on demand. |
| `warm` | Cards | Warm interval (5 min) + edit events | Version check required. |
| `hot` | Progress / review logs | Hot interval (60 s), visibility, network online | Merge append-only data. |

### 7.3 Module Responsibilities
- `lib/sync/manager.ts` – Device ID, cursor metadata, transactional Dexie updates, queue cleanup, snapshot reading.
- `lib/sync/mappers.ts` – Map safe DTOs to Dexie records.
- `hooks/use-sync-queue.ts` – High-level enqueue + manual sync (dispatches `syncData` thunk, updates queue size).
- `hooks/use-sync-operations.ts` – Strongly typed helpers for deck/card/progress operations.
- `hooks/use-auto-sync.ts` – Interval + event listeners for automated sync scheduling.
- `redux/slices/studySlice.ts` – Wraps `performSync`, stores latest safe entities.
- `redux/slices/syncSlice.ts` – Tracks queue size, cursors, device ID, last sync reason/status (useful for diagnostics UI).

### 7.4 `/api/sync` Contract (current stub, expected behavior)
**Request (`SyncRequestPayload`):**
```json
{
  "deviceId": "uuid",
  "operations": [
    {
      "id": "op-uuid",
      "entity": "card",
      "entityId": "card-id",
      "type": "UPSERT",
      "payload": { "...SafeCard" },
      "category": "warm",
      "version": "2025-01-01T00:00:00.000Z",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "cursors": { "warm": "2025-01-01T00:00:00.000Z" },
  "options": { "categories": ["warm"], "forcePull": false, "reason": "hot-interval" }
}
```

**Response (`SyncResponsePayload`):**
```json
{
  "appliedOperationIds": ["op-uuid"],
  "collections": {
    "cards": [{ "...SafeCard" }],
    "progresses": [{ "...SafeUserCardProgress" }],
    "decks": [],
    "templates": [],
    "styles": []
  },
  "cursors": { "warm": "2025-01-01T00:00:05.000Z" },
  "deviceId": "uuid",
  "timestamp": "2025-01-01T00:00:05.000Z"
}
```

### 7.5 Conflict Policy
- Compare incoming `version`/`updatedAt` with server value. Reject or merge stale writes; always return the canonical entity.
- Cold/warm entities: last-write-wins is acceptable but inform clients via returned payload.
- Hot entities: treat `reviewRecords` append-only—merge arrays server-side, recompute derived stability scheduling fields.

### 7.6 Extension Checklist
1. Add new safe DTO + Dexie table + mapper.
2. Provide enqueue helper in `use-sync-operations`.
3. Update server `/api/sync` implementation to handle new entity type atomically.
4. Adjust auto-sync intervals if cadence differs.
5. Surface new state in Redux slices if UI needs it (e.g., template sync status).
