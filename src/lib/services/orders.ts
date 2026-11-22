import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  increment,
  query, 
  orderBy,
  startAfter,
  limit,
  type DocumentData,
  type QueryDocumentSnapshot,
  runTransaction,
  where
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import {
  CreateOrderInput,
  Order,
  UpdateOrderInput,
  UpdateOrderStatusInput,
  OrderItem,
  OrderStatusHistory,
  Product,
  CustomerOrderSummary
} from '@/types';
import { canTransitionOrderStatus } from '@/lib/utils/order-status';
import { normalizeIsoString } from '@/lib/utils/timestamp';

const MAX_CUSTOMER_ORDER_SUMMARIES = 20;

function mapCustomerOrderSummaries(raw: unknown): CustomerOrderSummary[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry: Record<string, unknown>) => ({
    id: String(entry.id || ''),
    status: (entry.status as Order['status']) || 'new',
    total: Number(entry.total || 0),
    createdAt: normalizeIsoString(entry.createdAt),
  }));
}

function customerOrderStateFingerprint(data: Record<string, unknown>): string {
  const summaries = mapCustomerOrderSummaries(data.orderSummaries)
    .map((summary) => ({
      id: summary.id,
      status: summary.status,
      total: summary.total,
      createdAt: summary.createdAt,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return JSON.stringify({
    summaries,
    totalOrders: data.totalOrders ?? null,
    totalSpent: data.totalSpent ?? null,
    lastOrderDate: data.lastOrderDate ?? null,
    lastOrderDateOrderId: data.lastOrderDateOrderId ?? null,
    lastOrderMutationOrderId: data.lastOrderMutationOrderId ?? null,
    lastOrderMutationId: data.lastOrderMutationId ?? null,
    lastOrderRefillOrderId: data.lastOrderRefillOrderId ?? null,
  });
}

/**
 * Keep a bounded, active-only projection ordered newest-first. Canonical order documents
 * remain complete; edits to older orders outside this cache do not displace recent rows.
 * Firestore Rules verify the first/last boundaries and allow only safe oldest-row compaction.
 */
function compareCustomerOrderSummaryDesc(a: CustomerOrderSummary, b: CustomerOrderSummary): number {
  if (a.createdAt !== b.createdAt) return a.createdAt > b.createdAt ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id > b.id ? -1 : 1;
}

function projectCustomerOrderSummaries(
  existing: CustomerOrderSummary[],
  changed: CustomerOrderSummary
): CustomerOrderSummary[] {
  // Cancelled orders remain canonical in /orders but are removed from this active-only
  // cache. Sorting on every mutation makes the latest/oldest projection boundaries
  // independently verifiable by Firestore Rules.
  const active = existing.filter((summary) => summary.status !== 'cancelled' && summary.id !== changed.id);
  if (changed.status !== 'cancelled') active.push(changed);
  return active.sort(compareCustomerOrderSummaryDesc).slice(0, MAX_CUSTOMER_ORDER_SUMMARIES);
}

function latestActiveSummary(summaries: CustomerOrderSummary[]): CustomerOrderSummary | null {
  return summaries
    .filter((summary) => summary.status !== 'cancelled')
    .sort(compareCustomerOrderSummaryDesc)[0] ?? null;
}

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
    actorUid: hist.actorUid ? String(hist.actorUid) : undefined,
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
    createdByUid: data.createdByUid ? String(data.createdByUid) : undefined,
    deliveryDate: data.deliveryDate ? normalizeIsoString(data.deliveryDate) : undefined,
  };
}

/**
 * Rebuild lifetime aggregates from the complete orders collection and compact the
 * customer document's bounded recent-order projection.
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

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Capture the projection version before the collection query.
    const beforeQuerySnap = await getDoc(customerRef);
    if (!beforeQuerySnap.exists()) return;
    const baselineData = (beforeQuerySnap.data() || {}) as Record<string, unknown>;
    const baselineFingerprint = customerOrderStateFingerprint(baselineData);

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
    const boundedProjection = scannedSummaries
      .filter((summary) => summary.status !== 'cancelled')
      .sort(compareCustomerOrderSummaryDesc)
      .slice(0, MAX_CUSTOMER_ORDER_SUMMARIES);

    try {
      await runTransaction(db, async (tx) => {
        const customerSnap = await tx.get(customerRef);
        if (!customerSnap.exists()) return;
        const currentData = (customerSnap.data() || {}) as Record<string, unknown>;

        // Any order mutation changes its unique customer marker, even when the order is
        // outside the bounded projection. Include aggregate scalars too so an admin
        // repair cannot overwrite a concurrent outside-cache cancellation or another repair.
        if (customerOrderStateFingerprint(currentData) !== baselineFingerprint) {
          throw new Error('SYNC_CUSTOMER_AGGREGATES_RETRY');
        }

        // Lifetime counters always come from the full order scan, never the bounded cache.
        const activeOrders = scannedSummaries.filter((order) => order.status !== 'cancelled');
        const completedOrders = scannedSummaries.filter((order) => order.status === 'completed');
        const latestActive = latestActiveSummary(activeOrders);
        const totalOrders = activeOrders.length;
        const totalSpent = completedOrders.reduce((sum, order) => sum + order.total, 0);

        tx.update(customerRef, {
          totalOrders,
          totalSpent,
          lastOrderDate: latestActive?.createdAt || '',
          lastOrderDateOrderId: latestActive?.id || null,
          lastOrderRefillOrderId: null,
          orderSummaries: boundedProjection,
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

export type OrderPageCursor = QueryDocumentSnapshot<DocumentData>;

export interface OrderPage {
  items: Order[];
  nextCursor: OrderPageCursor | null;
  hasMore: boolean;
}

/**
 * Cursor-based order browsing. The caller may request additional pages without
 * reading the entire collection; search/filter flows can still use listOrders()
 * when they need the existing global substring-search semantics.
 */
export async function listOrdersPage(
  cursor: OrderPageCursor | null = null,
  pageSize = 50,
  customerId?: string
): Promise<OrderPage> {
  const safePageSize = Number.isFinite(pageSize)
    ? Math.min(Math.max(Math.floor(pageSize), 1), 100)
    : 50;
  const ordersRef = collection(db, 'orders');
  const pageQuery = customerId
    ? cursor
      ? query(ordersRef, where('customerId', '==', customerId), orderBy('createdAt', 'desc'), startAfter(cursor), limit(safePageSize + 1))
      : query(ordersRef, where('customerId', '==', customerId), orderBy('createdAt', 'desc'), limit(safePageSize + 1))
    : cursor
      ? query(ordersRef, orderBy('createdAt', 'desc'), startAfter(cursor), limit(safePageSize + 1))
      : query(ordersRef, orderBy('createdAt', 'desc'), limit(safePageSize + 1));
  const snapshot = await getDocs(pageQuery);
  const pageDocs = snapshot.docs.slice(0, safePageSize);
  const lastDoc = pageDocs.at(-1) || null;

  return {
    items: pageDocs.map((docSnap) => mapDocToOrder(docSnap.id, docSnap.data())),
    nextCursor: lastDoc,
    hasMore: snapshot.docs.length > safePageSize,
  };
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

/**
 * Load only the order data required by the dashboard: every order in the supplied
 * local-day window plus the six most recent orders. This avoids downloading the
 * entire order collection just to render dashboard KPIs and the recent-orders panel.
 */
export async function getDashboardOrders(
  dayStartInclusive: string,
  dayEndExclusive: string
): Promise<{ todayOrders: Order[]; recentOrders: Order[] }> {
  if (!dayStartInclusive || !dayEndExclusive || dayStartInclusive >= dayEndExclusive) {
    throw new Error('Khoảng thời gian dashboard không hợp lệ.');
  }

  const ordersRef = collection(db, 'orders');
  const [todaySnapshot, recentSnapshot] = await Promise.all([
    getDocs(query(
      ordersRef,
      where('createdAt', '>=', dayStartInclusive),
      where('createdAt', '<', dayEndExclusive),
      orderBy('createdAt', 'desc')
    )),
    getDocs(query(ordersRef, orderBy('createdAt', 'desc'), limit(6))),
  ]);

  return {
    todayOrders: todaySnapshot.docs.map((docSnap) => mapDocToOrder(docSnap.id, docSnap.data())),
    recentOrders: recentSnapshot.docs.map((docSnap) => mapDocToOrder(docSnap.id, docSnap.data())),
  };
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

  const phoneDigits = input.customerSnapshot.phone.replace(/\D/g, '');
  const phoneNormalized = /^84[35789]\d{8}$/.test(phoneDigits) ? `0${phoneDigits.slice(2)}` : phoneDigits;
  if (!/^0[35789]\d{8}$/.test(phoneNormalized)) {
    throw new Error('Số điện thoại không hợp lệ (10 số, đầu 03/05/07/08/09).');
  }
  const customerId = input.customerId || `CUST_${phoneNormalized}`;
  const customerRef = doc(db, 'customers', customerId);
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
      ...(input.createdByUid ? { actorUid: input.createdByUid } : {}),
      note: 'Đơn hàng được tạo mới',
    };

    const orderData = {
      customerId,
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
      ...(input.createdByUid ? { createdByUid: input.createdByUid } : {}),
      deliveryDate: input.deliveryDate || null,
    };

    // The customer document is the transaction's contention point. Update scalar
    // aggregates by deltas; never derive lifetime totals from the bounded projection.
    const custRaw = customerSnap.exists() ? customerSnap.data() || {} : {};
    const existingSummaries = mapCustomerOrderSummaries(custRaw.orderSummaries);
    const newOrderSummary: CustomerOrderSummary = {
      id: orderId,
      status: 'new',
      total,
      createdAt: now,
    };
    const projectedSummaries = projectCustomerOrderSummaries(existingSummaries, newOrderSummary);
    const latestActive = latestActiveSummary(projectedSummaries);

    const updatedCustomerAggregates = {
      lastOrderDate: latestActive?.createdAt || '',
      lastOrderDateOrderId: latestActive?.id || null,
      lastOrderRefillOrderId: null,
      lastOrderMutationOrderId: orderId,
      lastOrderMutationId: initialHistory.id,
      orderSummaries: projectedSummaries,
    };

    // 3. ALL WRITES AFTER READS (Atomic)
    tx.set(orderRef, orderData);
    if (customerSnap.exists()) {
      // Atomic increment preserves the counter delta under concurrent order creation.
      tx.update(customerRef, {
        totalOrders: increment(1),
        ...updatedCustomerAggregates,
      });
    } else {
      // A first-time customer and the first order are committed together. If any
      // product/order validation fails, neither document is written.
      tx.set(customerRef, {
        name: input.customerSnapshot.name.trim(),
        phone: input.customerSnapshot.phone.trim(),
        phoneNormalized,
        address: input.customerSnapshot.address.trim(),
        totalOrders: 1,
        totalSpent: 0,
        ...updatedCustomerAggregates,
        note: null,
        createdAt: now,
      });
    }

    return mapDocToOrder(orderId, orderData);
  });
}

export async function updateOrderStatus(id: string, input: UpdateOrderStatusInput): Promise<Order> {
  if (!id) throw new Error('Mã đơn hàng không hợp lệ.');
  const orderRef = doc(db, 'orders', id);
  const maxRefillAttempts = 3;

  for (let attempt = 1; attempt <= maxRefillAttempts; attempt++) {
    let refillContext: {
      customerId: string;
      summary: CustomerOrderSummary;
      baselineFingerprint: string;
    } | null = null;

    // The Web SDK cannot query a collection inside a transaction. When cancelling a
    // cached active order would leave a hole in a non-full projection, prefetch the
    // latest canonical active order outside the cache and guard the read with the
    // customer's order-mutation fingerprint inside the transaction.
    if (input.status === 'cancelled') {
      const beforeOrderSnap = await getDoc(orderRef);
      if (!beforeOrderSnap.exists()) {
        throw new Error(`Không tìm thấy đơn hàng: ${id}`);
      }
      const beforeOrderData = beforeOrderSnap.data();
      const beforeStatus = beforeOrderData.status as Order['status'];
      const customerId = String(beforeOrderData.customerId || '');
      if (!customerId) {
        throw new Error(`Đơn hàng không có mã khách hàng: ${id}`);
      }

      if (beforeStatus !== 'cancelled' && canTransitionOrderStatus(beforeStatus, input.status)) {
        const customerRef = doc(db, 'customers', customerId);
        const beforeCustomerSnap = await getDoc(customerRef);
        if (!beforeCustomerSnap.exists()) {
          throw new Error(`Không tìm thấy khách hàng của đơn hàng: ${customerId}`);
        }
        const beforeCustomerData = beforeCustomerSnap.data() as Record<string, unknown>;
        const existingSummaries = mapCustomerOrderSummaries(beforeCustomerData.orderSummaries);
        const remainingSummaries = existingSummaries.filter(
          (summary) => summary.status !== 'cancelled' && summary.id !== id
        );
        const postActiveCount = Math.max(0, Number(beforeCustomerData.totalOrders || 0) - 1);

        if (postActiveCount > remainingSummaries.length && remainingSummaries.length < MAX_CUSTOMER_ORDER_SUMMARIES) {
          const ordersSnapshot = await getDocs(query(
            collection(db, 'orders'),
            where('customerId', '==', customerId)
          ));
          const remainingIds = new Set(remainingSummaries.map((summary) => summary.id));
          const refillCandidates = ordersSnapshot.docs
            .filter((orderSnap) => orderSnap.id !== id && !remainingIds.has(orderSnap.id))
            .map((orderSnap): CustomerOrderSummary | null => {
              const raw = orderSnap.data();
              if (!['new', 'confirmed', 'delivering', 'completed'].includes(String(raw.status))) {
                return null;
              }
              const order = mapDocToOrder(orderSnap.id, raw);
              if (!order.createdAt || !Number.isFinite(order.summary.total) || order.summary.total < 0) {
                return null;
              }
              return {
                id: order.id,
                status: order.status,
                total: order.summary.total,
                createdAt: order.createdAt,
              };
            })
            .filter((summary): summary is CustomerOrderSummary => summary !== null)
            .sort(compareCustomerOrderSummaryDesc);
          const refillSummary = refillCandidates[0] ?? null;

          if (!refillSummary) {
            throw new Error(
              `Không thể bổ sung lịch sử đơn hàng cho khách ${customerId}; cần quản trị viên đồng bộ lại dữ liệu khách hàng.`
            );
          }

          refillContext = {
            customerId,
            summary: refillSummary,
            baselineFingerprint: customerOrderStateFingerprint(beforeCustomerData),
          };
        }
      }
    }

    try {
      return await runTransaction(db, async (tx) => {
        // 1. ALL READS FIRST (Strict Firestore transaction rule)
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
        const custRaw = customerSnap.data() || {};

        if (refillContext) {
          if (
            customerId !== refillContext.customerId
            || customerOrderStateFingerprint(custRaw as Record<string, unknown>) !== refillContext.baselineFingerprint
          ) {
            throw new Error('ORDER_STATUS_REFILL_RETRY');
          }

          const refillOrderRef = doc(db, 'orders', refillContext.summary.id);
          const refillOrderSnap = await tx.get(refillOrderRef);
          if (!refillOrderSnap.exists()) {
            throw new Error('ORDER_STATUS_REFILL_RETRY');
          }
          const refillOrderData = refillOrderSnap.data();
          const refillSummaryTotal = Number((refillOrderData.summary as Record<string, unknown> | undefined)?.total);
          if (
            refillOrderData.customerId !== customerId
            || !['new', 'confirmed', 'delivering', 'completed'].includes(String(refillOrderData.status))
            || normalizeIsoString(refillOrderData.createdAt) !== refillContext.summary.createdAt
            || refillSummaryTotal !== refillContext.summary.total
          ) {
            throw new Error('ORDER_STATUS_REFILL_RETRY');
          }
        }

        // 2. COMPUTE UPDATES
        const now = new Date().toISOString();
        const historyEntry: OrderStatusHistory = {
          id: `${id}-HIST-${crypto.randomUUID()}`,
          status: input.status,
          timestamp: now,
          actorName: input.actorName || 'Nhân viên',
          ...(input.actorUid ? { actorUid: input.actorUid } : {}),
          note: input.note?.trim() || null,
        };

        const existingHistory = Array.isArray(orderData.statusHistory) ? orderData.statusHistory : [];
        const updatedHistory = [...existingHistory, historyEntry];

        const existingSummaries = mapCustomerOrderSummaries(custRaw.orderSummaries);
        const orderTotal = Number((orderData.summary as Record<string, unknown>)?.total || 0);
        const orderCreatedAt = normalizeIsoString(orderData.createdAt);
        const changedSummary: CustomerOrderSummary = {
          id,
          status: input.status,
          total: orderTotal,
          createdAt: orderCreatedAt,
        };
        const baseProjection = projectCustomerOrderSummaries(existingSummaries, changedSummary);
        const projectedSummaries = refillContext
          ? [...baseProjection, refillContext.summary]
            .sort(compareCustomerOrderSummaryDesc)
            .slice(0, MAX_CUSTOMER_ORDER_SUMMARIES)
          : baseProjection;

        const totalOrdersDelta = (input.status === 'cancelled' ? 0 : 1)
          - (currentStatus === 'cancelled' ? 0 : 1);
        const totalSpentDelta = (input.status === 'completed' ? orderTotal : 0)
          - (currentStatus === 'completed' ? orderTotal : 0);
        const latestActive = latestActiveSummary(projectedSummaries);

        // 3. WRITES (Atomic)
        tx.update(customerRef, {
          totalOrders: increment(totalOrdersDelta),
          totalSpent: increment(totalSpentDelta),
          lastOrderDate: latestActive?.createdAt || '',
          lastOrderDateOrderId: latestActive?.id || null,
          lastOrderRefillOrderId: refillContext?.summary.id || null,
          lastOrderMutationOrderId: id,
          lastOrderMutationId: updatedHistory[updatedHistory.length - 1].id,
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
    } catch (error) {
      if (error instanceof Error && error.message === 'ORDER_STATUS_REFILL_RETRY' && attempt < maxRefillAttempts) {
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    `Không thể cập nhật đơn hàng ${id}: dữ liệu khách hàng thay đổi liên tục trong ${maxRefillAttempts} lần thử.`
  );
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
  if (!input.items || input.items.length === 0) {
    throw new Error('Đơn hàng phải có ít nhất một sản phẩm.');
  }
  if (!input.customerName.trim() || !input.customerAddress.trim()) {
    throw new Error('Tên người nhận và địa chỉ giao hoa là bắt buộc.');
  }
  if (!Number.isFinite(input.deliveryFee) || !Number.isFinite(input.discount) || input.deliveryFee < 0 || input.discount < 0) {
    throw new Error('Phí giao hàng và giảm giá phải là số hợp lệ, không âm.');
  }

  const orderRef = doc(db, 'orders', id);
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
    // 1. ALL READS FIRST
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists()) {
      throw new Error(`Không tìm thấy đơn hàng: ${id}`);
    }
    const orderData = orderSnap.data();
    const currentStatus = orderData.status as Order['status'];
    if (currentStatus !== 'new' && currentStatus !== 'confirmed') {
      throw new Error('Chỉ được sửa đơn hàng ở trạng thái Mới hoặc Đã xác nhận.');
    }
    const customerId = String(orderData.customerId || '');
    if (!customerId) {
      throw new Error(`Đơn hàng không có mã khách hàng: ${id}`);
    }
    const customerRef = doc(db, 'customers', customerId);

    const productSnaps = await Promise.all(productRefs.map((p) => tx.get(p.ref)));
    const customerSnap = await tx.get(customerRef);
    if (!customerSnap.exists()) {
      throw new Error(`Không tìm thấy khách hàng của đơn hàng: ${customerId}`);
    }

    // 2. VALIDATION & CALCULATION (server prices win)
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
        id: `${id}-ITEM-${i}`,
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
    const existingHistory = Array.isArray(orderData.statusHistory) ? orderData.statusHistory : [];
    const editEntry: OrderStatusHistory = {
      id: `${id}-HIST-${crypto.randomUUID()}`,
      status: currentStatus,
      timestamp: now,
      actorName: input.actorName || 'Nhân viên',
      ...(input.actorUid ? { actorUid: input.actorUid } : {}),
      note: 'Chỉnh sửa thông tin đơn hàng',
    };

    // 3. Update only the bounded order projection. This order can only be new/confirmed,
    // so editing its price does not change lifetime order count or completed spend.
    const custRaw = customerSnap.data() || {};
    const existingSummaries = mapCustomerOrderSummaries(custRaw.orderSummaries);
    const projectedSummaries = projectCustomerOrderSummaries(existingSummaries, {
      id,
      status: currentStatus,
      total,
      createdAt: normalizeIsoString(orderData.createdAt),
    });
    const latestActive = latestActiveSummary(projectedSummaries);

    // 4. WRITES (Atomic)
    tx.update(customerRef, {
      lastOrderDate: latestActive?.createdAt || '',
      lastOrderDateOrderId: latestActive?.id || null,
      lastOrderRefillOrderId: null,
      orderSummaries: projectedSummaries,
      lastOrderMutationOrderId: id,
      lastOrderMutationId: editEntry.id,
    });
    tx.update(orderRef, {
      customerSnapshot: {
        name: input.customerName.trim(),
        phone: String((orderData.customerSnapshot as Record<string, unknown>)?.phone || ''),
        address: input.customerAddress.trim(),
      },
      items: validatedItems,
      summary: { subtotal, deliveryFee: input.deliveryFee, discount: input.discount, total },
      note: input.note?.trim() || null,
      deliveryDate: input.deliveryDate || null,
      statusHistory: [...existingHistory, editEntry],
    });

    return mapDocToOrder(id, {
      ...orderData,
      customerSnapshot: {
        name: input.customerName.trim(),
        phone: String((orderData.customerSnapshot as Record<string, unknown>)?.phone || ''),
        address: input.customerAddress.trim(),
      },
      items: validatedItems,
      summary: { subtotal, deliveryFee: input.deliveryFee, discount: input.discount, total },
      note: input.note?.trim() || null,
      deliveryDate: input.deliveryDate || null,
      statusHistory: [...existingHistory, editEntry],
    });
  });
}
