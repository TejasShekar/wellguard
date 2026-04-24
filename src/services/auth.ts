import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type FirebaseAuthTypes,
} from '@react-native-firebase/auth';

import { auth } from './firebase';

export type AuthUser = FirebaseAuthTypes.User;

export function watchAuth(callback: (user: AuthUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser(): AuthUser | null {
  return auth.currentUser;
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function signUp(email: string, password: string): Promise<AuthUser> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function signOut(): Promise<void> {
  await fbSignOut(auth);
}
