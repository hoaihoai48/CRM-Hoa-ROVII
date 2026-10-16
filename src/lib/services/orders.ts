import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  query, 
  orderBy
  where
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase/config';
import {
  CreateOrderInput,
  Order,
  UpdateOrderInput,
  UpdateOrderStatusInput,
  OrderItem,
  OrderStatusHistory,
} from '@/types';
import { normalizeIsoString } from '@/lib/utils/timestamp';

function mapDocToOrder(id: string, data: Record<string, unknown>): Order {
  const rawItems = Array.isArray(data.items) ? data.items : [];
  const items: OrderItem[] = rawItems.map((item: Record<string, unknown>, idx: number) => ({
    id: String(item.id || `ITEM-${idx}`),
    productId: String(item.productId || ''),
    productSnapshot: {
      name: String((item.productSnapshot as Record<string, unknown>)?.name || ''),
      unit: String((item.productSnapshot as Record<string, unknown>)?.unit || ''),
    },
    quantity: Number(item.quantity || 1),
    unitPrice: Number(item.unitPrice || 0),
    subtotal: Number(item.subtotal || 0),
  }));

  const rawHistory = Array.isArray(data.statusHistory) ? data.statusHistory : [];
  const statusHistory: OrderStatusHistory[] = rawHistory.map((hist: Record<string, unknown>, idx: number) => ({
    id: String(hist.id || `HIST-${idx}`),
    status: (hist.status as Order['status']) || 'new',
    timestamp: normalizeIsoString(hist.timestamp),
    note: hist.note ? String(hist.note) : undefined,
    actorName: String(hist.actorName || 'Hệ thống'),
  }));

  const rawSummary = (data.summary as Record<string, unknown>) || {};
  const summary = {
    subtotal: Number(rawSummary.subtotal || 0),
    deliveryFee: Number(rawSummary.deliveryFee || 0),
    discount: Number(rawSummary.discount || 0),
    total: Number(rawSummary.total || 0),
  };

  const rawCustomer = (data.customerSnapshot as Record<string, unknown>) || {};
  const customerSnapshot = {
    name: String(rawCustomer.name || ''),
    phone: String(rawCustomer.phone || ''),
    address: String(rawCustomer.address || ''),
  };

  return {
    id,
    customerId: String(data.customerId || ''),
    customerSnapshot,
    items,
    summary,
    status: (data.status as Order['status']) || 'new',
    statusHistory,
    note: data.note ? String(data.note).trim() : undefined,
    createdAt: normalizeIsoString(data.createdAt),
    createdBy: String(data.createdBy || 'Nhân viên'),
    deliveryDate: data.deliveryDate ? normalizeIsoString(data.deliveryDate) : undefined,
  };
}

/**
 * Rebuild the customer's materialized order projection from the orders collection and
 * derive aggregate fields from that projection.
 *
 * The orders query cannot be included in a Firestore Web SDK transaction. To avoid
 * overwriting a concurrent create/status mutation, snapshot the customer's current
 * projection before querying orders, then compare it inside the transaction. If it
 * changed at any point, abort this repair attempt and repeat the query from scratch.
 */
export async function syncCustomerAggregates(customerId: string): Promise<void> {
  if (!customerId) return;
  const repair = httpsCallable<{ customerId: string }, { repaired: boolean }>(
    functions,
    'syncCustomerAggregatesSecure',
  );
  await repair({ customerId });
}

export async function listOrders(): Promise<Order[]> {
  const collRef = collection(db, 'orders');
  let snapshot;
  try {
    const q = query(collRef, orderBy('createdAt', 'desc'));
    snapshot = await getDocs(q);
  } catch (error: unknown) {
    const errStr = String(error);
    if (errStr.includes('requires an index') || errStr.includes('failed-precondition')) {
      snapshot = await getDocs(collRef);
    } else {
      throw error;
    }
  }

  const orders = snapshot.docs.map((docSnap) => mapDocToOrder(docSnap.id, docSnap.data()));
  return orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listOrdersByCustomer(customerId: string): Promise<Order[]> {
  if (!customerId) return [];
  const collRef = collection(db, 'orders');
  let snapshot;
  try {
    const q = query(collRef, where('customerId', '==', customerId), orderBy('createdAt', 'desc'));
    snapshot = await getDocs(q);
  } catch (error: unknown) {
    const errStr = String(error);
    if (errStr.includes('requires an index') || errStr.includes('failed-precondition')) {
      snapshot = await getDocs(query(collRef, where('customerId', '==', customerId)));
    } else {
      throw error;
    }
  }
  const orders = snapshot.docs.map((docSnap) => mapDocToOrder(docSnap.id, docSnap.data()));
  return orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getOrderById(id: string): Promise<Order | null> {
  if (!id) return null;
  const docRef = doc(db, 'orders', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return mapDocToOrder(docSnap.id, docSnap.data());
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  if (!input.customerId) throw new Error('Khách hàng là bắt buộc.');
  if (
    !input.customerSnapshot.name.trim() ||
    !input.customerSnapshot.phone.trim() ||
    !input.customerSnapshot.address.trim()
  ) {
    throw new Error('Thông tin snapshot khách hàng chưa đầy đủ.');
  }
  if (!input.items || input.items.length === 0) throw new Error('Đơn hàng phải có ít nhất một sản phẩm.');
  if (!Number.isFinite(input.deliveryFee) || !Number.isFinite(input.discount) || input.deliveryFee < 0 || input.discount < 0) {
    throw new Error('Phí giao hàng và giảm giá phải là số hợp lệ, không âm.');
  }

  const createSecure = httpsCallable<
    Pick<CreateOrderInput, 'customerId' | 'customerSnapshot' | 'items' | 'deliveryFee' | 'discount' | 'note' | 'deliveryDate'>,
    Record<string, unknown>
  >(functions, 'createOrderSecure');
  const response = await createSecure({
    customerId: input.customerId,
    customerSnapshot: input.customerSnapshot,
    items: input.items,
    deliveryFee: input.deliveryFee,
    discount: input.discount,
    ...(input.note ? { note: input.note } : {}),
    ...(input.deliveryDate ? { deliveryDate: input.deliveryDate } : {}),
  });
  return mapDocToOrder(String(response.data.id || ''), response.data);
}

export async function updateOrderStatus(id: string, input: UpdateOrderStatusInput): Promise<Order> {
  if (!id) throw new Error('Mã đơn hàng không hợp lệ.');
  if (!input.status) throw new Error('Trạng thái đơn hàng không hợp lệ.');

  // Status changes cross the trusted server boundary. The callable verifies the active
  // membership and derives actorName from that membership instead of trusting the browser.
  const mutateStatus = httpsCallable<
    { id: string; status: UpdateOrderStatusInput['status']; note?: string },
    Record<string, unknown>
  >(functions, 'updateOrderStatusSecure');
  const response = await mutateStatus({
    id,
    status: input.status,
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
  });
  return mapDocToOrder(id, response.data);
}

/**
 * Edit an order that is still 'new' or 'confirmed'.
 *
 * Safety rules:
 * - Orders in 'delivering', 'completed' or 'cancelled' are immutable (history/financial integrity).
 * - Item unit prices are always re-read from the products collection; client totals are ignored,
 *   so changing a product price never rewrites this order's recorded prices except through an explicit edit.
 * - The customer's materialized aggregates are recomputed in the same transaction.
 */
export async function updateOrder(id: string, input: UpdateOrderInput): Promise<Order> {
  if (!id) throw new Error('Mã đơn hàng không hợp lệ.');
  if (!input.items || input.items.length === 0) throw new Error('Đơn hàng phải có ít nhất một sản phẩm.');
  if (!input.customerName.trim() || !input.customerAddress.trim()) {
    throw new Error('Tên người nhận và địa chỉ giao hoa là bắt buộc.');
  }
  if (!Number.isFinite(input.deliveryFee) || !Number.isFinite(input.discount) || input.deliveryFee < 0 || input.discount < 0) {
    throw new Error('Phí giao hàng và giảm giá phải là số hợp lệ, không âm.');
  }

  const updateSecure = httpsCallable<
    Pick<UpdateOrderInput, 'items' | 'deliveryFee' | 'discount' | 'customerName' | 'customerAddress' | 'note' | 'deliveryDate'> & { id: string },
    Record<string, unknown>
  >(functions, 'updateOrderSecure');
  const response = await updateSecure({
    id,
    items: input.items,
    deliveryFee: input.deliveryFee,
    discount: input.discount,
    customerName: input.customerName,
    customerAddress: input.customerAddress,
    ...(input.note ? { note: input.note } : {}),
    ...(input.deliveryDate ? { deliveryDate: input.deliveryDate } : {}),
  });
  return mapDocToOrder(id, response.data);
}
