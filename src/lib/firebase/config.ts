import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

// Fail fast in production runtime if required config is missing without hardcoded fallbacks
if (typeof window !== 'undefined') {
  const missingKeys: string[] = [];
  if (!apiKey) missingKeys.push('NEXT_PUBLIC_FIREBASE_API_KEY');
  if (!projectId) missingKeys.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
  if (!authDomain) missingKeys.push('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
  if (!appId) missingKeys.push('NEXT_PUBLIC_FIREBASE_APP_ID');

  if (missingKeys.length > 0) {
    throw new Error(
      `[Firebase Config Error] Thiếu các biến môi trường bắt buộc: ${missingKeys.join(', ')}. Vui lòng kiểm tra file .env.local hoặc cấu hình deploy.`
    );
  }
}

const firebaseConfig = {
  apiKey: apiKey || '',
  authDomain: authDomain || '',
  projectId: projectId || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: appId || '',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
};

// Initialize Firebase once as singleton
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
