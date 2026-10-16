'use strict';
/* eslint @typescript-eslint/no-require-imports: off */

const { randomUUID } = require('node:crypto');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

initializeApp();
const db = getFirestore();

const ALLOWED_STATUSES = new Set(['new', 'confirmed', 'delivering', 'completed', 'cancelled']);
const NEXT_STATUSES = {
  new: ['confirmed', 'cancelled'],
  confirmed: ['delivering', 'cancelled'],
  delivering: ['completed'],
  completed: [],
  cancelled: [],
};

function requireText(value, field, maxLength = 500) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new HttpsError('invalid-argument', `Trường ${field} không hợp lệ.`);
  }
  return value.trim();
}

function requireMoney(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new HttpsError('invalid-argument', `${field} phải là số hợp lệ, không âm.`);
  }
  return value;
}

function requireItems(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new HttpsError('invalid-argument', 'Đơn hàng phải có từ 1 đến 100 dòng sản phẩm.');
  }
  return value.map((item) => {
    const productId = requireText(item?.productId, 'productId', 160);
    if (!Number.isInteger(item?.quantity) || item.quantity <= 0 || item.quantity > 10000) {
      throw new HttpsError('invalid-argument', 'Số lượng phải là số nguyên dương hợp lệ.');
    }
    return { productId, quantity: item.quantity };
  });
}

function normalizeSummaries(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => ({
    id: String(entry?.id || ''),
    status: ALLOWED_STATUSES.has(entry?.status) ? entry.status : 'new',
    total: Number.isFinite(Number(entry?.total)) ? Number(entry.total) : 0,
    createdAt: String(entry?.createdAt || ''),
  })).filter((entry) => entry.id);
}

function computeAggregates(summaries) {
  const active = summaries.filter((entry) => entry.status !== 'cancelled');
  const completed = summaries.filter((entry) => entry.status === 'completed');
  return {
    totalOrders: active.length,
    totalSpent: completed.reduce((sum, entry) => sum + entry.total, 0),
    lastOrderDate: active.map((entry) => entry.createdAt).sort().at(-1) || '',
    orderSummaries: summaries,
  };
}

async function requireActiveMembership(transaction, uid) {
  const membershipSnap = await transaction.get(db.doc(`users/${uid}`));
  if (!membershipSnap.exists) {
    throw new HttpsError('permission-denied', 'Tài khoản chưa được cấp quyền CRM.');
  }
  const membership = membershipSnap.data();
  if (membership.status !== 'active' || !['admin', 'staff'].includes(membership.role)) {
    throw new HttpsError('permission-denied', 'Tài khoản không có quyền cập nhật dữ liệu CRM.');
  }
  return membership;
}

function trustedActorName(membership, request) {
  return String(membership.name || membership.email || request.auth?.token.email || 'Nhân viên').slice(0, 120);
}

function validateProductSnapshots(productSnapshots, requestedItems, orderId) {
  const validatedItems = [];
  for (let i = 0; i < requestedItems.length; i++) {
    const snap = productSnapshots[i];
    const requested = requestedItems[i];
    if (!snap.exists) {
      throw new HttpsError('not-found', `Không tìm thấy sản phẩm: ${requested.productId}.`);
    }
    const product = snap.data();
    if (product.isActive === false) {
      throw new HttpsError('failed-precondition', `Sản phẩm đã ngừng kinh doanh: ${product.name || requested.productId}.`);
    }
    const unitPrice = Number(product.price);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new HttpsError('failed-precondition', `Giá sản phẩm không hợp lệ: ${product.name || requested.productId}.`);
    }
    const subtotal = unitPrice * requested.quantity;
    if (!Number.isFinite(subtotal)) {
      throw new HttpsError('invalid-argument', 'Tạm tính sản phẩm vượt miền giá trị hợp lệ.');
    }
    validatedItems.push({
      id: `${orderId}-ITEM-${i}`,
      productId: requested.productId,
      productSnapshot: { name: String(product.name || ''), unit: String(product.unit || 'bó') },
      quantity: requested.quantity,
      unitPrice,
      subtotal,
    });
  }
  return validatedItems;
}

function projectOrderSummary(customer, orderId, status, total, createdAt) {
  const summaries = normalizeSummaries(customer.orderSummaries);
  let found = false;
  const projected = summaries.map((entry) => {
    if (entry.id !== orderId) return entry;
    found = true;
    return { ...entry, status, total, createdAt };
  });
  if (!found) projected.push({ id: orderId, status, total, createdAt });
  return computeAggregates(projected);
}

exports.createOrderSecure = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Bạn cần đăng nhập để tạo đơn hàng.');
  const customerId = requireText(request.data?.customerId, 'customerId', 160);
  const snapshotInput = request.data?.customerSnapshot || {};
  const customerName = requireText(snapshotInput.name, 'customerSnapshot.name', 200);
  const customerAddress = requireText(snapshotInput.address, 'customerSnapshot.address', 500);
  const requestedItems = requireItems(request.data?.items);
  const deliveryFee = requireMoney(request.data?.deliveryFee, 'Phí giao hàng');
  const discount = requireMoney(request.data?.discount, 'Giảm giá');
  const note = typeof request.data?.note === 'string' ? request.data.note.trim().slice(0, 2000) : '';
  const deliveryDate = typeof request.data?.deliveryDate === 'string' ? request.data.deliveryDate : '';
  const orderId = `DH-${randomUUID()}`;
  const now = new Date().toISOString();
  const orderRef = db.doc(`orders/${orderId}`);
  const customerRef = db.doc(`customers/${customerId}`);
  const productRefs = requestedItems.map((item) => db.doc(`products/${item.productId}`));

  return db.runTransaction(async (transaction) => {
    const membership = await requireActiveMembership(transaction, request.auth.uid);
    const customerSnap = await transaction.get(customerRef);
    const productSnaps = await Promise.all(productRefs.map((ref) => transaction.get(ref)));
    if (!customerSnap.exists) throw new HttpsError('not-found', 'Không tìm thấy khách hàng.');
    const validatedItems = validateProductSnapshots(productSnaps, requestedItems, orderId);
    const subtotal = validatedItems.reduce((sum, item) => sum + item.subtotal, 0);
    if (discount > subtotal) throw new HttpsError('invalid-argument', 'Giảm giá không được lớn hơn tạm tính tiền hàng.');
    const total = subtotal + deliveryFee - discount;
    if (!Number.isFinite(total) || total < 0) throw new HttpsError('invalid-argument', 'Tổng tiền đơn hàng không hợp lệ.');

    const actorName = trustedActorName(membership, request);
    const orderData = {
      customerId,
      customerSnapshot: {
        name: customerName,
        phone: String(customerSnap.data().phone || snapshotInput.phone || '').trim(),
        address: customerAddress,
      },
      items: validatedItems,
      summary: { subtotal, deliveryFee, discount, total },
      status: 'new',
      statusHistory: [{
        id: `${orderId}-HIST-0`,
        status: 'new',
        timestamp: now,
        actorName,
        note: 'Đơn hàng được tạo mới',
      }],
      note: note || null,
      createdAt: now,
      createdBy: actorName,
      deliveryDate: deliveryDate || null,
    };
    const customer = customerSnap.data();
    const aggregates = projectOrderSummary(customer, orderId, 'new', total, now);
    transaction.create(orderRef, orderData);
    transaction.update(customerRef, aggregates);
    return { id: orderId, ...orderData };
  });
});

exports.updateOrderStatusSecure = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Bạn cần đăng nhập để cập nhật đơn hàng.');
  const orderId = requireText(request.data?.id, 'id', 160);
  const nextStatus = request.data?.status;
  if (!ALLOWED_STATUSES.has(nextStatus)) throw new HttpsError('invalid-argument', 'Trạng thái đơn hàng không hợp lệ.');
  const note = typeof request.data?.note === 'string' ? request.data.note.trim().slice(0, 500) : '';
  const orderRef = db.doc(`orders/${orderId}`);
  const now = new Date().toISOString();

  return db.runTransaction(async (transaction) => {
    const membership = await requireActiveMembership(transaction, request.auth.uid);
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists) throw new HttpsError('not-found', 'Không tìm thấy đơn hàng.');
    const order = orderSnap.data();
    const currentStatus = order.status;
    if (!ALLOWED_STATUSES.has(currentStatus) || !NEXT_STATUSES[currentStatus]?.includes(nextStatus)) {
      throw new HttpsError('failed-precondition', `Không thể chuyển trạng thái từ "${currentStatus}" sang "${nextStatus}".`);
    }
    const customerId = requireText(order.customerId, 'customerId', 160);
    const customerRef = db.doc(`customers/${customerId}`);
    const customerSnap = await transaction.get(customerRef);
    if (!customerSnap.exists) throw new HttpsError('failed-precondition', 'Không tìm thấy khách hàng của đơn hàng.');

    const actorName = trustedActorName(membership, request);
    const historyEntry = {
      id: `${orderId}-HIST-${randomUUID()}`,
      status: nextStatus,
      timestamp: now,
      actorName,
      ...(note ? { note } : {}),
    };
    const updatedHistory = [...(Array.isArray(order.statusHistory) ? order.statusHistory : []), historyEntry];
    const total = Number(order.summary?.total);
    const aggregates = projectOrderSummary(
      customerSnap.data(),
      orderId,
      nextStatus,
      Number.isFinite(total) && total >= 0 ? total : 0,
      String(order.createdAt || ''),
    );
    transaction.update(orderRef, { status: nextStatus, statusHistory: updatedHistory });
    transaction.update(customerRef, aggregates);
    return { id: orderId, ...order, status: nextStatus, statusHistory: updatedHistory };
  });
});

exports.updateOrderSecure = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Bạn cần đăng nhập để sửa đơn hàng.');
  const orderId = requireText(request.data?.id, 'id', 160);
  const requestedItems = requireItems(request.data?.items);
  const deliveryFee = requireMoney(request.data?.deliveryFee, 'Phí giao hàng');
  const discount = requireMoney(request.data?.discount, 'Giảm giá');
  const customerName = requireText(request.data?.customerName, 'customerName', 200);
  const customerAddress = requireText(request.data?.customerAddress, 'customerAddress', 500);
  const note = typeof request.data?.note === 'string' ? request.data.note.trim().slice(0, 2000) : '';
  const deliveryDate = typeof request.data?.deliveryDate === 'string' ? request.data.deliveryDate : '';
  const orderRef = db.doc(`orders/${orderId}`);
  const now = new Date().toISOString();
  const productRefs = requestedItems.map((item) => db.doc(`products/${item.productId}`));

  return db.runTransaction(async (transaction) => {
    const membership = await requireActiveMembership(transaction, request.auth.uid);
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists) throw new HttpsError('not-found', 'Không tìm thấy đơn hàng.');
    const order = orderSnap.data();
    const currentStatus = order.status;
    if (currentStatus !== 'new' && currentStatus !== 'confirmed') {
      throw new HttpsError('failed-precondition', 'Chỉ được sửa đơn hàng ở trạng thái Mới hoặc Đã xác nhận.');
    }
    const customerId = requireText(order.customerId, 'customerId', 160);
    const customerRef = db.doc(`customers/${customerId}`);
    const productSnaps = await Promise.all(productRefs.map((ref) => transaction.get(ref)));
    const customerSnap = await transaction.get(customerRef);
    if (!customerSnap.exists) throw new HttpsError('failed-precondition', 'Không tìm thấy khách hàng của đơn hàng.');

    const validatedItems = validateProductSnapshots(productSnaps, requestedItems, orderId);
    const subtotal = validatedItems.reduce((sum, item) => sum + item.subtotal, 0);
    if (discount > subtotal) throw new HttpsError('invalid-argument', 'Giảm giá không được lớn hơn tạm tính tiền hàng.');
    const total = subtotal + deliveryFee - discount;
    if (!Number.isFinite(total) || total < 0) throw new HttpsError('invalid-argument', 'Tổng tiền đơn hàng không hợp lệ.');

    const actorName = trustedActorName(membership, request);
    const customerSnapshot = {
      name: customerName,
      phone: String(order.customerSnapshot?.phone || ''),
      address: customerAddress,
    };
    const editEntry = {
      id: `${orderId}-HIST-${randomUUID()}`,
      status: currentStatus,
      timestamp: now,
      actorName,
      note: 'Chỉnh sửa thông tin đơn hàng',
    };
    const statusHistory = [...(Array.isArray(order.statusHistory) ? order.statusHistory : []), editEntry];
    const aggregates = projectOrderSummary(customerSnap.data(), orderId, currentStatus, total, String(order.createdAt || ''));
    const updated = {
      ...order,
      customerSnapshot,
      items: validatedItems,
      summary: { subtotal, deliveryFee, discount, total },
      note: note || null,
      deliveryDate: deliveryDate || null,
      statusHistory,
    };
    transaction.update(customerRef, aggregates);
    transaction.update(orderRef, {
      customerSnapshot,
      items: validatedItems,
      summary: updated.summary,
      note: updated.note,
      deliveryDate: updated.deliveryDate,
      statusHistory,
    });
    return { id: orderId, ...updated };
  });
});

exports.syncCustomerAggregatesSecure = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Bạn cần đăng nhập để sửa thống kê khách hàng.');
  const customerId = requireText(request.data?.customerId, 'customerId', 160);
  const customerRef = db.doc(`customers/${customerId}`);
  const ordersQuery = db.collection('orders').where('customerId', '==', customerId);

  return db.runTransaction(async (transaction) => {
    await requireActiveMembership(transaction, request.auth.uid);
    const customerSnap = await transaction.get(customerRef);
    const ordersSnap = await transaction.get(ordersQuery);
    if (!customerSnap.exists) throw new HttpsError('not-found', 'Không tìm thấy khách hàng.');
    const summaries = ordersSnap.docs.map((docSnap) => {
      const order = docSnap.data();
      const total = Number(order.summary?.total);
      return {
        id: docSnap.id,
        status: ALLOWED_STATUSES.has(order.status) ? order.status : 'new',
        total: Number.isFinite(total) && total >= 0 ? total : 0,
        createdAt: String(order.createdAt || ''),
      };
    });
    transaction.update(customerRef, computeAggregates(summaries));
    return { repaired: true, customerId, orderCount: summaries.length };
  });
});
