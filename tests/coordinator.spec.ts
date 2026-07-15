import { test, expect } from '@playwright/test';

// Coordinator flow tests.
// Requires TEST_COORD_EMAIL and TEST_COORD_PASSWORD in .env.local
// pointing to a test coordinator in your test Supabase project.
// Run `npm run seed:test` first to create the test coordinator.

const EMAIL    = process.env.TEST_COORD_EMAIL    ?? 'test@sevatrack.test';
const PASSWORD = process.env.TEST_COORD_PASSWORD ?? 'testpassword123';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/admin');
  await page.getByPlaceholder(/email/i).fill(EMAIL);
  await page.getByPlaceholder(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL('**/admin/dashboard', { timeout: 10_000 });
}

test('coordinator can log in', async ({ page }) => {
  await login(page);
  await expect(page.getByText('Seva Track')).toBeVisible();
  await expect(page.getByText('Logout')).toBeVisible();
});

test('dashboard shows all tabs', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('button', { name: 'Dates' })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Add' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Members' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
});

test('coordinator can create and delete an event', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: '+ Add' }).click();

  // Fill in date (next month to avoid conflicts)
  const future = new Date();
  future.setMonth(future.getMonth() + 1);
  const dateStr = future.toISOString().slice(0, 10);
  await page.getByLabel(/date/i).fill(dateStr);
  await page.getByRole('button', { name: /save|create|add date/i }).click();

  // Should navigate back to dates view and show the new event
  await expect(page.getByText(dateStr)).toBeVisible({ timeout: 5_000 });

  // Delete it
  await page.getByText(dateStr).click();
  await page.getByRole('button', { name: /delete/i }).click();
  page.once('dialog', d => d.accept());
  await expect(page.getByText(dateStr)).not.toBeVisible({ timeout: 5_000 });
});

test('coordinator can see members tab', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Members' }).click();
  await expect(page.getByText('Volunteer Contributions')).toBeVisible();
});

test('coordinator can open settings', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByText(/address|profile|settings/i)).toBeVisible();
});

test('coordinator logout works', async ({ page }) => {
  await login(page);
  await page.getByText('Logout').click();
  await page.waitForURL('**/admin', { timeout: 5_000 });
  await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible();
});

test('unauthenticated access to dashboard redirects to login', async ({ page }) => {
  await page.goto('/admin/dashboard');
  // Should end up on /admin (login page), not the dashboard
  await expect(page).not.toHaveURL(/dashboard/);
});
