import { test, expect } from '@playwright/test';

// Smoke tests — verify every public page loads without crashing.
// These run against the TEST database (via .env.local).

test('home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Seva Track')).toBeVisible();
  await expect(page.getByText("I'm a Member")).toBeVisible();
  await expect(page.getByText('Admin Portal')).toBeVisible();
});

test('member page loads', async ({ page }) => {
  await page.goto('/member');
  await expect(page).not.toHaveTitle(/error/i);
  // Should show either events or "no upcoming dates"
  await expect(page.locator('body')).not.toContainText('Application error');
});

test('admin login page loads', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible();
});

test('guide page loads', async ({ page }) => {
  await page.goto('/guide');
  await expect(page.getByText('For Volunteers')).toBeVisible();
  await expect(page.getByText('For Coordinators')).toBeVisible();
});

test('terms page loads', async ({ page }) => {
  await page.goto('/terms');
  await expect(page).not.toHaveTitle(/error/i);
  await expect(page.locator('body')).not.toContainText('Application error');
});

test('logistics page loads', async ({ page }) => {
  await page.goto('/logistics');
  await expect(page).not.toHaveTitle(/error/i);
  await expect(page.locator('body')).not.toContainText('Application error');
});

test('no console errors on home page', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.goto('/');
  await page.waitForTimeout(1000);
  expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
});
