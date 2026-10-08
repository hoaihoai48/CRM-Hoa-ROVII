import { Customer, CreateCustomerInput } from '@/types';
import { mockCustomers } from '@/lib/mock';

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export async function listCustomers(): Promise<Customer[]> {
  return [...mockCustomers];
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  return mockCustomers.find((customer) => customer.id === id) ?? null;
}

export async function findCustomerByPhone(phone: string): Promise<Customer | null> {
  const phoneNormalized = normalizePhone(phone);
  if (!phoneNormalized) return null;
  return mockCustomers.find((customer) => customer.phoneNormalized === phoneNormalized) ?? null;
}

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  const phoneNormalized = normalizePhone(input.phone);
  if (!phoneNormalized) throw new Error('Số điện thoại không hợp lệ.');

  const existing = mockCustomers.find((customer) => customer.phoneNormalized === phoneNormalized);
  if (existing) return existing;

  const customer: Customer = {
    id: `CUST-${Date.now()}`,
    name: input.name.trim(),
    phone: input.phone.trim(),
    phoneNormalized,
    address: input.address.trim(),
    totalOrders: 0,
    totalSpent: 0,
    lastOrderDate: '',
    note: input.note?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  mockCustomers.unshift(customer);
  return customer;
}
