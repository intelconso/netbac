// Droits d'accès du compte connecté : essai, abonnement, lecture seule.
//
// Réunit les trois sources (voir subscription.ts), tient `useAccess` à jour
// pour les écrans, et pose le verrou de writeGate qui met le store en lecture
// seule. Le serveur applique la même règle dans firestore.rules — ce module ne
// fait qu'éviter d'envoyer des écritures qu'il refuserait.
import { AppState as RNAppState, Platform } from 'react-native';
import { create } from 'zustand';
import * as Application from 'expo-application';
import {
  doc,
  getDocFromServer,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from '@react-native-firebase/firestore';
import { getIdToken, getIdTokenResult } from '@react-native-firebase/auth';
import { auth, db } from './firebase';
import {
  Access,
  DAY_MS,
  SubscriptionDoc,
  claimsHavePro,
  isReadOnly,
  parseSubscriptionDoc,
  resolveAccess,
  trialDeviceKey,
} from './subscription';
import { fetchCustomerInfo, hasPro, initPurchases, onCustomerInfo, resetPurchases } from './purchases';
import { onWriteLockChange, setWriteLocked } from './writeGate';
import { resyncActive } from './sync';
import { processPhotoQueue } from './photoQueue';

type AccessStore = {
  // undefined = pas encore lu, null = lu et absent (création en cours).
  doc: SubscriptionDoc | null | undefined;
  proFromStore: boolean;
  proFromClaims: boolean;
  managementURL: string | null;
  // Simulateur de développement — voir setSimulatedAccess. Ignoré hors __DEV__.
  simulated: SimulatedAccess | null;
  access: Access;
};

export type SimulatedAccess = 'trial-25' | 'trial-3' | 'expired' | 'trial-used' | 'active';

const INITIAL: AccessStore = {
  doc: undefined,
  proFromStore: false,
  proFromClaims: false,
  managementURL: null,
  simulated: null,
  access: { kind: 'unknown' },
};

export const useAccess = create<AccessStore>(() => ({ ...INITIAL }));

function recompute(): void {
  const s = useAccess.getState();
  const now = Date.now();
  const sim = __DEV__ ? s.simulated : null;
  const access = sim
    ? simulatedAccess(sim, now)
    : resolveAccess({ doc: s.doc, proActive: s.proFromStore || s.proFromClaims, now });
  useAccess.setState({ access });
  setWriteLocked(isReadOnly(access));
}

function simulatedAccess(sim: SimulatedAccess, now: number): Access {
  switch (sim) {
    case 'trial-25': return { kind: 'trial', endsAt: now + 25 * DAY_MS - 1, daysLeft: 25 };
    case 'trial-3': return { kind: 'trial', endsAt: now + 3 * DAY_MS - 1, daysLeft: 3 };
    case 'expired': return { kind: 'expired', trialEndedAt: now - DAY_MS };
    case 'trial-used': return { kind: 'expired', reason: 'trial-used' };
    case 'active': return { kind: 'active' };
  }
}

// Simulateur de développement : force un état d'abonnement pour essayer le
// bandeau, l'écran d'abonnement et la lecture seule sans rien déployer. Agit
// sur l'app seulement — le serveur n'en sait rien — et n'existe qu'en __DEV__ :
// une build de production ignore `simulated` dans recompute(). Remis à zéro à
// la déconnexion et au rechargement de l'app.
export function setSimulatedAccess(sim: SimulatedAccess | null): void {
  if (!__DEV__) return;
  useAccess.setState({ simulated: sim });
  recompute();
}

// Relit les claims du jeton. `force` : après un achat, l'extension RevenueCat
// pose le claim quelques secondes plus tard — le jeton en cache ne l'a pas.
async function refreshClaims(force: boolean): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  try {
    if (force) await getIdToken(user, true);
    const result = await getIdTokenResult(user);
    useAccess.setState({ proFromClaims: claimsHavePro(result.claims as Record<string, unknown>) });
    recompute();
  } catch {
    /* hors ligne : on garde la dernière valeur */
  }
}

// Après un achat ou une restauration : relit le jeton jusqu'à ce que le claim
// arrive, puis relance la synchro (les règles Firestore lisent le claim).
export function afterPurchase(): void {
  for (const delay of [3_000, 10_000, 30_000]) {
    setTimeout(() => {
      refreshClaims(true).then(() => resyncActive()).catch(() => {});
    }, delay);
  }
}

async function deviceKey(): Promise<string | null> {
  try {
    if (Platform.OS === 'android') return trialDeviceKey('a', Application.getAndroidId());
    if (Platform.OS === 'ios') return trialDeviceKey('i', await Application.getIosIdForVendorAsync());
  } catch { /* pas d'identifiant : pas d'essai pour l'instant, on réessaiera */ }
  return null;
}

// Compte neuf : essai si ce téléphone n'en a jamais eu, sinon `noTrial`.
// L'essai et l'inscription du téléphone partent dans UN lot : les règles
// n'acceptent l'un qu'avec l'autre, donc un téléphone ne peut pas servir deux
// essais même si deux comptes s'ouvrent en même temps dessus.
async function createSubscription(uid: string): Promise<void> {
  const key = await deviceKey();
  if (!key) throw new Error('no-device-id');
  const subRef = doc(db, 'subscriptions', uid);
  const devRef = doc(db, 'trialDevices', key);
  const dev = await getDocFromServer(devRef);
  const devExists = typeof (dev as any).exists === 'function' ? (dev as any).exists() : !!(dev as any).exists;
  const owner = devExists ? (dev.data() as any)?.uid : null;
  if (devExists && owner !== uid) {
    await setDoc(subRef, { noTrial: true });
    return;
  }
  const batch = writeBatch(db);
  if (!devExists) batch.set(devRef, { uid, createdAt: serverTimestamp() });
  batch.set(subRef, { trialStartedAt: serverTimestamp(), trialDevice: key });
  await batch.commit();
}

const cleanups: (() => void)[] = [];
let activeUid: string | null = null;

// Démarre le suivi pour `uid`. La promesse se résout dès que le document
// d'abonnement est connu (ou après 4 s, hors ligne) : la synchro ne doit pas
// pousser avant que l'essai soit créé, sans quoi les règles la refuseraient.
export function startAccess(uid: string): Promise<void> {
  if (activeUid === uid) return Promise.resolve();
  stopAccess();
  activeUid = uid;

  let settle: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    settle = resolve;
    setTimeout(resolve, 4_000);
  });

  // 1. Document d'abonnement. Absent ET confirmé par le serveur (pas lu du
  //    cache) = compte neuf : on crée l'essai, daté par le serveur — ou
  //    `noTrial` si le téléphone a déjà eu le sien (createSubscription). Les
  //    règles n'acceptent cette création qu'une fois, avec `request.time`.
  //    Absent mais lu du cache = on ne sait pas encore — surtout ne rien
  //    créer, un compte offert verrait son document écrasé localement.
  const ref = doc(db, 'subscriptions', uid);
  let creating = false;
  const unsubDoc = onSnapshot(
    ref,
    { includeMetadataChanges: true },
    (snap: any) => {
      const exists = typeof snap.exists === 'function' ? snap.exists() : !!snap.exists;
      if (exists) {
        const parsed = parseSubscriptionDoc(snap.data());
        useAccess.setState({ doc: parsed });
        recompute();
        if (parsed.comp || parsed.noTrial || typeof parsed.trialStartedAt === 'number') settle();
        return;
      }
      if (snap.metadata?.fromCache) return;
      useAccess.setState({ doc: null });
      recompute();
      if (!creating) {
        creating = true;
        createSubscription(uid).catch(() => { creating = false; });
      }
    },
    () => { settle(); },
  );
  cleanups.push(unsubDoc);

  // 2. RevenueCat (no-op tant que les clés ne sont pas renseignées).
  initPurchases(uid)
    .then(() => fetchCustomerInfo())
    .then((info) => {
      if (activeUid !== uid) return;
      useAccess.setState({ proFromStore: hasPro(info), managementURL: info?.managementURL ?? null });
      recompute();
      cleanups.push(onCustomerInfo((next) => {
        useAccess.setState({ proFromStore: hasPro(next), managementURL: next.managementURL ?? null });
        recompute();
      }));
    })
    .catch(() => {});

  // 3. Claim posé par l'extension RevenueCat — vaut aussi hors des stores
  //    (abonnement pris sur l'autre plateforme, avec le même compte).
  refreshClaims(false);

  // 4. L'essai expire avec le temps, pas sur un événement : on recalcule
  //    chaque minute et au retour au premier plan.
  const tick = setInterval(recompute, 60_000);
  cleanups.push(() => clearInterval(tick));
  const sub = RNAppState.addEventListener('change', (next) => {
    if (next === 'active') { recompute(); refreshClaims(false); }
  });
  cleanups.push(() => sub.remove());

  // 5. Déverrouillage → on rattrape : synchro complète, et la file photo
  //    qui attendait.
  cleanups.push(onWriteLockChange((locked) => {
    if (locked) return;
    resyncActive();
    processPhotoQueue().catch(() => {});
  }));

  return ready;
}

export function stopAccess(): void {
  while (cleanups.length) {
    try { cleanups.pop()!(); } catch { /* ignore */ }
  }
  if (activeUid) resetPurchases().catch(() => {});
  activeUid = null;
  useAccess.setState({ ...INITIAL });
  setWriteLocked(false);
}
