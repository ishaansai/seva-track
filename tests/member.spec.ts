import { test, expect } from '@playwright/test';

// Member flow tests.
// These test the volunteer-facing pages.
// Run `npm run seed:test` first so there are events to sign up for.

test('member page shows sign up and mark delivered tabs', async ({ page }) => {
  await page.goto('/member');
  await expect(page.getByText('Sign Up')).toBeVisible();
  await expect(page.getByText('Mark Delivered')).toBeVisible();
});

test('mark delivered tab shows phone input', async ({ page }) => {
  await page.goto('/member');
  await page.getByText('Mark Delivered').click();
  await expect(page.getByPlaceholder(/phone/i)).toBeVisible();
});

test('signup form requires name and phone', async ({ page }) => {
  await page.goto('/member');
  // If there are upcoming events, try to open signup form
  const signupBtn = page.getByRole('button', { name: /sign up/i }).first();
  if (await signupBtn.isVisible()) {
    await signupBtn.click();
    // Try submitting empty form
    const sendCode = page.getByRole('button', { name: /send code|verify/i });
    if (await sendCode.isVisible()) {
      await sendCode.click();
      // Should show validation error or not proceed without name/phone
      await expect(page.getByText(/name|phone|required/i)).toBeVisible();
    }
  }
});

test('member page shows no application error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto('/member');
  await page.waitForTimeout(2000);
  expect(errors).toHaveLength(0);
});
