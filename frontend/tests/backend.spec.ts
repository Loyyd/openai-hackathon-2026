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

// Creates an isolated smoke record in the local development API. It intentionally
// exercises the current upstream upload interface and supplied portable image URL.
test('uploaded backend snapshot URLs load in the collection and observation drawer', async ({ page }) => {
  const id = 'frontend-smoke-' + Date.now();
  const camera = { id, provider: 'Frontend smoke test', name: 'Uploaded snapshot ' + id, location: { id: id + '-location', name: 'Dublin test location', latitude: 53.35, longitude: -6.26 }, image_url: '', last_updated: new Date().toISOString() };
  const created = await page.request.post('/backend/api/cameras', { data: camera });
  expect(created.ok()).toBe(true);
  await page.goto('/cameras');
  await page.getByLabel('Search cameras').fill(camera.name);
  const card = page.getByRole('button', { name: 'Open camera ' + camera.name, exact: true });
  await card.click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Snapshot image', { exact: true }).setInputFiles({ name: 'snapshot.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC', 'base64') });
  const captureTime = await page.evaluate(() => { const now = new Date(Date.now() + 60_000); return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); });
  await dialog.getByLabel('Captured at (your local time)', { exact: true }).fill(captureTime);
  const uploadResponse = page.waitForResponse((response) => response.url().endsWith(`/api/cameras/${id}/snapshots`) && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Save snapshot', exact: true }).click();
  const uploaded = await uploadResponse;
  expect(uploaded.status()).toBe(201);
  const observation = await uploaded.json();
  const browserUrl = '/backend' + observation.image_url;
  const imageResponse = await page.request.get(browserUrl);
  expect(imageResponse.ok()).toBe(true);
  expect(imageResponse.headers()['content-type']).toContain('image/png');
  await expect(dialog.getByText('Snapshot saved. Analysis results appear after processing.')).toBeVisible();
  const detailImage = dialog.locator('.detail-snapshot img');
  await expect(detailImage).toHaveAttribute('src', browserUrl);
  await expect.poll(() => detailImage.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const detection = { id: id + '-detection', observation_id: observation.id, type: 'vehicle', confidence: .9, label: 'Smoke test vehicle', metadata: {} };
  expect((await page.request.post('/backend/api/detections', { data: detection })).status()).toBe(201);
  await page.keyboard.press('Escape');
  const image = card.locator('img');
  await expect(image).toHaveAttribute('src', browserUrl);
  await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await card.click();
  await expect(detailImage).toHaveAttribute('src', browserUrl);
  await expect.poll(() => detailImage.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole('dialog').locator('.observation-row')).toHaveCount(2);
  await expect(dialog.getByText('Smoke test vehicle · 90% confidence', { exact: true })).toBeVisible();
  await page.screenshot({ path: '../output/playwright/redesign/backend-uploaded-snapshot.png' });
});
