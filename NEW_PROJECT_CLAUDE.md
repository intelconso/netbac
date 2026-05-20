# Project Instructions

> Template extracted from NETBAC workflow. Rename/trim sections to fit the new app.
> This file loads automatically every Claude Code session — keep it current.

## What this is

[One-liner: what the app does, who it's for, production status.]
Android-first mobile app built with React Native / Expo + Firebase.

## Stack

- **Frontend:** React Native via Expo (managed workflow + dev client for native modules)
- **Router:** `expo-router` (file-based routing under `app/`, Stack + Tabs)
- **State:** Zustand with `persist` middleware → AsyncStorage (per-user key via a `switchStoreToUser(uid)` helper)
- **Auth:** Firebase Authentication
  - `@react-native-firebase/app`
  - `@react-native-firebase/auth`
  - `@react-native-google-signin/google-signin` for Google sign-in
- **DB:** Cloud Firestore (`@react-native-firebase/firestore`) — keep a local-first store and sync up/down; mind the 1 MB doc limit (use subcollections for unbounded lists)
- **Styling:** NativeWind (Tailwind for RN). Define brand colors (`primary`, `danger`, `background`) in `tailwind.config.js`
- **Icons:** `lucide-react-native`
- **Dates:** `date-fns` + `date-fns/locale` (fr if French UI)
- **PDF / print:** `expo-print` (`Print.printAsync({ html })` — opens native print dialog with Save as PDF, no share sheet)
- **Camera / scan:** `expo-camera`
- **Notifications:** `expo-notifications`
- **Safe area:** `react-native-safe-area-context`
- **Tests:** Jest + `__mocks__/` + `jest.setup.js`

## Project layout

```
app/                      # expo-router screens
  (tabs)/                 # tab group
    _layout.tsx
    index.tsx             # dashboard
    settings.tsx
  [feature]/[id].tsx      # dynamic routes
src/
  lib/
    store.ts              # zustand store + persist + cloud sync
    firebase.ts           # firebase init
    useSession.ts         # auth session hook
    utils.ts              # cn, formatDate, getDaysRemaining, etc.
    pdf.ts                # report builder + Print.printAsync
  components/
  types.ts
__mocks__/                # jest mocks
jest.setup.js
tailwind.config.js
google-services.json      # GITIGNORED, per-machine
GoogleService-Info.plist  # GITIGNORED, per-machine
android/                  # bare android project (after expo prebuild)
```

## Common commands

```bash
npm start                       # expo dev server (Metro)
npx expo start --dev-client     # dev server expecting the custom dev client APK
npx expo start --dev-client --tunnel   # wireless dev over ngrok-style tunnel
npm run android                 # build + install debug on connected device
npm run ios                     # iOS sim (mac only)
npm run lint
npm test
```

### Android dev client (wireless live reload)

1. Install the **debug dev-client APK** on the phone once (built via `eas build --profile development` or `./gradlew assembleDebug`).
2. Run `npx expo start --dev-client --tunnel` on the dev machine.
3. Open the dev-client app on the phone → it auto-discovers the tunnel URL, or paste it manually.
4. JS changes hot-reload. Native module changes require a new dev-client build.

### Release APK (signed)

- Keystore: `android/app/release.keystore` (gitignored)
- Credentials: `android/keystore.properties` (gitignored) with `storeFile`, `storePassword`, `keyAlias`, `keyPassword`
- `android/app/build.gradle` reads `keystore.properties` for `signingConfigs.release`
- Build: `cd android && ./gradlew assembleRelease` → `android/app/build/outputs/apk/release/app-release.apk`
- **User-policy:** do not run gradle builds unprompted — hand the command to the user (it may freeze their machine). Override only on explicit request.

## Conventions

### Store
- Single zustand store with `persist` middleware and `partialize` so only user-owned data is persisted
- `INITIAL_STATE` is **completely blank** — never seed zones/items/whatever for new users
- Custom `merge` that re-applies defaults missing from older persisted states (so adding a new field doesn't strand existing users)
- Per-user key: on auth change, call `switchStoreToUser(uid)` which swaps the AsyncStorage key to `store:${uid}`
- Cloud sync: `applyCloudState` defensively merges (skip `undefined`, skip function-typed keys) before writing
- Activity logs: append-only, no `.slice()` cap unless approaching Firestore 1 MB doc limit (then move to subcollection)

### Routing & back behavior
- Use `useFocusEffect(useCallback(() => { ... }, deps))` for Android `BackHandler` — never bare `useEffect`, or multiple screens steal back events
- Hardware back should step back through internal screen state (modals, drill-downs) before unwinding the navigation stack
- Prefer `router.push` over `router.replace` when you want the previous screen restored on back (`router.back()` lands on its preserved state)
- Pass state needed for restoration via URL params (`useLocalSearchParams`)

### UI
- French UI labels where applicable
- NativeWind classes for layout/color; brand tokens (`bg-primary`, `bg-danger`, `bg-background`) in tailwind config
- Confirmation modal for any destructive or audit-relevant action (with product/item name + Annuler + colored confirm)
- For HACCP-style audit trails: items are immutable post-creation; only status transitions (`active → used | discarded`) — no edit, no hard delete
- Single source of truth for enums (e.g. `src/lib/actionTypes.ts` exporting an `ACTION_TYPES` array with id/label/icon) — drive both creation chips and read-side display from one constant
- Stat tiles: `numberOfLines={1}` on uppercase labels to prevent wrap
- Action tiles: `style={{ aspectRatio: 1 }}` for clean squares

### PDF reports
- Filter type lives in `pdf.ts`; export `filterProducts(state, filter)` so the UI live-preview and the PDF share filtering logic
- Build HTML string, then `Print.printAsync({ html })` — opens system print dialog with Save as PDF / printer choice (no messaging share sheet)
- Inline `<style>` block in the HTML (no external assets)

### Firestore safety
- **Never commit** `google-services.json` / `GoogleService-Info.plist` — they're per-environment and gitignored
- **Confirm before** running migrations, changing security rules, or touching production data
- Watch the 1 MB single-doc limit; promote unbounded arrays to subcollections when they grow

## Style preferences

- Terse, direct, no trailing summaries
- Clickable path format: `[file.tsx](app/file.tsx)` or `[file.tsx:42](app/file.tsx#L42)`
- No emojis unless explicitly asked
- TDD for non-trivial logic: failing Jest test first, then implementation; bug fixes get a regression test first
- Comments only when the WHY is non-obvious — never narrate WHAT

## Auto-memory

Path: `~/.claude/projects/-<escaped-project-path>/memory/`
- Feedback rules persist across sessions (e.g. "never run gradle builds", "TDD approach")
- Copy over the relevant feedback memories from the old project on day 1 if behavior should carry across

## Open status

[Populate as work begins — current sprint, known bugs, upcoming features.]
