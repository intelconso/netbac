import { getApp } from '@react-native-firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail as fbSendPasswordResetEmail,
  sendEmailVerification as fbSendEmailVerification,
  signInWithCredential,
  GoogleAuthProvider,
  FirebaseAuthTypes,
} from '@react-native-firebase/auth';
import { getFirestore, FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

const app = getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

export type { FirebaseAuthTypes, FirebaseFirestoreTypes };

export async function signUpWithEmail(email: string, password: string, displayName?: string) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (displayName && cred.user) {
    await updateProfile(cred.user, { displayName: displayName.trim() });
  }
  if (cred.user && !cred.user.emailVerified) {
    try {
      await fbSendEmailVerification(cred.user);
    } catch {
      /* don't fail signup if verification email fails */
    }
  }
  return cred;
}

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function signOut() {
  return firebaseSignOut(auth);
}

export async function sendPasswordReset(email: string) {
  return fbSendPasswordResetEmail(auth, email.trim());
}

export async function resendVerificationEmail() {
  if (!auth.currentUser) throw new Error('Aucun utilisateur connecté.');
  return fbSendEmailVerification(auth.currentUser);
}

export async function signInWithGoogleIdToken(idToken: string) {
  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
}

export function onAuthChange(cb: (user: FirebaseAuthTypes.User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

export function currentUser(): FirebaseAuthTypes.User | null {
  return auth.currentUser;
}
