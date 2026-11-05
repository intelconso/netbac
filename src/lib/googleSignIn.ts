// Google sign-in wrapper. Requires the native module
// @react-native-google-signin/google-signin to be installed and linked
// (which means a dev client rebuild). The import below is lazy so the JS
// bundle still loads if the package isn't installed yet.

import { signInWithGoogleIdToken } from './firebase';

let configured = false;

export async function signInWithGoogle(webClientId: string) {
  // Lazy require so the rest of the app works without the native module installed.
  let GoogleSignin: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
  } catch {
    throw new Error(
      'Module Google Sign-In non installé. Construisez un nouveau dev client après installation.'
    );
  }

  if (!configured) {
    GoogleSignin.configure({ webClientId });
    configured = true;
  }

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const signInResult: any = await GoogleSignin.signIn();
  // v13+: { type, data: { idToken, user, ... } }
  // v12 and below: { idToken, user, ... }
  const idToken: string | undefined = signInResult?.data?.idToken ?? signInResult?.idToken;
  if (!idToken) {
    throw new Error('Google n’a pas renvoyé d’idToken.');
  }
  return signInWithGoogleIdToken(idToken);
}

export async function signOutGoogle() {
  let GoogleSignin: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
  } catch {
    return;
  }
  try {
    await GoogleSignin.signOut();
  } catch {
    /* ignore */
  }
}

// Pour la suppression du compte : Firebase exige une connexion récente avant
// deleteUser — on redemande Google, et on réauthentifie avec ce jeton.
export async function reauthWithGoogle(webClientId: string) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GoogleSignin: G } = require('@react-native-google-signin/google-signin');
  if (!configured) {
    G.configure({ webClientId });
    configured = true;
  }
  const res: any = await G.signIn();
  if (res?.type === 'cancelled') throw Object.assign(new Error(''), { code: 'ERR_REQUEST_CANCELED' });
  const idToken: string | undefined = res?.data?.idToken ?? res?.idToken;
  if (!idToken) throw new Error('Google n’a pas renvoyé d’idToken.');
  const { auth } = require('./firebase');
  const { GoogleAuthProvider } = require('@react-native-firebase/auth');
  if (!auth.currentUser) throw new Error('Aucun utilisateur connecté.');
  await auth.currentUser.reauthenticateWithCredential(GoogleAuthProvider.credential(idToken));
}
