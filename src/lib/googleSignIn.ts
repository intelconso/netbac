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
