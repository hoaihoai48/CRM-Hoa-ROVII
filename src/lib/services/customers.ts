import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  query, 
  where, 
  limit, 
  orderBy 
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
  // Order by createdAt desc if available, otherwise fetch all
  try {
    const q = query(collRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => mapDocToCustomer(docSnap.id, docSnap.data()));
  } catch {
    const snapshot = await getDocs(collRef);
    return snapshot.docs.map((docSnap) => mapDocToCustomer(docSnap.id, docSnap.data()));
  }
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

  // Check duplicate phone in Firestore
  const existing = await findCustomerByPhone(phoneNormalized);
  if (existing) {
    return existing;
  }

  const customerId = `CUST-${Date.now()}`;
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

  const docRef = doc(db, 'customers', customerId);
  await setDoc(docRef, newCustomerData);

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
}
