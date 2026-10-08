import { StoreSettings, User, UpdateStoreSettingsInput } from '@/types';
import { mockCurrentUser, mockStoreSettings } from '@/lib/mock';

export async function getStoreSettings(): Promise<StoreSettings> {
  return { ...mockStoreSettings };
}

export async function updateStoreSettings(changes: UpdateStoreSettingsInput): Promise<StoreSettings> {
  Object.assign(mockStoreSettings, changes);
  return { ...mockStoreSettings };
}

export async function getCurrentUser(): Promise<User> {
  return { ...mockCurrentUser };
}
