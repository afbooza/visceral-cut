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
- **Data persistence (local-first)**: All data is written to `localStorage` first (key `"tony-workout-tracker-v2"`, shape `{ logs: {} }`; in-progress session draft under `"tony-workout-draft"`), then synced in the background to Upstash Redis via Vercel serverless functions in `api/` (`logs.js`, `draft.js`). The client sync layer is `src/sync.js`. Redis stores logs in a hash `logs` (field = `YYYY-MM-DD` date key) and the in-progress draft under key `draft`.
- **Auth**: Single-user shared secret. The client sends `Authorization: Bearer <token>` (token entered in the Sync view, stored in localStorage); the API compares it against the `SYNC_TOKEN` env var. Redis credentials (`UPSTASH_REDIS_REST_URL`/`TOKEN` or `KV_REST_API_URL`/`TOKEN`) stay server-side.
- **Sync semantics**: On load and on "Sync Now", the app pulls remote logs, merges with local (newer `up`/`ts` timestamp wins per date), and pushes any dates the server is missing — this doubles as the one-time migration of pre-existing localStorage history. Every set input saves the draft locally immediately and pushes it to Redis debounced (1.5s), enabling mid-workout recovery via a "Resume" banner.
- **PWA**: Configured via `vite-plugin-pwa` in `vite.config.js` with Workbox service worker caching (JS, CSS, HTML, images, Google Fonts). Targets standalone portrait mode on mobile.
- **Styling**: Inline styles with JS objects throughout — no CSS files, no CSS framework, no Tailwind. Color palette uses dark background (#0e0e0e) with lime accent (#c8f060). Fonts: DM Mono (body) and Bebas Neue (headings) from Google Fonts.

## Domain Logic

- **Workout programs**: Push/Pull/Legs/Core split, each with warmup exercises and 5-6 main exercises. Sets, reps, and weight are logged per exercise. History is keyed by exercise *index*, so reordering or removing exercises within a day shifts which historical data shows as PREV — renaming in place is safe.
- **Schedule**: Fixed 7-day weekly template mixing lift days, cardio, and rest.

## Deployment

Deployed to Vercel. Build command: `npm run build`, output directory: `dist`. Serverless functions in `api/` are deployed automatically by Vercel.

Required env vars (set in Vercel project settings): `SYNC_TOKEN` (shared secret for API auth) plus the Upstash Redis REST credentials, which the Vercel Marketplace Upstash integration injects automatically. Local API testing requires `vercel dev` (plain `vite` dev serves only the frontend; the app degrades gracefully to local-only).
