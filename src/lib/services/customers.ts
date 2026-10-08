import { Customer } from '@/types';
import { seedCustomers as seedCustomers } from '@/lib/mock';

export async function listCustomers(): Promise<Customer[]> {
  return seedCustomers;
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  return seedCustomers.find((customer) => customer.id === id) ?? null;
}

export async function findCustomerByPhone(phone: string): Promise<Customer | null> {
  const normalized = phone.replace(/\D/g, '');
  if (!normalized) return null;
  return seedCustomers.find((customer) => customer.phone.replace(/\D/g, '') === normalized) ?? null;
}

export const customers = seedCustomers;

export const mockCustomers = customers;
