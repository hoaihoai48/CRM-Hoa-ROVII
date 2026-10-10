import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
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
  Product,
  CustomerOrderSummary
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
  const customerRef = doc(db, 'customers', customerId);
  const ordersColl = collection(db, 'orders');
  const q = query(ordersColl, where('customerId', '==', customerId));
  const maxAttempts = 5;

  const readProjection = (raw: Record<string, unknown>): CustomerOrderSummary[] => {
    const summaries = Array.isArray(raw.orderSummaries) ? raw.orderSummaries : [];
    return summaries.map((s: Record<string, unknown>) => ({
      id: String(s.id || ''),
      status: (s.status as Order['status']) || 'new',
      total: Number(s.total || 0),
      createdAt: normalizeIsoString(s.createdAt),
    }));
  };

  const projectionFingerprint = (summaries: CustomerOrderSummary[]): string =>
    JSON.stringify(
      summaries
        .map((s) => ({ id: s.id, status: s.status, total: s.total, createdAt: s.createdAt }))
        .sort((a, b) => a.id.localeCompare(b.id))
    );

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Capture the projection version before the collection query.
    const beforeQuerySnap = await getDoc(customerRef);
    if (!beforeQuerySnap.exists()) return;
    const baselineSummaries = readProjection((beforeQuerySnap.data() || {}) as Record<string, unknown>);
    const baselineFingerprint = projectionFingerprint(baselineSummaries);

    const ordersSnapshot = await getDocs(q);
    const scannedSummaries: CustomerOrderSummary[] = ordersSnapshot.docs.map((d) => {
      const order = mapDocToOrder(d.id, d.data());
      return {
        id: order.id,
        status: order.status,
        total: order.summary.total,
        createdAt: order.createdAt,
      };
    });

    try {
      await runTransaction(db, async (tx) => {
        const customerSnap = await tx.get(customerRef);
        if (!customerSnap.exists()) return;
        const currentSummaries = readProjection((customerSnap.data() || {}) as Record<string, unknown>);

        // A create/status mutation updates the projection atomically with its order.
        // If it raced with our query, do not merge guesses: retry the whole repair.
        if (projectionFingerprint(currentSummaries) !== baselineFingerprint) {
          throw new Error('SYNC_CUSTOMER_AGGREGATES_RETRY');
        }

        const activeOrders = scannedSummaries.filter((order) => order.status !== 'cancelled');
        const completedOrders = scannedSummaries.filter((order) => order.status === 'completed');
        const totalOrders = activeOrders.length;
        const totalSpent = completedOrders.reduce((sum, order) => sum + order.total, 0);
        const sortedDates = activeOrders.map((order) => order.createdAt).sort();

        tx.update(customerRef, {
          totalOrders,
          totalSpent,
          lastOrderDate: sortedDates.at(-1) || '',
          orderSummaries: scannedSummaries,
        });
      });
      return;
    } catch (error) {
      if (error instanceof Error && error.message === 'SYNC_CUSTOMER_AGGREGATES_RETRY') {
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    `Could not repair aggregates for customer ${customerId}: customer orders changed during ${maxAttempts} consecutive attempts.`
  );
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
  if (!input.items || input.items.length === 0) {
    throw new Error('Đơn hàng phải có ít nhất một sản phẩm.');
  }
  if (!Number.isFinite(input.deliveryFee) || !Number.isFinite(input.discount) || input.deliveryFee < 0 || input.discount < 0) {
    throw new Error('Phí giao hàng và giảm giá phải là số hợp lệ, không âm.');
  }

  const customerRef = doc(db, 'customers', input.customerId);
  const orderId = `DH-${crypto.randomUUID()}`;
  const orderRef = doc(db, 'orders', orderId);

  // Setup product references
  const productRefs = input.items.map((item) => {
    if (!item.productId || !Number.isFinite(item.quantity) || !Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error('Sản phẩm phải có mã hợp lệ và số lượng là số nguyên lớn hơn 0.');
    }
    return {
      productId: item.productId,
      quantity: item.quantity,
      ref: doc(db, 'products', item.productId),
    };
  });

  return await runTransaction(db, async (tx) => {
    // 1. ALL READS FIRST (Strict Firestore transaction rule: all tx.get before any writes)
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

      const unitPrice = Number(productData.price);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new Error(`Giá sản phẩm không hợp lệ: ${productData.name || pReq.productId}`);
      }
      const subtotal = unitPrice * pReq.quantity;
      if (!Number.isFinite(subtotal)) {
        throw new Error(`Tạm tính sản phẩm vượt miền giá trị hợp lệ: ${productData.name || pReq.productId}`);
      }

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
    if (!Number.isFinite(subtotal) || !Number.isFinite(total) || total < 0) {
      throw new Error('Tổng tiền đơn hàng không hợp lệ.');
    }
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
      status: 'new' as const,
      statusHistory: [initialHistory],
      note: input.note?.trim() || null,
      createdAt: now,
      createdBy: input.createdBy || 'Nhân viên',
      deliveryDate: input.deliveryDate || null,
    };

    // Transactionally read customer's existing order summaries from customer document
    // This makes customer aggregate computation 100% concurrency-safe with atomic transaction locks
    const custRaw = customerSnap.data() || {};
    const existingSummaries: CustomerOrderSummary[] = Array.isArray(custRaw.orderSummaries)
      ? custRaw.orderSummaries.map((s: Record<string, unknown>) => ({
          id: String(s.id || ''),
          status: (s.status as Order['status']) || 'new',
          total: Number(s.total || 0),
          createdAt: normalizeIsoString(s.createdAt),
        }))
      : [];

    const newOrderSummary: CustomerOrderSummary = {
      id: orderId,
      status: 'new',
      total,
      createdAt: now,
    };

    // Project new order summary into transactional list
    const allProjectedSummaries = [...existingSummaries, newOrderSummary];
    const activeSummaries = allProjectedSummaries.filter((o) => o.status !== 'cancelled');
    const completedSummaries = allProjectedSummaries.filter((o) => o.status === 'completed');

    const totalOrders = activeSummaries.length;
    const totalSpent = completedSummaries.reduce((sum, o) => sum + o.total, 0);
    const sortedDates = activeSummaries.map((o) => o.createdAt).sort();
    const lastOrderDate = sortedDates.at(-1) || '';

    const updatedCustomerAggregates = {
      totalOrders,
      totalSpent,
      lastOrderDate,
      orderSummaries: allProjectedSummaries,
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
    // 1. ALL READS FIRST (Strict Firestore transaction rule)
    // Read order inside the transaction so customerId is always consistent.
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists()) {
      throw new Error(`Không tìm thấy đơn hàng: ${id}`);
    }

    const orderData = orderSnap.data();
    const currentStatus = orderData.status as Order['status'];
    const customerId = String(orderData.customerId || '');
    if (!customerId) {
      throw new Error(`Đơn hàng không có mã khách hàng: ${id}`);
    }
    const customerRef = doc(db, 'customers', customerId);

    if (!canTransitionOrderStatus(currentStatus, input.status)) {
      throw new Error(`Không thể chuyển trạng thái từ "${currentStatus}" sang "${input.status}".`);
    }

    const customerSnap = await tx.get(customerRef);
    if (!customerSnap.exists()) {
      throw new Error(`Không tìm thấy khách hàng của đơn hàng: ${customerId}`);
    }

    // 2. COMPUTE UPDATES
    const now = new Date().toISOString();
    const historyEntry: OrderStatusHistory = {
      id: `${id}-HIST-${crypto.randomUUID()}`,
      status: input.status,
      timestamp: now,
      actorName: input.actorName || 'Nhân viên',
      note: input.note?.trim() || null,
    };

    const existingHistory = Array.isArray(orderData.statusHistory) ? orderData.statusHistory : [];
    const updatedHistory = [...existingHistory, historyEntry];

    // Transactionally read and update customer order summaries inside the transaction
    const custRaw = customerSnap.data() || {};
    const existingSummaries: CustomerOrderSummary[] = Array.isArray(custRaw.orderSummaries)
      ? custRaw.orderSummaries.map((s: Record<string, unknown>) => ({
          id: String(s.id || ''),
          status: (s.status as Order['status']) || 'new',
          total: Number(s.total || 0),
          createdAt: normalizeIsoString(s.createdAt),
        }))
      : [];

    const orderTotal = Number((orderData.summary as Record<string, unknown>)?.total || 0);
    const orderCreatedAt = normalizeIsoString(orderData.createdAt);

    // Project order with new status across customer's transactional order summaries
    let orderFoundInSummaries = false;
    const projectedSummaries = existingSummaries.map((s) => {
      if (s.id === id) {
        orderFoundInSummaries = true;
        return { ...s, status: input.status };
      }
      return s;
    });

    if (!orderFoundInSummaries) {
      projectedSummaries.push({
        id,
        status: input.status,
        total: orderTotal,
        createdAt: orderCreatedAt,
      });
    }

    const activeSummaries = projectedSummaries.filter((o) => o.status !== 'cancelled');
    const completedSummaries = projectedSummaries.filter((o) => o.status === 'completed');

    const totalOrders = activeSummaries.length;
    const totalSpent = completedSummaries.reduce((sum, o) => sum + o.total, 0);
    const sortedDates = activeSummaries.map((o) => o.createdAt).sort();
    const lastOrderDate = sortedDates.at(-1) || '';

    // 3. WRITES (Atomic)
    tx.update(customerRef, {
      totalOrders,
      totalSpent,
      lastOrderDate,
      orderSummaries: projectedSummaries,
    });

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
