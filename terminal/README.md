# CRT Institutional Trading Terminal & TradeXGuardian (Terminal Package)

Frontend application built with React 18, TypeScript (Strict), Vite, Tailwind CSS, Zustand, and Lightweight Charts 4.2.

---

## Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Launch development server
npm run dev
# Terminal: http://localhost:5173
# Landing:  http://localhost:5173/?view=landing

# 3. Production build
npm run build

# 4. Preview build
npm run preview
```

---

## Native Mobile App Commands (Capacitor)

The terminal is wrapped for direct compilation to native iOS and Android apps.

```bash
# Sync web build to native iOS and Android projects
npm run cap:build

# Open native Android Studio project
npm run cap:android

# Open native Xcode project (macOS)
npm run cap:ios
```

---

## Progressive Web App (PWA)
- Manifest: `public/manifest.webmanifest`
- Service Worker: `public/sw.js`
- iOS Safari: Tap Share &gt; "Add to Home Screen"
- Android Chrome: Tap "Install app"
- Desktop Chrome / Edge: Click Install button in address bar

---

## Zero Emoji Policy
This application strictly enforces a ZERO EMOJI POLICY across all code, UI components, notifications, logs, and markdown files. Professional institutional typography and vector SVG icons are used exclusively.
