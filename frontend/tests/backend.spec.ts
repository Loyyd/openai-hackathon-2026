import { test, expect } from '@playwright/test';
import type { MapData } from '../types';

// Optional smoke test against the repository's current backend. API calls are real.
// Update the unavailable-service assertions when the backend handoff is implemented.
test('real backend proxy reads, camera evidence and unavailable operator services', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e8eee4"/><path d="M0 100L256 160M80 0L130 256" stroke="#fff" stroke-width="12"/></svg>',
  }));
  const response = await page.request.get('/backend/api/map');
  expect(response.ok()).toBe(true);
  const data: MapData = await response.json();
  expect(data.cameras.length).toBeGreaterThan(0);
  await page.goto('/');
  await expect(page.getByText('Backend connected', { exact: true })).toBeVisible();
  await expect(page.getByText('Workflow data is unavailable.')).toBeVisible();
  await expect(page.getByTestId('active-count')).toHaveText(String(data.incidents.filter((item) => item.status === 'active').length));
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();
  await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible();
  await page.screenshot({ path: '../output/playwright/desktop-backend.png', fullPage: true });
  await page.locator('.incident-card').first().click();
  let dialog = page.getByRole('dialog');
  await expect(dialog.locator('.evidence-card').first()).toBeVisible();
  await dialog.getByRole('button', { name: 'Open camera evidence' }).first().click();
  dialog = page.getByRole('dialog');
  await expect(dialog.locator('.observation-row')).not.toHaveCount(1);
  await expect(dialog.locator('.detail-snapshot img')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Operator sign in' }).click();
  dialog = page.getByRole('dialog', { name: 'Operator sign in' });
  await dialog.getByLabel('Email', { exact: true }).fill('frontend-smoke@example.test');
  await dialog.getByLabel('Password', { exact: true }).fill('not-a-real-account');
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('This service is not available yet.');
});
