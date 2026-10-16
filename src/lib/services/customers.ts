import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  limit,
  orderBy,
  runTransaction,
  updateDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Customer, CreateCustomerInput, UpdateCustomerInput } from '@/types';
import { normalizeIsoString } from '@/lib/utils/timestamp';

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Store Vietnamese mobile numbers in national format so 0... and +84... share one identity. */
function normalizePhone(phone: string): string {
  const digits = digitsOnly(phone);
  return /^84[35789]\d{8}$/.test(digits) ? `0${digits.slice(2)}` : digits;
}

function phoneLookupVariants(phone: string): string[] {
  // Search the canonical format first, then the raw digit form for pre-existing records.
  return [...new Set([normalizePhone(phone), digitsOnly(phone)])];
}

/** VN mobile: 10 digits starting 03/05/07/08/09, including the +84 equivalent. */
export function isValidVNPhone(phone: string): boolean {
  return /^0[35789]\d{8}$/.test(normalizePhone(phone));
}

function mapDocToCustomer(id: string, data: Record<string, unknown>): Customer {
  const rawSummaries = Array.isArray(data.orderSummaries) ? data.orderSummaries : [];
  const orderSummaries = rawSummaries.map((s: Record<string, unknown>) => ({
    id: String(s.id || ''),
    status: (s.status as Customer['orderSummaries'] extends (infer U)[] ? U extends { status: infer S } ? S : never : never) || 'new',
    total: Number(s.total || 0),
    createdAt: normalizeIsoString(s.createdAt),
  }));

  return {
    id,
    name: String(data.name || '').trim(),
    phone: String(data.phone || '').trim(),
    phoneNormalized: String(data.phoneNormalized || normalizePhone(String(data.phone || ''))),
    address: String(data.address || '').trim(),
    totalOrders: Number(data.totalOrders || 0),
    totalSpent: Number(data.totalSpent || 0),
    lastOrderDate: normalizeIsoString(data.lastOrderDate, ''),
    orderSummaries,
    note: data.note ? String(data.note).trim() : undefined,
    createdAt: normalizeIsoString(data.createdAt),
  };
}

export async function listCustomers(): Promise<Customer[]> {
  const collRef = collection(db, 'customers');
  // Order by createdAt desc if index exists, otherwise fallback to unindexed query but let errors propagate
  let snapshot;
  try {
    const q = query(collRef, orderBy('createdAt', 'desc'));
    snapshot = await getDocs(q);
  } catch (error: unknown) {
    // If the error is index-related, retry without ordering; otherwise rethrow
    const errStr = String(error);
    if (errStr.includes('requires an index') || errStr.includes('failed-precondition')) {
      snapshot = await getDocs(collRef);
    } else {
      throw error;
    }
  }

  const customers = snapshot.docs.map((docSnap) => mapDocToCustomer(docSnap.id, docSnap.data()));
  return customers.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  if (!id) return null;
  const docRef = doc(db, 'customers', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return mapDocToCustomer(docSnap.id, docSnap.data());
}

export async function findCustomerByPhone(phone: string): Promise<Customer | null> {
  const variants = phoneLookupVariants(phone).filter(Boolean);
  if (variants.length === 0) return null;

  // Check deterministic IDs in canonical-first order, including IDs written before canonicalization.
  for (const variant of variants) {
    const deterministicSnap = await getDoc(doc(db, 'customers', `CUST_${variant}`));
    if (deterministicSnap.exists()) {
      return mapDocToCustomer(deterministicSnap.id, deterministicSnap.data());
    }
  }

  // Search canonical and legacy phoneNormalized values for non-deterministic customer IDs.
  const collRef = collection(db, 'customers');
  for (const variant of variants) {
    const q = query(collRef, where('phoneNormalized', '==', variant), limit(1));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      return mapDocToCustomer(docSnap.id, docSnap.data());
    }
  }
  return null;
}

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  const phoneNormalized = normalizePhone(input.phone);
  if (!isValidVNPhone(input.phone)) throw new Error('Số điện thoại không hợp lệ (10 số, đầu 03/05/07/08/09).');
  if (!input.name.trim()) throw new Error('Tên khách hàng là bắt buộc.');
  if (!input.address.trim()) throw new Error('Địa chỉ khách hàng là bắt buộc.');

  const customerId = `CUST_${phoneNormalized}`;
  const customerRef = doc(db, 'customers', customerId);
  const variants = phoneLookupVariants(input.phone);

  // Preserve existing records created before canonicalization, including deterministic legacy IDs.
  for (const variant of variants) {
    if (variant === phoneNormalized) continue;
    const legacyIdSnap = await getDoc(doc(db, 'customers', `CUST_${variant}`));
    if (legacyIdSnap.exists()) {
      return mapDocToCustomer(legacyIdSnap.id, legacyIdSnap.data());
    }
  }

  // Client transactions cannot query a collection, so preflight all canonical/legacy index values.
  for (const variant of variants) {
    const legacyQuery = query(
      collection(db, 'customers'),
      where('phoneNormalized', '==', variant),
      limit(1),
    );
    const legacySnap = await getDocs(legacyQuery);
    if (!legacySnap.empty) {
      const legacyDoc = legacySnap.docs[0];
      return mapDocToCustomer(legacyDoc.id, legacyDoc.data());
    }
  }

  // Use transaction with canonical deterministic docRef to eliminate races between 0... and +84...
  return await runTransaction(db, async (tx) => {
    const existingSnap = await tx.get(customerRef);
    if (existingSnap.exists()) {
      return mapDocToCustomer(existingSnap.id, existingSnap.data());
    }

    const now = new Date().toISOString();
    const newCustomerData = {
      name: input.name.trim(),
      phone: input.phone.trim(),
      phoneNormalized,
      address: input.address.trim(),
      totalOrders: 0,
      totalSpent: 0,
      lastOrderDate: '',
      note: input.note?.trim() || null,
      createdAt: now,
    };

    tx.set(customerRef, newCustomerData);

    return {
      id: customerId,
      name: newCustomerData.name,
      phone: newCustomerData.phone,
      phoneNormalized,
      address: newCustomerData.address,
      totalOrders: 0,
      totalSpent: 0,
      lastOrderDate: '',
      note: input.note?.trim() || undefined,
      createdAt: now,
    };
  });
}

/**
 * Update editable customer profile fields (name, address, note).
 * Phone is the identity key baked into the document ID and order snapshots,
 * and totalOrders/totalSpent/lastOrderDate/orderSummaries are system-computed
 * by order transactions — none of them can be changed through this function.
 */
export async function updateCustomer(id: string, input: UpdateCustomerInput): Promise<Customer> {
  if (!id) throw new Error('Mã khách hàng không hợp lệ.');
  const name = input.name.trim();
  const address = input.address.trim();
  if (!name) throw new Error('Tên khách hàng là bắt buộc.');
  if (!address) throw new Error('Địa chỉ khách hàng là bắt buộc.');

  const customerRef = doc(db, 'customers', id);
  const existing = await getDoc(customerRef);
  if (!existing.exists()) {
    throw new Error(`Không tìm thấy khách hàng với ID: ${id}`);
  }

  await updateDoc(customerRef, {
    name,
    address,
    note: input.note?.trim() ? input.note.trim() : null,
  });

  const updated = await getDoc(customerRef);
  return mapDocToCustomer(updated.id, (updated.data() || {}) as Record<string, unknown>);
}
