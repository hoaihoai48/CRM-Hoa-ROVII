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

let membershipRequest: { uid: string; promise: Promise<User | null> } | null = null;

/** Drop the in-flight deduplication entry when Firebase changes sessions. */
export function resetCurrentUserRequest() {
  membershipRequest = null;
}

/** Resolve CRM membership; concurrent requests for one UID share one Firestore read. */
export function getCurrentUser(): Promise<User | null> {
  const current = auth.currentUser;
  if (!current) {
    membershipRequest = null;
    return Promise.resolve(null);
  }
  if (membershipRequest?.uid === current.uid) return membershipRequest.promise;

  const uid = current.uid;
  let request: Promise<User | null>;
  request = getDoc(doc(db, 'users', uid))
    .then((snapshot) => {
      if (!snapshot.exists()) return null;
      const data = snapshot.data();
      if ((data.role !== 'admin' && data.role !== 'staff') ||
          (data.status !== 'active' && data.status !== 'inactive')) return null;
      return {
        id: uid,
        name: current.displayName || current.phoneNumber || current.email?.split('@')[0] || 'Nhân viên tiệm',
        email: current.email || current.phoneNumber || '',
        role: data.role,
        status: data.status,
        avatarUrl: current.photoURL || undefined,
      };
    })
    .finally(() => {
      if (membershipRequest?.promise === request) membershipRequest = null;
    });
  membershipRequest = { uid, promise: request };
  return request;
}
