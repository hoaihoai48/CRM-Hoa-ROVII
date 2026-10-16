'use strict';

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

exports.updateOrderStatusSecure = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Bạn cần đăng nhập để cập nhật đơn hàng.');
  }

  const uid = request.auth.uid;
  const membershipSnap = await db.doc(`users/${uid}`).get();
  if (!membershipSnap.exists) {
    throw new HttpsError('permission-denied', 'Tài khoản chưa được cấp quyền CRM.');
  }
  const membership = membershipSnap.data();
  if (membership.status !== 'active' || !['admin', 'staff'].includes(membership.role)) {
    throw new HttpsError('permission-denied', 'Tài khoản không có quyền cập nhật đơn hàng.');
  }

  const orderId = requireText(request.data?.id, 'id', 160);
  const nextStatus = request.data?.status;
  if (!ALLOWED_STATUSES.has(nextStatus)) {
    throw new HttpsError('invalid-argument', 'Trạng thái đơn hàng không hợp lệ.');
  }
  const note = typeof request.data?.note === 'string' ? request.data.note.trim().slice(0, 500) : '';
  const actorName = String(membership.name || membership.email || request.auth.token.email || 'Nhân viên').slice(0, 120);

  const orderRef = db.doc(`orders/${orderId}`);
  const now = new Date().toISOString();
  const result = await db.runTransaction(async (transaction) => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists) {
      throw new HttpsError('not-found', 'Không tìm thấy đơn hàng.');
    }
    const order = orderSnap.data();
    const currentStatus = order.status;
    if (!ALLOWED_STATUSES.has(currentStatus) || !NEXT_STATUSES[currentStatus]?.includes(nextStatus)) {
      throw new HttpsError('failed-precondition', `Không thể chuyển trạng thái từ "${currentStatus}" sang "${nextStatus}".`);
    }
    const customerId = requireText(order.customerId, 'customerId', 160);
    const customerRef = db.doc(`customers/${customerId}`);
    const customerSnap = await transaction.get(customerRef);
    if (!customerSnap.exists) {
      throw new HttpsError('failed-precondition', 'Không tìm thấy khách hàng của đơn hàng.');
    }

    const rawHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    const historyEntry = {
      id: `${orderId}-HIST-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: nextStatus,
      timestamp: now,
      actorName,
      ...(note ? { note } : {}),
    };
    const updatedHistory = [...rawHistory, historyEntry];
    const customer = customerSnap.data();
    const summaries = normalizeSummaries(customer.orderSummaries);
    const total = Number(order.summary?.total);
    const createdAt = String(order.createdAt || '');
    let found = false;
    const updatedSummaries = summaries.map((entry) => {
      if (entry.id !== orderId) return entry;
      found = true;
      return { ...entry, status: nextStatus, total: Number.isFinite(total) ? total : entry.total, createdAt: createdAt || entry.createdAt };
    });
    if (!found) {
      updatedSummaries.push({
        id: orderId,
        status: nextStatus,
        total: Number.isFinite(total) ? total : 0,
        createdAt,
      });
    }

    transaction.update(orderRef, { status: nextStatus, statusHistory: updatedHistory });
    transaction.update(customerRef, computeAggregates(updatedSummaries));

    return {
      id: orderId,
      ...order,
      status: nextStatus,
      statusHistory: updatedHistory,
    };
  });

  return result;
});
