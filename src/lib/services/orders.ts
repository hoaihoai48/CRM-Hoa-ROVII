import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
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
 * Recalculation of a customer's aggregate stats in Firestore (repair / sync utility).
 */
export async function syncCustomerAggregates(customerId: string): Promise<void> {
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
  const q = query(collRef, where('customerId', '==', customerId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => mapDocToOrder(docSnap.id, docSnap.data()));
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

  const customerRef = doc(db, 'customers', input.customerId);
  const orderId = `DH-${crypto.randomUUID()}`;
  const orderRef = doc(db, 'orders', orderId);

  // Setup product references
  const productRefs = input.items.map((item) => {
    if (item.quantity <= 0) {
      throw new Error('Số lượng sản phẩm phải lớn hơn 0.');
    }
    return {
      productId: item.productId,
      quantity: item.quantity,
      ref: doc(db, 'products', item.productId),
    };
  });

  return await runTransaction(db, async (tx) => {
    // 1. ALL READS FIRST (Strict Firestore rule)
    const customerSnap = await tx.get(customerRef);
    if (!customerSnap.exists()) {
      throw new Error(`Không tìm thấy khách hàng với ID: ${input.customerId}`);
    }

    const productSnaps = await Promise.all(productRefs.map((p) => tx.get(p.ref)));

    // 2. VALIDATION & CALCULATION IN TRANSACTION
    const validatedItems: OrderItem[] = [];
    for (let i = 0; i < productSnaps.length; i++) {
      const snap = productSnaps[i];
      const pReq = productRefs[i];

      if (!snap.exists()) {
        throw new Error(`Không tìm thấy sản phẩm trong cơ sở dữ liệu: ${pReq.productId}`);
      }

      const productData = snap.data() as Product;
      if (!productData.isActive) {
        throw new Error(`Sản phẩm đã ngừng kinh doanh: ${productData.name}`);
      }

      const unitPrice = Number(productData.price || 0);
      const subtotal = unitPrice * pReq.quantity;

      validatedItems.push({
        id: `${orderId}-ITEM-${i}`,
        productId: pReq.productId,
        productSnapshot: {
          name: productData.name,
          unit: productData.unit || 'bó',
        },
        quantity: pReq.quantity,
        unitPrice,
        subtotal,
      });
    }

    const subtotal = validatedItems.reduce((sum, item) => sum + item.subtotal, 0);
    if (input.discount > subtotal) {
      throw new Error('Giảm giá không được lớn hơn tạm tính tiền hàng.');
    }

    const total = subtotal + input.deliveryFee - input.discount;
    const now = new Date().toISOString();

    const initialHistory: OrderStatusHistory = {
      id: `${orderId}-HIST-0`,
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

    // Calculate updated customer aggregates atomically from customer snapshot and new order
    const currentCustomerData = customerSnap.data() || {};
    const currentTotalOrders = Number(currentCustomerData.totalOrders || 0);
    const currentLastOrderDate = String(currentCustomerData.lastOrderDate || '');
    const updatedCustomerAggregates = {
      totalOrders: currentTotalOrders + 1,
      lastOrderDate: now > currentLastOrderDate ? now : currentLastOrderDate,
    };

    // 3. ALL WRITES AFTER READS (Atomic)
    tx.set(orderRef, orderData);
    tx.update(customerRef, updatedCustomerAggregates);

    return mapDocToOrder(orderId, orderData);
  });
}

export async function updateOrderStatus(id: string, input: UpdateOrderStatusInput): Promise<Order> {
  if (!id) throw new Error('Mã đơn hàng không hợp lệ.');
  const orderRef = doc(db, 'orders', id);

  return await runTransaction(db, async (tx) => {
    // 1. ALL READS FIRST
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists()) {
      throw new Error(`Không tìm thấy đơn hàng: ${id}`);
    }

    const orderData = orderSnap.data();
    const currentStatus = orderData.status as Order['status'];

    if (!canTransitionOrderStatus(currentStatus, input.status)) {
      throw new Error(`Không thể chuyển trạng thái từ "${currentStatus}" sang "${input.status}".`);
    }

    const customerId = String(orderData.customerId || '');
    const customerRef = customerId ? doc(db, 'customers', customerId) : null;
    const customerSnap = customerRef ? await tx.get(customerRef) : null;

    if (!customerRef || !customerSnap || !customerSnap.exists()) {
      throw new Error(`Không tìm thấy khách hàng của đơn hàng: ${customerId}`);
    }

    // 2. COMPUTE UPDATES
    const now = new Date().toISOString();
    const historyEntry: OrderStatusHistory = {
      id: `${id}-HIST-${crypto.randomUUID()}`,
      status: input.status,
      timestamp: now,
      actorName: input.actorName || 'Nhân viên',
      note: input.note?.trim() || undefined,
    };

    const existingHistory = Array.isArray(orderData.statusHistory) ? orderData.statusHistory : [];
    const updatedHistory = [...existingHistory, historyEntry];

    // Compute Customer Aggregate Delta atomically
    const custData = customerSnap.data() || {};
    let totalOrders = Number(custData.totalOrders || 0);
    let totalSpent = Number(custData.totalSpent || 0);
    const orderTotal = Number((orderData.summary as Record<string, unknown>)?.total || 0);

    // Total orders count: active orders (status !== 'cancelled')
    if (currentStatus !== 'cancelled' && input.status === 'cancelled') {
      totalOrders = Math.max(0, totalOrders - 1);
    } else if (currentStatus === 'cancelled' && input.status !== 'cancelled') {
      totalOrders += 1;
    }

    // Total spent: completed orders (status === 'completed')
    if (currentStatus !== 'completed' && input.status === 'completed') {
      totalSpent += orderTotal;
    } else if (currentStatus === 'completed' && input.status !== 'completed') {
      totalSpent = Math.max(0, totalSpent - orderTotal);
    }

    tx.update(customerRef, {
      totalOrders,
      totalSpent,
    });

    // 3. ORDER WRITE
    tx.update(orderRef, {
      status: input.status,
      statusHistory: updatedHistory,
    });

    return mapDocToOrder(id, {
      ...orderData,
      status: input.status,
      statusHistory: updatedHistory,
    });
  });
}
