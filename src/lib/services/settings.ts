import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/config';
import { StoreSettings, User, UpdateStoreSettingsInput } from '@/types';

const DEFAULT_STORE_SETTINGS: StoreSettings = {
  storeName: '',
  phone: '',
  address: '',
  zaloUrl: '',
  email: '',
  notificationEnabled: true,
};

export async function getStoreSettings(): Promise<StoreSettings> {
  const docRef = doc(db, 'settings', 'store');
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    return { ...DEFAULT_STORE_SETTINGS };
  }
  const data = docSnap.data() as Partial<StoreSettings>;
  return {
    storeName: data.storeName || DEFAULT_STORE_SETTINGS.storeName,
    phone: data.phone || DEFAULT_STORE_SETTINGS.phone,
    address: data.address || DEFAULT_STORE_SETTINGS.address,
    zaloUrl: data.zaloUrl || DEFAULT_STORE_SETTINGS.zaloUrl,
    email: data.email || DEFAULT_STORE_SETTINGS.email,
    notificationEnabled: data.notificationEnabled ?? DEFAULT_STORE_SETTINGS.notificationEnabled,
  };
}

export async function updateStoreSettings(changes: UpdateStoreSettingsInput): Promise<StoreSettings> {
  const docRef = doc(db, 'settings', 'store');
  const cleanChanges: Record<string, unknown> = {};

  if (changes.storeName !== undefined) cleanChanges.storeName = changes.storeName.trim();
  if (changes.phone !== undefined) cleanChanges.phone = changes.phone.trim();
  if (changes.address !== undefined) cleanChanges.address = changes.address.trim();
  if (changes.zaloUrl !== undefined) cleanChanges.zaloUrl = changes.zaloUrl.trim();
  if (changes.email !== undefined) cleanChanges.email = changes.email.trim();
  if (changes.notificationEnabled !== undefined) cleanChanges.notificationEnabled = changes.notificationEnabled;

  await setDoc(docRef, cleanChanges, { merge: true });
  return await getStoreSettings();
}

let cachedMembership: { uid: string; user: User | null; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

export function clearMembershipCache() {
  cachedMembership = null;
}

export function getCachedMembership(uid?: string): User | null | undefined {
  if (!cachedMembership) return undefined;
  if (uid && cachedMembership.uid !== uid) return undefined;
  if (Date.now() - cachedMembership.timestamp >= CACHE_TTL_MS) return undefined;
  return cachedMembership.user;
}

/**
 * Returns the currently authenticated Firebase user mapped to domain User,
 * resolving provisioned role and membership status from Firestore users/{uid},
 * or null if unauthenticated. Never returns fake dummy identities.
 * Caches in memory to avoid repetitive full-page spinners on Next.js page transitions.
 */
export async function getCurrentUser(forceRefresh = false): Promise<User | null> {
  const current = auth.currentUser;
  if (!current) {
    cachedMembership = null;
    return null;
  }

  const now = Date.now();
  if (
    !forceRefresh &&
    cachedMembership &&
    cachedMembership.uid === current.uid &&
    now - cachedMembership.timestamp < CACHE_TTL_MS
  ) {
    return cachedMembership.user;
  }

  try {
    const userDocRef = doc(db, 'users', current.uid);
    const userDocSnap = await getDoc(userDocRef);
    if (!userDocSnap.exists()) {
      cachedMembership = { uid: current.uid, user: null, timestamp: now };
      return null;
    }

    const data = userDocSnap.data();
    if (
      (data.role !== 'admin' && data.role !== 'staff') ||
      (data.status !== 'active' && data.status !== 'inactive')
    ) {
      cachedMembership = { uid: current.uid, user: null, timestamp: now };
      return null;
    }

    const domainUser: User = {
      id: current.uid,
      name: current.displayName || current.phoneNumber || current.email?.split('@')[0] || 'Nhân viên tiệm',
      email: current.email || current.phoneNumber || '',
      role: data.role,
      status: data.status,
      avatarUrl: current.photoURL || undefined,
    };

    cachedMembership = { uid: current.uid, user: domainUser, timestamp: now };
    return domainUser;
  } catch (error) {
    // A missing membership document is handled above. Propagate read/network errors
    // so the UI can distinguish verification failure from an unprovisioned account.
    throw error;
  }
}

