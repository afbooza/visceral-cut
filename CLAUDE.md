# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm install        # Install dependencies
npm run dev        # Start Vite dev server
npm run build      # Production build (outputs to dist/)
npm run preview    # Preview production build locally
```

No test runner, linter, or formatter is configured.

## Architecture

**Visceral Cut** is a mobile-first PWA for personal workout and readiness tracking, built with React 18 + Vite.

- **Single-component app**: The entire UI lives in `src/App.jsx` (~600 lines). There is no component decomposition, routing library, or state management library.
- **View switching**: Navigation between views (dashboard, history, schedule, session, settings) is handled via `useState` — no React Router.
- **Data persistence (local-first)**: All data is written to `localStorage` first (key `"tony-workout-tracker-v2"`, shape `{ logs: {} }`; in-progress session draft under `"tony-workout-draft"`; exercise catalog under `"tony-workout-catalog"`, shape `{ items: { id: exercise } }`; customized program under `"tony-workout-program"`, shape `{ days: { Push: [...], ... }, up }`), then synced in the background to Upstash Redis via Vercel serverless functions in `api/` (`logs.js`, `draft.js`, `catalog.js`, `program.js`). The client sync layer is `src/sync.js`. Redis stores logs in a hash `logs` (field = `YYYY-MM-DD` date key), the catalog in a hash `catalog` (field = exercise id, per-item newer-wins merge), the in-progress draft under key `draft`, and the program under key `program` (whole-object newer-wins).
- **Video uploads**: Catalog exercises accept either a pasted URL (YouTube etc.) or a file uploaded from the device to Vercel Blob (store `visceral-cut-videos`). Uploads go direct-to-Blob from the client (`upload()` from `@vercel/blob/client`, multipart) — `api/upload.js` only mints the client token (auth: sync token via `clientPayload`, since the blob library issues the token request itself) and handles DELETE for cleanup. Blob files are deleted best-effort when their exercise is deleted or the video is replaced. Uploaded/direct-file videos play in an in-app overlay `<video>`; other links open externally.
- **Auth**: Single-user shared secret. The client sends `Authorization: Bearer <token>` (token entered in the Sync view, stored in localStorage); the API compares it against the `SYNC_TOKEN` env var. Redis credentials (`UPSTASH_REDIS_REST_URL`/`TOKEN` or `KV_REST_API_URL`/`TOKEN`) stay server-side.
- **Sync semantics**: On load and on "Sync Now", the app pulls remote logs, merges with local (newer `up`/`ts` timestamp wins per date), and pushes any dates the server is missing — this doubles as the one-time migration of pre-existing localStorage history. Every set input saves the draft locally immediately and pushes it to Redis debounced (1.5s), enabling mid-workout recovery via a "Resume" banner.
- **PWA**: Configured via `vite-plugin-pwa` in `vite.config.js` with Workbox service worker caching (JS, CSS, HTML, images, Google Fonts). Targets standalone portrait mode on mobile.
- **Styling**: Inline styles with JS objects throughout — no CSS files, no CSS framework, no Tailwind. Color palette uses dark background (#0e0e0e) with lime accent (#c8f060). Fonts: DM Mono (body) and Bebas Neue (headings) from Google Fonts.

## Domain Logic

- **Workout programs**: Push/Pull/Legs/Core split, each with warmup exercises and 5-6 main exercises. Sets, reps, and weight are logged per exercise. The stock program lives in the `WORKOUTS` constant; a customized program (exercises swapped in, added, or removed via the Plan tab's Program editor) overrides it per day — always resolve via `getProgram(type)`, never read `WORKOUTS` directly for session/history rendering. Added exercises append to the end of the day (keeps existing indices stable); removing a slot shifts later indices, which the `names` guard absorbs for new logs. History is keyed by exercise *index*, so reordering or removing exercises within a day shifts which historical data shows as PREV — renaming in place is safe. Logs saved since the catalog feature also record a `names` array; the session view suppresses PREV for a slot whose name changed, and history/edit views prefer `log.names` for display.
- **Exercise catalog**: User-defined exercises (name, workout type, tracking style weight/bodyweight/time, body focus, sets/reps, suggested weight, description, video URL) managed in the Catalog tab. Swapping one into a program day copies a snapshot into the program — later catalog edits don't retroactively change the program.
- **Schedule**: Fixed 7-day weekly template mixing lift days, cardio, and rest.

## Deployment

Deployed to Vercel. Build command: `npm run build`, output directory: `dist`. Serverless functions in `api/` are deployed automatically by Vercel.

Required env vars (set in Vercel project settings): `SYNC_TOKEN` (shared secret for API auth), the Upstash Redis REST credentials (injected by the Vercel Marketplace Upstash integration), and `BLOB_READ_WRITE_TOKEN` (injected by the linked `visceral-cut-videos` Blob store). Local API testing requires `vercel dev` (plain `vite` dev serves only the frontend; the app degrades gracefully to local-only). `vercel dev` gives functions only Development-scoped env vars: `SYNC_TOKEN` and `BLOB_READ_WRITE_TOKEN` exist there, but the Upstash KV vars are Production/Preview-only and marked sensitive — `vercel env pull` writes them as empty strings, so Redis-backed routes 500 locally unless you paste real KV creds (from the Upstash console) into `.env.local`.
