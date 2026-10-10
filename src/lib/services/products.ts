import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Product, CreateProductInput } from '@/types';
import { normalizeIsoString } from '@/lib/utils/timestamp';

function assertValidPrice(price: unknown): asserts price is number {
  if (!Number.isFinite(price) || (price as number) < 0) {
    throw new Error('Giá sản phẩm phải là số hợp lệ, không âm.');
  }
}

/** Max images per product: keeps Data-URL docs safely under the 1 MiB limit. */
export const MAX_PRODUCT_IMAGES = 5;

function normalizeImageUrls(value: unknown, fallbackCover?: string): string[] {
  const list = Array.isArray(value)
    ? value.map((v) => String(v).trim()).filter(Boolean)
    : [];
  if (list.length === 0 && fallbackCover) list.push(fallbackCover);
  return list.slice(0, MAX_PRODUCT_IMAGES);
}

function mapDocToProduct(id: string, data: Record<string, unknown>): Product {
  // Do not mask corrupt data with silent 0: fall back only when non-finite.
  const rawPrice = Number(data.price);
  return {
    id,
    name: String(data.name || '').trim(),
    price: Number.isFinite(rawPrice) ? rawPrice : 0,
    unit: String(data.unit || 'bó').trim(),
    isActive: data.isActive !== false,
    category: data.category ? String(data.category).trim() : undefined,
    imageUrl: data.imageUrl ? String(data.imageUrl).trim() : undefined,
    imageUrls: normalizeImageUrls(
      data.imageUrls,
      data.imageUrl ? String(data.imageUrl).trim() : undefined
    ),
    note: data.note ? String(data.note).trim() : undefined,
    createdAt: normalizeIsoString(data.createdAt),
  };
}

export async function listProducts(): Promise<Product[]> {
  const collRef = collection(db, 'products');
  const snapshot = await getDocs(collRef);
  return snapshot.docs.map((docSnap) => mapDocToProduct(docSnap.id, docSnap.data()));
}

export async function getProductById(id: string): Promise<Product | null> {
  if (!id) return null;
  const docRef = doc(db, 'products', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return mapDocToProduct(docSnap.id, docSnap.data());
}

export async function listActiveProducts(): Promise<Product[]> {
  const collRef = collection(db, 'products');
  const q = query(collRef, where('isActive', '==', true));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => mapDocToProduct(docSnap.id, docSnap.data()));
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  if (!input.name.trim()) throw new Error('Tên sản phẩm không được để trống.');
  assertValidPrice(input.price);
  if (!input.unit.trim()) throw new Error('Đơn vị tính không được để trống.');

  const productId = `PROD-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const cleanImageUrls = normalizeImageUrls(input.imageUrls, input.imageUrl?.trim() || undefined);

  const productData = {
    name: input.name.trim(),
    price: input.price,
    unit: input.unit.trim(),
    isActive: input.isActive ?? true,
    category: input.category?.trim() || null,
    imageUrl: cleanImageUrls[0] || null,
    imageUrls: cleanImageUrls,
    note: input.note?.trim() || null,
    createdAt: now,
  };

  const docRef = doc(db, 'products', productId);
  await setDoc(docRef, productData);

  return {
    id: productId,
    name: productData.name,
    price: productData.price,
    unit: productData.unit,
    isActive: productData.isActive,
    category: input.category?.trim() || undefined,
    imageUrl: cleanImageUrls[0] || undefined,
    imageUrls: cleanImageUrls,
    note: input.note?.trim() || undefined,
    createdAt: now,
  };
}

export async function updateProduct(id: string, changes: Partial<Omit<Product, 'id' | 'createdAt'>>): Promise<Product> {
  if (!id) throw new Error('Mã sản phẩm không hợp lệ.');
  const docRef = doc(db, 'products', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error('Không tìm thấy sản phẩm.');

  const updateData: Record<string, unknown> = {};
  if (changes.name !== undefined) updateData.name = changes.name.trim();
  if (changes.price !== undefined) {
    assertValidPrice(changes.price);
    updateData.price = changes.price;
  }
  if (changes.unit !== undefined) updateData.unit = changes.unit.trim();
  if (changes.isActive !== undefined) updateData.isActive = Boolean(changes.isActive);
  if (changes.category !== undefined) updateData.category = changes.category?.trim() || null;
  if (changes.imageUrls !== undefined) {
    const clean = normalizeImageUrls(changes.imageUrls, changes.imageUrl?.trim() || undefined);
    updateData.imageUrls = clean;
    updateData.imageUrl = clean[0] || null;
  } else if (changes.imageUrl !== undefined) {
    updateData.imageUrl = changes.imageUrl?.trim() || null;
  }
  if (changes.note !== undefined) updateData.note = changes.note?.trim() || null;

  await updateDoc(docRef, updateData);

  const updatedSnap = await getDoc(docRef);
  return mapDocToProduct(updatedSnap.id, updatedSnap.data() as Record<string, unknown>);
}
