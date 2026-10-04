import { test, expect } from '@playwright/test';

test('camera dashboard uses connected APIs without transport or session requests', async ({ page }) => {
  const requested: string[] = [];
  await page.route('**/backend/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    requested.push(path);
    const payload = path.endsWith('/api/map') ? { cameras: [], incidents: [] } :
      path.endsWith('/api/processing') ? { running: true, capturing: false, stored_snapshots: 3, completed: 3, pending: 0, failed: 0, vehicles: 2, error: null } : {};
    await route.fulfill({ json: payload });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Camera monitoring' })).toBeVisible();
  await expect(page.getByText('3 stored snapshots')).toBeVisible();
  await expect(page.getByText('2 vehicle IDs')).toBeVisible();
  await expect(page.getByText('Transport signals')).toHaveCount(0);
  await expect(page.getByText('Use demo data')).toHaveCount(0);
  await expect(page.getByText('Operator sign in')).toHaveCount(0);
  expect(requested.some(path => /auth|workflow|transport/.test(path))).toBe(false);
  await page.getByRole('button', { name: 'Collect snapshots', exact: true }).click();
  expect(requested).toContain('/backend/api/cameras/capture');
});
