// Abonnement — logique pure, sans Firebase ni RevenueCat.
//
// Un abonnement = un restaurant = un compte Firebase (tous les téléphones du
// restaurant partagent le même compte). Trois sources disent si le compte a
// le droit d'ÉCRIRE :
//
//   - `subscriptions/{uid}.comp`           compte offert (comptes d'avant le
//                                          modèle payant, comptes de démo)
//   - `subscriptions/{uid}.trialStartedAt` essai gratuit, horodaté par le
//                                          SERVEUR à la première ouverture
//   - `subscriptions/{uid}.noTrial`        compte créé sur un téléphone qui a
//                                          déjà eu son essai (voir
//                                          trialDeviceKey) : pas d'essai
//   - l'entitlement RevenueCat `pro`       abonnement payé via les stores
//
// Ce module ne fait que trancher. Les règles Firestore (firestore.rules)
// tranchent la même chose côté serveur — c'est elles qui font foi ; ce qui
// est calculé ici sert à l'écran, pas à la sécurité.
//
// Expiré ne veut PAS dire verrouillé dehors : un registre HACCP doit rester
// consultable par un contrôleur. Expiré = lecture seule — historique,
// rapports et exports PDF fonctionnent, toute saisie est bloquée.

export const TRIAL_DAYS = 30;
export const PRO_ENTITLEMENT = 'pro';
export const DAY_MS = 24 * 60 * 60 * 1000;

// Ce qu'on a lu de `subscriptions/{uid}`, dates déjà converties en ms.
export type SubscriptionDoc = {
  trialStartedAt?: number;
  comp?: boolean;
  noTrial?: boolean;
};

export type Access =
  // Pas encore lu (premier démarrage hors ligne, ou document en création).
  // Jamais traité comme expiré : on ne bloque pas un restaurant sur une
  // absence de réseau — le serveur, lui, refusera s'il le faut.
  | { kind: 'unknown' }
  | { kind: 'comp' }
  | { kind: 'active' }
  | { kind: 'trial'; endsAt: number; daysLeft: number }
  // `reason: 'trial-used'` : jamais eu d'essai, le téléphone l'avait déjà
  // consommé avec un autre compte.
  | { kind: 'expired'; trialEndedAt?: number; reason?: 'trial-used' };

export function trialEndsAt(trialStartedAt: number): number {
  return trialStartedAt + TRIAL_DAYS * DAY_MS;
}

// Jours restants arrondis au-dessus : il reste « 1 jour » jusqu'à la toute
// dernière milliseconde de l'essai, jamais « 0 jour » tant qu'il court.
export function trialDaysLeft(trialStartedAt: number, now: number): number {
  return Math.max(0, Math.ceil((trialEndsAt(trialStartedAt) - now) / DAY_MS));
}

// `doc` : undefined = pas encore lu, null = lu et absent.
export function resolveAccess(input: {
  doc: SubscriptionDoc | null | undefined;
  proActive: boolean;
  now: number;
}): Access {
  const { doc, proActive, now } = input;
  if (doc?.comp) return { kind: 'comp' };
  if (proActive) return { kind: 'active' };
  if (doc?.noTrial && typeof doc.trialStartedAt !== 'number') return { kind: 'expired', reason: 'trial-used' };
  if (!doc || typeof doc.trialStartedAt !== 'number') return { kind: 'unknown' };
  const endsAt = trialEndsAt(doc.trialStartedAt);
  if (now < endsAt) {
    return { kind: 'trial', endsAt, daysLeft: trialDaysLeft(doc.trialStartedAt, now) };
  }
  return { kind: 'expired', trialEndedAt: endsAt };
}

export function isReadOnly(access: Access): boolean {
  return access.kind === 'expired';
}

// Claims posés par l'extension Firebase de RevenueCat sur le jeton du compte.
export function claimsHavePro(claims: Record<string, unknown> | null | undefined): boolean {
  const list = claims?.revenueCatEntitlements;
  return Array.isArray(list) && list.includes(PRO_ENTITLEMENT);
}

// Lecture tolérante d'une date Firestore : Timestamp, nombre, ou rien.
// Un serverTimestamp() encore en attente se lit `null` — traité comme absent,
// le snapshot suivant (confirmé par le serveur) portera la vraie date.
export function toMillis(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof (value as any).toMillis === 'function') {
    const ms = (value as any).toMillis();
    return typeof ms === 'number' && Number.isFinite(ms) ? ms : undefined;
  }
  return undefined;
}

export function parseSubscriptionDoc(data: Record<string, unknown> | undefined | null): SubscriptionDoc {
  if (!data) return {};
  return {
    trialStartedAt: toMillis(data.trialStartedAt),
    comp: data.comp === true,
    noTrial: data.noTrial === true,
  };
}

// Un essai PAR TÉLÉPHONE, pas seulement par compte : sans quoi recréer un
// compte Google rendrait 30 jours de plus. La clé est l'identifiant du
// téléphone propre à l'app (Android ID — stable aux réinstallations, change
// seulement à la remise à zéro d'usine ; identifierForVendor sur iOS). Elle
// sert d'id de document dans `trialDevices/`, d'où le nettoyage : un id
// Firestore ne peut pas contenir de « / ».
// Contournable par une remise à zéro du téléphone : c'est voulu, la barrière
// vise l'abus ordinaire — le vrai frein reste l'historique HACCP qu'un compte
// neuf n'a pas.
export function trialDeviceKey(platform: string, rawId: string | null | undefined): string | null {
  const id = (rawId ?? '').trim().replace(/[^A-Za-z0-9_-]/g, '');
  if (id.length < 8) return null;
  return `${platform}_${id}`;
}
