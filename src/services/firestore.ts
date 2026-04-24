import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@react-native-firebase/firestore';

import { firestore } from './firebase';

export type UserDoc = {
  uid: string;
  email: string | null;
  apIds: string[];
  fcmToken: string | null;
  platform: 'android';
  createdAt: number;
  updatedAt: number;
};

function userRef(uid: string) {
  return doc(firestore, 'users', uid);
}

export async function upsertUserOnSignIn(params: {
  uid: string;
  email: string | null;
}): Promise<void> {
  const ref = userRef(params.uid);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    await updateDoc(ref, {
      email: params.email,
      updatedAt: serverTimestamp(),
    });
    return;
  }
  await setDoc(ref, {
    uid: params.uid,
    email: params.email,
    apIds: [],
    fcmToken: null,
    platform: 'android',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function setFcmToken(uid: string, token: string): Promise<void> {
  await updateDoc(userRef(uid), {
    fcmToken: token,
    updatedAt: serverTimestamp(),
  });
}
