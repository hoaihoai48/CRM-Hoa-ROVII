import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult
} from 'firebase/auth';
import { auth, googleProvider } from './config';

/**
 * 1. Email & Password Authentication
 */
export async function loginWithEmail(email: string, pass: string) {
  const credential = await signInWithEmailAndPassword(auth, email, pass);
  return credential.user;
}

export async function registerWithEmail(email: string, pass: string) {
  const credential = await createUserWithEmailAndPassword(auth, email, pass);
  return credential.user;
}

/**
 * 2. Google Sign-In (Popup)
 */
export async function loginWithGoogle() {
  googleProvider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

/**
 * 3. Phone Number Authentication (SMS OTP)
 */
export function setupRecaptcha(containerId: string) {
  return new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
  });
}

export async function sendPhoneOtp(phoneNumber: string, appVerifier: RecaptchaVerifier): Promise<ConfirmationResult> {
  return await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
}

export async function verifyPhoneOtp(confirmationResult: ConfirmationResult, verificationCode: string) {
  const result = await confirmationResult.confirm(verificationCode);
  return result.user;
}

/**
 * 4. Sign Out
 */
export async function logoutUser() {
  return await firebaseSignOut(auth);
}

/**
 * 5. Auth State Observer
 */
export function subscribeToAuth(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}
