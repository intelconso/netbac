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

- **Inventaire v1 (2026-08-24)** — suivi de stock par article, alimenté **uniquement**
  par les étiquettes. Le stock n'est jamais stocké : il est dérivé d'un registre
  append-only (`AppState.stockMovements`) parce qu'un compteur se corromprait sous
  l'union-merge de `sync.ts`. Toute la logique pure est dans
  [inventory.ts](src/lib/inventory.ts) ; les écritures passent par
  `reconcileProductMovements` dans [store.ts](src/lib/store.ts) — y compris les
  suppressions en cascade d'un emplacement (`tombProductsWhere`), sans quoi une
  étiquette supprimée laissait son entrée au registre.
  Règle en place : **toute création d'étiquette fait entrer du stock** — voir
  `createsStockIn()`, seul endroit à changer pour ne compter que les livraisons.
  **Aucune saisie manuelle de quantité** : une quantité tapée à la main n'apprend
  rien (il a fallu regarder l'étagère) et s'ajoutait à celle des étiquettes, donc
  comptait deux fois le même stock. `addStockMovement` / `setStockCount` restent
  dans le store, sans écran — c'est le point de reprise quand un vrai inventaire
  physique sera nécessaire. Corollaire : les écrans d'inventaire sont en lecture
  seule, et aucune étiquette n'est modifiable nulle part dans l'app.
  Le catalogue est groupé par **catégorie** (`articleCategories`, liste plate,
  6 familles par défaut à ids fixes) et non plus par emplacement : une catégorie
  est intrinsèque à l'ingrédient, un emplacement est contingent — et un article
  rangé dans une zone sans bac ne pouvait jamais recevoir d'étiquette. Les champs
  `zoneId`/`unitId`/`shelfId`/`bacId` de `Article` restent lisibles mais dormants.
