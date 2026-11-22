import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getStorage, connectStorageEmulator, ref, uploadBytes, deleteObject, getBytes } from 'firebase/storage';
import app, { auth } from '../src/lib/firebase/config';

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-crm-hoa-rovii';
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const password = 'StorageRulesTest123!';
const storage = getStorage(app, `gs://${projectId}.appspot.com`);
const storageEmulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199';
const [storageHost, storagePort] = storageEmulatorHost.split(':');
connectStorageEmulator(storage, storageHost, Number(storagePort) || 9199);

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Storage Rules assertion failed: ${message}`);
  console.log(`  ✓ ${message}`);
}

async function provisionMembership(
  uid: string,
  role: string,
  status: string,
) {
  const url = `http://${firestoreHost}/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer owner',
    },
    body: JSON.stringify({
      fields: {
        role: { stringValue: role },
        status: { stringValue: status },
        email: { stringValue: `storage-${role}-${status}@example.test` },
        createdAt: { stringValue: new Date().toISOString() },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to provision Storage test membership: ${await response.text()}`);
  }
}

async function createMember(role: 'admin' | 'staff', status: 'active' | 'inactive') {
  const email = `storage-${role}-${status}@example.test`;
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await provisionMembership(credential.user.uid, role, status);
  await signOut(auth);
  return email;
}

async function expectStorageDenied(label: string, action: () => Promise<unknown>) {
  let denied = false;
  try {
    await action();
  } catch (error) {
    const code = (error as { code?: string }).code;
    denied = code === 'storage/unauthorized';
    if (!denied) throw error;
  }
  assert(denied, label);
}

async function run() {
  console.log('--- STORAGE RULES: active-admin product image boundary ---');
  const adminEmail = await createMember('admin', 'active');
  const staffEmail = await createMember('staff', 'active');
  const inactiveEmail = await createMember('staff', 'inactive');
  const orphanCredential = await createUserWithEmailAndPassword(
    auth,
    'storage-no-membership@example.test',
    password,
  );
  const orphanEmail = orphanCredential.user.email!;
  await signOut(auth);

  const malformedCredential = await createUserWithEmailAndPassword(
    auth,
    'storage-malformed-membership@example.test',
    password,
  );
  const malformedEmail = malformedCredential.user.email!;
  await provisionMembership(malformedCredential.user.uid, 'superadmin', 'active');
  await signOut(auth);

  const pngBytes = new Uint8Array(Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l2cAAAAASUVORK5CYII=',
    'base64',
  ));
  const adminImage = ref(storage, 'products/storage-rules-admin-test.png');

  await expectStorageDenied(
    'Unauthenticated client cannot upload product images',
    () => uploadBytes(ref(storage, 'products/storage-rules-anonymous-test.png'), pngBytes, { contentType: 'image/png' }),
  );

  await signInWithEmailAndPassword(auth, orphanEmail, password);
  await expectStorageDenied(
    'Authenticated user without a membership document cannot upload product images',
    () => uploadBytes(ref(storage, 'products/storage-rules-no-membership.png'), pngBytes, { contentType: 'image/png' }),
  );
  await signOut(auth);

  await signInWithEmailAndPassword(auth, malformedEmail, password);
  await expectStorageDenied(
    'Authenticated user with a malformed/non-admin membership cannot upload product images',
    () => uploadBytes(ref(storage, 'products/storage-rules-malformed-membership.png'), pngBytes, { contentType: 'image/png' }),
  );
  await signOut(auth);

  await signInWithEmailAndPassword(auth, adminEmail, password);
  await uploadBytes(adminImage, pngBytes, { contentType: 'image/png' });
  assert(true, 'Active admin can upload a valid product image');
  await uploadBytes(adminImage, pngBytes, { contentType: 'image/png' });
  assert(true, 'Active admin can overwrite an existing product image');

  await expectStorageDenied(
    'Active admin cannot upload a PDF or mismatched file type',
    () => uploadBytes(ref(storage, 'products/storage-rules-invalid.txt'), pngBytes, { contentType: 'image/png' }),
  );
  await expectStorageDenied(
    'Active admin cannot upload an image with a non-image MIME type',
    () => uploadBytes(ref(storage, 'products/storage-rules-invalid-mime.png'), pngBytes, { contentType: 'application/pdf' }),
  );
  await expectStorageDenied(
    'Active admin cannot upload an object at or above the 10 MiB limit',
    () => uploadBytes(ref(storage, 'products/storage-rules-oversize.png'), new Uint8Array(10 * 1024 * 1024), { contentType: 'image/png' }),
  );
  await signOut(auth);

  await signInWithEmailAndPassword(auth, staffEmail, password);
  await expectStorageDenied(
    'Active staff cannot upload product images',
    () => uploadBytes(ref(storage, 'products/storage-rules-staff-test.png'), pngBytes, { contentType: 'image/png' }),
  );
  await expectStorageDenied(
    'Active staff cannot overwrite an existing product image',
    () => uploadBytes(adminImage, pngBytes, { contentType: 'image/png' }),
  );
  await expectStorageDenied(
    'Active staff cannot delete product images',
    () => deleteObject(adminImage),
  );
  await signOut(auth);

  await signInWithEmailAndPassword(auth, inactiveEmail, password);
  await expectStorageDenied(
    'Inactive staff cannot upload product images',
    () => uploadBytes(ref(storage, 'products/storage-rules-inactive-test.png'), pngBytes, { contentType: 'image/png' }),
  );
  await expectStorageDenied(
    'Inactive staff cannot delete product images',
    () => deleteObject(adminImage),
  );
  await signOut(auth);

  // Product images are intentionally public-readable for storefront rendering.
  const publicBytes = await getBytes(adminImage);
  assert(publicBytes.byteLength === pngBytes.byteLength, 'Unauthenticated client can read a public product image');

  await signInWithEmailAndPassword(auth, adminEmail, password);
  await deleteObject(adminImage);
  assert(true, 'Active admin can delete a product image');
  await signOut(auth);

  console.log('Storage Rules regression suite passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
