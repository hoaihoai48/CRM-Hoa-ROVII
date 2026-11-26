import { expect, test, type Page } from '@playwright/test';

const projectId = 'demo-crm-hoa-rovii';
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


test('changing the phone after selecting a customer clears the old customer identity', async ({ page }) => {
  const productId = `PROD-PHONE-IDENTITY-${crypto.randomUUID()}`;
  const productName = `Hoa kiểm tra danh tính ${crypto.randomUUID().slice(0, 6)}`;
  const originalPhone = `09${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`;
  const replacementPhone = `08${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`;
  const originalCustomerId = `CUST_${originalPhone}`;
  await seedActiveProduct(page, productId, productName, 120000);
  await signInAsActiveAdmin(page);

  const customerSeed = await page.request.patch(
    `${firestoreEmulator}/v1/projects/${projectId}/databases/(default)/documents/customers/${originalCustomerId}`,
    {
      headers: { Authorization: 'Bearer owner' },
      data: {
        fields: {
          name: { stringValue: 'Khách đã chọn ban đầu' },
          phone: { stringValue: originalPhone },
          phoneNormalized: { stringValue: originalPhone },
          address: { stringValue: 'Địa chỉ khách ban đầu' },
          totalOrders: { integerValue: '0' },
          totalSpent: { integerValue: '0' },
          lastOrderDate: { stringValue: '' },
          createdAt: { stringValue: new Date().toISOString() },
        },
      },
    },
  );
  expect(customerSeed.ok()).toBeTruthy();

  await page.goto('/orders/new');
  await page.getByLabel('Số điện thoại').fill(originalPhone);
  await page.getByRole('button', { name: 'Chọn khách này' }).click();
  await expect(page.getByLabel('Tên khách hàng')).toHaveValue('Khách đã chọn ban đầu');

  // Changing the identity phone must not retain the selected customer's document ID or profile.
  await page.getByLabel('Số điện thoại').fill(replacementPhone);
  await expect(page.getByLabel('Tên khách hàng')).toHaveValue('');
  await expect(page.getByLabel('Địa chỉ giao hoa')).toHaveValue('');

  await page.getByLabel('Tên khách hàng').fill('Khách theo số mới');
  await page.getByLabel('Địa chỉ giao hoa').fill('Địa chỉ khách theo số mới');
  const productCard = page.getByText(productName, { exact: true }).locator('xpath=../..');
  await productCard.locator('button[title="Tăng"]').click();
  await page.getByRole('button', { name: 'Lưu đơn hàng' }).click();
  await expect(page).toHaveURL(/\/orders\/DH-/);

  const orderId = new URL(page.url()).pathname.split('/').pop();
  const orderResponse = await page.request.get(
    `${firestoreEmulator}/v1/projects/${projectId}/databases/(default)/documents/orders/${orderId}`,
    { headers: { Authorization: 'Bearer owner' } },
  );
  expect(orderResponse.ok()).toBeTruthy();
  const order = await orderResponse.json();
  expect(order.fields.customerId.stringValue).toBe(`CUST_${replacementPhone}`);
  expect(order.fields.customerSnapshot.mapValue.fields.phone.stringValue).toBe(replacementPhone);

  const originalCustomer = await page.request.get(
    `${firestoreEmulator}/v1/projects/${projectId}/databases/(default)/documents/customers/${originalCustomerId}`,
    { headers: { Authorization: 'Bearer owner' } },
  );
  expect(originalCustomer.ok()).toBeTruthy();
  const original = await originalCustomer.json();
  expect(original.fields.totalOrders.integerValue).toBe('0');
});


test('customer order history loads additional cursor pages without skipping records', async ({ page }) => {
  const staffUid = await signInAsActiveAdmin(page);
  const customerId = `CUST-HISTORY-E2E-${crypto.randomUUID()}`;
  const customerName = 'Khách hàng lịch sử phân trang E2E';
  const customerPhone = '0901234567';
  const customerAddress = 'Địa chỉ kiểm thử phân trang';

  const customerResponse = await page.request.patch(
    `${firestoreEmulator}/v1/projects/${projectId}/databases/(default)/documents/customers/${customerId}`,
    {
      headers: { Authorization: 'Bearer owner' },
      data: {
        fields: {
          name: { stringValue: customerName },
          phone: { stringValue: customerPhone },
          phoneNormalized: { stringValue: customerPhone },
          address: { stringValue: customerAddress },
          totalOrders: { integerValue: '27' },
          totalSpent: { integerValue: '2700000' },
          lastOrderDate: { stringValue: '2026-11-22T00:26:00.000Z' },
          orderSummaries: { arrayValue: { values: [] } },
          createdAt: { stringValue: '2026-01-01T00:00:00.000Z' },
        },
      },
    },
  );
  expect(customerResponse.ok()).toBeTruthy();

  const fixtureWrites = Array.from({ length: 27 }, (_, index) => {
    const sequence = String(index).padStart(3, '0');
    const orderId = `ORDER-HISTORY-E2E-${sequence}`;
    const createdAt = new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString();
    return page.request.patch(
      `${firestoreEmulator}/v1/projects/${projectId}/databases/(default)/documents/orders/${orderId}`,
      {
        headers: { Authorization: 'Bearer owner' },
        data: {
          fields: {
            customerId: { stringValue: customerId },
            customerSnapshot: {
              mapValue: {
                fields: {
                  name: { stringValue: customerName },
                  phone: { stringValue: customerPhone },
                  address: { stringValue: customerAddress },
                },
              },
            },
            items: {
              arrayValue: {
                values: [{
                  mapValue: {
                    fields: {
                      id: { stringValue: `ITEM-${sequence}` },
                      productId: { stringValue: 'PRODUCT-HISTORY-E2E' },
                      productSnapshot: {
                        mapValue: {
                          fields: {
                            name: { stringValue: `Hoa lịch sử ${sequence}` },
                            unit: { stringValue: 'bó' },
                          },
                        },
                      },
                      quantity: { integerValue: '1' },
                      unitPrice: { integerValue: '100000' },
                      subtotal: { integerValue: '100000' },
                    },
                  },
                }],
              },
            },
            summary: {
              mapValue: {
                fields: {
                  subtotal: { integerValue: '100000' },
                  deliveryFee: { integerValue: '0' },
                  discount: { integerValue: '0' },
                  total: { integerValue: '100000' },
                },
              },
            },
            status: { stringValue: 'completed' },
            statusHistory: {
              arrayValue: {
                values: [{
                  mapValue: {
                    fields: {
                      id: { stringValue: `HISTORY-${sequence}` },
                      status: { stringValue: 'completed' },
                      timestamp: { stringValue: createdAt },
                      actorName: { stringValue: 'E2E fixture' },
                      actorUid: { stringValue: staffUid },
                    },
                  },
                }],
              },
            },
            createdAt: { stringValue: createdAt },
            createdBy: { stringValue: 'E2E fixture' },
            createdByUid: { stringValue: staffUid },
          },
        },
      },
    );
  });
  const responses = await Promise.all(fixtureWrites);
  expect(responses.every((response) => response.ok())).toBeTruthy();

  await page.goto(`/customers/${customerId}`);
  await expect(page.getByText('Lịch sử đơn hàng')).toBeVisible();
  await expect(page.getByText('Đã tải 25 đơn')).toBeVisible();
  await expect(page.getByRole('link', { name: /#ORDER-HISTORY-E2E-026/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /#ORDER-HISTORY-E2E-000/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'Tải thêm đơn hàng' }).click();
  await expect(page.getByText('27 đơn').last()).toBeVisible();
  await expect(page.getByRole('link', { name: /#ORDER-HISTORY-E2E-000/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tải thêm đơn hàng' })).toHaveCount(0);
});
