import { Product } from '@/types';
import { mockProducts } from '@/lib/mock';

export async function listProducts(): Promise<Product[]> {
  return mockProducts;
}

export async function getProductById(id: string): Promise<Product | null> {
  return mockProducts.find((product) => product.id === id) ?? null;
}

export async function listActiveProducts(): Promise<Product[]> {
  return mockProducts.filter((product) => product.isActive);
}

export const products = mockProducts;

export const mockProducts = products;
