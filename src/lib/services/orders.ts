import { Order } from '@/types';
import { mockOrders } from '@/lib/mock';

export async function listOrders(): Promise<Order[]> {
  return mockOrders;
}

export async function getOrderById(id: string): Promise<Order | null> {
  return mockOrders.find((order) => order.id === id) ?? null;
}

export const mockOrders = orders;
