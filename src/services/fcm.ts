import {
  AuthorizationStatus,
  getToken,
  onTokenRefresh,
  requestPermission,
} from '@react-native-firebase/messaging';

import { messaging } from './firebase';
import { setFcmToken } from './firestore';

export async function ensureFcmPermission(): Promise<boolean> {
  const status = await requestPermission(messaging);
  return (
    status === AuthorizationStatus.AUTHORIZED ||
    status === AuthorizationStatus.PROVISIONAL
  );
}

export async function registerFcmToken(uid: string): Promise<string | null> {
  const granted = await ensureFcmPermission();
  if (!granted) return null;
  const token = await getToken(messaging);
  await setFcmToken(uid, token);
  return token;
}

export function watchFcmTokenRefresh(uid: string): () => void {
  return onTokenRefresh(messaging, token => {
    setFcmToken(uid, token).catch(() => {});
  });
}
