// RevenueCat — achats via l'App Store et Google Play.
//
// Les clés API viennent de app.json → expo.extra.revenuecat. Tant qu'elles
// sont vides (stores pas encore configurés), tout ici est un no-op :
// `purchasesAvailable()` rend false et l'écran d'abonnement affiche
// « bientôt disponible » au lieu d'un bouton qui échouerait.
//
// L'identifiant RevenueCat de l'utilisateur EST l'uid Firebase : c'est ce qui
// permet à l'extension Firebase de RevenueCat de poser l'entitlement sur le
// bon compte (claim `revenueCatEntitlements`, lu par firestore.rules).
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, {
  CustomerInfo,
  PurchasesPackage,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';
import { PRO_ENTITLEMENT } from './subscription';

type RevenueCatConfig = { iosApiKey?: string; androidApiKey?: string; testStoreApiKey?: string };

// En dev, le « Test Store » de RevenueCat : de vrais parcours d'achat, sans
// Play Console ni App Store Connect. Jamais en release — RevenueCat refuse
// une clé test_ dans une build de production.
function apiKey(): string {
  const cfg = (Constants.expoConfig?.extra?.revenuecat ?? {}) as RevenueCatConfig;
  if (__DEV__ && cfg.testStoreApiKey?.trim()) return cfg.testStoreApiKey.trim();
  const key = Platform.OS === 'ios' ? cfg.iosApiKey : Platform.OS === 'android' ? cfg.androidApiKey : '';
  return (key ?? '').trim();
}

let configured = false;
let currentUid: string | null = null;

export function purchasesAvailable(): boolean {
  return apiKey().length > 0;
}

export function hasPro(info: CustomerInfo | null | undefined): boolean {
  return !!info?.entitlements.active[PRO_ENTITLEMENT];
}

// Configure au premier appel, puis bascule d'utilisateur par logIn.
export async function initPurchases(uid: string): Promise<void> {
  if (!purchasesAvailable()) return;
  if (!configured) {
    Purchases.configure({ apiKey: apiKey(), appUserID: uid });
    configured = true;
    currentUid = uid;
    return;
  }
  if (currentUid !== uid) {
    await Purchases.logIn(uid);
    currentUid = uid;
  }
}

export async function resetPurchases(): Promise<void> {
  if (!configured || !currentUid) return;
  currentUid = null;
  try { await Purchases.logOut(); } catch { /* déjà anonyme */ }
}

export async function fetchCustomerInfo(): Promise<CustomerInfo | null> {
  if (!configured) return null;
  try { return await Purchases.getCustomerInfo(); } catch { return null; }
}

export function onCustomerInfo(listener: (info: CustomerInfo) => void): () => void {
  if (!configured) return () => {};
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => { Purchases.removeCustomerInfoUpdateListener(listener); };
}

// L'abonnement mensuel de l'offre courante (réglée dans RevenueCat).
export async function monthlyPackage(): Promise<PurchasesPackage | null> {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return null;
    return current.monthly ?? current.availablePackages[0] ?? null;
  } catch {
    return null;
  }
}

export type PurchaseOutcome =
  | { ok: true; info: CustomerInfo }
  | { ok: false; cancelled: boolean; error?: string };

export async function buy(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { ok: true, info: customerInfo };
  } catch (e: any) {
    const cancelled = e?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR || e?.userCancelled === true;
    return { ok: false, cancelled, error: cancelled ? undefined : e?.message ?? 'Achat impossible.' };
  }
}

export async function restore(): Promise<CustomerInfo | null> {
  if (!configured) return null;
  return Purchases.restorePurchases();
}
