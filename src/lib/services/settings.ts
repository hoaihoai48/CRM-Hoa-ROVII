import { StoreSettings, User } from '@/types';
import { mockCurrentUser, mockStoreSettings } from '@/lib/mock';

export async function getStoreSettings(): Promise<StoreSettings> {
  return mockStoreSettings;
}

export async function getCurrentUser(): Promise<User> {
  return mockCurrentUser;
}
