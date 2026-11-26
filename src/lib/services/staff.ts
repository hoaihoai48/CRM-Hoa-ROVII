import { collection, doc, getDocs, runTransaction, setDoc, updateDoc } from 'firebase/firestore';
import { connectAuthEmulator, createUserWithEmailAndPassword, deleteUser, getAuth, signOut, updateProfile } from 'firebase/auth';
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

export interface LinkExistingStaffInput {
  uid: string;
  name: string;
  email: string;
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
  const secondaryAuth = getAuth(secondaryApp);
  // The secondary Auth instance must use the same emulator as the primary app.
  // Otherwise staff provisioning can accidentally target the configured Firebase project
  // even when the rest of the application is running against the Auth Emulator.
  const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
  if (authEmulatorHost) {
    try {
      const authUrl = authEmulatorHost.startsWith('http') ? authEmulatorHost : 'http://' + authEmulatorHost;
      connectAuthEmulator(secondaryAuth, authUrl, { disableWarnings: true });
    } catch {
      // Already connected.
    }
  }
  return secondaryAuth;
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
  if (name.length > 120) throw new Error('Tên nhân viên không được vượt quá 120 ký tự.');
  if (!email || email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('Email không hợp lệ hoặc vượt quá 254 ký tự.');
  }
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
  } catch (membershipError) {
    // Compensating action: do not leave an Auth account without its CRM membership.
    try {
      await deleteUser(credential.user);
    } catch (cleanupError) {
      // Surface the UID so an administrator can recover the orphaned account deliberately.
      throw new Error(
        `Không thể tạo hồ sơ nhân viên và cũng không thể thu hồi tài khoản đăng nhập ${credential.user.uid}. Cần xử lý thủ công. Lỗi ghi hồ sơ: ${String(membershipError)}. Lỗi thu hồi: ${String(cleanupError)}`
      );
    }
    throw new Error(
      `Không thể tạo hồ sơ nhân viên; tài khoản đăng nhập vừa tạo đã được thu hồi. ${String(membershipError)}`
    );
  } finally {
    // Never leave the secondary session lying around.
    await signOut(secondaryAuth);
  }
  return { id: credential.user.uid, ...membershipData };
}

/** Admin-only: attach an already authenticated identity (for example Google sign-in) to CRM.
 * The admin must verify the UID and email together with the employee before granting access.
 * This intentionally creates only the Firestore membership; it does not create or alter an Auth account.
 */
export async function linkExistingStaffAccount(input: LinkExistingStaffInput): Promise<StaffListItem> {
  const uid = input.uid.trim();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!uid || uid.length > 128) throw new Error('UID Firebase Auth không hợp lệ.');
  if (!name || name.length > 120) throw new Error('Tên nhân viên phải có từ 1 đến 120 ký tự.');
  if (!email || email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('Email tài khoản hiện có không hợp lệ.');
  }
  if (input.role !== 'admin' && input.role !== 'staff') throw new Error('Vai trò không hợp lệ.');

  const membershipRef = doc(db, 'users', uid);
  const now = new Date().toISOString();
  const membershipData = {
    uid,
    name,
    email,
    role: input.role,
    status: 'active' as const,
    createdAt: now,
    updatedAt: now,
  };

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(membershipRef);
    if (existing.exists()) {
      throw new Error('UID này đã có hồ sơ nhân viên. Hãy cập nhật hồ sơ hiện có thay vì liên kết lại.');
    }
    transaction.set(membershipRef, membershipData);
  });

  return { id: uid, ...membershipData };
}

/** Admin-only: change role or activate/deactivate. No deletes — deactivate instead. */
export async function updateStaffMembership(
  uid: string,
  changes: { role?: UserRole; status?: MembershipStatus }
): Promise<void> {
  if (!uid || uid.length > 128) throw new Error('Mã nhân viên không hợp lệ.');
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
    uid,
    ...changes,
    updatedAt: new Date().toISOString(),
  });
}
