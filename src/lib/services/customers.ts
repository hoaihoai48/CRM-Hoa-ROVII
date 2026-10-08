import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  limit, 
  orderBy,
  runTransaction
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Customer, CreateCustomerInput } from '@/types';
import { normalizeIsoString } from '@/lib/utils/timestamp';

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function mapDocToCustomer(id: string, data: Record<string, unknown>): Customer {
  return {
    id,
    name: String(data.name || '').trim(),
    phone: String(data.phone || '').trim(),
    phoneNormalized: String(data.phoneNormalized || normalizePhone(String(data.phone || ''))),
    address: String(data.address || '').trim(),
    totalOrders: Number(data.totalOrders || 0),
    totalSpent: Number(data.totalSpent || 0),
    lastOrderDate: normalizeIsoString(data.lastOrderDate, ''),
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
  const phoneNormalized = normalizePhone(phone);
  if (!phoneNormalized) return null;

  // 1. Check deterministic doc ID first
  const deterministicRef = doc(db, 'customers', `CUST_${phoneNormalized}`);
  const deterministicSnap = await getDoc(deterministicRef);
  if (deterministicSnap.exists()) {
    return mapDocToCustomer(deterministicSnap.id, deterministicSnap.data());
  }

  // 2. Query for backwards compatibility with existing legacy customer IDs
  const collRef = collection(db, 'customers');
  const q = query(collRef, where('phoneNormalized', '==', phoneNormalized), limit(1));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  return mapDocToCustomer(docSnap.id, docSnap.data());
}

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  const phoneNormalized = normalizePhone(input.phone);
  if (!phoneNormalized) throw new Error('Số điện thoại không hợp lệ.');
  if (!input.name.trim()) throw new Error('Tên khách hàng là bắt buộc.');
  if (!input.address.trim()) throw new Error('Địa chỉ khách hàng là bắt buộc.');

  // Check legacy customer ID first to prevent duplicate if existed with legacy ID
  const existingLegacy = await findCustomerByPhone(phoneNormalized);
  if (existingLegacy) {
    return existingLegacy;
  }

  const customerId = `CUST_${phoneNormalized}`;
  const customerRef = doc(db, 'customers', customerId);

  // Use Firestore transaction on the deterministic customer document to eliminate race condition
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
