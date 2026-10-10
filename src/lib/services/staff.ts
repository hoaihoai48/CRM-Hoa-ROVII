import { collection, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth, signOut, updateProfile } from 'firebase/auth';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { db } from '@/lib/firebase/config';
import { UserMembership, UserRole, MembershipStatus } from '@/types';

export interface StaffListItem extends UserMembership {
  id: string;
  name?: string;
}

export interface CreateStaffInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

function mapDocToMembership(id: string, data: Record<string, unknown>): StaffListItem {
  return {
    id,
    uid: String(data.uid || id),
    name: data.name ? String(data.name) : undefined,
    email: String(data.email || ''),
    role: (data.role as UserRole) || 'staff',
    status: (data.status as MembershipStatus) || 'inactive',
    createdAt: String(data.createdAt || ''),
    updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
  };
}

function getSecondaryAuth() {
  const mainApp = getApp();
  const secondaryName = 'staff-provisioning';
  const existing = getApps().find((app) => app.name === secondaryName);
  const secondaryApp = existing || initializeApp(mainApp.options, secondaryName);
  return getAuth(secondaryApp);
}

/** Admin-only: list all staff memberships. Enforced by firestore.rules (list: admin). */
export async function listStaff(): Promise<StaffListItem[]> {
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.docs
    .map((docSnap) => mapDocToMembership(docSnap.id, (docSnap.data() || {}) as Record<string, unknown>))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Admin-only: create a login account AND its membership in one step.
 * Uses a secondary Auth instance so the admin stays signed in.
 * The membership write is allowed by firestore.rules only for active admins.
 */
export async function createStaffAccount(input: CreateStaffInput): Promise<StaffListItem> {
  const name = input.name.trim();
  const email = input.email.trim();
  if (!name) throw new Error('Tên nhân viên là bắt buộc.');
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Email không hợp lệ.');
  if (!input.password || input.password.length < 6) throw new Error('Mật khẩu phải có ít nhất 6 ký tự.');
  if (input.role !== 'admin' && input.role !== 'staff') throw new Error('Vai trò không hợp lệ.');

  const secondaryAuth = getSecondaryAuth();
  const credential = await createUserWithEmailAndPassword(secondaryAuth, email, input.password);
  try {
    await updateProfile(credential.user, { displayName: name });
  } catch {
    // Display name is cosmetic; membership below is the source of truth.
  }
  const now = new Date().toISOString();
  const membershipData = {
    uid: credential.user.uid,
    name,
    email,
    role: input.role,
    status: 'active' as const,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await setDoc(doc(db, 'users', credential.user.uid), membershipData);
  } finally {
    // Never leave the secondary session lying around.
    await signOut(secondaryAuth);
  }
  return { id: credential.user.uid, ...membershipData };
}

/** Admin-only: change role or activate/deactivate. No deletes — deactivate instead. */
export async function updateStaffMembership(
  uid: string,
  changes: { role?: UserRole; status?: MembershipStatus }
): Promise<void> {
  if (!uid) throw new Error('Mã nhân viên không hợp lệ.');
  if (changes.role !== undefined && changes.role !== 'admin' && changes.role !== 'staff') {
    throw new Error('Vai trò không hợp lệ.');
  }
  if (changes.status !== undefined && changes.status !== 'active' && changes.status !== 'inactive') {
    throw new Error('Trạng thái không hợp lệ.');
  }
  if (changes.role === undefined && changes.status === undefined) {
    throw new Error('Không có thay đổi nào để lưu.');
  }
  await updateDoc(doc(db, 'users', uid), {
    ...changes,
    updatedAt: new Date().toISOString(),
  });
}
