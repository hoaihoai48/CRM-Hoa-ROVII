import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/config';
import { StoreSettings, User, UpdateStoreSettingsInput } from '@/types';

const DEFAULT_STORE_SETTINGS: StoreSettings = {
  storeName: 'Tiệm Hoa Tươi Họa Mi',
  phone: '0909888999',
  address: '158 Nguyễn Đình Chiểu, Phường Võ Thị Sáu, Quận 3, TP.HCM',
  zaloUrl: 'https://zalo.me/0909888999',
  email: 'lienhe@tiemhoa.vn',
  notificationEnabled: true,
};

export async function getStoreSettings(): Promise<StoreSettings> {
  try {
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
  } catch {
    return { ...DEFAULT_STORE_SETTINGS };
  }
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

/**
 * Returns the currently authenticated Firebase user mapped to domain User.
 * If no user is logged in, falls back to a clean default staff identity.
 */
export async function getCurrentUser(): Promise<User> {
  const current = auth.currentUser;
  if (current) {
    return {
      id: current.uid,
      name: current.displayName || current.phoneNumber || current.email?.split('@')[0] || 'Nhân viên tiệm',
      email: current.email || current.phoneNumber || 'nhanvien@tiemhoa.vn',
      role: 'staff',
      avatarUrl: current.photoURL || undefined,
    };
  }

  return {
    id: 'ANON-STAFF',
    name: 'Nhân viên trực ca',
    email: 'nhanvien@tiemhoa.vn',
    role: 'staff',
  };
}
