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

function mapDocToProduct(id: string, data: Record<string, unknown>): Product {
  return {
    id,
    name: String(data.name || '').trim(),
    price: Number(data.price || 0),
    unit: String(data.unit || 'bó').trim(),
    isActive: data.isActive !== false,
    category: data.category ? String(data.category).trim() : undefined,
    imageUrl: data.imageUrl ? String(data.imageUrl).trim() : undefined,
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
  if (input.price < 0) throw new Error('Giá sản phẩm không được âm.');
  if (!input.unit.trim()) throw new Error('Đơn vị tính không được để trống.');

  const productId = `PROD-${Date.now()}`;
  const now = new Date().toISOString();

  const productData = {
    name: input.name.trim(),
    price: input.price,
    unit: input.unit.trim(),
    isActive: input.isActive ?? true,
    category: input.category?.trim() || null,
    imageUrl: input.imageUrl?.trim() || null,
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
    imageUrl: input.imageUrl?.trim() || undefined,
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
    if (changes.price < 0) throw new Error('Giá sản phẩm không được âm.');
    updateData.price = changes.price;
  }
  if (changes.unit !== undefined) updateData.unit = changes.unit.trim();
  if (changes.isActive !== undefined) updateData.isActive = Boolean(changes.isActive);
  if (changes.category !== undefined) updateData.category = changes.category?.trim() || null;
  if (changes.imageUrl !== undefined) updateData.imageUrl = changes.imageUrl?.trim() || null;
  if (changes.note !== undefined) updateData.note = changes.note?.trim() || null;

  await updateDoc(docRef, updateData);

  const updatedSnap = await getDoc(docRef);
  return mapDocToProduct(updatedSnap.id, updatedSnap.data() as Record<string, unknown>);
}
