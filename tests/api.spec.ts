import { test, expect } from '@playwright/test';

// API health checks — verify endpoints respond correctly.
// These are fast and don't require browser interaction.

test('GET /api/public returns coordinators, events, signups', async ({ request }) => {
  const res = await request.get('/api/public');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty('coordinators');
  expect(body).toHaveProperty('events');
  expect(body).toHaveProperty('signups');
  expect(Array.isArray(body.coordinators)).toBe(true);
});

test('GET /api/ping returns 200', async ({ request }) => {
  const res = await request.get('/api/ping');
  expect(res.status()).toBe(200);
});

test('POST /api/otp/send rejects missing phone', async ({ request }) => {
  const res = await request.post('/api/otp/send', { data: {} });
  expect(res.status()).toBe(400);
});

test('POST /api/otp/send rejects short phone', async ({ request }) => {
  const res = await request.post('/api/otp/send', { data: { phone: '123' } });
  expect(res.status()).toBe(400);
});

test('POST /api/member/cancel rejects missing signupId', async ({ request }) => {
  const res = await request.post('/api/member/cancel', { data: {} });
  expect(res.status()).toBe(400);
});

test('POST /api/member/cancel rejects fake signupId', async ({ request }) => {
  const res = await request.post('/api/member/cancel', {
    data: { signupId: '00000000-0000-0000-0000-000000000000' },
  });
  expect(res.status()).toBe(404);
});

test('POST /api/admin/delete-event rejects unauthenticated', async ({ request }) => {
  const res = await request.post('/api/admin/delete-event', {
    data: { eventId: '00000000-0000-0000-0000-000000000000' },
  });
  expect(res.status()).toBe(401);
});

test('GET /api/cron/reminders rejects missing secret', async ({ request }) => {
  const res = await request.get('/api/cron/reminders');
  expect(res.status()).toBe(401);
});
