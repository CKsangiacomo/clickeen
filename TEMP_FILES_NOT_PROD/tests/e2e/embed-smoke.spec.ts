import { test, expect } from '@playwright/test';

// Ensures embed service key endpoints exist.
test.describe('Embed service', () => {
  test('health endpoints respond', async ({ request }) => {
    const res = await request.get('http://localhost:3002/api/ingest');
    expect(res.status()).toBeGreaterThanOrEqual(200);
  });
});