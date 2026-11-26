import { expect, test, type Page } from '@playwright/test';

const projectId = 'demo-crm-hoa-rovii';
const authEmulator = 'http://127.0.0.1:9099';
const firestoreEmulator = 'http://127.0.0.1:8080';

async function createAuthUser(page: Page, prefix: string): Promise<{ uid: string; email: string }> {
  const email = prefix + '-' + crypto.randomUUID() + '@example.test';
  const password = 'RoviiE2E-Synthetic-2026!';
  const response = await page.request.post(
    authEmulator + '/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key-for-emulator',
    { data: { email, password, returnSecureToken: true } },
  );
  expect(response.ok()).toBeTruthy();
  const user = await response.json() as { localId: string };
  return { uid: user.localId, email };
}

async function seedMembership(
  page: Page,
  uid: string,
  email: string,
  role: 'admin' | 'staff',
  name: string,
): Promise<void> {
  const response = await page.request.patch(
    firestoreEmulator + '/v1/projects/' + projectId + '/databases/(default)/documents/users/' + uid,
    {
      headers: { Authorization: 'Bearer owner' },
      data: {
        fields: {
          uid: { stringValue: uid },
          email: { stringValue: email },
          name: { stringValue: name },
          role: { stringValue: role },
          status: { stringValue: 'active' },
          createdAt: { stringValue: new Date().toISOString() },
        },
      },
    },
  );
  expect(response.ok()).toBeTruthy();
}

async function signInAsActiveAdmin(page: Page): Promise<string> {
  const account = await createAuthUser(page, 'rovii-admin-e2e');
  await seedMembership(page, account.uid, account.email, 'admin', 'Admin E2E ROVII');

  await page.goto('/login');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Mật khẩu').fill('RoviiE2E-Synthetic-2026!');
  await page.getByRole('button', { name: 'Đăng nhập với Email' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return account.uid;
}

async function readFirestoreDocument(page: Page, collectionName: string, documentId: string) {
  const response = await page.request.get(
    firestoreEmulator + '/v1/projects/' + projectId + '/databases/(default)/documents/' + collectionName + '/' + documentId,
    { headers: { Authorization: 'Bearer owner' } },
  );
  expect(response.ok()).toBeTruthy();
  return await response.json() as { fields: Record<string, { stringValue?: string; integerValue?: string; doubleValue?: string; booleanValue?: boolean }> };
}

test.describe('Admin daily workflows', () => {
  test('creates, edits and deactivates a product through the catalog UI', async ({ page }) => {
    await signInAsActiveAdmin(page);

    const productName = 'Hoa E2E ' + crypto.randomUUID().slice(0, 8);
    const updatedName = productName + ' Premium';

    await page.goto('/products/new');
    await page.getByLabel('Tên mẫu hoa / sản phẩm').fill(productName);
    await page.getByLabel('Giá bán (VNĐ)').fill('245000');
    await page.locator('form select').nth(0).selectOption('giỏ');
    await page.locator('form select').nth(1).selectOption('Hoa giỏ');
    await page.getByLabel('Mô tả / Lưu ý cắm hoa').fill('Sản phẩm kiểm thử danh mục');
    await page.getByRole('button', { name: 'Lưu sản phẩm' }).click();
    await expect(page).toHaveURL(/\/products$/);

    const productCard = page.locator('div.group').filter({ hasText: productName });
    await expect(productCard).toBeVisible();
    await productCard.getByRole('link', { name: 'Sửa' }).click();
    await expect(page.getByRole('heading', { name: new RegExp('Chỉnh sửa: ' + productName) })).toBeVisible();

    const productId = new URL(page.url()).pathname.split('/').pop();
    expect(productId).toBeTruthy();
    await page.getByLabel('Tên mẫu hoa / sản phẩm').fill(updatedName);
    await page.getByLabel('Giá bán (VNĐ)').fill('275000');
    await page.getByText('Trạng thái bán hàng').locator('xpath=../..').getByRole('button').click();
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(page).toHaveURL(/\/products$/);

    const product = await readFirestoreDocument(page, 'products', productId as string);
    expect(product.fields.name.stringValue).toBe(updatedName);
    expect(product.fields.price.integerValue || product.fields.price.doubleValue).toBe('275000');
    expect(product.fields.unit.stringValue).toBe('giỏ');
    expect(product.fields.category.stringValue).toBe('Hoa giỏ');
    expect(product.fields.isActive.booleanValue).toBe(false);

    // The service should reject values that Firestore Rules would reject, with a useful form error.
    await page.goto('/products/new');
    await page.getByLabel('Tên mẫu hoa / sản phẩm').fill('A'.repeat(201));
    await page.getByRole('button', { name: 'Lưu sản phẩm' }).click();
    await expect(page.getByText('Tên sản phẩm không được vượt quá 200 ký tự.')).toBeVisible();
  });

  test('creates, searches and edits a customer profile without changing its phone identity', async ({ page }) => {
    await signInAsActiveAdmin(page);

    const customerName = 'Khách E2E ' + crypto.randomUUID().slice(0, 8);
    const updatedName = customerName + ' VIP';
    const phone = '09' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
    const customerId = 'CUST_' + phone;

    await page.goto('/customers');
    await page.getByRole('button', { name: 'Thêm khách hàng' }).first().click();
    await page.getByLabel('Tên khách hàng').fill(customerName);
    await page.getByLabel('Số điện thoại').fill(phone);
    await page.getByLabel('Địa chỉ').fill('12 Đường Hoa, Nha Trang');
    await page.getByLabel('Ghi chú (không bắt buộc)').fill('Ưa hoa tone pastel');
    await page.getByRole('button', { name: 'Lưu khách hàng' }).click();

    const search = page.getByPlaceholder('Tìm tên hoặc số điện thoại khách hàng...');
    await search.fill(phone);
    const customerLink = page.getByRole('link', { name: customerName, exact: true }).first();
    await expect(customerLink).toBeVisible();
    await customerLink.click();
    await expect(page.getByRole('heading', { name: customerName })).toBeVisible();

    await page.getByRole('button', { name: 'Sửa thông tin' }).click();
    await page.getByLabel('Tên khách hàng').fill(updatedName);
    await page.getByLabel('Địa chỉ thường giao').fill('99 Đường Hoa, Nha Trang');
    await page.getByLabel('Ghi chú sở thích của khách').fill('Khách VIP - ưu tiên giao buổi sáng');
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(page.getByRole('status').getByText('Đã lưu thông tin khách hàng.')).toBeVisible();

    const customer = await readFirestoreDocument(page, 'customers', customerId);
    expect(customer.fields.name.stringValue).toBe(updatedName);
    expect(customer.fields.phone.stringValue).toBe(phone);
    expect(customer.fields.address.stringValue).toBe('99 Đường Hoa, Nha Trang');
    expect(customer.fields.note.stringValue).toContain('Khách VIP');
  });

  test('manages memberships, provisions email/password staff and links an existing Firebase Auth identity', async ({ page }) => {
    await signInAsActiveAdmin(page);

    const fixture = await createAuthUser(page, 'rovii-staff-fixture');
    await seedMembership(page, fixture.uid, fixture.email, 'staff', 'Nhân viên E2E');

    await page.goto('/staff');
    const row = page.getByRole('row').filter({ hasText: fixture.email });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Lên admin' }).click();
    await expect(row.getByText('admin', { exact: true })).toBeVisible();

    await row.getByRole('button', { name: 'Khóa' }).click();
    await expect(row.getByText('Đã khóa')).toBeVisible();
    await row.getByRole('button', { name: 'Mở khóa' }).click();
    await expect(row.getByText('Đang hoạt động')).toBeVisible();

    const membership = await readFirestoreDocument(page, 'users', fixture.uid);
    expect(membership.fields.uid.stringValue).toBe(fixture.uid);
    expect(membership.fields.role.stringValue).toBe('admin');
    expect(membership.fields.status.stringValue).toBe('active');

    const newStaffName = 'Nhân viên mới E2E';
    const newStaffEmail = 'rovii-new-staff-' + crypto.randomUUID() + '@example.test';
    await page.getByRole('button', { name: 'Thêm nhân viên' }).click();
    await page.getByLabel('Tên nhân viên').fill(newStaffName);
    await page.getByLabel('Email đăng nhập').fill(newStaffEmail);
    await page.getByLabel('Mật khẩu (tối thiểu 6 ký tự)').fill('RoviiStaff-2026!');
    await page.locator('form select').selectOption('staff');
    await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
    await expect(page.getByRole('status').getByText(newStaffEmail)).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: newStaffEmail })).toBeVisible();

    const existingAuthAccount = await createAuthUser(page, 'rovii-existing-auth');
    await page.getByRole('button', { name: 'Liên kết tài khoản đã có' }).click();
    await page.getByLabel('UID Firebase Auth').fill(existingAuthAccount.uid);
    await page.getByLabel('Email tài khoản hiện có').fill(existingAuthAccount.email);
    await page.getByLabel('Tên hiển thị nhân viên').fill('Nhân viên Auth E2E');
    await page.locator('form').last().locator('select').selectOption('staff');
    await page.getByRole('button', { name: 'Cấp quyền cho tài khoản' }).click();
    await expect(page.getByRole('status').getByText(existingAuthAccount.email)).toBeVisible();

    const linkedMembership = await readFirestoreDocument(page, 'users', existingAuthAccount.uid);
    expect(linkedMembership.fields.uid.stringValue).toBe(existingAuthAccount.uid);
    expect(linkedMembership.fields.email.stringValue).toBe(existingAuthAccount.email);
    expect(linkedMembership.fields.name.stringValue).toBe('Nhân viên Auth E2E');
    expect(linkedMembership.fields.role.stringValue).toBe('staff');
    expect(linkedMembership.fields.status.stringValue).toBe('active');
  });

  test('loads and saves store settings for an active admin', async ({ page }) => {
    await signInAsActiveAdmin(page);

    const seed = await page.request.patch(
      firestoreEmulator + '/v1/projects/' + projectId + '/databases/(default)/documents/settings/store',
      {
        headers: { Authorization: 'Bearer owner' },
        data: {
          fields: {
            storeName: { stringValue: 'ROVII E2E Seed' },
            phone: { stringValue: '0900000000' },
            address: { stringValue: 'Địa chỉ seed' },
            zaloUrl: { stringValue: 'https://zalo.me/0900000000' },
            logoUrl: { stringValue: '' },
          },
        },
      },
    );
    expect(seed.ok()).toBeTruthy();

    await page.goto('/settings');
    await page.getByLabel('Tên tiệm hoa').fill('Tiệm Hoa ROVII E2E');
    await page.getByLabel('Số điện thoại hotline').fill('0912345678');
    await page.getByLabel('Link Zalo OA / Zalo cá nhân của tiệm').fill('https://zalo.me/0912345678');
    await page.getByLabel('Địa chỉ cửa hàng').fill('25 Đường Hoa, Nha Trang');
    await page.getByRole('button', { name: 'Lưu cài đặt' }).click();
    await expect(page.getByText('Đã lưu cài đặt.')).toBeVisible();

    const settings = await readFirestoreDocument(page, 'settings', 'store');
    expect(settings.fields.storeName.stringValue).toBe('Tiệm Hoa ROVII E2E');
    expect(settings.fields.phone.stringValue).toBe('0912345678');
    expect(settings.fields.address.stringValue).toBe('25 Đường Hoa, Nha Trang');
    expect(settings.fields.zaloUrl.stringValue).toBe('https://zalo.me/0912345678');
  });

  test('shows authenticated account UID and email when membership is not provisioned', async ({ page }) => {
    const account = await createAuthUser(page, 'rovii-unprovisioned-login');

    await page.goto('/login');
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Mật khẩu').fill('RoviiE2E-Synthetic-2026!');
    await page.getByRole('button', { name: 'Đăng nhập với Email' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await expect(page.getByText('UID Firebase Auth:', { exact: false })).toBeVisible();
    await expect(page.getByText(account.uid, { exact: true })).toBeVisible();
    await expect(page.getByText(account.email, { exact: false })).toBeVisible();

    // Simulate the admin granting membership after verifying the employee's UID/email.
    await seedMembership(page, account.uid, account.email, 'staff', 'Nhân viên vừa được cấp quyền');
    await page.getByRole('button', { name: 'Kiểm tra lại quyền truy cập' }).click();
    await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible();
  });

  test('keeps admin-only staff controls unavailable to a regular staff member', async ({ page }) => {
    const account = await createAuthUser(page, 'rovii-readonly-staff');
    await seedMembership(page, account.uid, account.email, 'staff', 'Staff Readonly E2E');

    await page.goto('/login');
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Mật khẩu').fill('RoviiE2E-Synthetic-2026!');
    await page.getByRole('button', { name: 'Đăng nhập với Email' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto('/staff');
    await expect(page.getByText('Khu vực dành cho quản trị viên.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Thêm nhân viên' })).toHaveCount(0);

    await page.goto('/settings');
    await expect(page.getByText(/Tài khoản nhân viên chỉ được xem cài đặt/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lưu cài đặt' })).toHaveCount(0);

    await page.goto('/products/new');
    await expect(page.getByRole('alert').getByText(/Chỉ quản trị viên đang hoạt động/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lưu sản phẩm' })).toHaveCount(0);

    const productId = 'PROD-STAFF-DIRECT-ACCESS';
    const seedProduct = await page.request.patch(
      firestoreEmulator + '/v1/projects/' + projectId + '/databases/(default)/documents/products/' + productId,
      {
        headers: { Authorization: 'Bearer owner' },
        data: {
          fields: {
            name: { stringValue: 'Sản phẩm kiểm tra quyền staff' },
            price: { integerValue: '100000' },
            unit: { stringValue: 'bó' },
            isActive: { booleanValue: true },
            createdAt: { stringValue: new Date().toISOString() },
          },
        },
      },
    );
    expect(seedProduct.ok()).toBeTruthy();
    await page.goto('/products/' + productId);
    await expect(page.getByRole('alert').getByText(/Chỉ quản trị viên đang hoạt động/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lưu thay đổi' })).toHaveCount(0);
  });
});
