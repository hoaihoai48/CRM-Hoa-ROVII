import { StoreSettings, User } from '@/types';
import { seedCurrentUser as seedCurrentUser, seedStoreSettings as seedStoreSettings } from '@/lib/mock';

export async function getStoreSettings(): Promise<StoreSettings> {
  return seedStoreSettings;
}

export async function getCurrentUser(): Promise<User> {
  return seedCurrentUser;
}

export const currentUser = seedCurrentUser;
export const storeSettings = seedStoreSettings;

export const mockCurrentUser = currentUser;
export const mockStoreSettings = storeSettings;
