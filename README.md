# Visceral Cut — PWA Deploy Guide

## Deploy to Vercel (free, ~5 min)

### Step 1 — Push to GitHub
1. Go to github.com → New repository → name it `visceral-cut` → Create
2. Upload all files from this zip, preserving folder structure
   - Or use GitHub Desktop if you prefer a GUI

### Step 2 — Deploy on Vercel
1. Go to vercel.com → Sign up with GitHub
2. Click "Add New Project" → Import your `visceral-cut` repo
3. Framework: **Vite** (auto-detected)
4. Build command: `npm run build`
5. Output directory: `dist`
6. Click **Deploy** — takes ~60 seconds

You'll get a URL like `visceral-cut.vercel.app`

---

## Install on iPhone (Safari only)
1. Open your Vercel URL in **Safari** (Chrome won't work for PWA install on iOS)
2. Tap the **Share** button (box with arrow at bottom)
3. Scroll down → tap **"Add to Home Screen"**
4. Name it "Visceral Cut" → tap **Add**

It will appear on your home screen like a native app, full screen, no browser chrome.

## Install on Android (Chrome)
1. Open your Vercel URL in Chrome
2. Tap the **three dots menu** → "Add to Home screen"
3. Or Chrome will prompt you automatically with an install banner

---

## Data persistence
- All data lives in **localStorage** on your device
- Data persists indefinitely as long as you don't clear Safari/Chrome data
- Data is per-device — not synced across devices
- To back up: open browser dev tools → Application → Local Storage → copy the value for `tony-workout-tracker-v2`

## Local development (optional)
```bash
npm install
npm run dev
```
