import { expect, test, type Page } from '@playwright/test';

const projectId = 'crm-hoa-rovii';
const authEmulator = 'http://127.0.0.1:9099';
const firestoreEmulator = 'http://127.0.0.1:8080';

async function signInAsActiveAdmin(page: Page): Promise<string> {
  const email = `rovii-orders-e2e-${crypto.randomUUID()}@example.test`;
  const password = 'RoviiOrdersE2E-2026!';

  const signup = await page.request.post(
    `${authEmulator}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key-for-emulator`,
    { data: { email, password, returnSecureToken: true } },
  );
  expect(signup.ok()).toBeTruthy();
  const user = await signup.json() as { localId: string };

  const membership = await page.request.patch(
    `${firestoreEmulator}/v1/projects/${projectId}/databases/(default)/documents/users/${user.localId}`,
    {
      headers: { Authorization: 'Bearer owner' },
      data: {
        fields: {
          email: { stringValue: email },
          role: { stringValue: 'admin' },
          status: { stringValue: 'active' },
        },
      },
    },
  );
  expect(membership.ok()).toBeTruthy();

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập với Email' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return user.localId;
}

async function seedActiveProduct(page: Page, productId: string, name: string, price: number): Promise<void> {
  const response = await page.request.patch(
    `${firestoreEmulator}/v1/projects/${projectId}/databases/(default)/documents/products/${productId}`,
    {
      headers: { Authorization: 'Bearer owner' },
      data: {
        fields: {
          name: { stringValue: name },
          price: { integerValue: String(price) },
          unit: { stringValue: 'bó' },
          isActive: { booleanValue: true },
          createdAt: { stringValue: new Date().toISOString() },
        },
      },
    },
  );
  expect(response.ok()).toBeTruthy();
}

test('staff can create, edit and complete an order with consistent totals and history', async ({ page }) => {
  const productId = `PROD-E2E-${crypto.randomUUID()}`;
  const productName = `Hoa E2E ${crypto.randomUUID().slice(0, 8)}`;
  const phone = `09${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`;
  await seedActiveProduct(page, productId, productName, 350000);
  const staffUid = await signInAsActiveAdmin(page);

  await page.goto('/orders/new');
  await page.getByLabel('Số điện thoại').fill(phone);
  await page.getByLabel('Tên khách hàng').fill('Khách hàng E2E ROVII');
  await page.getByLabel('Địa chỉ giao hoa').fill('123 Đường Hoa, Hà Nội');
  await page.getByLabel('Ghi chú đơn hàng & lời nhắn thiệp').fill('Giao trước 10 giờ, thiệp chúc mừng');

  const productCard = page.getByText(productName, { exact: true }).locator('xpath=../..');
  await productCard.locator('button[title="Tăng"]').click();

  const orderFormNumbers = page.locator('form input[type="number"]');
  await orderFormNumbers.nth(0).fill('30000');
  await orderFormNumbers.nth(1).fill('0');
  await page.getByRole('button', { name: 'Lưu đơn hàng' }).click();

  await expect(page).toHaveURL(/\/orders\/DH-/);
  await expect(page.getByRole('heading', { name: /Đơn hàng #DH-/ })).toBeVisible();
  await expect(page.getByText(productName, { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Giao trước 10 giờ, thiệp chúc mừng').first()).toBeVisible();

  await page.evaluate(() => {
    window.print = () => {
      document.documentElement.dataset.printTriggered = 'true';
    };
  });
  await page.getByRole('button', { name: 'In đơn hàng' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-print-triggered', 'true');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.printable-order')).toBeVisible();
  await expect(page.locator('.print-hide').first()).toBeHidden();
  await page.emulateMedia({ media: 'screen' });

  await page.getByRole('button', { name: 'Sửa đơn hàng' }).click();
  await page.locator('#editDeliveryFee').fill('25000');
  await page.locator('#editDiscount').fill('20000');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByText('Đã lưu thay đổi đơn hàng.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sửa đơn hàng' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xác nhận' })).toBeVisible();

  await page.getByRole('button', { name: 'Xác nhận' }).click();
  await expect(page.getByRole('button', { name: 'Giao hàng' })).toBeVisible();

  // Confirmed orders remain editable until delivery begins.
  await page.getByRole('button', { name: 'Sửa đơn hàng' }).click();
  await page.locator('#editDeliveryFee').fill('20000');
  await page.locator('#editDiscount').fill('20000');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByText('Đã lưu thay đổi đơn hàng.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sửa đơn hàng' })).toBeVisible();

  await page.getByRole('button', { name: 'Giao hàng' }).click();
  await expect(page.getByRole('button', { name: 'Hoàn tất' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sửa đơn hàng' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Hoàn tất' }).click();
  await expect(page.getByRole('button', { name: 'Hoàn tất' })).toHaveCount(0);
  await expect(page.getByText('Hoàn tất', { exact: true }).first()).toBeVisible();

  const orderId = new URL(page.url()).pathname.split('/').pop();
  expect(orderId).toBeTruthy();
  const orderResponse = await page.request.get(
    `${firestoreEmulator}/v1/projects/${projectId}/databases/(default)/documents/orders/${orderId}`,
    { headers: { Authorization: 'Bearer owner' } },
  );
  expect(orderResponse.ok()).toBeTruthy();
  const order = await orderResponse.json();
  expect(order.fields.status.stringValue).toBe('completed');
  expect(order.fields.createdByUid.stringValue).toBe(staffUid);
  expect(order.fields.summary.mapValue.fields.subtotal.integerValue).toBe('350000');
  expect(order.fields.summary.mapValue.fields.total.integerValue).toBe('350000');
  expect(order.fields.statusHistory.arrayValue.values).toHaveLength(6);
  for (const entry of order.fields.statusHistory.arrayValue.values) {
    expect(entry.mapValue.fields.actorUid.stringValue).toBe(staffUid);
  }

  const customerResponse = await page.request.get(
    `${firestoreEmulator}/v1/projects/${projectId}/databases/(default)/documents/customers/CUST_${phone}`,
    { headers: { Authorization: 'Bearer owner' } },
  );
  expect(customerResponse.ok()).toBeTruthy();
  const customer = await customerResponse.json();
  expect(customer.fields.totalOrders.integerValue).toBe('1');
  expect(customer.fields.totalSpent.integerValue).toBe('350000');
});
