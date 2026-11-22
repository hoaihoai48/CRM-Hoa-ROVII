/**
 * Firebase Firestore Emulator Automated Integration & Concurrency Test Suite
 * Tests Cases A through P for Data Invariants & Optimistic Concurrency Control (OCC)
 */

import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, auth } from '../src/lib/firebase/config';
import { createCustomer, findCustomerByPhone, getCustomerById, updateCustomer } from '../src/lib/services/customers';
import { createOrder, getDashboardOrders, getOrderById, syncCustomerAggregates, updateOrder, updateOrderStatus } from '../src/lib/services/orders';
import { Product } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

/**
 * Trusted test-only administrative provision helper using Firestore Emulator REST API
 * (Authorization: Bearer owner). This mimics Firebase Admin SDK or Console actions
 * without exposing production credentials or introducing client-side security backdoors.
 */
async function provisionUserMembership(
  uid: string,
  membership: { email: string; role: 'admin' | 'staff'; status: 'active' | 'inactive' }
) {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'crm-hoa-rovii';
  const url = `http://${host}/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer owner',
    },
    body: JSON.stringify({
      fields: {
        role: { stringValue: membership.role },
        status: { stringValue: membership.status },
        email: { stringValue: membership.email },
        createdAt: { stringValue: new Date().toISOString() },
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to provision user ${uid} via emulator REST API: ${errorText}`);
  }
}

function encodeFirestoreValue(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeFirestoreValue) } };
  if (typeof value === 'object') {
    const fields: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry !== undefined) fields[key] = encodeFirestoreValue(entry);
    }
    return { mapValue: { fields } };
  }
  throw new Error(`Unsupported Firestore Emulator test value type: ${typeof value}`);
}

async function setDocumentAsAdmin(collectionName: string, documentId: string, data: Record<string, unknown>) {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'crm-hoa-rovii';
  const url = `http://${host}/v1/projects/${projectId}/databases/(default)/documents/${collectionName}/${documentId}`;
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) fields[key] = encodeFirestoreValue(value);
  }
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Failed to seed ${collectionName}/${documentId} via Emulator admin API: ${await res.text()}`);
}

async function corruptCustomerAggregatesAsAdmin(customerId: string) {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'crm-hoa-rovii';
  const updateMask = [
    'updateMask.fieldPaths=totalOrders',
    'updateMask.fieldPaths=totalSpent',
    'updateMask.fieldPaths=orderSummaries',
  ].join('&');
  const url = `http://${host}/v1/projects/${projectId}/databases/(default)/documents/customers/${customerId}?${updateMask}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer owner',
    },
    body: JSON.stringify({
      fields: {
        totalOrders: { integerValue: '99999' },
        totalSpent: { integerValue: '88888888' },
        orderSummaries: {
          arrayValue: {
            values: [{
              mapValue: {
                fields: {
                  id: { stringValue: 'CORRUPTED-ORDER' },
                  status: { stringValue: 'completed' },
                  total: { integerValue: '99999999' },
                  createdAt: { stringValue: '2020-01-01T00:00:00.000Z' },
                },
              },
            }],
          },
        },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to corrupt customer aggregates through emulator admin API: ${await res.text()}`);
  }
}

async function runTestSuite() {
  console.log('🚀 Starting Firebase Emulator Integration & Invariant Verification Suite...\n');

  // Authenticate as a staff user in Auth emulator
  const testStaffEmail = 'staff.tester@cuatiemhoa.vn';
  const testStaffPass = 'SecurePassword123!';
  let staffUserUid = '';
  try {
    const cred = await createUserWithEmailAndPassword(auth, testStaffEmail, testStaffPass);
    staffUserUid = cred.user.uid;
    console.log(`🔐 Created & authenticated staff test user: ${testStaffEmail} (${staffUserUid})`);
  } catch {
    // If user already exists in emulator session, sign in
    const cred = await signInWithEmailAndPassword(auth, testStaffEmail, testStaffPass);
    staffUserUid = cred.user.uid;
    console.log(`🔐 Authenticated existing staff test user: ${testStaffEmail} (${staffUserUid})`);
  }

  // Provision trusted active staff membership via emulator administrative API
  await provisionUserMembership(staffUserUid, {
    email: testStaffEmail,
    role: 'staff',
    status: 'active',
  });
  console.log('🛡️ Provisioned active staff membership via trusted emulator admin path.');

  // Setup seed products
  const p1: Product = {
    id: 'PROD_HOA_HONG',
    name: 'Bó Hoa Hồng Đỏ',
    category: 'hoa-bo',
    price: 350000,
    unit: 'bó',
    isActive: true,
    note: 'Hoa hồng đỏ tươi',
    createdAt: new Date().toISOString(),
  };

  const p2: Product = {
    id: 'PROD_HOA_LAN',
    name: 'Chậu Lan Hồ Điệp',
    category: 'hoa-chau',
    price: 850000,
    unit: 'chậu',
    isActive: true,
    note: 'Lan hồ điệp sang trọng',
    createdAt: new Date().toISOString(),
  };

  const pInactive: Product = {
    id: 'PROD_INACTIVE',
    name: 'Hoa Tạm Ngưng',
    category: 'hoa-bo',
    price: 100000,
    unit: 'bó',
    isActive: false,
    createdAt: new Date().toISOString(),
  };

  await setDocumentAsAdmin('products', p1.id, Object.fromEntries(Object.entries(p1).filter(([key]) => key !== 'id')));
  await setDocumentAsAdmin('products', p2.id, Object.fromEntries(Object.entries(p2).filter(([key]) => key !== 'id')));
  await setDocumentAsAdmin('products', pInactive.id, Object.fromEntries(Object.entries(pInactive).filter(([key]) => key !== 'id')));
  console.log('✅ Seeded test products into emulator.\\n');

  console.log('--- SECURITY: Product catalog writes are admin-only ---');
  let staffProductCreateBlocked = false;
  try {
    await setDoc(doc(db, 'products', 'PROD_STAFF_FORGED'), {
      name: 'Forged Product', price: 1, unit: 'bó', isActive: true, createdAt: new Date().toISOString(),
    });
  } catch {
    staffProductCreateBlocked = true;
  }
  assert(staffProductCreateBlocked, 'Active staff must not create products directly');

  let staffPriceChangeBlocked = false;
  try {
    await updateDoc(doc(db, 'products', p1.id), { price: 1 });
  } catch {
    staffPriceChangeBlocked = true;
  }
  assert(staffPriceChangeBlocked, 'Active staff must not change product prices directly');

  let staffProductDeleteBlocked = false;
  try {
    await (await import('firebase/firestore')).deleteDoc(doc(db, 'products', p1.id));
  } catch {
    staffProductDeleteBlocked = true;
  }
  assert(staffProductDeleteBlocked, 'Active staff must not delete products directly');


  // ==========================================
  // TEST: Vietnamese phone canonicalization and legacy compatibility
  // ==========================================
  console.log('--- TEST GUARD: Canonical phone identity and legacy aliases ---');
  const canonicalPhoneCustomer = await createCustomer({
    name: 'Khách Chuẩn Hóa',
    phone: '0901234567',
    address: '1 Canonical Street',
  });
  const internationalPhoneAlias = await createCustomer({
    name: 'Khách Dùng Đầu Số Quốc Tế',
    phone: '+84 901 234 567',
    address: '1 Canonical Street',
  });
  assert(
    internationalPhoneAlias.id === canonicalPhoneCustomer.id,
    'National and +84 formats must resolve to the same customer',
  );
  assert(
    internationalPhoneAlias.phoneNormalized === '0901234567',
    'Stored phoneNormalized must use Vietnamese national format',
  );
  const aliasLookup = await findCustomerByPhone('+84 901 234 567');
  assert(aliasLookup?.id === canonicalPhoneCustomer.id, 'Phone lookup must resolve international aliases');

  // Simulate a record created before canonicalization used an 84... deterministic ID.
  const legacyPhoneDigits = '84901234568';
  const legacyCustomerId = `CUST_${legacyPhoneDigits}`;
  await setDoc(doc(db, 'customers', legacyCustomerId), {
    name: 'Khách Legacy',
    phone: '+84901234568',
    phoneNormalized: legacyPhoneDigits,
    address: '2 Legacy Street',
    totalOrders: 0,
    totalSpent: 0,
    lastOrderDate: '',
    orderSummaries: [],
    createdAt: new Date().toISOString(),
  });
  const legacyNationalLookup = await createCustomer({
    name: 'Khách Legacy National Format',
    phone: '0901234568',
    address: '2 Legacy Street',
  });
  assert(legacyNationalLookup.id === legacyCustomerId, 'Create must reuse legacy international-format customer IDs');
  const legacyInternationalLookup = await findCustomerByPhone('0901234568');
  assert(legacyInternationalLookup?.id === legacyCustomerId, 'Lookup must find legacy phoneNormalized values');

  // ==========================================
  // TEST: New customer + first order are atomic
  // ==========================================
  console.log('--- TEST ATOMICITY: New customer and first order ---');
  const failedAtomicCustomerId = 'CUST_0901111223';
  let atomicOrderRejected = false;
  try {
    await createOrder({
      customerSnapshot: { name: 'Atomic Failure', phone: '0901111223', address: 'Atomic Test Address' },
      items: [{ productId: pInactive.id, quantity: 1 }],
      deliveryFee: 0,
      discount: 0,
      createdBy: 'Tester',
    });
  } catch {
    atomicOrderRejected = true;
  }
  assert(atomicOrderRejected, 'Invalid product must reject a first-order transaction');
  assert((await getCustomerById(failedAtomicCustomerId)) === null, 'Failed first-order transaction must not leave an orphan customer');

  let forgedCustomerBlocked = false;
  try {
    const now = new Date().toISOString();
    await setDoc(doc(db, 'customers', 'CUST_0901111225'), {
      name: 'Forged Customer', phone: '0901111225', phoneNormalized: '0901111225', address: 'Forged Address',
      totalOrders: 1, totalSpent: 0, lastOrderDate: now,
      orderSummaries: [{ id: 'MISSING-ORDER', status: 'new', total: 100, createdAt: now }], createdAt: now,
    });
  } catch {
    forgedCustomerBlocked = true;
  }
  assert(forgedCustomerBlocked, 'Rules must reject a non-empty first-customer projection without a matching order');

  const atomicSuccess = await createOrder({
    customerSnapshot: { name: 'Atomic Success', phone: '0901111224', address: 'Atomic Test Address' },
    items: [{ productId: p1.id, quantity: 1 }],
    deliveryFee: 0,
    discount: 0,
    createdBy: 'Tester',
    createdByUid: staffUserUid,
  });
  const atomicCustomer = await getCustomerById('CUST_0901111224');
  assert(atomicCustomer !== null, 'Successful first-order transaction must create the customer');
  assert(atomicCustomer!.totalOrders === 1, 'New customer must receive the first order aggregate atomically');
  const atomicOrderRecord = await getOrderById(atomicSuccess.id);
  assert(atomicOrderRecord?.createdByUid === staffUserUid, 'New order must retain the authenticated creator UID');
  assert(atomicOrderRecord?.statusHistory[0]?.actorUid === staffUserUid, 'Initial order history must retain the authenticated actor UID');
  assert(atomicCustomer!.orderSummaries?.some((summary) => summary.id === atomicSuccess.id) ?? false, 'New customer projection must contain the first order');

  let forgedActorUidBlocked = false;
  try {
    await createOrder({
      customerSnapshot: { name: 'Forged Actor', phone: '0901111226', address: 'Atomic Test Address' },
      items: [{ productId: p1.id, quantity: 1 }],
      deliveryFee: 0,
      discount: 0,
      createdBy: 'Tester',
      createdByUid: 'NOT-THE-AUTHENTICATED-UID',
    });
  } catch {
    forgedActorUidBlocked = true;
  }
  assert(forgedActorUidBlocked, 'Rules must reject a forged creator UID');
  assert((await getCustomerById('CUST_0901111226')) === null, 'Rejected forged actor write must not create a customer');

  // ==========================================
  // TEST: Inactive / Invalid Product Guards
  // ==========================================
  console.log('--- TEST GUARD: Reject Inactive & Non-Existent Products ---');
  const tempCust = await createCustomer({
    name: 'Khách Test Guard',
    phone: '0901111222',
    address: '123 Guard Street',
  });

  let threwInactive = false;
  try {
    await createOrder({
      customerId: tempCust.id,
      customerSnapshot: { name: tempCust.name, phone: tempCust.phone, address: tempCust.address },
      items: [{ productId: 'PROD_INACTIVE', quantity: 1 }],
      deliveryFee: 0,
      discount: 0,
      createdBy: 'Tester',
    });
  } catch (err: unknown) {
    threwInactive = true;
    console.log(`  ✓ Correctly rejected inactive product with error: ${(err as Error).message}`);
  }
  assert(threwInactive, 'Must reject order creation with inactive product');

  // ==========================================
  // CASE A: Create order when no previous orders exist
  // ==========================================
  console.log('\n--- CASE A: First Order Creation ---');
  const custA = await createCustomer({
    name: 'Nguyễn Văn A',
    phone: '0900000001',
    address: '1 Lê Lợi, Q1, TP.HCM',
  });

  const orderA = await createOrder({
    customerId: custA.id,
    customerSnapshot: { name: custA.name, phone: custA.phone, address: custA.address },
    items: [{ productId: p1.id, quantity: 2 }], // 350k * 2 = 700k
    deliveryFee: 30000,
    discount: 50000, // Total = 680,000
    createdBy: 'Tester',
  });

  const custACheck = await getCustomerById(custA.id);
  assert(custACheck !== null, 'Customer A must exist');
  assert(custACheck!.totalOrders === 1, `Case A: totalOrders must be 1 (got ${custACheck!.totalOrders})`);
  assert(custACheck!.totalSpent === 0, `Case A: totalSpent must be 0 for 'new' status (got ${custACheck!.totalSpent})`);
  assert(custACheck!.lastOrderDate === orderA.createdAt, 'Case A: lastOrderDate must match order createdAt');
  assert((custACheck!.orderSummaries?.length ?? 0) === 1, 'Case A: orderSummaries length must be 1');

  console.log('--- SECURITY: Active members use client transactions; schema still applies ---');
  let malformedOrderBlocked = false;
  try {
    await setDoc(doc(db, 'orders', 'CLIENT-MALFORMED-ORDER'), {
      status: 'completed',
      summary: { total: 1 },
    });
  } catch {
    malformedOrderBlocked = true;
  }
  assert(malformedOrderBlocked, 'Active client must not create an order that violates the required document schema');

  // Spark-compatible architecture intentionally allows active members to write orders
  // through the client SDK. Rules validate access/schema but cannot verify all totals
  // against product documents or recompute the customer's entire order history.
  // This is acceptable for the trusted internal team operating model, not for public
  // self-service or an adversarial client threat model.

  let forgedCustomerCreateBlocked = false;
  try {
    await setDoc(doc(db, 'customers', 'CLIENT-FORGED-CUSTOMER'), {
      name: 'Forged', phone: '0900000000', phoneNormalized: '0900000000', address: 'Nowhere',
      totalOrders: 99, totalSpent: 999999, lastOrderDate: '2099-01-01', createdAt: new Date().toISOString(),
    });
  } catch {
    forgedCustomerCreateBlocked = true;
  }
  assert(forgedCustomerCreateBlocked, 'Active client must not create a customer with forged aggregates');

  // ==========================================
  // CASE B, C: Multiple orders with Completed & Cancelled states
  // ==========================================
  console.log('\n--- CASE B & C: Multiple Orders & Aggregate Calculations ---');
  const custBC = await createCustomer({
    name: 'Trần Thị B',
    phone: '0900000002',
    address: '2 Nguyễn Huệ, Q1, TP.HCM',
  });

  // Create Order 1 (will be completed)
  const o1 = await createOrder({
    customerId: custBC.id,
    customerSnapshot: { name: custBC.name, phone: custBC.phone, address: custBC.address },
    items: [{ productId: p1.id, quantity: 1 }], // 350,000
    deliveryFee: 0,
    discount: 0,
    createdBy: 'Tester',
  });

  // Complete Order 1: new -> confirmed -> delivering -> completed
  await updateOrderStatus(o1.id, { status: 'confirmed', actorName: 'Tester' });
  await updateOrderStatus(o1.id, { status: 'delivering', actorName: 'Tester' });
  await updateOrderStatus(o1.id, { status: 'completed', actorName: 'Tester' });

  // Create Order 2 (will be cancelled)
  const o2 = await createOrder({
    customerId: custBC.id,
    customerSnapshot: { name: custBC.name, phone: custBC.phone, address: custBC.address },
    items: [{ productId: p2.id, quantity: 1 }], // 850,000
    deliveryFee: 0,
    discount: 0,
    createdBy: 'Tester',
  });
  // Cancel Order 2: new -> cancelled
  await updateOrderStatus(o2.id, { status: 'cancelled', actorName: 'Tester', note: 'Khách đổi ý' });

  // Create Order 3 (remains active 'new')
  const o3 = await createOrder({
    customerId: custBC.id,
    customerSnapshot: { name: custBC.name, phone: custBC.phone, address: custBC.address },
    items: [{ productId: p1.id, quantity: 1 }], // 350,000
    deliveryFee: 20000,
    discount: 0,
    createdBy: 'Tester',
  });

  const custBCCheck = await getCustomerById(custBC.id);
  // Total orders: o1 (completed, active) + o3 (new, active) = 2 active orders. o2 is cancelled!
  assert(custBCCheck!.totalOrders === 2, `Case B: totalOrders must be 2 excluding cancelled (got ${custBCCheck!.totalOrders})`);
  // Total spent: only o1 is completed = 350,000
  assert(custBCCheck!.totalSpent === 350000, `Case C: totalSpent must be 350,000 (got ${custBCCheck!.totalSpent})`);
  assert(custBCCheck!.lastOrderDate === o3.createdAt, 'Case B: lastOrderDate must be latest active order (o3)');

  // ==========================================
  // CASE D, E, F, G: Order Status Transitions
  // ==========================================
  console.log('\n--- CASE D, E, F, G: Status Lifecycle & State Machine Transitions ---');
  const custTrans = await createCustomer({
    name: 'Lê Văn C',
    phone: '0900000003',
    address: '3 Pasteur, Q3, TP.HCM',
  });

  const oTrans = await createOrder({
    customerId: custTrans.id,
    customerSnapshot: { name: custTrans.name, phone: custTrans.phone, address: custTrans.address },
    items: [{ productId: p2.id, quantity: 2 }], // 850k * 2 = 1,700,000
    deliveryFee: 50000,
    discount: 100000, // Total = 1,650,000
    createdBy: 'Tester',
  });

  const initialOrderSnap = await getDoc(doc(db, 'orders', oTrans.id));

  // Order creation must atomically update the matching customer order projection.
  const orphanOrderId = `ORPHAN-ORDER-${crypto.randomUUID()}`;
  let orphanOrderCreateBlocked = false;
  try {
    await setDoc(doc(db, 'orders', orphanOrderId), initialOrderSnap.data() || {});
  } catch {
    orphanOrderCreateBlocked = true;
  }
  assert(
    orphanOrderCreateBlocked,
    'Firestore Rules must reject creating an order without its customer projection in the same transaction',
  );

  // Keep projection-negative test fixtures isolated from the main lifecycle aggregate assertions.
  const custProjection = await createCustomer({
    name: 'Khách hàng kiểm tra projection',
    phone: '0900000012',
    address: '12 Đường Hoa, Hà Nội',
  });

  // A valid status/history transition must also update the customer's order projection atomically.
  const projectionStatusOrder = await createOrder({
    customerId: custProjection.id,
    customerSnapshot: { name: custProjection.name, phone: custProjection.phone, address: custProjection.address },
    items: [{ productId: p1.id, quantity: 1 }],
    deliveryFee: 0,
    discount: 0,
    createdBy: 'Tester',
  });
  const projectionStatusSnap = await getDoc(doc(db, 'orders', projectionStatusOrder.id));
  const projectionStatusData = projectionStatusSnap.data() || {};
  let missingStatusProjectionBlocked = false;
  try {
    await updateDoc(doc(db, 'orders', projectionStatusOrder.id), {
      status: 'confirmed',
      statusHistory: [
        ...((projectionStatusData.statusHistory || []) as Array<Record<string, unknown>>),
        {
          id: 'FORGED-STATUS-WITHOUT-PROJECTION',
          status: 'confirmed',
          timestamp: new Date().toISOString(),
          actorName: 'Untrusted Client',
        },
      ],
    });
  } catch {
    missingStatusProjectionBlocked = true;
  }
  assert(
    missingStatusProjectionBlocked,
    'Firestore Rules must reject status transitions that do not atomically update the customer projection',
  );

  // A price/total edit must update the same customer's order summary in that transaction.
  const projectionTotalOrder = await createOrder({
    customerId: custProjection.id,
    customerSnapshot: { name: custProjection.name, phone: custProjection.phone, address: custProjection.address },
    items: [{ productId: p1.id, quantity: 1 }],
    deliveryFee: 0,
    discount: 0,
    createdBy: 'Tester',
  });
  const projectionTotalSnap = await getDoc(doc(db, 'orders', projectionTotalOrder.id));
  const projectionTotalData = projectionTotalSnap.data() || {};
  let missingTotalProjectionBlocked = false;
  try {
    await updateDoc(doc(db, 'orders', projectionTotalOrder.id), {
      summary: { subtotal: 1, deliveryFee: 0, discount: 0, total: 1 },
      statusHistory: [
        ...((projectionTotalData.statusHistory || []) as Array<Record<string, unknown>>),
        {
          id: 'FORGED-TOTAL-WITHOUT-PROJECTION',
          status: 'new',
          timestamp: new Date().toISOString(),
          actorName: 'Untrusted Client',
        },
      ],
    });
  } catch {
    missingTotalProjectionBlocked = true;
  }
  assert(
    missingTotalProjectionBlocked,
    'Firestore Rules must reject order total changes that do not atomically update the customer projection',
  );

  const invalidInitialOrderId = `INVALID-INITIAL-HISTORY-${crypto.randomUUID()}`;
  let invalidInitialHistoryBlocked = false;
  try {
    await setDoc(doc(db, 'orders', invalidInitialOrderId), {
      ...(initialOrderSnap.data() || {}),
      status: 'confirmed',
    });
  } catch {
    invalidInitialHistoryBlocked = true;
  }
  assert(
    invalidInitialHistoryBlocked,
    'Firestore Rules must reject a new order whose initial status/history does not start at new',
  );

  let directInvalidTransitionBlocked = false;
  try {
    await updateDoc(doc(db, 'orders', oTrans.id), { status: 'completed' });
  } catch {
    directInvalidTransitionBlocked = true;
  }
  assert(
    directInvalidTransitionBlocked,
    'Firestore Rules must block a direct client transition from new to completed',
  );

  let directStatusWithoutHistoryBlocked = false;
  try {
    await updateDoc(doc(db, 'orders', oTrans.id), { status: 'confirmed' });
  } catch {
    directStatusWithoutHistoryBlocked = true;
  }
  assert(
    directStatusWithoutHistoryBlocked,
    'Firestore Rules must block status changes that do not append a matching history entry',
  );

  let directHistoryRewriteBlocked = false;
  try {
    await updateDoc(doc(db, 'orders', oTrans.id), {
      statusHistory: [{
        id: 'FORGED-HISTORY',
        status: 'new',
        timestamp: new Date().toISOString(),
        actorName: 'Untrusted Client',
      }],
    });
  } catch {
    directHistoryRewriteBlocked = true;
  }
  assert(
    directHistoryRewriteBlocked,
    'Firestore Rules must prevent replacing an existing status-history entry',
  );

  // Invalid transition test: new -> completed (not allowed without confirmed/delivering)
  let invalidTransitionBlocked = false;
  try {
    await updateOrderStatus(oTrans.id, { status: 'completed', actorName: 'Tester' });
  } catch (err: unknown) {
    invalidTransitionBlocked = true;
    console.log(`  ✓ Blocked illegal transition (new -> completed): ${(err as Error).message}`);
  }
  assert(invalidTransitionBlocked, 'State machine must reject illegal status transition');

  // Case D: new -> confirmed
  await updateOrderStatus(oTrans.id, { status: 'confirmed', actorName: 'Tester' });

  const confirmedOrderSnap = await getDoc(doc(db, 'orders', oTrans.id));
  const confirmedHistory = (confirmedOrderSnap.data()?.statusHistory || []) as Array<Record<string, unknown>>;
  let reorderedHistoryBlocked = false;
  try {
    await updateDoc(doc(db, 'orders', oTrans.id), {
      statusHistory: [
        ...[...confirmedHistory].reverse(),
        {
          id: 'FORGED-APPEND',
          status: 'confirmed',
          timestamp: new Date().toISOString(),
          actorName: 'Untrusted Client',
        },
      ],
    });
  } catch {
    reorderedHistoryBlocked = true;
  }
  assert(
    reorderedHistoryBlocked,
    'Firestore Rules must preserve the exact order of prior status-history entries',
  );

  const statusAfterClientUpdate = await getOrderById(oTrans.id);
  assert(
    statusAfterClientUpdate?.statusHistory.at(-1)?.actorName === 'Tester',
    'Spark-compatible client workflow must preserve the staff name supplied by the signed-in internal user',
  );
  let snapCust = await getCustomerById(custTrans.id);
  assert(snapCust!.totalOrders === 1 && snapCust!.totalSpent === 0, 'Case D: confirmed retains totalOrders=1, totalSpent=0');

  // A valid transition must not smuggle unrelated order-content or financial changes.
  const preDeliveringSnap = await getDoc(doc(db, 'orders', oTrans.id));
  const preDeliveringData = preDeliveringSnap.data() || {};
  const preDeliveringHistory = (preDeliveringData.statusHistory || []) as Array<Record<string, unknown>>;
  let transitionWithTamperedTotalsBlocked = false;
  try {
    await updateDoc(doc(db, 'orders', oTrans.id), {
      status: 'delivering',
      summary: { subtotal: 1, deliveryFee: 0, discount: 0, total: 1 },
      statusHistory: [
        ...preDeliveringHistory,
        {
          id: 'FORGED-TRANSITION',
          status: 'delivering',
          timestamp: new Date().toISOString(),
          actorName: 'Untrusted Client',
        },
      ],
    });
  } catch {
    transitionWithTamperedTotalsBlocked = true;
  }
  assert(
    transitionWithTamperedTotalsBlocked,
    'Firestore Rules must restrict a status transition to status and history fields only',
  );

  // Case E: confirmed -> delivering
  await updateOrderStatus(oTrans.id, { status: 'delivering', actorName: 'Tester' });
  snapCust = await getCustomerById(custTrans.id);

  const deliveringSnap = await getDoc(doc(db, 'orders', oTrans.id));
  const deliveringHistory = (deliveringSnap.data()?.statusHistory || []) as Array<Record<string, unknown>>;
  let deliveringEditBlocked = false;
  try {
    await updateDoc(doc(db, 'orders', oTrans.id), {
      note: 'forged edit after delivery started',
      statusHistory: [
        ...deliveringHistory,
        {
          id: 'FORGED-DELIVERING-EDIT',
          status: 'delivering',
          timestamp: new Date().toISOString(),
          actorName: 'Untrusted Client',
        },
      ],
    });
  } catch {
    deliveringEditBlocked = true;
  }
  assert(
    deliveringEditBlocked,
    'Firestore Rules must make delivering orders immutable, including same-status edits',
  );
  assert(snapCust!.totalOrders === 1 && snapCust!.totalSpent === 0, 'Case E: delivering retains totalOrders=1, totalSpent=0');

  // Case F: delivering -> completed
  await updateOrderStatus(oTrans.id, { status: 'completed', actorName: 'Tester' });
  snapCust = await getCustomerById(custTrans.id);
  assert(snapCust!.totalSpent === 1650000, `Case F: completed increases totalSpent to 1,650,000 (got ${snapCust!.totalSpent})`);

  const completedSnap = await getDoc(doc(db, 'orders', oTrans.id));
  const completedData = completedSnap.data() || {};
  const completedHistory = (completedData.statusHistory || []) as Array<Record<string, unknown>>;
  let completedEditBlocked = false;
  try {
    await updateDoc(doc(db, 'orders', oTrans.id), {
      summary: { subtotal: 1, deliveryFee: 0, discount: 0, total: 1 },
      statusHistory: [
        ...completedHistory,
        {
          id: 'FORGED-COMPLETED-EDIT',
          status: 'completed',
          timestamp: new Date().toISOString(),
          actorName: 'Untrusted Client',
        },
      ],
    });
  } catch {
    completedEditBlocked = true;
  }
  assert(
    completedEditBlocked,
    'Firestore Rules must make completed orders immutable, including same-status edits',
  );

  // Case G: Test cancellation of active order
  const oCancel = await createOrder({
    customerId: custTrans.id,
    customerSnapshot: { name: custTrans.name, phone: custTrans.phone, address: custTrans.address },
    items: [{ productId: p1.id, quantity: 1 }], // 350k
    deliveryFee: 0,
    discount: 0,
    createdBy: 'Tester',
  });
  snapCust = await getCustomerById(custTrans.id);
  assert(snapCust!.totalOrders === 2, 'Before cancel: totalOrders = 2');

  await updateOrderStatus(oCancel.id, { status: 'cancelled', actorName: 'Tester', note: 'Huỷ kiểm thử' });
  snapCust = await getCustomerById(custTrans.id);
  assert(snapCust!.totalOrders === 1, `Case G: cancelled order decrements totalOrders back to 1 (got ${snapCust!.totalOrders})`);
  assert(snapCust!.totalSpent === 1650000, 'Case G: cancelled order does not affect previous completed totalSpent');

  const cancelledSnap = await getDoc(doc(db, 'orders', oCancel.id));
  const cancelledHistory = (cancelledSnap.data()?.statusHistory || []) as Array<Record<string, unknown>>;
  let cancelledEditBlocked = false;
  try {
    await updateDoc(doc(db, 'orders', oCancel.id), {
      note: 'forged edit after cancellation',
      statusHistory: [
        ...cancelledHistory,
        {
          id: 'FORGED-CANCELLED-EDIT',
          status: 'cancelled',
          timestamp: new Date().toISOString(),
          actorName: 'Untrusted Client',
        },
      ],
    });
  } catch {
    cancelledEditBlocked = true;
  }
  assert(
    cancelledEditBlocked,
    'Firestore Rules must make cancelled orders immutable, including same-status edits',
  );

  // ==========================================
  // CASE H: Self-Healing Invariant / Inconsistent Aggregate Repair
  // ==========================================
  console.log('\n--- CASE H: Self-Healing Against Inconsistent Document Aggregates & Projection ---');
  // Intentionally corrupt aggregates through the Emulator's trusted admin REST path;
  // client rules must continue to deny this same mutation.
  await corruptCustomerAggregatesAsAdmin(custTrans.id);

  const corruptedSnap = await getCustomerById(custTrans.id);
  assert(corruptedSnap !== null, 'Customer must exist');
  assert(corruptedSnap!.totalOrders === 99999, 'Corrupted totalOrders injected');
  assert(corruptedSnap!.totalSpent === 88888888, 'Corrupted totalSpent injected');
  assert(
    corruptedSnap!.orderSummaries?.length === 1 && corruptedSnap!.orderSummaries[0].id === 'CORRUPTED-ORDER',
    'Corrupted fake order summary injected into projection'
  );

  // Directly exercise the repair utility; it must rebuild projection and aggregates from orders collection.
  await syncCustomerAggregates(custTrans.id);
  const repairedSnap = await getCustomerById(custTrans.id);
  assert(repairedSnap !== null, 'Repaired customer must exist');

  // Verify fake summary is purged
  const hasCorrupted = (repairedSnap!.orderSummaries ?? []).some((s) => s.id === 'CORRUPTED-ORDER');
  assert(!hasCorrupted, 'Case H: fake summary CORRUPTED-ORDER must be purged from projection');

  // Verify projection contains exactly the 2 real orders: oTrans (completed) and oCancel (cancelled)
  const summaries = repairedSnap!.orderSummaries ?? [];
  assert(summaries.length === 2, `Case H: repair restores exactly 2 real order summaries (got ${summaries.length})`);

  const summaryCompleted = summaries.find((s) => s.id === oTrans.id);
  assert(summaryCompleted !== undefined, `Case H: projection contains completed order ${oTrans.id}`);
  assert(summaryCompleted!.status === 'completed', 'Case H: oTrans summary status must be completed');
  assert(summaryCompleted!.total === 1650000, `Case H: oTrans summary total must be 1,650,000 (got ${summaryCompleted!.total})`);
  assert(summaryCompleted!.createdAt === oTrans.createdAt, 'Case H: oTrans summary createdAt matches order');

  const summaryCancelled = summaries.find((s) => s.id === oCancel.id);
  assert(summaryCancelled !== undefined, `Case H: projection contains cancelled order ${oCancel.id}`);
  assert(summaryCancelled!.status === 'cancelled', 'Case H: oCancel summary status must be cancelled');
  assert(summaryCancelled!.total === 350000, `Case H: oCancel summary total must be 350,000 (got ${summaryCancelled!.total})`);
  assert(summaryCancelled!.createdAt === oCancel.createdAt, 'Case H: oCancel summary createdAt matches order');

  // Verify aggregates recomputed correctly from restored projection
  assert(repairedSnap!.totalOrders === 1, `Case H: totalOrders excludes cancelled order (got ${repairedSnap!.totalOrders})`);
  assert(repairedSnap!.totalSpent === 1650000, `Case H: totalSpent sums only completed order (got ${repairedSnap!.totalSpent})`);
  assert(repairedSnap!.lastOrderDate === oTrans.createdAt, 'Case H: lastOrderDate matches latest active order');

  // Creating another order after repair must still preserve all aggregate invariants.
  const oAfterRepair = await createOrder({
    customerId: custTrans.id,
    customerSnapshot: { name: custTrans.name, phone: custTrans.phone, address: custTrans.address },
    items: [{ productId: p1.id, quantity: 1 }],
    deliveryFee: 0,
    discount: 0,
    createdBy: 'Tester',
  });

  const healedSnap = await getCustomerById(custTrans.id);
  // Expected: oTrans (completed, 1650k) + oAfterRepair (new, 350k) = 2 active orders; totalSpent = 1650000
  assert(healedSnap!.totalOrders === 2, `Case H: totalOrders remains correct after next create (got ${healedSnap!.totalOrders})`);
  assert(healedSnap!.totalSpent === 1650000, `Case H: totalSpent remains 1,650,000 after next create (got ${healedSnap!.totalSpent})`);
  assert(healedSnap!.lastOrderDate === oAfterRepair.createdAt, 'Case H: lastOrderDate updated to new order createdAt');
  assert((healedSnap!.orderSummaries ?? []).length === 3, 'Case H: projection has all 3 orders');

  // ==========================================
  // CASE I & J: Optimistic Concurrency Control (OCC) Simulator
  // Concurrent order creation for the exact same customer
  // ==========================================
  console.log('\n--- CASE I & J: Concurrency & Race-Condition Simulation ---');
  const custConc = await createCustomer({
    name: 'Phạm Concurrency',
    phone: '0900999888',
    address: '99 Concurrency Ave',
  });

  console.log('  Firing 5 simultaneous orders for the same customer via Promise.all()...');
  const concurrentPromises = [1, 2, 3, 4, 5].map((idx) =>
    createOrder({
      customerId: custConc.id,
      customerSnapshot: { name: custConc.name, phone: custConc.phone, address: custConc.address },
      items: [{ productId: p1.id, quantity: 1 }], // 350,000 each
      deliveryFee: 10000 * idx,
      discount: 0,
      note: `Concurrent order #${idx}`,
      createdBy: 'Concurrent Tester',
    })
  );

  const createdOrders = await Promise.all(concurrentPromises);
  assert(createdOrders.length === 5, 'All 5 concurrent orders must successfully resolve');

  const finalCustConc = await getCustomerById(custConc.id);
  assert(
    finalCustConc!.totalOrders === 5,
    `Case I & J: Exactly 5 totalOrders recorded without lost update (got ${finalCustConc!.totalOrders})`
  );
  assert(
    (finalCustConc!.orderSummaries?.length ?? 0) === 5,
    `Case I & J: Exactly 5 orderSummaries projected (got ${finalCustConc!.orderSummaries?.length})`
  );

  console.log('\n======================================================');
  // Case K: concurrent status changes must leave order and customer projection consistent.
  console.log('\n--- CASE K: Concurrent Status Mutations ---');
  const raceOrder = await createOrder({
    customerId: custConc.id,
    customerSnapshot: { name: custConc.name, phone: custConc.phone, address: custConc.address },
    items: [{ productId: p1.id, quantity: 1 }],
    deliveryFee: 0,
    discount: 0,
    createdBy: 'Concurrent Status Tester',
  });
  const statusAttempts = await Promise.all([
    updateOrderStatus(raceOrder.id, { status: 'confirmed', actorName: 'Tester A' }).then(() => true).catch(() => false),
    updateOrderStatus(raceOrder.id, { status: 'cancelled', actorName: 'Tester B' }).then(() => true).catch(() => false),
  ]);
  assert(statusAttempts.some(Boolean), 'Case K: at least one concurrent status change commits');
  const storedRaceOrder = await getOrderById(raceOrder.id);
  const raceCustomer = await getCustomerById(custConc.id);
  const raceSummary = raceCustomer!.orderSummaries?.find((summary) => summary.id === raceOrder.id);
  assert(storedRaceOrder !== null, 'Case K: order remains present after concurrent status changes');
  assert(raceSummary?.status === storedRaceOrder!.status, 'Case K: order status matches customer projection');
  assert(
    raceCustomer!.totalOrders === (raceCustomer!.orderSummaries ?? []).filter((summary) => summary.status !== 'cancelled').length,
    'Case K: totalOrders matches projection after concurrent status changes'
  );
  assert(
    raceCustomer!.totalSpent === (raceCustomer!.orderSummaries ?? []).filter((summary) => summary.status === 'completed').reduce((sum, summary) => sum + summary.total, 0),
    'Case K: totalSpent matches projection after concurrent status changes'
  );

  // ==========================================
  // CASE N: Large customer histories stay below the Firestore document-size ceiling.
  // ==========================================
  console.log('\n--- CASE N: Bounded customer order projection ---');
  const scaleCustomer = await createCustomer({
    name: 'Khách hàng Scale',
    phone: '0900888777',
    address: '88 Scale Street',
  });
  const scaleBase = Date.parse('2026-10-01T00:00:00.000Z');
  const scaleRows: Array<{ id: string; status: 'new' | 'completed' | 'cancelled'; createdAt: string }> = [];
  for (let i = 0; i < 65; i++) {
    const id = `SCALE-ORDER-${String(i).padStart(3, '0')}`;
    const status = i % 11 === 0 ? 'completed' : i % 7 === 0 ? 'cancelled' : 'new';
    const createdAt = new Date(scaleBase + i * 60_000).toISOString();
    scaleRows.push({ id, status, createdAt });
    await setDocumentAsAdmin('orders', id, {
      customerId: scaleCustomer.id,
      customerSnapshot: { name: scaleCustomer.name, phone: scaleCustomer.phone, address: scaleCustomer.address },
      items: [{ id: `${id}-ITEM-0`, productId: p1.id, productSnapshot: { name: 'Hoa Scale', unit: 'bó' }, quantity: 1, unitPrice: 1000, subtotal: 1000 }],
      summary: { subtotal: 1000, deliveryFee: 0, discount: 0, total: 1000 },
      status,
      statusHistory: [{ id: `${id}-HIST-0`, status, timestamp: createdAt, actorName: 'Scale Fixture' }],
      createdAt,
      createdBy: 'Scale Fixture',
    });
  }

  await syncCustomerAggregates(scaleCustomer.id);
  const scaleAfterSync = await getCustomerById(scaleCustomer.id);
  const scaleActive = scaleRows.filter((row) => row.status !== 'cancelled');
  const scaleCompleted = scaleRows.filter((row) => row.status === 'completed');
  const scaleLatestActive = [...scaleActive].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  assert(scaleAfterSync!.totalOrders === scaleActive.length, 'Case N: lifetime totalOrders includes every active order');
  assert(scaleAfterSync!.totalSpent === scaleCompleted.length * 1000, 'Case N: lifetime totalSpent includes all completed orders');
  assert(scaleAfterSync!.lastOrderDate === scaleLatestActive!.createdAt, 'Case N: lastOrderDate remains exact after projection compaction');
  assert((scaleAfterSync!.orderSummaries ?? []).length <= 50, 'Case N: repair compacts large projection to at most 50 recent active orders');
  assert(scaleAfterSync!.orderSummaries?.some((summary) => summary.id === scaleLatestActive!.id) ?? false, 'Case N: compact projection retains latest active order');

  const oldestActiveNew = scaleRows.find((row) => row.status === 'new')!;
  await updateOrderStatus(oldestActiveNew.id, { status: 'confirmed', actorName: 'Scale Tester' });
  const scaleAfterOldUpdate = await getCustomerById(scaleCustomer.id);
  assert(scaleAfterOldUpdate!.totalOrders === scaleActive.length, 'Case N: changing an old order to confirmed does not alter lifetime count');
  assert(scaleAfterOldUpdate!.orderSummaries?.some((summary) => summary.id === oldestActiveNew.id && summary.status === 'confirmed') ?? false, 'Case N: changed old order is retained in bounded projection');
  assert((scaleAfterOldUpdate!.orderSummaries ?? []).length <= 50, 'Case N: changed old order does not grow projection beyond 50');

  await updateOrder(oldestActiveNew.id, {
    items: [{ productId: p1.id, quantity: 1 }],
    deliveryFee: 0,
    discount: 0,
    customerName: scaleCustomer.name,
    customerAddress: scaleCustomer.address,
    note: 'Scale projection edit',
    actorName: 'Scale Tester',
  });
  const scaleAfterEdit = await getCustomerById(scaleCustomer.id);
  assert(scaleAfterEdit!.totalOrders === scaleActive.length, 'Case N: editing a projected order preserves lifetime order count');
  assert(scaleAfterEdit!.totalSpent === scaleCompleted.length * 1000, 'Case N: editing a non-completed order preserves completed spend');
  assert(scaleAfterEdit!.orderSummaries?.some((summary) => summary.id === oldestActiveNew.id && summary.total === 350000) ?? false, 'Case N: edit refreshes the changed summary total');
  assert((scaleAfterEdit!.orderSummaries ?? []).length <= 50, 'Case N: editing an old order keeps the projection bounded');

  const latestActiveOrder = scaleLatestActive!;
  const nextLatestActive = [...scaleActive]
    .filter((row) => row.id !== latestActiveOrder.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  await updateOrderStatus(latestActiveOrder.id, { status: 'cancelled', actorName: 'Scale Tester' });
  const scaleAfterCancel = await getCustomerById(scaleCustomer.id);
  assert(scaleAfterCancel!.totalOrders === scaleActive.length - 1, 'Case N: cancelling latest order decrements lifetime count exactly once');
  assert(scaleAfterCancel!.lastOrderDate === nextLatestActive!.createdAt, 'Case N: cancelling latest order finds the next latest active date');
  assert(scaleAfterCancel!.orderSummaries?.some((summary) => summary.id === latestActiveOrder.id && summary.status === 'cancelled') ?? false, 'Case N: changed cancelled order remains available to Firestore Rules');
  assert((scaleAfterCancel!.orderSummaries ?? []).length <= 51, 'Case N: cancelled order plus recent active projection stays within 51 entries');

  const scaleNewOrder = await createOrder({
    customerId: scaleCustomer.id,
    customerSnapshot: { name: scaleCustomer.name, phone: scaleCustomer.phone, address: scaleCustomer.address },
    items: [{ productId: p1.id, quantity: 1 }],
    deliveryFee: 0,
    discount: 0,
    createdBy: 'Scale Tester',
  });
  const scaleAfterCreate = await getCustomerById(scaleCustomer.id);
  assert(scaleAfterCreate!.totalOrders === scaleActive.length, 'Case N: new order increments compacted lifetime count without loss');
  assert(scaleAfterCreate!.totalSpent === scaleCompleted.length * 1000, 'Case N: new order does not alter completed spend');
  assert(scaleAfterCreate!.orderSummaries?.some((summary) => summary.id === scaleNewOrder.id) ?? false, 'Case N: new order is present in bounded projection');
  assert((scaleAfterCreate!.orderSummaries ?? []).length <= 50, 'Case N: new order keeps projection bounded to 50');

  let oversizedProjectionBlocked = false;
  try {
    await updateDoc(doc(db, 'customers', scaleCustomer.id), {
      orderSummaries: Array.from({ length: 52 }, (_, index) => ({
        id: `FORGED-SUMMARY-${index}`,
        status: 'new',
        total: 1000,
        createdAt: new Date(scaleBase + index * 60_000).toISOString(),
      })),
    });
  } catch {
    oversizedProjectionBlocked = true;
  }
  assert(oversizedProjectionBlocked, 'Case N: Firestore Rules reject a customer projection larger than 51 entries');

  await setDocumentAsAdmin('customers', scaleCustomer.id, {
    name: scaleCustomer.name,
    phone: scaleCustomer.phone,
    phoneNormalized: scaleCustomer.phoneNormalized,
    address: scaleCustomer.address,
    totalOrders: scaleAfterCreate!.totalOrders,
    totalSpent: scaleAfterCreate!.totalSpent,
    lastOrderDate: scaleAfterCreate!.lastOrderDate,
    orderSummaries: Array.from({ length: 52 }, (_, index) => ({
      id: `LEGACY-SUMMARY-${index}`,
      status: 'new',
      total: 1000,
      createdAt: new Date(scaleBase + index * 60_000).toISOString(),
    })),
    note: null,
    createdAt: scaleCustomer.createdAt,
  });
  const legacyProfileUpdate = await updateCustomer(scaleCustomer.id, {
    name: 'Khách hàng Scale đã cập nhật',
    address: '88 Scale Street, updated',
    note: 'Legacy projection compatibility',
  });
  assert(legacyProfileUpdate.name === 'Khách hàng Scale đã cập nhật', 'Case N: profile edits remain allowed for legacy projections larger than 51');
  await syncCustomerAggregates(scaleCustomer.id);
  const compactedLegacyCustomer = await getCustomerById(scaleCustomer.id);
  assert((compactedLegacyCustomer!.orderSummaries ?? []).length <= 50, 'Case N: aggregate repair compacts a legacy oversized projection');

  // ==========================================
  // SECURITY TESTS: Role-based Firestore Authorization
  // ==========================================
  console.log('\n--- SECURITY TESTS: Role & Membership Enforcement ---');

  // 1. Authenticated but unprovisioned user
  console.log('  1. Testing authenticated but UNPROVISIONED user...');
  const unprovisionedEmail = 'unprovisioned@cuatiemhoa.vn';
  const unprovCred = await createUserWithEmailAndPassword(auth, unprovisionedEmail, 'Password123!');
  let unprovReadBlocked = false;
  try {
    await getCustomerById(custA.id);
  } catch (err: unknown) {
    unprovReadBlocked = true;
    console.log(`     ✓ Unprovisioned read blocked with error: ${(err as Error).message}`);
  }
  assert(unprovReadBlocked, 'Unprovisioned user must be denied read access to customers');

  let unprovWriteBlocked = false;
  try {
    await createCustomer({ name: 'Hacker', phone: '0999999999', address: 'Nowhere' });
  } catch (err: unknown) {
    unprovWriteBlocked = true;
    console.log(`     ✓ Unprovisioned write blocked with error: ${(err as Error).message}`);
  }
  assert(unprovWriteBlocked, 'Unprovisioned user must be denied write access to customers');

  // 2. Self-promotion and self-activation blocked
  console.log('  2. Testing client self-promotion and role creation block...');
  let selfPromotionBlocked = false;
  try {
    await setDoc(doc(db, 'users', unprovCred.user.uid), {
      role: 'admin',
      status: 'active',
      email: unprovisionedEmail,
    });
  } catch (err: unknown) {
    selfPromotionBlocked = true;
    console.log(`     ✓ Client write to users/{uid} blocked: ${(err as Error).message}`);
  }
  assert(selfPromotionBlocked, 'Client must not be able to write or create their own membership doc');

  // 3. User can read their own membership doc, but cannot read or list another user's membership doc
  console.log('  3. Testing membership profile read restrictions (self-read allowed, cross-user denied)...');
  // Verify self-read against an existing provisioned membership document.
  await signInWithEmailAndPassword(auth, testStaffEmail, testStaffPass);
  const selfDoc = await getDoc(doc(db, 'users', staffUserUid));
  assert(selfDoc.exists(), 'Active staff can read their own existing membership document');

  let usersListBlocked = false;
  try {
    await getDocs(collection(db, 'users'));
  } catch (err: unknown) {
    usersListBlocked = true;
    console.log(`     ✓ Listing users blocked: ${(err as Error).message}`);
  }
  assert(usersListBlocked, 'Client must not be able to list membership documents');

  // Verify that an authenticated user cannot read another user's membership doc
  await signInWithEmailAndPassword(auth, unprovisionedEmail, 'Password123!');
  let crossUserReadBlocked = false;
  try {
    const crossDoc = await getDoc(doc(db, 'users', staffUserUid));
    if (crossDoc.exists()) {
      crossUserReadBlocked = false;
    }
  } catch (err: unknown) {
    crossUserReadBlocked = true;
    console.log(`     ✓ Cross-user membership read blocked: ${(err as Error).message}`);
  }
  assert(crossUserReadBlocked, 'User must not be able to read another user profile doc in users collection');

  // 4. Inactive provisioned user
  console.log('  4. Testing INACTIVE provisioned user...');
  const inactiveEmail = 'inactive.staff@cuatiemhoa.vn';
  const inactiveCred = await createUserWithEmailAndPassword(auth, inactiveEmail, 'Password123!');
  await provisionUserMembership(inactiveCred.user.uid, {
    email: inactiveEmail,
    role: 'staff',
    status: 'inactive',
  });

  let inactiveReadBlocked = false;
  try {
    await getCustomerById(custA.id);
  } catch (err: unknown) {
    inactiveReadBlocked = true;
    console.log(`     ✓ Inactive user read blocked: ${(err as Error).message}`);
  }
  assert(inactiveReadBlocked, 'Inactive user must be denied read access');

  let inactiveStatusMutationBlocked = false;
  try {
    await updateOrderStatus(orderA.id, { status: 'confirmed', actorName: 'Inactive User' });
  } catch {
    inactiveStatusMutationBlocked = true;
  }
  assert(inactiveStatusMutationBlocked, 'Firestore Rules must deny status mutations from inactive memberships');

  // 5. Role-based settings differentiation: staff read-only, admin can write
  console.log('  5. Testing role-based settings access (staff read-only, admin can write)...');
  // Staff is currently signed in; read should succeed, write should fail.
  await signInWithEmailAndPassword(auth, testStaffEmail, testStaffPass);
  let staffSettingsReadSucceeded = false;
  try {
    await getDoc(doc(db, 'settings', 'store'));
    staffSettingsReadSucceeded = true;
  } catch (err: unknown) {
    console.log(`     ✗ Staff settings read failed: ${(err as Error).message}`);
  }
  assert(staffSettingsReadSucceeded, 'Staff user must be allowed to read settings');

  let staffSettingsWriteBlocked = false;
  try {
    await setDoc(doc(db, 'settings', 'store'), { storeName: 'Hacked Store' }, { merge: true });
  } catch (err: unknown) {
    staffSettingsWriteBlocked = true;
    console.log(`     ✓ Staff settings write blocked: ${(err as Error).message}`);
  }
  assert(staffSettingsWriteBlocked, 'Staff user must be denied write access to settings');

  // Create & provision an admin user
  const adminEmail = 'admin.tester@cuatiemhoa.vn';
  const adminPass = 'AdminPass123!';
  let adminUid = '';
  try {
    const adminCred = await createUserWithEmailAndPassword(auth, adminEmail, adminPass);
    adminUid = adminCred.user.uid;
  } catch {
    const adminCred = await signInWithEmailAndPassword(auth, adminEmail, adminPass);
    adminUid = adminCred.user.uid;
  }
  await provisionUserMembership(adminUid, {
    email: adminEmail,
    role: 'admin',
    status: 'active',
  });
  await signInWithEmailAndPassword(auth, adminEmail, adminPass);
  await updateDoc(doc(db, 'products', p1.id), { note: 'Admin product-write policy test' });
  console.log('     ✓ Admin product update succeeded as expected');

  let adminCreatedAtMutationBlocked = false;
  try {
    await updateDoc(doc(db, 'products', p1.id), { createdAt: '2000-01-01T00:00:00.000Z' });
  } catch {
    adminCreatedAtMutationBlocked = true;
  }
  assert(adminCreatedAtMutationBlocked, 'Admin must not rewrite a product creation timestamp');

  let adminProductDeleteBlocked = false;
  try {
    await (await import('firebase/firestore')).deleteDoc(doc(db, 'products', p1.id));
  } catch {
    adminProductDeleteBlocked = true;
  }
  assert(adminProductDeleteBlocked, 'Product deletion must remain disabled even for admins');

  await updateDoc(doc(db, 'products', p1.id), { note: p1.note });
  await setDoc(doc(db, 'settings', 'store'), { storeName: 'Tiệm Hoa ROVII' }, { merge: true });
  console.log('     ✓ Admin settings write succeeded as expected');

  // ==========================================
  // CASE M: Admin in-app staff management (list/create/update users)
  // ==========================================
  console.log('\n--- CASE M: Admin Staff Management Via Rules ---');
  const staffListSnap = await getDocs(collection(db, 'users'));
  assert(staffListSnap.size >= 3, `Case M: admin can list memberships (got ${staffListSnap.size})`);

  // Admin creates a membership doc for a new staff user (mirrors createStaffAccount service).
  const mStaffEmail = 'managed.staff@cuatiemhoa.vn';
  const mStaffCred = await createUserWithEmailAndPassword(auth, mStaffEmail, 'Password123!');
  // Still signed in as the new user here; switch back to admin for the membership write.
  await signInWithEmailAndPassword(auth, adminEmail, adminPass);
  const nowM = new Date().toISOString();
  await setDoc(doc(db, 'users', mStaffCred.user.uid), {
    uid: mStaffCred.user.uid,
    name: 'Managed Staff',
    email: mStaffEmail,
    role: 'staff',
    status: 'active',
    createdAt: nowM,
    updatedAt: nowM,
  });
  console.log('     ✓ Admin created staff membership doc');

  // Admin deactivates then reactivates.
  await signInWithEmailAndPassword(auth, adminEmail, adminPass);
  await updateDoc(doc(db, 'users', mStaffCred.user.uid), { status: 'inactive', updatedAt: nowM });
  let deactivatedReadBlocked = false;
  try {
    await signInWithEmailAndPassword(auth, mStaffEmail, 'Password123!');
    await getCustomerById(custA.id);
  } catch {
    deactivatedReadBlocked = true;
  }
  assert(deactivatedReadBlocked, 'Case M: deactivated staff must be denied business reads');
  await signInWithEmailAndPassword(auth, adminEmail, adminPass);
  await updateDoc(doc(db, 'users', mStaffCred.user.uid), { status: 'active', updatedAt: nowM });
  await signInWithEmailAndPassword(auth, mStaffEmail, 'Password123!');
  const reactivatedRead = await getCustomerById(custA.id);
  assert(reactivatedRead !== null, 'Case M: reactivated staff can read again');

  // Non-admin still cannot list users or write memberships.
  await signInWithEmailAndPassword(auth, mStaffEmail, 'Password123!');
  let staffListBlocked = false;
  try {
    await getDocs(collection(db, 'users'));
  } catch {
    staffListBlocked = true;
  }
  assert(staffListBlocked, 'Case M: staff must not list memberships');
  let staffSelfEscalateBlocked = false;
  try {
    await updateDoc(doc(db, 'users', mStaffCred.user.uid), { role: 'admin', updatedAt: nowM });
  } catch {
    staffSelfEscalateBlocked = true;
  }
  assert(staffSelfEscalateBlocked, 'Case M: staff must not self-promote to admin');
  // Restore admin session for the remaining checks.
  await signInWithEmailAndPassword(auth, adminEmail, adminPass);

  // 6. Unauthenticated user denied
  console.log('  6. Testing UNAUTHENTICATED user...');
  await signOut(auth);
  let unauthReadBlocked = false;
  try {
    await getCustomerById(custA.id);
  } catch (err: unknown) {
    unauthReadBlocked = true;
    console.log(`     ✓ Unauthenticated read blocked: ${(err as Error).message}`);
  }
  assert(unauthReadBlocked, 'Unauthenticated user must be denied access to collections');

  let unauthStatusMutationBlocked = false;
  try {
    await updateOrderStatus(orderA.id, { status: 'confirmed', actorName: 'Unauthenticated' });
  } catch {
    unauthStatusMutationBlocked = true;
  }
  assert(unauthStatusMutationBlocked, 'Firestore Rules must deny unauthenticated status mutations');

  // Restore an authorized session before running the remaining CRUD regression cases.
  await signInWithEmailAndPassword(auth, testStaffEmail, testStaffPass);

  // ==========================================
  // CASE N: Customer profile update (name/address/note only)
  // ==========================================
  console.log('\n--- CASE N: Customer Update Preserves Identity & Aggregates ---');
  const custK = await createCustomer({
    name: 'Phạm Thị K',
    phone: '0900000004',
    address: '4 Cách Mạng Tháng 8, Q3, TP.HCM',
    note: 'Thích tone pastel',
  });
  const orderK = await createOrder({
    customerId: custK.id,
    customerSnapshot: { name: custK.name, phone: custK.phone, address: custK.address },
    items: [{ productId: p1.id, quantity: 1 }],
    deliveryFee: 0,
    discount: 0,
    createdBy: 'Tester',
  });
  const updatedK = await updateCustomer(custK.id, {
    name: 'Phạm Thị K Updated',
    address: '5 Cách Mạng Tháng 8, Q3, TP.HCM',
    note: 'Thích tone đỏ',
  });
  assert(updatedK.name === 'Phạm Thị K Updated', 'Case K: customer name updated');
  assert(updatedK.address === '5 Cách Mạng Tháng 8, Q3, TP.HCM', 'Case K: customer address updated');
  assert(updatedK.note === 'Thích tone đỏ', 'Case K: customer note updated');
  assert(updatedK.phone === custK.phone, 'Case K: phone (identity) unchanged');
  assert(updatedK.totalOrders === 1, `Case K: totalOrders preserved (got ${updatedK.totalOrders})`);
  assert((updatedK.orderSummaries?.length ?? 0) === 1, 'Case K: orderSummaries preserved');
  assert(updatedK.orderSummaries![0].id === orderK.id, 'Case K: order history entry preserved');

  let updateMissingBlocked = false;
  try {
    await updateCustomer('CUST_0000000000', { name: 'Ghost', address: 'Nowhere' });
  } catch {
    updateMissingBlocked = true;
  }
  assert(updateMissingBlocked, 'Case K: updating a non-existent customer must throw');

  // ==========================================
  // CASE O: Order edit (new/confirmed only, server prices win)
  // ==========================================
  console.log('\n--- CASE O: Order Edit With Aggregate Recomputation ---');
  const custL = await createCustomer({
    name: 'Hoàng Văn L',
    phone: '0900000005',
    address: '6 Điện Biên Phủ, Q.Bình Thạnh, TP.HCM',
  });
  const orderL = await createOrder({
    customerId: custL.id,
    customerSnapshot: { name: custL.name, phone: custL.phone, address: custL.address },
    items: [{ productId: p1.id, quantity: 1 }], // 350,000
    deliveryFee: 30000,
    discount: 0, // Total = 380,000
    createdBy: 'Tester',
  });
  assert(orderL.summary.total === 380000, `Case L: initial total 380,000 (got ${orderL.summary.total})`);

  // Edit while 'new': change items + fees + delivery snapshot name/address.
  const editedL = await updateOrder(orderL.id, {
    items: [{ productId: p1.id, quantity: 2 }], // 700,000
    deliveryFee: 30000,
    discount: 50000, // Total = 680,000
    customerName: 'Hoàng Văn L (người nhận: Lan)',
    customerAddress: '7 Điện Biên Phủ, Q.Bình Thạnh, TP.HCM',
    note: 'Giao giờ hành chính',
    actorName: 'Tester',
  });
  assert(editedL.summary.total === 680000, `Case L: edited total 680,000 (got ${editedL.summary.total})`);
  assert(editedL.summary.subtotal === 700000, `Case L: edited subtotal 700,000 (got ${editedL.summary.subtotal})`);
  assert(editedL.customerSnapshot.phone === custL.phone, 'Case L: snapshot phone unchanged');
  assert(editedL.status === 'new', 'Case L: edit does not change status');
  const custLCheck = await getCustomerById(custL.id);
  assert((custLCheck!.orderSummaries?.length ?? 0) === 1, 'Case L: still exactly 1 order summary');
  assert(custLCheck!.orderSummaries![0].total === 680000, `Case L: summary total follows edit (got ${custLCheck!.orderSummaries![0].total})`);
  assert(custLCheck!.totalOrders === 1, 'Case L: totalOrders unchanged by edit');

  // Completed orders are immutable.
  await updateOrderStatus(orderL.id, { status: 'confirmed', actorName: 'Tester' });
  await updateOrderStatus(orderL.id, { status: 'delivering', actorName: 'Tester' });
  await updateOrderStatus(orderL.id, { status: 'completed', actorName: 'Tester' });
  let editCompletedBlocked = false;
  try {
    await updateOrder(orderL.id, {
      items: [{ productId: p1.id, quantity: 9 }],
      deliveryFee: 0,
      discount: 0,
      customerName: 'Hacker',
      customerAddress: 'Hacker address',
      actorName: 'Tester',
    });
  } catch (err: unknown) {
    editCompletedBlocked = true;
    console.log(`  ✓ Correctly rejected edit of completed order: ${(err as Error).message}`);
  }
  assert(editCompletedBlocked, 'Case L: completed orders must be immutable');
  const custLFinal = await getCustomerById(custL.id);
  assert(custLFinal!.totalSpent === 680000, `Case L: totalSpent follows edited total (got ${custLFinal!.totalSpent})`);

  // ==========================================
  // CASE P: Dashboard reads a local-day range and only six recent orders.
  // ==========================================
  console.log('\\n--- CASE P: Dashboard bounded order queries ---');
  const dashboardCustomer = await createCustomer({
    name: 'Khách hàng Dashboard',
    phone: '0900777666',
    address: '77 Dashboard Street',
  });
  const dashboardBase = Date.parse('2099-01-01T00:00:00.000Z');
  for (let i = 0; i < 8; i++) {
    const id = `DASH-ORDER-${String(i).padStart(3, '0')}`;
    const createdAt = new Date(dashboardBase + (i === 7 ? 24 * 60 * 60 * 1000 : i * 60 * 60 * 1000)).toISOString();
    const status = i === 0 ? 'completed' : 'new';
    await setDocumentAsAdmin('orders', id, {
      customerId: dashboardCustomer.id,
      customerSnapshot: { name: dashboardCustomer.name, phone: dashboardCustomer.phone, address: dashboardCustomer.address },
      items: [{ id: `${id}-ITEM-0`, productId: p1.id, productSnapshot: { name: 'Hoa Dashboard', unit: 'bó' }, quantity: 1, unitPrice: 1000, subtotal: 1000 }],
      summary: { subtotal: 1000, deliveryFee: 0, discount: 0, total: 1000 },
      status,
      statusHistory: [{ id: `${id}-HIST-0`, status, timestamp: createdAt, actorName: 'Dashboard Fixture' }],
      createdAt,
      createdBy: 'Dashboard Fixture',
    });
  }
  const dashboardResult = await getDashboardOrders(
    '2099-01-01T00:00:00.000Z',
    '2099-01-02T00:00:00.000Z'
  );
  assert(dashboardResult.todayOrders.length === 7, 'Case P: dashboard day query returns exactly seven orders in the day window');
  assert(dashboardResult.todayOrders[0].id === 'DASH-ORDER-006', 'Case P: today orders are sorted newest first');
  assert(dashboardResult.recentOrders.length === 6, 'Case P: dashboard recent query is capped at six orders');
  assert(dashboardResult.recentOrders[0].id === 'DASH-ORDER-007', 'Case P: recent query includes the newest order regardless of day');
  assert(dashboardResult.recentOrders[5].id === 'DASH-ORDER-002', 'Case P: recent query returns the six newest orders only');

  // Restore staff session for clean shutdown
  await signInWithEmailAndPassword(auth, testStaffEmail, testStaffPass);

  console.log('🎉 ALL INTEGRATION & INVARIANT TESTS PASSED 100%!');
  console.log('======================================================\n');
  process.exit(0);
}

runTestSuite().catch((err) => {
  console.error('\n💥 TEST RUNNER FAILED WITH UNHANDLED ERROR:\n', err);
  process.exit(1);
});
