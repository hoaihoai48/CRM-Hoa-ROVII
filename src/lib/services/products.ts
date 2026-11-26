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

/** Product image references are bounded so duplicated cover/list fields stay below Firestore's 1 MiB document limit. */
export const MAX_PRODUCT_IMAGES = 5;
export const MAX_PRODUCT_IMAGE_DATA_URL_LENGTH = 150_000;
const MAX_PRODUCT_IMAGE_REMOTE_URL_LENGTH = 2_048;
const MAX_PRODUCT_NOTE_LENGTH = 2_000;
const MAX_PRODUCT_CATEGORY_LENGTH = 100;

function normalizeImageUrls(value: unknown, fallbackCover?: string, strict = false): string[] {
  const list = Array.isArray(value)
    ? value.map((v) => String(v).trim()).filter(Boolean)
    : [];
  if (list.length === 0 && fallbackCover) list.push(fallbackCover);
  if (strict && list.length > MAX_PRODUCT_IMAGES) {
    throw new Error(`Mỗi sản phẩm chỉ được có tối đa ${MAX_PRODUCT_IMAGES} ảnh.`);
  }
  return list.slice(0, MAX_PRODUCT_IMAGES);
}

function isValidProductImageReference(value: string): boolean {
  const isBoundedDataUrl =
    value.length <= MAX_PRODUCT_IMAGE_DATA_URL_LENGTH
    && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
  const isBoundedHttpsUrl =
    value.length <= MAX_PRODUCT_IMAGE_REMOTE_URL_LENGTH
    && /^https:\/\/\S+$/.test(value);
  return isBoundedDataUrl || isBoundedHttpsUrl;
}

function assertValidProductImagePayload(imageUrls: string[], cover?: string | null): void {
  if (imageUrls.length > MAX_PRODUCT_IMAGES) {
    throw new Error(`Mỗi sản phẩm chỉ được có tối đa ${MAX_PRODUCT_IMAGES} ảnh.`);
  }
  const references = [...imageUrls, ...(cover ? [cover] : [])];
  if (references.some((reference) => !isValidProductImageReference(reference))) {
    throw new Error('Ảnh sản phẩm không hợp lệ hoặc vượt giới hạn khoảng 110KB sau nén. Hãy chọn ảnh khác hoặc giảm kích thước.');
  }
}

function assertValidProductTextBounds(category?: string | null, note?: string | null): void {
  if ((category?.trim().length || 0) > MAX_PRODUCT_CATEGORY_LENGTH) {
    throw new Error(`Danh mục không được vượt quá ${MAX_PRODUCT_CATEGORY_LENGTH} ký tự.`);
  }
  if ((note?.trim().length || 0) > MAX_PRODUCT_NOTE_LENGTH) {
    throw new Error(`Ghi chú không được vượt quá ${MAX_PRODUCT_NOTE_LENGTH} ký tự.`);
  }
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
  const cleanImageUrls = normalizeImageUrls(input.imageUrls, input.imageUrl?.trim() || undefined, true);
  assertValidProductImagePayload(cleanImageUrls, cleanImageUrls[0] || null);
  assertValidProductTextBounds(input.category, input.note);

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
  if (changes.category !== undefined) {
    assertValidProductTextBounds(changes.category, undefined);
    updateData.category = changes.category?.trim() || null;
  }
  const existingData = docSnap.data();
  const existingImageUrls = normalizeImageUrls(
    existingData.imageUrls,
    existingData.imageUrl ? String(existingData.imageUrl).trim() : undefined,
  );
  if (changes.imageUrls !== undefined) {
    const clean = normalizeImageUrls(changes.imageUrls, changes.imageUrl?.trim() || undefined, true);
    if (clean.length !== existingImageUrls.length || clean.some((url, index) => url !== existingImageUrls[index])) {
      assertValidProductImagePayload(clean, clean[0] || null);
      updateData.imageUrls = clean;
      updateData.imageUrl = clean[0] || null;
    }
  } else if (changes.imageUrl !== undefined) {
    const nextCover = changes.imageUrl?.trim() || '';
    const nextImages = nextCover
      ? [nextCover, ...existingImageUrls.filter((url) => url !== nextCover)]
      : existingImageUrls.slice(1);
    assertValidProductImagePayload(nextImages, nextCover || null);
    updateData.imageUrls = nextImages;
    updateData.imageUrl = nextCover || null;
  }
  if (changes.note !== undefined) {
    assertValidProductTextBounds(undefined, changes.note);
    updateData.note = changes.note?.trim() || null;
  }

  await updateDoc(docRef, updateData);

  const updatedSnap = await getDoc(docRef);
  return mapDocToProduct(updatedSnap.id, updatedSnap.data() as Record<string, unknown>);
}
