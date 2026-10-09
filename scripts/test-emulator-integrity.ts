/**
 * Firebase Firestore Emulator Automated Integration & Concurrency Test Suite
 * Tests Cases A through J for Data Invariants & Optimistic Concurrency Control (OCC)
 */

import { doc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../src/lib/firebase/config';
import { createCustomer, getCustomerById } from '../src/lib/services/customers';
import { createOrder, getOrderById, syncCustomerAggregates, updateOrderStatus } from '../src/lib/services/orders';
import { Product } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runTestSuite() {
  console.log('🚀 Starting Firebase Emulator Integration & Invariant Verification Suite...\n');

  // Authenticate as a staff user in Auth emulator
  const testStaffEmail = 'staff.tester@cuatiemhoa.vn';
  const testStaffPass = 'SecurePassword123!';
  try {
    await createUserWithEmailAndPassword(auth, testStaffEmail, testStaffPass);
    console.log(`🔐 Created & authenticated staff test user: ${testStaffEmail}`);
  } catch {
    // If user already exists in emulator session, sign in
    await signInWithEmailAndPassword(auth, testStaffEmail, testStaffPass);
    console.log(`🔐 Authenticated existing staff test user: ${testStaffEmail}`);
  }

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

  await setDoc(doc(db, 'products', p1.id), p1);
  await setDoc(doc(db, 'products', p2.id), p2);
  await setDoc(doc(db, 'products', pInactive.id), pInactive);
  console.log('✅ Seeded test products into emulator.\n');

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
  let snapCust = await getCustomerById(custTrans.id);
  assert(snapCust!.totalOrders === 1 && snapCust!.totalSpent === 0, 'Case D: confirmed retains totalOrders=1, totalSpent=0');

  // Case E: confirmed -> delivering
  await updateOrderStatus(oTrans.id, { status: 'delivering', actorName: 'Tester' });
  snapCust = await getCustomerById(custTrans.id);
  assert(snapCust!.totalOrders === 1 && snapCust!.totalSpent === 0, 'Case E: delivering retains totalOrders=1, totalSpent=0');

  // Case F: delivering -> completed
  await updateOrderStatus(oTrans.id, { status: 'completed', actorName: 'Tester' });
  snapCust = await getCustomerById(custTrans.id);
  assert(snapCust!.totalSpent === 1650000, `Case F: completed increases totalSpent to 1,650,000 (got ${snapCust!.totalSpent})`);

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

  // ==========================================
  // CASE H: Self-Healing Invariant / Inconsistent Aggregate Repair
  // ==========================================
  console.log('\n--- CASE H: Self-Healing Against Inconsistent Document Aggregates & Projection ---');
  // Intentionally corrupt customer aggregates AND orderSummaries projection in DB directly
  const corruptedRef = doc(db, 'customers', custTrans.id);
  const corruptedFakeSummary = {
    id: 'CORRUPTED-ORDER',
    status: 'completed',
    total: 99999999,
    createdAt: '2020-01-01T00:00:00.000Z',
  };

  await setDoc(corruptedRef, {
    totalOrders: 99999,
    totalSpent: 88888888,
    orderSummaries: [corruptedFakeSummary],
  }, { merge: true });

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

  console.log('🎉 ALL INTEGRATION & INVARIANT TESTS PASSED 100%!');
  console.log('======================================================\n');
  process.exit(0);
}

runTestSuite().catch((err) => {
  console.error('\n💥 TEST RUNNER FAILED WITH UNHANDLED ERROR:\n', err);
  process.exit(1);
});
