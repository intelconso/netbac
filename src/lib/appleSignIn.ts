// Sign in with Apple — iOS seulement.
//
// Exigé par Apple dès qu'une app propose une connexion tierce (ici Google) :
// sans lui, la revue App Store refuse l'app. Sur Android, rien ici ne
// s'exécute — le module natif n'existe que sur iOS, d'où le require paresseux.
//
// Un compte Apple est un compte Firebase à part, comme un compte Google : un
// restaurant qui se connecte une fois par Apple et une fois par Google a deux
// comptes, donc deux inventaires. Il faut toujours revenir par le même bouton.
import { Platform } from 'react-native';
import { AppleAuthProvider, signInWithCredential } from '@react-native-firebase/auth';
import { auth } from './firebase';

function appleModule(): any | null {
  if (Platform.OS !== 'ios') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-apple-authentication');
  } catch {
    return null;
  }
}

export async function appleSignInAvailable(): Promise<boolean> {
  const mod = appleModule();
  if (!mod) return false;
  try { return await mod.isAvailableAsync(); } catch { return false; }
}

export function isAppleCancel(e: any): boolean {
  return e?.code === 'ERR_REQUEST_CANCELED';
}

// Demande à Apple un jeton frais. Sert à la connexion ET à la suppression du
// compte : Apple exige alors de révoquer le jeton, avec un `authorizationCode`
// qu'on n'obtient qu'en redemandant.
async function requestApple(): Promise<{ identityToken: string; authorizationCode: string | null; fullName: any }> {
  const mod = appleModule();
  if (!mod) throw new Error('Connexion Apple indisponible sur cet appareil.');
  const res = await mod.signInAsync({
    requestedScopes: [
      mod.AppleAuthenticationScope.FULL_NAME,
      mod.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!res.identityToken) throw new Error('Apple n’a pas renvoyé de jeton.');
  return { identityToken: res.identityToken, authorizationCode: res.authorizationCode ?? null, fullName: res.fullName };
}

export async function signInWithApple() {
  const { identityToken, fullName } = await requestApple();
  const credential = AppleAuthProvider.credential(identityToken);
  const cred = await signInWithCredential(auth, credential);
  // Apple ne donne le nom qu'à la toute première connexion.
  const name = [fullName?.givenName, fullName?.familyName].filter(Boolean).join(' ').trim();
  if (name && cred.user && !cred.user.displayName) {
    try { await cred.user.updateProfile({ displayName: name }); } catch { /* sans gravité */ }
  }
  return cred;
}

// Pour la suppression du compte : réauthentifie (Firebase l'exige avant
// deleteUser) puis révoque le jeton Apple (Apple l'exige).
export async function reauthAndRevokeApple(): Promise<void> {
  const { identityToken, authorizationCode } = await requestApple();
  const user = auth.currentUser;
  if (!user) throw new Error('Aucun utilisateur connecté.');
  await user.reauthenticateWithCredential(AppleAuthProvider.credential(identityToken));
  if (authorizationCode) {
    try { await (auth as any).revokeToken(authorizationCode); } catch { /* le compte sera quand même supprimé */ }
  }
}
