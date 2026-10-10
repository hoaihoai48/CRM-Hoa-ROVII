import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'fake-api-key-for-emulator';
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'crm-hoa-rovii';
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'crm-hoa-rovii.firebaseapp.com';
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:1234567890:web:abcdef';

// Fail fast in production runtime if required config is missing without hardcoded fallbacks
if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST && !process.env.FIRESTORE_EMULATOR_HOST) {
  const missingKeys: string[] = [];
  if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) missingKeys.push('NEXT_PUBLIC_FIREBASE_API_KEY');
  if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) missingKeys.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
  if (!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) missingKeys.push('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
  if (!process.env.NEXT_PUBLIC_FIREBASE_APP_ID) missingKeys.push('NEXT_PUBLIC_FIREBASE_APP_ID');

  if (missingKeys.length > 0) {
    throw new Error(
      `[Firebase Config Error] Thiếu các biến môi trường bắt buộc: ${missingKeys.join(', ')}. Vui lòng kiểm tra file .env.local hoặc cấu hình deploy.`
    );
  }
}

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
};

// Initialize Firebase once as singleton
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

// Auto-connect emulator if host is present in environment
const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
if (authEmulatorHost) {
  try {
    const authUrl = authEmulatorHost.startsWith('http') ? authEmulatorHost : `http://${authEmulatorHost}`;
    connectAuthEmulator(auth, authUrl, { disableWarnings: true });
  } catch {
    // Already connected
  }
}

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST;
if (emulatorHost) {
  const [host, portStr] = emulatorHost.split(':');
  const port = parseInt(portStr, 10) || 8080;
  try {
    connectFirestoreEmulator(db, host, port);
  } catch {
    // connectFirestoreEmulator throws if already connected in test runners
  }
}

export const googleProvider = new GoogleAuthProvider();

export default app;
