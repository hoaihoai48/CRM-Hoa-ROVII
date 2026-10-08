import { Product, CreateProductInput } from '@/types';
import { mockProducts } from '@/lib/mock';

export async function listProducts(): Promise<Product[]> {
  return [...mockProducts];
}

export async function getProductById(id: string): Promise<Product | null> {
  return mockProducts.find((product) => product.id === id) ?? null;
}

export async function listActiveProducts(): Promise<Product[]> {
  return mockProducts.filter((product) => product.isActive);
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  if (!input.name.trim()) throw new Error('Tên sản phẩm không được để trống.');
  if (input.price < 0) throw new Error('Giá sản phẩm không được âm.');

  const product: Product = {
    id: `PROD-${Date.now()}`,
    name: input.name.trim(),
    price: input.price,
    unit: input.unit.trim(),
    isActive: input.isActive ?? true,
    category: input.category?.trim() || undefined,
    imageUrl: input.imageUrl?.trim() || undefined,
    note: input.note?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  mockProducts.unshift(product);
  return product;
}

export async function updateProduct(id: string, changes: Partial<Omit<Product, 'id' | 'createdAt'>>): Promise<Product> {
  const product = mockProducts.find((item) => item.id === id);
  if (!product) throw new Error('Không tìm thấy sản phẩm.');

  Object.assign(product, changes);
  return product;
}
