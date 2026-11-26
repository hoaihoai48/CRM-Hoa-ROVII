import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
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
  Product
} from '@/types';
import { canTransitionOrderStatus } from '@/lib/utils/order-status';
import { normalizeIsoString } from '@/lib/utils/timestamp';

function normalizePhoneIdentity(value: string): string {
  const digits = value.replace(/\D/g, '');
  return /^84[35789]\d{8}$/.test(digits) ? `0${digits.slice(2)}` : digits;
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
 * Reconcile the three customer summary fields from canonical orders.
 * This is an explicit admin maintenance action, not part of order creation/history.
 */
/**
 * Reconcile customer summary fields from canonical orders.
 * Use only as an explicit maintenance action, not in normal order workflows.
 */
export async function syncCustomerAggregates(customerId: string): Promise<void> {
  if (!customerId) return;
  const customerRef = doc(db, 'customers', customerId);
  const ordersQuery = query(
    collection(db, 'orders'),
    where('customerId', '==', customerId),
  );

  // Collection queries cannot run inside a Web SDK transaction. Snapshot the three
  // aggregate values first, then retry if an order mutation changes them during the scan.
  for (let attempt = 0; attempt < 5; attempt++) {
    const before = await getDoc(customerRef);
    if (!before.exists()) return;
    const beforeData = before.data();
    const baseline = {
      totalOrders: Number(beforeData.totalOrders || 0),
      totalSpent: Number(beforeData.totalSpent || 0),
      lastOrderDate: String(beforeData.lastOrderDate || ''),
    };

    const snapshot = await getDocs(ordersQuery);
    const orders = snapshot.docs.map((item) => mapDocToOrder(item.id, item.data()));
    const totalOrders = orders.filter((order) => order.status !== 'cancelled').length;
    const totalSpent = orders
      .filter((order) => order.status === 'completed')
      .reduce((sum, order) => sum + order.summary.total, 0);
    const lastOrderDate = orders.reduce(
      (latest, order) => order.createdAt > latest ? order.createdAt : latest,
      '',
    );

    try {
      await runTransaction(db, async (tx) => {
        const current = await tx.get(customerRef);
        if (!current.exists()) return;
        const currentData = current.data();
        const unchanged =
          Number(currentData.totalOrders || 0) === baseline.totalOrders
          && Number(currentData.totalSpent || 0) === baseline.totalSpent
          && String(currentData.lastOrderDate || '') === baseline.lastOrderDate;
        if (!unchanged) throw new Error('SYNC_CUSTOMER_AGGREGATES_RETRY');
        tx.update(customerRef, { totalOrders, totalSpent, lastOrderDate });
      });
      return;
    } catch (error) {
      if (error instanceof Error && error.message === 'SYNC_CUSTOMER_AGGREGATES_RETRY') continue;
      throw error;
    }
  }

  throw new Error(`Could not repair aggregates for customer ${customerId}: order totals changed during five consecutive scans.`);
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
  if (input.items.length > 100) {
    throw new Error('Một đơn hàng không được vượt quá 100 dòng sản phẩm.');
  }
  if (!Number.isFinite(input.deliveryFee) || !Number.isFinite(input.discount) || input.deliveryFee < 0 || input.discount < 0) {
    throw new Error('Phí giao hàng và giảm giá phải là số hợp lệ, không âm.');
  }

  const phoneNormalized = normalizePhoneIdentity(input.customerSnapshot.phone);
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
    if (!customerSnap.exists() && input.customerId) {
      throw new Error('Hồ sơ khách hàng đã chọn không còn tồn tại. Vui lòng tìm và chọn lại khách hàng.');
    }
    if (customerSnap.exists()) {
      const customerData = customerSnap.data() || {};
      const storedPhone = normalizePhoneIdentity(String(customerData.phoneNormalized || customerData.phone || ''));
      if (storedPhone !== phoneNormalized) {
        throw new Error('Số điện thoại không khớp với hồ sơ khách hàng đã chọn. Vui lòng chọn lại khách hàng.');
      }
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

    const customerData = customerSnap.exists() ? customerSnap.data() || {} : {};
    const updatedCustomerAggregates = {
      totalOrders: (Number.isFinite(Number(customerData.totalOrders)) ? Number(customerData.totalOrders) : 0) + 1,
      totalSpent: Number.isFinite(Number(customerData.totalSpent)) ? Number(customerData.totalSpent) : 0,
      lastOrderDate: now,
    };

    // 3. ALL WRITES AFTER READS (Atomic)
    tx.set(orderRef, orderData);
    if (customerSnap.exists()) {
      tx.update(customerRef, updatedCustomerAggregates);
    } else {
      // A first-time customer and the first order are committed together. If any
      // product/order validation fails, neither document is written.
      tx.set(customerRef, {
        name: input.customerSnapshot.name.trim(),
        phone: input.customerSnapshot.phone.trim(),
        phoneNormalized,
        address: input.customerSnapshot.address.trim(),
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

  return await runTransaction(db, async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists()) throw new Error(`Không tìm thấy đơn hàng: ${id}`);

    const orderData = orderSnap.data();
    const currentStatus = orderData.status as Order['status'];
    const customerId = String(orderData.customerId || '');
    if (!customerId) throw new Error(`Đơn hàng không có mã khách hàng: ${id}`);
    if (!canTransitionOrderStatus(currentStatus, input.status)) {
      throw new Error(`Không thể chuyển trạng thái từ "${currentStatus}" sang "${input.status}".`);
    }

    const customerRef = doc(db, 'customers', customerId);
    const customerSnap = await tx.get(customerRef);
    if (!customerSnap.exists()) throw new Error(`Không tìm thấy khách hàng của đơn hàng: ${customerId}`);

    const now = new Date().toISOString();
    const historyEntry: OrderStatusHistory = {
      id: `${id}-HIST-${crypto.randomUUID()}`,
      status: input.status,
      timestamp: now,
      actorName: input.actorName || 'Nhân viên',
      ...(input.actorUid ? { actorUid: input.actorUid } : {}),
      note: input.note?.trim() || null,
    };
    const previousHistory = Array.isArray(orderData.statusHistory) ? orderData.statusHistory : [];
    const statusHistory = [...previousHistory, historyEntry];

    const customer = customerSnap.data() || {};
    const orderTotal = Number((orderData.summary as Record<string, unknown>)?.total || 0);
    const wasActive = currentStatus !== 'cancelled';
    const willBeActive = input.status !== 'cancelled';
    const wasCompleted = currentStatus === 'completed';
    const willBeCompleted = input.status === 'completed';

    tx.update(customerRef, {
      totalOrders: Math.max(0, Number(customer.totalOrders || 0) + Number(willBeActive) - Number(wasActive)),
      totalSpent: Math.max(0, Number(customer.totalSpent || 0)
        + (willBeCompleted ? orderTotal : 0)
        - (wasCompleted ? orderTotal : 0)),
    });
    tx.update(orderRef, { status: input.status, statusHistory });

    return mapDocToOrder(id, { ...orderData, status: input.status, statusHistory });
  });
}

/**
 * Edit an order that is still 'new' or 'confirmed'.
 *
 * Safety rules:
 * - Orders in 'delivering', 'completed' or 'cancelled' are immutable (history/financial integrity).
 * - Item unit prices are always re-read from the products collection; client totals are ignored,
 *   so changing a product price never rewrites this order's recorded prices except through an explicit edit.
 * - The order document is canonical; scalar customer aggregates are unaffected because
 *   only new/confirmed orders can be edited.
 */
export async function updateOrder(id: string, input: UpdateOrderInput): Promise<Order> {
  if (!id) throw new Error('Mã đơn hàng không hợp lệ.');
  if (!input.items || input.items.length === 0) {
    throw new Error('Đơn hàng phải có ít nhất một sản phẩm.');
  }
  if (input.items.length > 100) {
    throw new Error('Một đơn hàng không được vượt quá 100 dòng sản phẩm.');
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
    const originalItems = Array.isArray(orderData.items) ? orderData.items as OrderItem[] : [];
    const originalItemsByProductId = new Map(originalItems.map((item) => [item.productId, item]));

    const productSnaps = await Promise.all(productRefs.map((p) => tx.get(p.ref)));

    // 2. VALIDATION & CALCULATION. Active products use the current catalog price.
    // An inactive product may remain in an existing order only at its original or lower quantity,
    // preserving the price/name snapshot that the customer already accepted.
    const validatedItems: OrderItem[] = [];
    for (let i = 0; i < productSnaps.length; i++) {
      const snap = productSnaps[i];
      const pReq = productRefs[i];
      if (!snap.exists()) {
        throw new Error(`Không tìm thấy sản phẩm trong cơ sở dữ liệu: ${pReq.productId}`);
      }
      const productData = snap.data() as Product;
      const isActive = productData.isActive === true;
      const originalItem = originalItemsByProductId.get(pReq.productId);
      if (!isActive && (!originalItem || pReq.quantity > originalItem.quantity)) {
        throw new Error(`Sản phẩm đã ngừng kinh doanh: chỉ được giữ hoặc giảm số lượng đã có trong đơn (${productData.name || pReq.productId}).`);
      }
      const unitPrice = isActive ? Number(productData.price) : Number(originalItem!.unitPrice);
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
        productSnapshot: isActive ? { name: productData.name, unit: productData.unit || 'bó' } : originalItem!.productSnapshot,
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

    // 3. WRITES (Atomic)
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
