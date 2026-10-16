'use strict';
/* eslint @typescript-eslint/no-require-imports: off */

// Read-only production-data audit. This script never writes, repairs, or deletes documents.
// Authenticate with Application Default Credentials and explicitly select the intended project.
const { initializeApp, applicationDefault, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
if (!projectId) {
  console.error('Set FIREBASE_PROJECT_ID explicitly to the intended Firebase project. No database was queried.');
  process.exit(2);
}
const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
if (usingEmulator && !projectId.startsWith('demo-')) {
  console.error('FIRESTORE_EMULATOR_HOST is set but the project ID is not a demo project. Refusing to avoid auditing the wrong database.');
  process.exit(2);
}
if (projectId.startsWith('demo-') && !usingEmulator) {
  console.error('Refusing to run the legacy-data audit against a demo project unless FIRESTORE_EMULATOR_HOST is explicitly set.');
  process.exit(2);
}

if (!getApps().length) {
  initializeApp(usingEmulator ? { projectId } : { credential: applicationDefault(), projectId });
}
const db = getFirestore();

const STATUSES = new Set(['new', 'confirmed', 'delivering', 'completed', 'cancelled']);
const moneyClose = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 0.01;
const asNumber = (value) => typeof value === 'number' && Number.isFinite(value) ? value : NaN;
const asString = (value) => typeof value === 'string' ? value : '';

function summarizeCustomer(orders) {
  const summaries = orders.map(({ id, data }) => ({
    id,
    status: STATUSES.has(data.status) ? data.status : 'new',
    total: Number.isFinite(asNumber(data.summary?.total)) && asNumber(data.summary.total) >= 0 ? asNumber(data.summary.total) : 0,
    createdAt: asString(data.createdAt),
  }));
  const active = summaries.filter((order) => order.status !== 'cancelled');
  const completed = summaries.filter((order) => order.status === 'completed');
  return {
    totalOrders: active.length,
    totalSpent: completed.reduce((sum, order) => sum + order.total, 0),
    lastOrderDate: active.map((order) => order.createdAt).sort().at(-1) || '',
    orderSummaries: summaries,
  };
}

async function main() {
  console.log(JSON.stringify({ audit: 'legacy-orders-read-only', projectId, startedAt: new Date().toISOString() }));
  const [ordersSnapshot, customersSnapshot] = await Promise.all([
    db.collection('orders').get(),
    db.collection('customers').get(),
  ]);
  const orders = ordersSnapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
  const customers = new Map(customersSnapshot.docs.map((doc) => [doc.id, doc.data()]));
  const ordersByCustomer = new Map();
  const orderCustomerById = new Map(orders.map((order) => [order.id, asString(order.data.customerId)]));
  const anomalies = {
    missingCustomerId: [],
    missingCustomerDocument: [],
    invalidStatus: [],
    malformedOrderSummary: [],
    lineItemSubtotalMismatch: [],
    orderTotalMismatch: [],
    duplicateOrderSummaryIds: [],
    customerAggregateMismatch: [],
    customerProjectionMismatch: [],
    orphanCustomerSummary: [],
  };

  for (const order of orders) {
    const data = order.data;
    const customerId = asString(data.customerId);
    if (!customerId) anomalies.missingCustomerId.push(order.id);
    else {
      if (!customers.has(customerId)) anomalies.missingCustomerDocument.push(order.id);
      if (!ordersByCustomer.has(customerId)) ordersByCustomer.set(customerId, []);
      ordersByCustomer.get(customerId).push(order);
    }
    if (!STATUSES.has(data.status)) anomalies.invalidStatus.push(order.id);

    const summary = data.summary || {};
    const items = Array.isArray(data.items) ? data.items : [];
    if (!Array.isArray(data.items) || items.length === 0 ||
        !Number.isFinite(asNumber(summary.subtotal)) ||
        !Number.isFinite(asNumber(summary.deliveryFee)) ||
        !Number.isFinite(asNumber(summary.discount)) ||
        !Number.isFinite(asNumber(summary.total))) {
      anomalies.malformedOrderSummary.push(order.id);
      continue;
    }

    let computedSubtotal = 0;
    let validItems = true;
    for (const item of items) {
      const quantity = asNumber(item.quantity);
      const unitPrice = asNumber(item.unitPrice);
      const subtotal = asNumber(item.subtotal);
      if (!Number.isFinite(quantity) || quantity <= 0 ||
          !Number.isFinite(unitPrice) || unitPrice < 0 ||
          !Number.isFinite(subtotal) || subtotal < 0 ||
          !moneyClose(quantity * unitPrice, subtotal)) {
        validItems = false;
        break;
      }
      computedSubtotal += subtotal;
    }
    if (!validItems || !moneyClose(computedSubtotal, asNumber(summary.subtotal))) {
      anomalies.lineItemSubtotalMismatch.push(order.id);
    }
    const computedTotal = asNumber(summary.subtotal) + asNumber(summary.deliveryFee) - asNumber(summary.discount);
    if (asNumber(summary.discount) < 0 || asNumber(summary.deliveryFee) < 0 ||
        asNumber(summary.discount) > asNumber(summary.subtotal) ||
        asNumber(summary.total) < 0 || !moneyClose(computedTotal, asNumber(summary.total))) {
      anomalies.orderTotalMismatch.push(order.id);
    }
  }

  for (const [customerId, customer] of customers.entries()) {
    const customerOrders = ordersByCustomer.get(customerId) || [];
    const expected = summarizeCustomer(customerOrders);
    if (customer.totalOrders !== expected.totalOrders ||
        !moneyClose(asNumber(customer.totalSpent), expected.totalSpent) ||
        asString(customer.lastOrderDate) !== expected.lastOrderDate) {
      anomalies.customerAggregateMismatch.push(customerId);
    }

    const actualSummaries = Array.isArray(customer.orderSummaries) ? customer.orderSummaries : [];
    const actualIds = actualSummaries.map((summary) => asString(summary.id));
    if (new Set(actualIds).size !== actualIds.length) anomalies.duplicateOrderSummaryIds.push(customerId);
    for (const summary of actualSummaries) {
      if (orderCustomerById.get(summary.id) !== customerId) {
        anomalies.orphanCustomerSummary.push(customerId);
        break;
      }
    }

    const normalize = (entries) => entries
      .map((entry) => ({
        id: asString(entry.id),
        status: asString(entry.status),
        total: asNumber(entry.total),
        createdAt: asString(entry.createdAt),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    const actualProjection = normalize(actualSummaries);
    const expectedProjection = normalize(expected.orderSummaries);
    const projectionsMatch = actualProjection.length === expectedProjection.length &&
      actualProjection.every((entry, index) =>
        entry.id === expectedProjection[index].id &&
        entry.status === expectedProjection[index].status &&
        moneyClose(entry.total, expectedProjection[index].total) &&
        entry.createdAt === expectedProjection[index].createdAt
      );
    if (!projectionsMatch) anomalies.customerProjectionMismatch.push(customerId);
  }

  const counts = Object.fromEntries(Object.entries(anomalies).map(([key, ids]) => [key, ids.length]));
  const report = {
    audit: 'legacy-orders-read-only',
    projectId,
    finishedAt: new Date().toISOString(),
    scanned: { orders: orders.length, customers: customers.size },
    anomalyCounts: counts,
    totalAnomalyReferences: Object.values(counts).reduce((sum, count) => sum + count, 0),
    samples: Object.fromEntries(Object.entries(anomalies).map(([key, ids]) => [key, ids.slice(0, 25)])),
    note: 'Read-only scan; no documents were modified. A document can appear in multiple anomaly categories. Samples contain document IDs only, not customer names or phone numbers.',
  };
  console.log(JSON.stringify(report, null, 2));
  if (report.totalAnomalyReferences > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('Read-only legacy-data audit failed:', error && error.message ? error.message : error);
  process.exitCode = 2;
});
