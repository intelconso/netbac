---
name: Never run gradle builds on user's machine
description: User's PC freezes during gradle builds — always hand them the command instead of running it
type: feedback
originSessionId: 51be24ec-f89d-42dc-9c28-5382e7d824c4
---
Never run `./gradlew ...` (assembleDebug, assembleRelease, clean, etc.) directly — not in foreground, not in background. The user's machine freezes when these run.

Other commands are fine to run normally: `npm install`, `npx expo install`, `npx expo prebuild`, `npx expo export`, `npx tsc`, etc.

**Why:** User reported repeated PC freezes specifically during gradle invocations. Confirmed twice in the SDK 54 + Firebase setup work — once on `assembleRelease`, once on `assembleDebug`. They explicitly asked me to stop running gradle builds going forward.

**How to apply:** When a gradle build is needed (dev client APK, release APK, gradle clean, etc.), output the exact command in a code block and ask them to run it in a separate terminal. Wait for them to report success/failure or paste output. Same applies to any equivalent heavy native task that invokes gradle under the hood (e.g. `npx expo run:android` does — hand it over).
