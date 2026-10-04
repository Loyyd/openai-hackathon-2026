import { test, expect } from '@playwright/test';
import { installApi, openDashboard } from './api-fixture';

const demo = {
  run: { width: 3840, height: 2160, frames: 40, sample_fps: 5, embedding_backend: 'resnet18', device: 'cpu', ocr_status: 'attempted' },
  vehicles: [
    { vehicle_id: 'VX-0001', color: 'Blue', first_seen: 0, last_seen: 3, observation_count: 8, decision: 'NEW', identity_confidence: 0, evidence: {} },
    { vehicle_id: 'VX-0002', color: 'Red', first_seen: 1, last_seen: 6, observation_count: 12, decision: 'TRACKED', identity_confidence: 0.76, evidence: { visual_similarity: 0.81 } },
  ],
  video_available: false,
};

test('the recent AI page remains reachable and preserves vehicle inspection through refresh', async ({ page }) => {
  const state = await installApi(page);
  const response = structuredClone(demo);
  await page.route('**/backend/api/ai-demo', (route) => route.fulfill({ json: response }));
  await page.route('**/backend/api/ai-demo/media/**', (route) => route.abort());
  await openDashboard(page);
  await page.getByRole('link', { name: 'AI demo', exact: true }).click();
  await expect(page).toHaveURL('/ai');
  await expect(page.getByRole('heading', { name: 'Highway vehicle demo' })).toBeVisible();
  await expect(page.getByText('3840 × 2160', { exact: true })).toBeVisible();
  await expect(page.getByText('resnet18 / cpu', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /VX-0002/ }).click();
  await expect(page.locator('.incidents-panel')).toContainText('VX-0002 · Red');
  await expect(page.locator('.incidents-panel')).toContainText('76%');
  await expect(page.getByText(/Browser video not prepared/)).toBeVisible();
  response.video_available = true;
  await page.getByRole('button', { name: 'Refresh results' }).click();
  await expect(page.getByRole('button', { name: /VX-0002/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('video')).toHaveAttribute('src', '/backend/api/ai-demo/media/browser.mp4');
  await expect(page.locator('video')).toHaveAttribute('poster', '/backend/api/ai-demo/media/latest.jpg');
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page.getByTestId('active-count')).toHaveText('5');
  expect(state.pageErrors).toEqual([]);
});

test('AI demo availability errors remain visible, retry recovers, and outages retain results', async ({ page }) => {
  await installApi(page);
  let status = 404;
  await page.route('**/backend/api/ai-demo', (route) => route.fulfill({ status, json: status === 200 ? demo : {} }));
  await page.goto('/ai');
  const alert = page.locator('.notice-error[role="alert"]');
  await expect(alert).toContainText('No processed AI demo available.');
  status = 200;
  await page.getByRole('button', { name: 'Refresh results' }).click();
  await expect(page.getByRole('button', { name: /VX-0001/ })).toBeVisible();
  status = 503;
  await page.getByRole('button', { name: 'Refresh results' }).click();
  await expect(alert).toContainText('Showing the last successful results.');
  await expect(page.getByRole('button', { name: /VX-0001/ })).toBeVisible();
});
