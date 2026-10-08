import { Customer } from '@/types';
import { mockCustomers } from '@/lib/mock';

export async function listCustomers(): Promise<Customer[]> {
  return mockCustomers;
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  return mockCustomers.find((customer) => customer.id === id) ?? null;
}

export async function findCustomerByPhone(phone: string): Promise<Customer | null> {
  const normalized = phone.replace(/\D/g, '');
  if (!normalized) return null;
  return mockCustomers.find((customer) => customer.phone.replace(/\D/g, '') === normalized) ?? null;
}
