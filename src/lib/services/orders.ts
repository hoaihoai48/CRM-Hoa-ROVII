import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  orderBy, 
  runTransaction,
  where
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { 
  CreateOrderInput, 
  Order, 
  UpdateOrderStatusInput, 
  OrderItem, 
  OrderStatusHistory, 
  Product 
} from '@/types';
import { canTransitionOrderStatus } from '@/lib/utils/order-status';
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
 * Atomic recalculation of a customer's aggregate stats in Firestore.
 */
async function syncCustomerAggregates(customerId: string): Promise<void> {
  if (!customerId) return;
  const customerRef = doc(db, 'customers', customerId);

  // Fetch all orders of this customer
  const ordersColl = collection(db, 'orders');
  const q = query(ordersColl, where('customerId', '==', customerId));
  const snapshot = await getDocs(q);

  const customerOrders = snapshot.docs.map((d) => mapDocToOrder(d.id, d.data()));
  const activeOrders = customerOrders.filter((order) => order.status !== 'cancelled');
  const completedOrders = customerOrders.filter((order) => order.status === 'completed');

  const totalOrders = activeOrders.length;
  const totalSpent = completedOrders.reduce((sum, order) => sum + order.summary.total, 0);
  const sortedDates = activeOrders.map((order) => order.createdAt).sort();
  const lastOrderDate = sortedDates.at(-1) || '';

  await updateDoc(customerRef, {
    totalOrders,
    totalSpent,
    lastOrderDate,
  });
}

export async function listOrders(): Promise<Order[]> {
  const collRef = collection(db, 'orders');
  try {
    const q = query(collRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => mapDocToOrder(docSnap.id, docSnap.data()));
  } catch {
    const snapshot = await getDocs(collRef);
    const orders = snapshot.docs.map((docSnap) => mapDocToOrder(docSnap.id, docSnap.data()));
    return orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
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
  if (!input.items || input.items.length === 0) {
    throw new Error('Đơn hàng phải có ít nhất một sản phẩm.');
  }
  if (input.deliveryFee < 0 || input.discount < 0) {
    throw new Error('Phí giao hàng và giảm giá không được âm.');
  }

  // Verify customer exists in Firestore
  const customerRef = doc(db, 'customers', input.customerId);
  const customerSnap = await getDoc(customerRef);
  if (!customerSnap.exists()) {
    throw new Error(`Không tìm thấy khách hàng với ID: ${input.customerId}`);
  }

  // Read real products from Firestore & verify status and price
  const validatedItems: OrderItem[] = [];
  for (let i = 0; i < input.items.length; i++) {
    const itemInput = input.items[i];
    if (itemInput.quantity <= 0) {
      throw new Error('Số lượng sản phẩm phải lớn hơn 0.');
    }

    const prodRef = doc(db, 'products', itemInput.productId);
    const prodSnap = await getDoc(prodRef);
    if (!prodSnap.exists()) {
      throw new Error(`Không tìm thấy sản phẩm trong cơ sở dữ liệu: ${itemInput.productId}`);
    }

    const productData = prodSnap.data() as Product;
    if (!productData.isActive) {
      throw new Error(`Sản phẩm đã ngừng kinh doanh: ${productData.name}`);
    }

    const unitPrice = Number(productData.price);
    const subtotal = unitPrice * itemInput.quantity;

    validatedItems.push({
      id: `ITEM-${Date.now()}-${i}`,
      productId: itemInput.productId,
      productSnapshot: {
        name: productData.name,
        unit: productData.unit || 'bó',
      },
      quantity: itemInput.quantity,
      unitPrice,
      subtotal,
    });
  }

  const subtotal = validatedItems.reduce((sum, item) => sum + item.subtotal, 0);
  if (input.discount > subtotal) {
    throw new Error('Giảm giá không được lớn hơn tạm tính tiền hàng.');
  }

  const total = subtotal + input.deliveryFee - input.discount;
  const orderId = `DH-${Date.now()}`;
  const now = new Date().toISOString();

  const initialHistory: OrderStatusHistory = {
    id: `HIST-${Date.now()}`,
    status: 'new',
    timestamp: now,
    actorName: input.createdBy || 'Nhân viên',
    note: 'Đơn hàng được tạo mới',
  };

  const orderData = {
    customerId: input.customerId,
    customerSnapshot: {
      name: input.customerSnapshot.name.trim(),
      phone: input.customerSnapshot.phone.trim(),
      address: input.customerSnapshot.address.trim(),
    },
    items: validatedItems,
    summary: {
      subtotal,
      deliveryFee: input.deliveryFee,
      discount: input.discount,
      total,
    },
    status: 'new',
    statusHistory: [initialHistory],
    note: input.note?.trim() || null,
    createdAt: now,
    createdBy: input.createdBy || 'Nhân viên',
    deliveryDate: input.deliveryDate || null,
  };

  const orderRef = doc(db, 'orders', orderId);
  await setDoc(orderRef, orderData);

  // Sync customer aggregates atomically
  try {
    await syncCustomerAggregates(input.customerId);
  } catch (err) {
    console.error('Lỗi cập nhật customer aggregates:', err);
  }

  return mapDocToOrder(orderId, orderData);
}

export async function updateOrderStatus(id: string, input: UpdateOrderStatusInput): Promise<Order> {
  if (!id) throw new Error('Mã đơn hàng không hợp lệ.');
  const orderRef = doc(db, 'orders', id);

  return await runTransaction(db, async (transaction) => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists()) {
      throw new Error(`Không tìm thấy đơn hàng: ${id}`);
    }

    const orderData = orderSnap.data();
    const currentStatus = orderData.status as Order['status'];

    if (!canTransitionOrderStatus(currentStatus, input.status)) {
      throw new Error(`Không thể chuyển trạng thái từ "${currentStatus}" sang "${input.status}".`);
    }

    const now = new Date().toISOString();
    const historyEntry: OrderStatusHistory = {
      id: `HIST-${Date.now()}`,
      status: input.status,
      timestamp: now,
      actorName: input.actorName || 'Nhân viên',
      note: input.note?.trim() || undefined,
    };

    const existingHistory = Array.isArray(orderData.statusHistory) ? orderData.statusHistory : [];
    const updatedHistory = [...existingHistory, historyEntry];

    transaction.update(orderRef, {
      status: input.status,
      statusHistory: updatedHistory,
    });

    return mapDocToOrder(id, {
      ...orderData,
      status: input.status,
      statusHistory: updatedHistory,
    });
  }).then(async (updatedOrder) => {
    // Sync customer aggregates if status changes affect total or active count
    if (updatedOrder.customerId) {
      try {
        await syncCustomerAggregates(updatedOrder.customerId);
      } catch (err) {
        console.error('Lỗi đồng bộ customer aggregates:', err);
      }
    }
    return updatedOrder;
  });
}
