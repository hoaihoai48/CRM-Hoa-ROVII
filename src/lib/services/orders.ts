import { Order } from '@/types';
import { seedOrders as seedOrders } from '@/lib/mock';

export async function listOrders(): Promise<Order[]> {
  return seedOrders;
}

export async function getOrderById(id: string): Promise<Order | null> {
  return seedOrders.find((order) => order.id === id) ?? null;
}

export const orders = seedOrders;
export const mockOrdersData = orders;

export const mockOrders = orders;
