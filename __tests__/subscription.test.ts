// Abonnement : qui a le droit d'écrire, et ce que fait la lecture seule.
//
// Deux promesses verrouillées ici. Le CALCUL des droits — un compte offert ou
// payé n'expire jamais, l'essai s'arrête pile à 30 jours, et l'absence de
// réseau ne vaut jamais expiration. Et le VERROU du store — en lecture seule
// toute saisie est refusée, y compris une action ajoutée plus tard, mais la
// fusion du cloud continue : un compte expiré voit toujours ses données.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ALWAYS_ALLOWED_ACTIONS,
  BLOCKED_RESULTS,
  SILENT_BLOCKED_ACTIONS,
  useStore,
} from '../src/lib/store';
import {
  DAY_MS,
  TRIAL_DAYS,
  claimsHavePro,
  isReadOnly,
  parseSubscriptionDoc,
  resolveAccess,
  trialDaysLeft,
  trialDeviceKey,
} from '../src/lib/subscription';
import { setOnWriteBlocked, setWriteLocked } from '../src/lib/writeGate';

const initialState = useStore.getState();

beforeEach(async () => {
  await AsyncStorage.clear();
  setWriteLocked(false);
  setOnWriteBlocked(null);
  useStore.setState(initialState, true);
  useStore.persist.setOptions({ name: 'netbac-storage' });
});

afterAll(() => setWriteLocked(false));

const START = Date.UTC(2026, 10, 1, 9, 0, 0);
const END = START + TRIAL_DAYS * DAY_MS;

describe('un essai par téléphone', () => {
  it('noTrial : lecture seule d’emblée, mais un abonnement ou un accès offert passent', () => {
    const doc = { noTrial: true };
    expect(resolveAccess({ doc, proActive: false, now: START })).toEqual({ kind: 'expired', reason: 'trial-used' });
    expect(isReadOnly(resolveAccess({ doc, proActive: false, now: START }))).toBe(true);
    expect(resolveAccess({ doc, proActive: true, now: START }).kind).toBe('active');
    expect(resolveAccess({ doc: { noTrial: true, comp: true }, proActive: false, now: START }).kind).toBe('comp');
  });

  it('parseSubscriptionDoc lit noTrial', () => {
    expect(parseSubscriptionDoc({ noTrial: true }).noTrial).toBe(true);
    expect(parseSubscriptionDoc({ trialStartedAt: START }).noTrial).toBe(false);
  });

  it('trialDeviceKey : préfixe la plateforme, nettoie, refuse un identifiant absent ou trop court', () => {
    expect(trialDeviceKey('a', '9774d56d682e549c')).toBe('a_9774d56d682e549c');
    expect(trialDeviceKey('i', 'E621E1F8-C36C-495A-93FC-0C247A3E6E5F')).toBe('i_E621E1F8-C36C-495A-93FC-0C247A3E6E5F');
    expect(trialDeviceKey('a', 'ab/cd/ef/gh')).toBe('a_abcdefgh');
    expect(trialDeviceKey('a', null)).toBeNull();
    expect(trialDeviceKey('a', 'short')).toBeNull();
  });
});

describe('resolveAccess', () => {
  it('essai en cours jusqu’à la dernière milliseconde, expiré à la frontière exacte', () => {
    const doc = { trialStartedAt: START };
    expect(resolveAccess({ doc, proActive: false, now: END - 1 }).kind).toBe('trial');
    expect(resolveAccess({ doc, proActive: false, now: END }).kind).toBe('expired');
  });

  it('jours restants arrondis au-dessus, jamais négatifs', () => {
    expect(trialDaysLeft(START, START)).toBe(TRIAL_DAYS);
    expect(trialDaysLeft(START, END - 1)).toBe(1);
    expect(trialDaysLeft(START, END + 5 * DAY_MS)).toBe(0);
  });

  it('compte offert : jamais expiré, même essai terminé depuis longtemps', () => {
    const a = resolveAccess({ doc: { comp: true, trialStartedAt: START }, proActive: false, now: END + 365 * DAY_MS });
    expect(a.kind).toBe('comp');
    expect(isReadOnly(a)).toBe(false);
  });

  it('abonnement payé : prime sur un essai terminé', () => {
    expect(resolveAccess({ doc: { trialStartedAt: START }, proActive: true, now: END + DAY_MS }).kind).toBe('active');
  });

  it('document pas encore lu, ou absent, ou date serveur en attente : inconnu, donc pas verrouillé', () => {
    for (const doc of [undefined, null, {}]) {
      const a = resolveAccess({ doc, proActive: false, now: END + DAY_MS });
      expect(a.kind).toBe('unknown');
      expect(isReadOnly(a)).toBe(false);
    }
  });
});

describe('lecture des sources', () => {
  it('claim RevenueCat : seul l’entitlement pro compte', () => {
    expect(claimsHavePro({ revenueCatEntitlements: ['pro'] })).toBe(true);
    expect(claimsHavePro({ revenueCatEntitlements: ['autre'] })).toBe(false);
    expect(claimsHavePro({ revenueCatEntitlements: 'pro' })).toBe(false);
    expect(claimsHavePro(null)).toBe(false);
  });

  it('document Firestore : Timestamp converti, serverTimestamp en attente ignoré', () => {
    expect(parseSubscriptionDoc({ trialStartedAt: { toMillis: () => START } })).toEqual({ trialStartedAt: START, comp: false, noTrial: false });
    expect(parseSubscriptionDoc({ trialStartedAt: null, comp: true })).toEqual({ trialStartedAt: undefined, comp: true, noTrial: false });
    expect(parseSubscriptionDoc(undefined)).toEqual({});
  });
});

describe('verrou du store', () => {
  it('lecture seule : une saisie est refusée et ouvre l’écran d’abonnement', () => {
    const blocked: string[] = [];
    setOnWriteBlocked((a) => blocked.push(a));
    setWriteLocked(true);
    useStore.getState().addZone({ name: 'Cuisine', type: 'cuisine' } as any);
    expect(useStore.getState().zones).toHaveLength(0);
    expect(blocked).toEqual(['addZone']);
  });

  it('le ménage automatique est refusé sans ouvrir l’écran', () => {
    const blocked: string[] = [];
    setOnWriteBlocked((a) => blocked.push(a));
    setWriteLocked(true);
    expect(useStore.getState().purgeExpiredNotes()).toBe(0);
    expect(useStore.getState().autoUseStaleLabels()).toBe(0);
    expect(blocked).toEqual([]);
  });

  it('les actions dont on lit le retour rendent une forme neutre, pas undefined', () => {
    setWriteLocked(true);
    const r = useStore.getState().addSupplier({ name: 'Metro' });
    expect(r.ok).toBe(false);
    expect(useStore.getState().addProduct({} as any)).toBe('');
  });

  it('la fusion du cloud passe toujours : un compte expiré voit ses données', () => {
    setWriteLocked(true);
    useStore.getState().applyCloudState({ zones: [{ id: 'z1', name: 'Cuisine', type: 'cuisine', modifiedAt: 1 } as any] });
    expect(useStore.getState().zones.map((z) => z.id)).toEqual(['z1']);
  });

  it('déverrouillé : tout refonctionne', () => {
    setWriteLocked(true);
    setWriteLocked(false);
    useStore.getState().addZone({ name: 'Cuisine', type: 'cuisine' } as any);
    expect(useStore.getState().zones).toHaveLength(1);
  });

  it('les listes du verrou ne nomment que des actions qui existent', () => {
    const state = useStore.getState() as unknown as Record<string, unknown>;
    const names = [...ALWAYS_ALLOWED_ACTIONS, ...SILENT_BLOCKED_ACTIONS, ...Object.keys(BLOCKED_RESULTS)];
    for (const n of names) expect(typeof state[n]).toBe('function');
  });
});
