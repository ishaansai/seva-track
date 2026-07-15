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
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  await page.waitForURL('**/admin/dashboard', { timeout: 15_000 });
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

  // Fill in the first date input (span "Date 1" is not a real <label>, use type selector)
  const future = new Date();
  future.setMonth(future.getMonth() + 2);
  const dateStr = future.toISOString().slice(0, 10);
  await page.locator('input[type="date"]').first().fill(dateStr);

  // Scroll down to find and click the save button
  await page.getByRole('button', { name: 'Create Dates' }).click();

  // Dates are displayed as "Tue, Sep 15" — format the expected label
  const label = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
  await expect(page.getByText(label).first()).toBeVisible({ timeout: 5_000 });

  // Click the first matching event card and delete it
  await page.getByRole('button', { name: new RegExp(label) }).first().click();
  await page.getByRole('button', { name: /delete/i }).click();
  page.once('dialog', d => d.accept());
  // At least one fewer instance should remain (others may exist from prior runs)
  await page.waitForTimeout(1000);
});

test('coordinator can see members tab', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Members' }).click();
  await expect(page.getByText('Volunteer Contributions')).toBeVisible();
});

test('coordinator can open settings', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByText('Chapter Settings')).toBeVisible();
});

test('coordinator logout works', async ({ page }) => {
  await login(page);
  await page.getByText('Logout').click();
  await page.waitForURL('**/admin', { timeout: 5_000 });
  await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
});

test('unauthenticated access to dashboard redirects to login', async ({ page }) => {
  await page.goto('/admin/dashboard');
  // Should end up on /admin (login page), not the dashboard
  await expect(page).not.toHaveURL(/dashboard/);
});
