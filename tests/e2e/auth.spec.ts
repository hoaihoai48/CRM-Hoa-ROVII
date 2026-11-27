import { expect, test } from '@playwright/test';

const projectId = 'demo-crm-hoa-rovii';

test.describe('Authentication entry points', () => {
  test('renders the email login form', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Tiệm Hoa ROVII' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Mật khẩu')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Đăng nhập với Email' })).toBeEnabled();
  });

  test('redirects unauthenticated dashboard visitors to login', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Tiệm Hoa ROVII' })).toBeVisible();
  });

  test('shows an authentication error for unknown credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('missing-user@example.test');
    await page.getByLabel('Mật khẩu').fill('WrongPassword123!');
    await page.getByRole('button', { name: 'Đăng nhập với Email' }).click();

    await expect(page.getByText('Email hoặc mật khẩu không chính xác.')).toBeVisible();
    await expect(page.getByText(/auth\//i)).toHaveCount(0);
  });

  test('offers the same password-reset confirmation for existing and unknown emails', async ({ page }) => {
    const email = 'rovii-reset-' + crypto.randomUUID() + '@example.test';
    const authResponse = await page.request.post(
      'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key-for-emulator',
      { data: { email, password: 'RoviiE2E-Synthetic-2026!', returnSecureToken: true } },
    );
    expect(authResponse.ok()).toBeTruthy();

    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Quên mật khẩu?' }).click();
    const confirmation = await page.getByRole('status').textContent();
    if (!confirmation) throw new Error('Password reset confirmation was not rendered.');
    await expect(page.getByRole('status')).toContainText('Nếu email này thuộc một tài khoản có thể khôi phục');

    await page.getByLabel('Email').fill('not-registered@example.test');
    await page.getByRole('button', { name: 'Quên mật khẩu?' }).click();
    await expect(page.getByRole('status')).toHaveText(confirmation);
    await expect(page.getByText('Không thể gửi hướng dẫn đặt lại mật khẩu lúc này. Vui lòng thử lại sau hoặc liên hệ quản trị viên.')).toHaveCount(0);
  });
});

 
test('signs in an active synthetic member and opens the dashboard', async ({ page }) => {
  const email = `rovii-e2e-${crypto.randomUUID()}@example.test`;
  const password = 'RoviiE2E-Synthetic-2026!';

  const authResponse = await page.request.post(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key-for-emulator',
    { data: { email, password, returnSecureToken: true } },
  );
  expect(authResponse.ok()).toBeTruthy();
  const authUser = await authResponse.json() as { localId: string };

  const membershipResponse = await page.request.patch(
    `http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents/users/${authUser.localId}`,
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
  expect(membershipResponse.ok()).toBeTruthy();

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập với Email' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible();
  const refreshDashboard = page.getByRole('button', { name: 'Làm mới tổng quan' });
  await expect(refreshDashboard).toBeEnabled();
  await expect(page.getByText('Đang tải dữ liệu tổng quan...')).not.toBeVisible();
  await refreshDashboard.click();
  await expect(refreshDashboard).toBeEnabled();
});
