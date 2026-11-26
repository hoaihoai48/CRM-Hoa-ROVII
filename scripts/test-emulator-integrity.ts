/**
 * Firebase Firestore Emulator Automated Integration & Concurrency Test Suite
 * Tests Cases A through Q for Data Invariants & Optimistic Concurrency Control (OCC)
 */

import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, auth } from '../src/lib/firebase/config';
import { createCustomer, findCustomerByPhone, getCustomerById, listCustomersPage, updateCustomer } from '../src/lib/services/customers';
import { createOrder, getDashboardOrders, getOrderById, listOrdersPage, syncCustomerAggregates, updateOrder, updateOrderStatus } from '../src/lib/services/orders';
import { Product } from '../src/types';

const DEMO_PROJECT_ID = 'demo-crm-hoa-rovii';
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '';
const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '';
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST ?? '';
const isLoopbackEmulatorHost = (host: string) => /^(127\.0\.0\.1|localhost):\d+$/.test(host);

if (
  projectId !== DEMO_PROJECT_ID ||
  !isLoopbackEmulatorHost(authEmulatorHost) ||
  !isLoopbackEmulatorHost(firestoreHost)
) {
  throw new Error(
    'Refusing to run Firestore integrity tests outside the isolated demo-crm-hoa-rovii Auth/Firestore Emulators. Use npm run test:emulator.'
  );
}

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
  const host = firestoreHost;
  const projectId = DEMO_PROJECT_ID;
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
  let missingHistoryActorUidBlocked = false;
  try {
    await updateOrderStatus(atomicSuccess.id, {
      status: 'confirmed',
      actorName: 'Missing UID',
    });
  } catch {
    missingHistoryActorUidBlocked = true;
  }
  assert(missingHistoryActorUidBlocked, 'Rules must reject status-history entries without actor UID on UID-attributed orders');
  const unchangedAtomicOrder = await getOrderById(atomicSuccess.id);
  assert(unchangedAtomicOrder?.status === 'new' && unchangedAtomicOrder.statusHistory.length === 1, 'Rejected missing actor UID must not partially change order state');

  const attributedAtomicOrder = await updateOrderStatus(atomicSuccess.id, {
    status: 'confirmed',
    actorName: 'Authenticated Tester',
    actorUid: staffUserUid,
  });
  assert(attributedAtomicOrder.status === 'confirmed', 'Authenticated actor UID permits a valid status transition');
  assert(attributedAtomicOrder.statusHistory[1]?.actorUid === staffUserUid, 'Valid transition persists authenticated actor UID');

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

  // Customer scalar aggregates are client-maintained in the Spark deployment.
  // Rules validate customer shape and immutable identity fields, but cannot prove
  // cross-document aggregate arithmetic. This synthetic write documents that boundary.
  await setDoc(doc(db, 'customers', 'CLIENT-FORGED-CUSTOMER'), {
    name: 'Forged', phone: '0900000000', phoneNormalized: '0900000000', address: 'Nowhere',
    totalOrders: 99, totalSpent: 999999, lastOrderDate: '2099-01-01', createdAt: new Date().toISOString(),
  });
  const forgedCustomer = await getDoc(doc(db, 'customers', 'CLIENT-FORGED-CUSTOMER'));
  assert(
    forgedCustomer.exists() && forgedCustomer.data().totalSpent === 999999,
    'Spark trust boundary: active member can write valid-shaped customer scalar aggregates',
  );

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

  // Customer order history is read from canonical orders, not an embedded customer projection.
  // Firestore Rules intentionally validate order shape/lifecycle only in the Spark client model;
  // referential integrity and scalar customer summaries remain application-maintained.
  // Do not assert that a customer.orderSummaries projection must accompany order writes.

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
  // CASE H: Repair scalar customer summaries from canonical orders.
  // ==========================================
  console.log('\n--- CASE H: Canonical order aggregate repair ---');
  await corruptCustomerAggregatesAsAdmin(custTrans.id);
  const corruptedSnap = await getCustomerById(custTrans.id);
  assert(corruptedSnap !== null, 'Case H: customer exists before repair');
  assert(corruptedSnap!.totalOrders === 99999, 'Case H: test corruption changed scalar order count');

  await syncCustomerAggregates(custTrans.id);
  const repairedSnap = await getCustomerById(custTrans.id);
  assert(repairedSnap !== null, 'Case H: customer remains readable after repair');
  assert(repairedSnap!.totalOrders === 1, 'Case H: active order count is rebuilt from canonical orders');
  assert(repairedSnap!.totalSpent === 1650000, 'Case H: completed spend is rebuilt from canonical orders');
  const expectedLastPlacedDate = oTrans.createdAt > oCancel.createdAt ? oTrans.createdAt : oCancel.createdAt;
  assert(repairedSnap!.lastOrderDate === expectedLastPlacedDate, 'Case H: lastOrderDate uses latest placement, even when cancelled');

  const oAfterRepair = await createOrder({
    customerId: custTrans.id,
    customerSnapshot: { name: custTrans.name, phone: custTrans.phone, address: custTrans.address },
    items: [{ productId: p1.id, quantity: 1 }],
    deliveryFee: 0,
    discount: 0,
    createdBy: 'Tester',
  });
  const healedSnap = await getCustomerById(custTrans.id);
  assert(healedSnap!.totalOrders === 2, 'Case H: new order increments active count');
  assert(healedSnap!.totalSpent === 1650000, 'Case H: new order does not change completed spend');
  assert(healedSnap!.lastOrderDate === oAfterRepair.createdAt, 'Case H: latest placement date advances after repair');

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

  console.log('\n======================================================');
  // Case K: concurrent status changes are checked against canonical orders.
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
  assert(storedRaceOrder !== null, 'Case K: order remains present after concurrent status changes');
  const canonicalOrders = await listOrdersPage(null, 100, custConc.id);
  const canonicalActiveOrders = canonicalOrders.items.filter((order) => order.status !== 'cancelled');
  const canonicalCompletedOrders = canonicalOrders.items.filter((order) => order.status === 'completed');
  assert(raceCustomer!.totalOrders === canonicalActiveOrders.length, 'Case K: active count matches canonical orders');
  assert(
    raceCustomer!.totalSpent === canonicalCompletedOrders.reduce((sum, order) => sum + order.summary.total, 0),
    'Case K: completed spend matches canonical orders',
  );

  // ==========================================
  // CASE N: Customer history is read from canonical /orders documents.
  // ==========================================
  console.log('\n--- CASE N: Canonical customer order history ---');
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
  const latestPlaced = [...scaleRows].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  assert(scaleAfterSync!.totalOrders === scaleActive.length, 'Case N: active count derives from all canonical orders');
  assert(scaleAfterSync!.totalSpent === scaleCompleted.length * 1000, 'Case N: completed spend derives from canonical orders');
  assert(scaleAfterSync!.lastOrderDate === latestPlaced.createdAt, 'Case N: latest placement date includes cancelled orders');

  const oldestActiveNew = scaleRows.find((row) => row.status === 'new')!;
  await updateOrderStatus(oldestActiveNew.id, { status: 'confirmed', actorName: 'Scale Tester' });
  const scaleAfterStatus = await getCustomerById(scaleCustomer.id);
  assert(scaleAfterStatus!.totalOrders === scaleActive.length, 'Case N: confirming an order preserves active count');

  await updateOrder(oldestActiveNew.id, {
    items: [{ productId: p1.id, quantity: 1 }],
    deliveryFee: 0,
    discount: 0,
    customerName: scaleCustomer.name,
    customerAddress: scaleCustomer.address,
    note: 'Canonical history edit',
    actorName: 'Scale Tester',
  });
  const scaleAfterEdit = await getCustomerById(scaleCustomer.id);
  assert(scaleAfterEdit!.totalOrders === scaleActive.length, 'Case N: editing a non-completed order preserves count');
  assert(scaleAfterEdit!.totalSpent === scaleCompleted.length * 1000, 'Case N: editing a non-completed order preserves completed spend');

  await updateOrderStatus(latestPlaced.id, { status: 'cancelled', actorName: 'Scale Tester' });
  const scaleAfterCancel = await getCustomerById(scaleCustomer.id);
  assert(scaleAfterCancel!.totalOrders === scaleActive.length - 1, 'Case N: cancelling active order decrements count once');
  assert(scaleAfterCancel!.lastOrderDate === latestPlaced.createdAt, 'Case N: cancellation does not rewrite placement date');

  const scaleNewOrder = await createOrder({
    customerId: scaleCustomer.id,
    customerSnapshot: { name: scaleCustomer.name, phone: scaleCustomer.phone, address: scaleCustomer.address },
    items: [{ productId: p1.id, quantity: 1 }],
    deliveryFee: 0,
    discount: 0,
    createdBy: 'Scale Tester',
  });
  const scaleAfterCreate = await getCustomerById(scaleCustomer.id);
  assert(scaleAfterCreate!.totalOrders === scaleActive.length, 'Case N: new order increments active count');
  assert(scaleAfterCreate!.lastOrderDate === scaleNewOrder.createdAt, 'Case N: new order becomes latest placement');

  // Legacy embedded arrays are tolerated but never read or rewritten by normal workflows.
  await setDocumentAsAdmin('customers', scaleCustomer.id, {
    name: scaleCustomer.name,
    phone: scaleCustomer.phone,
    phoneNormalized: scaleCustomer.phoneNormalized,
    address: scaleCustomer.address,
    totalOrders: scaleAfterCreate!.totalOrders,
    totalSpent: scaleAfterCreate!.totalSpent,
    lastOrderDate: scaleAfterCreate!.lastOrderDate,
    orderSummaries: Array.from({ length: 52 }, (_, index) => ({
      id: `LEGACY-SUMMARY-${index}`, status: 'new', total: 1000,
      createdAt: new Date(scaleBase + index * 60_000).toISOString(),
    })),
    note: null,
    createdAt: scaleCustomer.createdAt,
  });
  await updateCustomer(scaleCustomer.id, {
    name: 'Khách hàng Scale đã cập nhật',
    address: '88 Scale Street, updated',
    note: 'Legacy projection preserved',
  });
  await syncCustomerAggregates(scaleCustomer.id);
  const rawLegacyCustomer = await getDoc(doc(db, 'customers', scaleCustomer.id));
  assert(rawLegacyCustomer.exists(), 'Case N: legacy customer remains present');
  const rawLegacyCustomerData = rawLegacyCustomer.data();
  assert(
    Array.isArray(rawLegacyCustomerData?.orderSummaries) && rawLegacyCustomerData.orderSummaries.length === 52,
    'Case N: legacy embedded summaries are left untouched',
  );

  const fullHistory = await listOrdersPage(null, 100, scaleCustomer.id);
  assert(fullHistory.items.length === 66, 'Case N: all canonical orders remain queryable beyond 50 records');
  assert(new Set(fullHistory.items.map((order) => order.id)).size === 66, 'Case N: canonical history contains no duplicates');

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

  console.log('  0. Testing bounded product image payloads and legacy-safe edits...');
  const tinyPngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/9ioAAAAASUVORK5CYII=';
  const imageProductBase = {
    name: 'Product Image Rule Test',
    price: 1000,
    unit: 'bó',
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'products', 'PROD_IMAGE_VALID'), {
    ...imageProductBase,
    imageUrl: tinyPngDataUrl,
    imageUrls: [tinyPngDataUrl],
  });

  const oversizedImageDataUrl = `data:image/jpeg;base64,${'A'.repeat(150_000)}`;
  let oversizedImageCreateBlocked = false;
  try {
    await setDoc(doc(db, 'products', 'PROD_IMAGE_OVERSIZED'), {
      ...imageProductBase,
      imageUrl: oversizedImageDataUrl,
      imageUrls: [oversizedImageDataUrl],
    });
  } catch {
    oversizedImageCreateBlocked = true;
  }
  assert(oversizedImageCreateBlocked, 'Firestore Rules must reject oversized Data URL product images');

  let tooManyImagesBlocked = false;
  try {
    await setDoc(doc(db, 'products', 'PROD_IMAGE_COUNT_OVERFLOW'), {
      ...imageProductBase,
      imageUrl: tinyPngDataUrl,
      imageUrls: Array(6).fill(tinyPngDataUrl),
    });
  } catch {
    tooManyImagesBlocked = true;
  }
  assert(tooManyImagesBlocked, 'Firestore Rules must reject more than five product images');

  let insecureImageUrlBlocked = false;
  try {
    await setDoc(doc(db, 'products', 'PROD_IMAGE_HTTP'), {
      ...imageProductBase,
      imageUrl: 'http://example.com/flower.jpg',
      imageUrls: ['http://example.com/flower.jpg'],
    });
  } catch {
    insecureImageUrlBlocked = true;
  }
  assert(insecureImageUrlBlocked, 'Firestore Rules must reject non-HTTPS remote product image URLs');

  const validHttpsImageUrl = 'https://cdn.example.com/flowers/rose.jpg';
  await setDoc(doc(db, 'products', 'PROD_IMAGE_HTTPS_VALID'), {
    ...imageProductBase,
    imageUrl: validHttpsImageUrl,
    imageUrls: [validHttpsImageUrl],
  });

  let oversizedRemoteImageUrlBlocked = false;
  try {
    const oversizedRemoteImageUrl = `https://cdn.example.com/${'a'.repeat(2048)}`;
    await setDoc(doc(db, 'products', 'PROD_IMAGE_URL_TOO_LONG'), {
      ...imageProductBase,
      imageUrl: oversizedRemoteImageUrl,
      imageUrls: [oversizedRemoteImageUrl],
    });
  } catch {
    oversizedRemoteImageUrlBlocked = true;
  }
  assert(oversizedRemoteImageUrlBlocked, 'Firestore Rules must reject remote image URLs longer than 2,048 characters');

  let oversizedNoteBlocked = false;
  try {
    await updateDoc(doc(db, 'products', 'PROD_IMAGE_VALID'), { note: 'N'.repeat(2001) });
  } catch {
    oversizedNoteBlocked = true;
  }
  assert(oversizedNoteBlocked, 'Firestore Rules must bound product notes to protect document payload size');

  let oversizedImageUpdateBlocked = false;
  try {
    await updateDoc(doc(db, 'products', 'PROD_IMAGE_VALID'), {
      imageUrl: oversizedImageDataUrl,
      imageUrls: [oversizedImageDataUrl],
    });
  } catch {
    oversizedImageUpdateBlocked = true;
  }
  assert(oversizedImageUpdateBlocked, 'Firestore Rules must reject oversized product image updates');

  await setDocumentAsAdmin('products', 'PROD_LEGACY_OVERSIZED_IMAGE', {
    ...imageProductBase,
    imageUrl: oversizedImageDataUrl,
    imageUrls: [oversizedImageDataUrl],
  });
  await updateDoc(doc(db, 'products', 'PROD_LEGACY_OVERSIZED_IMAGE'), {
    note: 'Legacy image remains untouched during unrelated edits',
  });
  console.log('     ✓ Legacy oversized image remains readable/editable without rewriting media fields');

  await setDocumentAsAdmin('products', 'PROD_LEGACY_LONG_TEXT', {
    ...imageProductBase,
    category: 'C'.repeat(101),
    note: 'N'.repeat(2001),
  });
  await updateDoc(doc(db, 'products', 'PROD_LEGACY_LONG_TEXT'), { note: 'Updated legacy note' });
  await updateDoc(doc(db, 'products', 'PROD_LEGACY_LONG_TEXT'), { category: 'Updated category' });
  console.log('     ✓ Unchanged legacy text fields do not block unrelated bounded edits');

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
  await createOrder({
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
  console.log('\n--- CASE P: Dashboard bounded order queries ---');
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

  // ==========================================
  // CASE Q: Cursor pagination is stable and does not duplicate or skip records.
  // ==========================================
  console.log('\n--- CASE Q: Cursor pagination for orders and customers ---');
  const orderPage1 = await listOrdersPage(null, 3, dashboardCustomer.id);
  const orderPage2 = await listOrdersPage(orderPage1.nextCursor, 3, dashboardCustomer.id);
  const orderPage3 = await listOrdersPage(orderPage2.nextCursor, 3, dashboardCustomer.id);
  const pagedOrders = [...orderPage1.items, ...orderPage2.items, ...orderPage3.items];
  assert(orderPage1.items.length === 3 && orderPage1.hasMore, 'Case Q: first order page has three records and a next page');
  assert(orderPage2.items.length === 3 && orderPage2.hasMore, 'Case Q: second order page has three records and a next page');
  assert(orderPage3.items.length === 2 && !orderPage3.hasMore, 'Case Q: final order page contains the remaining two records');
  assert(pagedOrders.length === 8 && new Set(pagedOrders.map((order) => order.id)).size === 8, 'Case Q: order cursors return all eight records exactly once');
  assert(pagedOrders[0].id === 'DASH-ORDER-007' && pagedOrders[7].id === 'DASH-ORDER-000', 'Case Q: order pages preserve descending createdAt order');

  const customerPageBase = Date.parse('2999-02-01T00:00:00.000Z');
  for (let i = 0; i < 7; i++) {
    const id = `CUST-PAGE-${String(i).padStart(3, '0')}`;
    const phone = `0900000${String(100 + i).slice(-3)}`;
    await setDocumentAsAdmin('customers', id, {
      name: `Khách hàng trang ${i}`,
      phone,
      phoneNormalized: phone,
      address: `Địa chỉ ${i}`,
      totalOrders: 0,
      totalSpent: 0,
      lastOrderDate: '',
      orderSummaries: [],
      note: null,
      createdAt: new Date(customerPageBase + i * 60 * 60 * 1000).toISOString(),
    });
  }
  const customerPage1 = await listCustomersPage(null, 3);
  const customerPage2 = await listCustomersPage(customerPage1.nextCursor, 3);
  const customerPage3 = await listCustomersPage(customerPage2.nextCursor, 3);
  const pagedCustomers = [...customerPage1.items, ...customerPage2.items, ...customerPage3.items].slice(0, 7);
  assert(customerPage1.items.length === 3 && customerPage1.hasMore, 'Case Q: first customer page has three records and a next page');
  assert(customerPage2.items.length === 3 && customerPage2.hasMore, 'Case Q: second customer page has three records and a next page');
  assert(customerPage3.items.length >= 1 && pagedCustomers.length === 7, 'Case Q: third customer page contains the remaining fixture records');
  assert(new Set(pagedCustomers.map((customer) => customer.id)).size === 7, 'Case Q: customer cursors return all seven fixture records exactly once');
  assert(pagedCustomers[0].id === 'CUST-PAGE-006' && pagedCustomers[6].id === 'CUST-PAGE-000', 'Case Q: customer pages preserve descending createdAt order');

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
