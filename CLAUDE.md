# NETBAC — Project Instructions

> Last updated: 2026-04-25.
> This file loads automatically every Claude Code session. Keep it current as the project evolves.

## What this is

NETBAC Mobile — HACCP traceability app for restaurants. React Native / Expo. Backend on Firebase (Auth + Firestore). Production-bound mobile app, not a web product.

## Stack

- **Frontend:** React Native via Expo (managed workflow + native modules where needed)
- **Auth:** Firebase Authentication (Google sign-in via `@react-native-google-signin`)
- **DB:** Cloud Firestore (`@react-native-firebase/firestore`)
- **Native modules:** Expo dev client, expo-camera, expo-notifications
- **Styling:** NativeWind (Tailwind for RN)
- **Tests:** Jest

## Common commands

```bash
npm start          # expo dev server
npm run android    # run on connected android device / emulator
npm run ios        # run on iOS simulator (mac only)
npm run lint
npm test
```

## Files / dirs to know

- `app/` — Expo Router screens
- `__mocks__/` + `jest.setup.js` — test scaffolding
- `google-services.json`, `GoogleService-Info.plist` — Firebase config (gitignored, per-machine)
- `claude.sh` — local convenience launcher

## Style preferences

- Terse, direct, no trailing summaries
- Clickable path format: `[file.tsx](app/file.tsx)` or `[file.tsx:42](app/file.tsx#L42)`
- French UI labels where applicable
- No emojis unless asked

## Safety rules

- **Never push Firebase config files.** They're per-environment and ignored.
- **Confirm before** running migrations / changing Firestore security rules / touching production data.
- Auto-memory at `~/.claude/projects/-home-fares-projects-netbac/memory/` — feedback rules persist across sessions.

## Open status

Populate this section as work progresses (current sprint, known bugs, upcoming features).
