// Suppression du compte depuis l'app — exigée par Apple (règle 5.1.1(v)) pour
// toute app qui permet d'en créer un.
//
// Ce qui part : le document `users/{uid}` (tout l'état du restaurant), la
// copie locale sur CE téléphone, et le compte de connexion Firebase.
// Ce qui reste, volontairement : `subscriptions/{uid}` et `trialDevices/` —
// sans eux, supprimer puis recréer son compte rendrait un essai neuf. Ils ne
// portent ni nom ni donnée du restaurant. Les photos déjà envoyées sur
// Cloudinary restent aussi (preset non signé : l'app ne peut pas effacer).
// L'abonnement payé n'est PAS résilié : seuls l'App Store / Google Play le
// peuvent, l'écran le dit avant de supprimer.
//
// Les autres téléphones du restaurant gardent leur copie locale jusqu'à leur
// prochaine ouverture, où la connexion échoue et les renvoie à l'accueil.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteDoc, doc } from '@react-native-firebase/firestore';
import { EmailAuthProvider, FirebaseAuthTypes } from '@react-native-firebase/auth';
import { auth, db } from './firebase';
import { useStore } from './store';
import { stopSync, startSync } from './sync';
import { stopPhotoQueue, startPhotoQueue } from './photoQueue';
import { reauthAndRevokeApple } from './appleSignIn';
import { reauthWithGoogle } from './googleSignIn';
import { GOOGLE_WEB_CLIENT_ID } from './authConfig';

export type SignInMethod = 'apple' | 'google' | 'password' | 'other';

export function signInMethod(user: FirebaseAuthTypes.User | null): SignInMethod {
  const ids = (user?.providerData ?? []).map((p) => p.providerId);
  if (ids.includes('apple.com')) return 'apple';
  if (ids.includes('google.com')) return 'google';
  if (ids.includes('password')) return 'password';
  return 'other';
}

async function reauthenticate(user: FirebaseAuthTypes.User, password?: string): Promise<void> {
  switch (signInMethod(user)) {
    case 'apple':
      return reauthAndRevokeApple();
    case 'google':
      return reauthWithGoogle(GOOGLE_WEB_CLIENT_ID);
    case 'password': {
      if (!user.email || !password) throw new Error('Mot de passe requis.');
      await user.reauthenticateWithCredential(EmailAuthProvider.credential(user.email, password));
      return;
    }
    default:
      return;
  }
}

export async function deleteAccount(opts: { password?: string } = {}): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Aucun utilisateur connecté.');
  const uid = user.uid;

  // 1. Prouver que c'est bien le titulaire. Rien n'est effacé avant.
  await reauthenticate(user, opts.password);

  // 2. Couper la synchro : sinon le prochain envoi recréerait le document.
  stopSync();
  stopPhotoQueue();

  // 3. Les données du restaurant dans le cloud.
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (e) {
    startSync(uid);
    startPhotoQueue();
    throw e;
  }

  // 4. La copie locale — vidée sous la clé de CE compte, puis la clé jetée.
  useStore.getState().resetState();
  try { await AsyncStorage.removeItem(`netbac-storage-${uid}`); } catch { /* vidée quand même */ }

  // 5. Le compte de connexion. L'AuthGate voit la déconnexion et renvoie à
  //    l'accueil (et arrête abonnement, synchro et file photo).
  await user.delete();
}

export function prettifyDeleteError(e: any): string {
  switch (e?.code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Mot de passe incorrect.';
    case 'auth/network-request-failed':
    case 'firestore/unavailable': return 'Pas de connexion réseau. Réessayez une fois en ligne.';
    case 'auth/too-many-requests': return 'Trop de tentatives. Réessayez plus tard.';
    case 'ERR_REQUEST_CANCELED': return '';
    default: return e?.message || 'La suppression a échoué.';
  }
}
