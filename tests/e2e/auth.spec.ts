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

    await expect(
      page.getByText(/auth\/(invalid-credential|user-not-found|wrong-password)/i),
    ).toBeVisible();
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
});
