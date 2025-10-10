# Explit Web – AI Maintainer Guide

This guide gives downstream AI agents the context they need to work effectively on the project without breaking critical guarantees.

## 1. Architecture Snapshot
- **Framework**: Next.js (App Router) with server components where practical.
- **Styling**: Tailwind CSS + shadcn/ui. Reuse existing component primitives under `components/ui`.
- **Data layer**: Prisma (`lib/prisma.ts`) connected to MongoDB, plus a Dexie IndexedDB cache (`lib/db-dexie.ts`) for offline-first study data.
- **Auth**: next-auth configured with the Prisma adapter in `lib/auth.ts`, currently wired for GitHub and Google OAuth. Session strategy is JWT; `session.user.id` is guaranteed via callbacks (see `types/next-auth.d.ts`).
- **Sync engine**: Dexie stores queue pending ops + metadata. `lib/sync/manager.ts` orchestrates POST `/api/sync` requests, applies responses transactionally, and exposes queue helpers.
- **State management**: Redux Toolkit store defined in `redux/store.ts` with slices for user, deck, study, and sync state. Serializable checks are disabled because Dexie objects are non-serializable.
- **Internationalization**: next-intl. Messages live under `messages/{locale}.json`. Root layout reads `NEXT_LOCALE` cookie to choose the bundle.
- **Media uploads**: `/app/api/s3-upload/route.ts` generates pre-signed S3 URLs. All AWS credentials must remain on the server.
- **Serialization utilities**: `lib/utils/serialization.ts` exposes a recursive `dateToStrings` helper to convert Prisma `Date` fields before sending to the client. Safe DTOs are declared in `types/data.ts`.

## 2. Project Layout Cheatsheet
| Path | Responsibility |
| --- | --- |
| `app/` | Next.js routes. `layout.tsx` wires global providers. `page.tsx` renders a localized hero component. |
| `components/home/HomeHero.tsx` | Client component using translations + shadcn button primitives. |
| `components/card-renderer/CardRenderer.tsx` | Client component that injects CSS and replaces template placeholders with card field values. |
| `redux/` | Store, slices, and hooks for RTK. `studySlice` consumes the shared sync manager; `syncSlice` tracks queue/cursor state. |
| `lib/` | Shared infrastructure (Prisma singleton, Dexie instance, sync manager + types, auth config, serialization helpers). |
| `prisma/schema.prisma` | MongoDB data model. Many relations already defined—consult before changing types. |
| `public/docs/guide.md` | High-level architectural requirements supplied by the user. Treat as source of truth. |

## 3. Operational Guidelines
1. **Preserve Content/Format/Style separation**: Data (card content), templates, and styling must remain decoupled. Card rendering should always use the dedicated renderer.
2. **Safe DTOs**: When moving Prisma entities to the client, run them through `dateToStrings` and map them into the safe types so Dates become ISO strings.
3. **Dexie sync**: Batch all sync mutations through `useSyncQueue` / `useSyncOperations`. `performSync` in `lib/sync/manager.ts` handles transactional writes and queue cleanup—never bypass it.
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

Use this document as a launchpad. Always re-check the repository state (`git status`) before edits—user may leave in-progress work that must not be overwritten. Good luck!***
