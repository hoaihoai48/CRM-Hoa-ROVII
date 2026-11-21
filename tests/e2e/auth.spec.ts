import { expect, test } from '@playwright/test';

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
