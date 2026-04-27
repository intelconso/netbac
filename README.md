# NETBAC Mobile

HACCP traceability app for restaurants — React Native / Expo.

## Prerequisites

- Node.js 18+
- Expo Go app on your phone (or iOS Simulator / Android Emulator)

## Setup

```bash
npm install
npm start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS).

## Commands

- `npm start` — start the dev server
- `npm run ios` — open in iOS Simulator
- `npm run android` — open in Android Emulator
- `npm run lint` — typecheck

## Stack

- Expo SDK 51 + Expo Router (file-based nav)
- React Native 0.74 + React 18
- NativeWind v4 (Tailwind for RN)
- Zustand + AsyncStorage (persisted store)
- lucide-react-native (icons)
- date-fns

## Structure

- `app/` — screens and routing (Expo Router)
  - `(tabs)/` — bottom-tab screens (Dashboard, Alerts, Reports, Admin)
  - `bac/[id].tsx`, `unit/[id].tsx` — dynamic routes
  - `add-product.tsx`, `express-add.tsx`, `labels.tsx`, `journal.tsx`, `history.tsx`, `reports.tsx`
- `src/components/` — shared components (ProductLabel)
- `src/lib/` — store, utils
- `src/types.ts` — domain types

## Notes

PDF export, camera scan, and share are stubbed (static). To enable:
- PDF: `expo-print` + `expo-sharing`
- Camera: `expo-camera`
- Share: `expo-sharing` or `react-native` Share API
