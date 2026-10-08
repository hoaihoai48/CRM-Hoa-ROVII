import { Product } from '@/types';
import { seedProducts as seedProducts } from '@/lib/mock';

export async function listProducts(): Promise<Product[]> {
  return seedProducts;
}

export async function getProductById(id: string): Promise<Product | null> {
  return seedProducts.find((product) => product.id === id) ?? null;
}

export async function listActiveProducts(): Promise<Product[]> {
  return seedProducts.filter((product) => product.isActive);
}

export const products = seedProducts;

export const mockProducts = products;
