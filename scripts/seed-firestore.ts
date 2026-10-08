import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { mockCustomers, mockProducts, mockOrders, mockStoreSettings } from '../src/lib/mock';

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'crm-hoa-rovi';

if (!apiKey) {
  console.error('❌ Lỗi: Vui lòng cung cấp biến NEXT_PUBLIC_FIREBASE_API_KEY (chạy với dotenv hoặc điền trong .env.local)');
  process.exit(1);
}

const firebaseConfig = {
  apiKey,
  authDomain: `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket: `${projectId}.firebasestorage.app`,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

async function seedFirestore() {
  console.log(`🌱 Bắt đầu nạp dữ liệu ban đầu (seed) vào project ${projectId}...`);

  // 1. Seed Store Settings
  console.log('📦 1. Seeding settings/store...');
  await setDoc(doc(db, 'settings', 'store'), mockStoreSettings, { merge: true });

  // 2. Seed Customers
  console.log(`👥 2. Seeding ${mockCustomers.length} customers...`);
  for (const customer of mockCustomers) {
    await setDoc(doc(db, 'customers', customer.id), customer, { merge: true });
  }

  // 3. Seed Products
  console.log(`🌸 3. Seeding ${mockProducts.length} products...`);
  for (const product of mockProducts) {
    await setDoc(doc(db, 'products', product.id), product, { merge: true });
  }

  // 4. Seed Orders
  console.log(`📋 4. Seeding ${mockOrders.length} orders...`);
  for (const order of mockOrders) {
    await setDoc(doc(db, 'orders', order.id), order, { merge: true });
  }

  console.log('✅ Hoàn tất nạp dữ liệu (seed) vào Firestore thành công và idempotent!');
}

seedFirestore().catch((err) => {
  console.error('❌ Lỗi khi seed dữ liệu:', err);
  process.exit(1);
});
