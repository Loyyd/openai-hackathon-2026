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
  await expect(page.locator('video')).not.toHaveAttribute('poster');
  await page.getByRole('link', { name: 'Map', exact: true }).click();
  await expect(page.getByTestId('active-count')).toHaveText('5');
  expect(state.pageErrors).toEqual([]);
});

test('replay reveals unique identities per frame and seeking rebuilds observed evidence', async ({ page }) => {
  const state = await installApi(page);
  const response = { ...demo, run: { ...demo.run, replay_fps: 2 }, video_available: true, timeline: [
    { timestamp: 10, vehicles: [{ vehicle_id: 'VX-0001', decision: 'NEW', identity_confidence: 0, evidence: {} }] },
    { timestamp: 10.5, vehicles: [{ vehicle_id: 'VX-0001', decision: 'TRACKED', identity_confidence: 0.4, evidence: {} }, { vehicle_id: 'VX-0002', decision: 'NEW', identity_confidence: 0, evidence: {} }] },
    { timestamp: 11, vehicles: [{ vehicle_id: 'VX-0002', decision: 'TRACKED', identity_confidence: 0.76, evidence: { visual_similarity: 0.81 } }] },
    { timestamp: 11.5, vehicles: [] },
  ] };
  await page.route('**/backend/api/ai-demo', route => route.fulfill({ json: response }));
  // Drive media events independently of codec support; real playback is checked in Preview.
  await page.route('**/backend/api/ai-demo/media/**', route => route.fulfill({ contentType: 'video/mp4', body: '' }));
  await page.goto('/ai');
  const panel = page.getByRole('region', { name: 'Replay identities' });
  const updateFrame = async (time: number) => {
    await page.locator('video').evaluate((video: HTMLVideoElement, currentTime) => {
      Object.defineProperty(video, 'currentTime', { configurable: true, value: currentTime });
      video.dispatchEvent(new Event('loadeddata'));
      video.dispatchEvent(new Event('seeked'));
    }, time);
  };
  await updateFrame(0);
  await expect(panel.getByRole('status')).toHaveText('1 discovered');
  await expect(panel.getByRole('button', { name: /VX-0002/ })).toHaveCount(0);
  await expect(panel).toContainText('1 observations · 10.00s–10.00s');
  await updateFrame(0.5);
  await expect(panel.getByRole('status')).toHaveText('2 discovered');
  await expect(panel.getByRole('button', { name: /VX-0001/ })).toHaveCount(1);
  await panel.getByRole('button', { name: /VX-0002/ }).click();
  await expect(panel).toContainText('Match confidence: 0% · NEW');
  await updateFrame(1);
  await expect(panel.getByRole('button', { name: /VX-0001/ })).toContainText('Previously seen');
  await expect(panel.getByRole('button', { name: /VX-0002/ })).toContainText('In frame');
  await expect(panel).toContainText('Match confidence: 76% · TRACKED');
  await expect(panel).toContainText('2 observations · 10.50s–11.00s');
  await page.getByRole('button', { name: 'Refresh results' }).click();
  await expect(panel.getByRole('button', { name: /VX-0002/ })).toHaveAttribute('aria-pressed', 'true');
  await updateFrame(1.5);
  await expect(panel.getByRole('status')).toHaveText('2 discovered');
  await expect(panel).toContainText('0 in frame');
  await updateFrame(0);
  await expect(panel.getByRole('status')).toHaveText('1 discovered');
  await expect(panel.getByRole('button', { name: /VX-0002/ })).toHaveCount(0);
  await expect(panel).toContainText('Match confidence: 0% · NEW');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel.getByRole('heading', { name: 'Unique identities' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(state.pageErrors).toEqual([]);
});

test('unavailable replay media keeps identities inspectable with a clear fallback', async ({ page }) => {
  await installApi(page);
  await page.route('**/backend/api/ai-demo', route => route.fulfill({ json: { ...demo, video_available: true, timeline: [{ timestamp: 0, vehicles: [] }] } }));
  await page.route('**/backend/api/ai-demo/media/**', route => route.abort());
  await page.goto('/ai');
  await expect(page.locator('.ai-video-panel').getByRole('alert')).toContainText('Replay could not load');
  await expect(page.getByRole('button', { name: /VX-0002/ })).toBeVisible();
  await expect(page.getByText('Full results · playback timing unavailable')).toBeVisible();
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
