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

- **Single-component app**: The entire UI lives in `src/App.jsx` (~500 lines). There is no component decomposition, routing library, or state management library.
- **View switching**: Navigation between views (dashboard, readiness, history, schedule, session) is handled via `useState` — no React Router.
- **Data persistence**: All data is stored in `localStorage` under key `"tony-workout-tracker-v2"` with shape `{ logs: {}, readiness: {} }`. There is no backend or API.
- **PWA**: Configured via `vite-plugin-pwa` in `vite.config.js` with Workbox service worker caching (JS, CSS, HTML, images, Google Fonts). Targets standalone portrait mode on mobile.
- **Styling**: Inline styles with JS objects throughout — no CSS files, no CSS framework, no Tailwind. Color palette uses dark background (#0e0e0e) with lime accent (#c8f060). Fonts: DM Mono (body) and Bebas Neue (headings) from Google Fonts.

## Domain Logic

- **Workout programs**: Push/Pull/Legs split, each with warmup exercises and 5 main exercises. Sets, reps, and weight are logged per exercise.
- **Readiness scoring**: Calculated from HRV status, Body Battery (0-100), and RHR delta (vs 7-day avg). Produces a 0-100% score with GO/EASY/REST recommendation.
- **Schedule**: Fixed 7-day weekly template mixing lift days, cardio, and rest.

## Deployment

Deployed to Vercel. Build command: `npm run build`, output directory: `dist`.
