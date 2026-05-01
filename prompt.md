# NETBAC Mobile — Cross-PC Setup Prompt for Claude Code

## Context

I'm setting up a development environment on a new Linux PC for an existing React Native / Expo project called **NETBAC** (HACCP traceability app for restaurants). The project already exists on a different machine and works there. On *this* machine I need to reach the same point: a working **dev-client APK** sideloaded into **Waydroid** (Linux Android container), connecting to a local Metro instance, with **Firebase Auth + Firestore** wired up via `@react-native-firebase`. The end-state is: I edit JS, save, and Waydroid hot-reloads through Fast Refresh.

Be methodical. Do **not** run gradle builds in the background — give me the gradle commands and let me run them in a separate terminal (heavy CPU load freezes the machine). All other commands (npm, expo, tsc, prebuild, etc.) you can run yourself.

## Project facts you must know upfront

- **Stack:** Expo SDK 54, React Native 0.81, React 19, expo-router 6, NativeWind 4, Hermes, new architecture **enabled** (`newArchEnabled: true` in app.json and `gradle.properties`).
- **Native module Firebase:** `@react-native-firebase/app`, `/auth`, `/firestore` — NOT `/messaging` (it conflicts with `expo-notifications` on a `default_notification_color` manifest meta-data; we removed messaging until we wire FCM properly).
- **Reanimated 4** is in use; it requires `react-native-worklets` and the babel plugin path is `react-native-worklets/plugin` (not `react-native-reanimated/plugin`).
- **Package name (Android):** `com.halalapps.netbac` — must match exactly in `app.json`, `android/app/build.gradle`, and the `package_name` inside `google-services.json`.
- **Google Sign-In:** uses `@react-native-google-signin/google-signin`. Webclient ID lives in `src/lib/authConfig.ts`. SHA-1 of the dev-client signing key must be registered in Firebase before Google sign-in works.
- **Per-user data isolation:** zustand store dynamically swaps its persist key by Firebase UID via `switchStoreToUser()` in `src/lib/store.ts`, called from the `AuthGate` in `app/_layout.tsx`.

## Host prerequisites — verify and install if missing

Run these checks before anything else. Report what's there and what's missing.

```bash
# Versions
node --version     # need >= 20
npm --version
java -version 2>&1 # need JDK 17 — RN 0.81 / Gradle 8.x will fail on JDK 11 or JDK 21
echo $ANDROID_HOME # should point to ~/Android/Sdk

# Android SDK pieces
ls $ANDROID_HOME/build-tools/        # need 36.0.0 (or whatever expo54 picks)
ls $ANDROID_HOME/platforms/          # need android-36
ls $ANDROID_HOME/ndk/                # need 27.x
ls $ANDROID_HOME/platform-tools/adb  # adb binary

# Waydroid
waydroid --version
systemctl status waydroid-container
```

If JDK 17 isn't installed: `sudo apt install openjdk-17-jdk` and set `JAVA_HOME` to it.
If Android SDK is missing: install Android Studio command-line tools and use `sdkmanager` to grab `build-tools;36.0.0`, `platforms;android-36`, `ndk;27.1.12297006`, `platform-tools`.

## Waydroid — the part that fights back

This is where most of the friction lives. Do these checks in order; fix and re-verify before proceeding.

### 1. Container running?

```bash
sudo systemctl status waydroid-container
# If inactive:
sudo systemctl restart waydroid-container
```

If the unit doesn't exist or fails to start, reinstall: `sudo apt purge waydroid && sudo apt install waydroid` and then run `sudo waydroid init`.

### 2. Session running?

```bash
waydroid status
# Should show: Session: RUNNING and an IP like 192.168.240.112
```

If session is `STOPPED`, start the UI to bring it up:

```bash
waydroid show-full-ui
# or just:
waydroid session start
```

Wait until the Android home screen appears in the Waydroid window. If it boots-loops (Google logo forever), the most common fix is:

```bash
sudo waydroid shell -c 'settings put global hidden_api_policy 1'
sudo systemctl restart waydroid-container
waydroid session stop && waydroid session start
```

### 3. Get Waydroid's IP

```bash
waydroid status | grep -i ip
# Or:
ip addr show waydroid0 | grep inet
```

Note the IP — it's usually `192.168.240.112` but can vary.

### 4. Connect ADB

```bash
adb kill-server
adb start-server
adb connect 192.168.240.112:5555      # use the IP from step 3
adb devices
```

You should see one entry like `192.168.240.112:5555  device`.

**Common failure modes and fixes:**

- `unauthorized` — Inside Waydroid: Settings → System → Developer options → enable USB debugging, and accept the RSA fingerprint dialog when it pops up. If you've never enabled developer mode, tap "Build number" 7 times in About first.
- `offline` — Restart adb (`adb kill-server && adb start-server`) and reconnect.
- `cannot connect: Connection refused` — Waydroid's adbd isn't listening. Run inside Waydroid shell: `waydroid shell` then `setprop persist.adb.tcp.port 5555 && stop adbd && start adbd`. Then reconnect from host.
- `no devices/emulators found` even though Waydroid is running — port 5555 isn't open. Same fix as Connection refused.

Do not move on until `adb devices` lists Waydroid as `device` (not `unauthorized`, not `offline`).

## Project setup

Assume the source is already cloned to `~/projects/netbac` (sync from the other machine via git, rsync, or whatever). If not, ask me where it is.

### 1. Per-machine files that won't be in git

- `google-services.json` (project root) — I'll provide it. It must match `com.halalapps.netbac`. If you don't have one yet, ask me to download it from Firebase Console → Project Settings → General → Android app → Download `google-services.json`.
- `android/local.properties` — write with `sdk.dir=/home/<user>/Android/Sdk` (use the actual home path).

### 2. Install dependencies

```bash
npm install --legacy-peer-deps
```

`--legacy-peer-deps` is required — `expo-router` and `react-native-safe-area-context` have a peerDep skirmish that npm 10+ can't auto-resolve.

### 3. Sanity-check the config files

After install, verify these match the working PC exactly:

- `app.json` — `expo.android.package` is `com.halalapps.netbac`, `newArchEnabled` is `true`, `googleServicesFile` is `./google-services.json`, plugins include `@react-native-firebase/app` and `@react-native-firebase/auth` and `expo-build-properties`.
- `babel.config.js` — plugin is `react-native-worklets/plugin`, NOT `react-native-reanimated/plugin`.
- `package.json` — these MUST be present:
  - `"expo": "^54.0.0"`
  - `"react-native": "0.81.5"`, `"react": "19.1.0"`
  - `"react-native-reanimated": "~4.1.1"`, `"react-native-worklets": "0.5.x"`
  - `"@react-native-firebase/app"`, `"/auth"`, `"/firestore"` at v22+
  - `"@react-native-google-signin/google-signin"` at v16+
  - `"expo-dev-client"`
  - **NO** `@react-native-firebase/messaging` (will cause manifest merge conflict).
- `src/lib/authConfig.ts` — `GOOGLE_WEB_CLIENT_ID` is non-empty (the Web Client ID from Firebase → Authentication → Sign-in method → Google → Web SDK config).

If any of these are wrong, fix them.

### 4. Generate android/

```bash
rm -rf android
npx expo prebuild --platform android
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
```

Verify after prebuild:
- `android/app/google-services.json` exists (copied from project root by the Expo plugin).
- `android/build.gradle` contains `classpath 'com.google.gms:google-services:4.x'`.
- `android/app/build.gradle` contains `apply plugin: 'com.google.gms.google-services'`.
- `android/gradle.properties` has `newArchEnabled=true`.
- `android/app/build.gradle` namespace and applicationId are `com.halalapps.netbac`.

### 5. TypeScript clean check

```bash
npx tsc --noEmit
```

Should pass with zero errors in app code. Test files (`__tests__/*`) may have unrelated `@types/jest` errors — ignore those.

### 6. JS bundle smoke test

```bash
rm -rf /tmp/netbac-export
npx expo export --platform android --output-dir /tmp/netbac-export --no-minify
```

Should bundle ~3700 modules cleanly into a `.hbc` file. If it fails, fix before building gradle. Common causes: missing `react-native-worklets`, wrong babel plugin, deps out of sync.

### 7. Build the dev-client APK

**This is the gradle step. Hand the command to me, do not run it yourself.**

Tell me to run:

```bash
cd ~/projects/netbac/android && ./gradlew assembleDebug
```

This takes 5–10 minutes on a 16GB machine, longer on lower RAM. If RAM < 8GB, suggest I edit `android/gradle.properties` and lower `org.gradle.jvmargs=-Xmx2048m` to `-Xmx1536m` first.

After the build, the APK lands at `android/app/build/outputs/apk/debug/app-debug.apk` (~200 MB — debug build is fat, that's normal).

### 8. Sideload into Waydroid

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

The `-r` flag replaces any existing install. If you get `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, uninstall first: `adb uninstall com.halalapps.netbac`.

### 9. Start Metro and connect

```bash
npx expo start --dev-client
```

Inside Waydroid, open the **NETBAC** app icon. First launch shows the dev-client connection screen. Either:
- Tap "Enter URL manually" and paste `http://<host-LAN-IP>:8081` (your *PC's* LAN IP, not Waydroid's), or
- Use `adb reverse tcp:8081 tcp:8081` on the host first, then enter `http://localhost:8081` inside the app — usually the simplest path with Waydroid.

```bash
adb reverse tcp:8081 tcp:8081
```

After connection: app loads, no Firebase session, redirects to `/login`. Sign up or log in to verify end-to-end.

## Gotchas to anticipate (these all bit me on the first machine)

- **Manifest merge: `default_notification_color`** — if `@react-native-firebase/messaging` got installed for any reason, it'll conflict with `expo-notifications`. Solution: remove messaging (`npm uninstall @react-native-firebase/messaging`) and re-prebuild.
- **`Cannot read property 'NativeModule' of undefined`** — caused by `newArchEnabled` mismatch between `app.json` and `android/gradle.properties`. Both must agree (both `true` in our setup).
- **`SDK location not found`** — `android/local.properties` is missing. Always write it after prebuild.
- **`auth/operation-not-allowed`** — Email/Password sign-in is disabled in Firebase Console. Tell me to enable it: Authentication → Sign-in method → Email/Password → Enable.
- **Google sign-in returns no idToken** — Web Client ID in `authConfig.ts` is wrong, or this machine's debug keystore SHA-1 isn't registered in Firebase. Get the SHA-1 with `keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android`, paste it into Firebase Console → Project Settings → Your apps → Android → Add fingerprint, then download a fresh `google-services.json` and replace the project-root one, then re-prebuild.
- **Hot reload doesn't fire** — `adb reverse` link broke. Re-run `adb reverse tcp:8081 tcp:8081`. Or shake the phone (in Waydroid, Ctrl+M usually opens dev menu) and tap Reload.
- **deprecation warnings about `auth().onAuthStateChanged`** — those are RN-Firebase v22 deprecation warnings. The codebase uses the modular API (`onAuthStateChanged(auth, cb)`). If you see them, something imported the namespaced API by accident — grep for `auth()` and `firestore()` calls and migrate them.

## Smoke test checklist when done

- [ ] `adb devices` → Waydroid shows as `device`
- [ ] App opens in Waydroid, lands on `/login`
- [ ] Sign up with email + password → email verification sent → redirected to login
- [ ] Log in → land on dashboard, header shows the name from signup
- [ ] Tap logout icon (top-right of dashboard) → confirmation dialog → confirm → back to login
- [ ] "Continuer avec Google" → Google account picker → home
- [ ] Kill app, reopen → still logged in (session persistence)
- [ ] Edit any JS file, save → Waydroid updates within 1–2 seconds via Fast Refresh

## Operating principles for this session

- **Hand over gradle.** Every `./gradlew ...` command — copy it into a code block, tell me to run it in another terminal, and wait for me to report back.
- **Check before you change.** If something looks wrong (e.g. wrong package name, wrong gradle plugin), confirm with me before deleting/regenerating.
- **Never re-prebuild without warning.** `expo prebuild --clean` wipes `android/` including the keystore. Always tell me first; we'll back up the keystore to `/tmp/netbac-keystores-backup/` before destructive prebuild.
- **Don't introduce new dependencies** unless absolutely required by the workflow above.
- **Don't change app code semantics.** This is environment setup, not feature work.

Start by verifying the host prerequisites. Report findings. We'll go step-by-step from there.
