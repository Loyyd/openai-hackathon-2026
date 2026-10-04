import { test, expect, type Page } from '@playwright/test';
import { installApi, openDashboard } from './api-fixture';

const demo = {
  run: { width: 3840, height: 2160, frames: 40, sample_fps: 5, embedding_backend: 'resnet18', device: 'cpu', ocr_status: 'attempted' },
  vehicles: [
    { vehicle_id: 'VX-0001', color: 'Blue', first_seen: 0, last_seen: 3, observation_count: 8, decision: 'NEW', identity_confidence: 0, evidence: {} },
    { vehicle_id: 'VX-0002', color: 'Red', first_seen: 1, last_seen: 6, observation_count: 12, decision: 'TRACKED', identity_confidence: 0.76, evidence: { visual_similarity: 0.81 } },
  ],
  video_available: false,
};

async function replayVideo(page: Page) {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
    const context = canvas.getContext('2d')!;
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
    const chunks: BlobPart[] = [];
    return await new Promise<number[]>((resolve) => {
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = async () => { stream.getTracks().forEach((track) => track.stop()); resolve([...new Uint8Array(await new Blob(chunks).arrayBuffer())]); };
      recorder.start();
      let frames = 0;
      const timer = setInterval(() => { context.fillStyle = frames++ % 2 ? '#176b49' : '#222b27'; context.fillRect(0, 0, 64, 64); if (frames === 12) { clearInterval(timer); recorder.stop(); } }, 50);
    });
  });
  return Buffer.from(bytes);
}

test('the recent AI page remains reachable and preserves vehicle inspection through refresh', async ({ page }) => {
  const state = await installApi(page);
  const response = structuredClone(demo);
  await page.route('**/backend/api/ai-demo', (route) => route.fulfill({ json: response }));
  await page.route('**/backend/api/ai-demo/media/**', (route) => route.abort());
  await openDashboard(page);
  await page.getByRole('link', { name: 'AI replay', exact: true }).click();
  await expect(page).toHaveURL('/ai');
  await expect(page.getByRole('heading', { name: 'Highway vehicle replay' })).toBeVisible();
  await expect(page.getByText('3840 × 2160', { exact: true })).toBeVisible();
  await expect(page.getByText('resnet18 / cpu', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /VX-0002/ }).click();
  await expect(page.locator('.vehicle-inspector')).toContainText('VX-0002 · Red');
  await expect(page.locator('.vehicle-inspector')).toContainText('76%');
  await expect(page.getByText(/Browser video not prepared/)).toBeVisible();
  response.video_available = true;
  await page.getByRole('button', { name: 'Refresh results' }).click();
  await expect(page.getByRole('button', { name: /VX-0002/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('video')).toHaveAttribute('src', '/backend/api/ai-demo/media/browser.mp4');
  await expect(page.locator('video')).not.toHaveAttribute('poster');
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page.getByTestId('active-count')).toHaveText('5');
  expect(state.pageErrors).toEqual([]);
});

test('replay reveals unique identities per frame and seeking rebuilds observed evidence', async ({ page }) => {
  const state = await installApi(page);
  const response = { ...demo, run: { ...demo.run, replay_fps: 2 }, video_available: true, timeline: [
    { timestamp: 10, vehicles: [{ vehicle_id: 'VX-0001', decision: 'NEW', identity_confidence: 0, evidence: {} }] },
    { timestamp: 10.5, vehicles: [{ vehicle_id: 'VX-0001', decision: 'TRACKED', identity_confidence: 0.4, evidence: {} }, { vehicle_id: 'VX-0002' }] },
    { timestamp: 11, vehicles: [{ vehicle_id: 'VX-0002', decision: 'TRACKED', identity_confidence: 0.76, evidence: { visual_similarity: 0.81 } }] },
    { timestamp: 11.5, vehicles: [] },
  ] };
  await page.route('**/backend/api/ai-demo', route => route.fulfill({ json: response }));
  // Decode real local test footage before driving exact source-frame events.
  await openDashboard(page);
  const bytes = await replayVideo(page);
  await page.route('**/backend/api/ai-demo/media/**', route => route.fulfill({ contentType: 'video/webm', body: bytes }));
  await page.goto('/ai');
  const panel = page.getByRole('region', { name: 'Replay identities' });
  await expect.poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.readyState)).toBeGreaterThanOrEqual(2);
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
  await expect(panel.locator('.vehicle-details')).toContainText('10.00s–10.00s');
  await expect(panel.locator('.vehicle-details dd').first()).toHaveText('1');
  await updateFrame(0.5);
  await expect(panel.getByRole('status')).toHaveText('2 discovered');
  await expect(panel.getByRole('button', { name: /VX-0001/ })).toHaveCount(1);
  await panel.getByRole('button', { name: /VX-0002/ }).click();
  await expect(panel.locator('.vehicle-details')).toContainText('Unavailable');
  await expect(panel.locator('.vehicle-details dd').last()).toHaveText('0%');
  await updateFrame(1);
  await expect(panel.getByRole('button', { name: /VX-0001/ })).toContainText('Previously seen');
  await expect(panel.getByRole('button', { name: /VX-0002/ })).toContainText('In frame');
  await expect(panel.locator('.vehicle-details')).toContainText('TRACKED');
  await expect(panel.locator('.vehicle-details dd').last()).toHaveText('76%');
  await expect(panel.locator('.vehicle-details')).toContainText('10.50s–11.00s');
  await expect(panel.locator('.vehicle-details dd').first()).toHaveText('2');
  await panel.getByText('Matching evidence', { exact: true }).click();
  await expect(panel.locator('pre')).toContainText('0.81');
  await page.getByRole('button', { name: 'Refresh results' }).click();
  await expect(panel.getByRole('button', { name: /VX-0002/ })).toHaveAttribute('aria-pressed', 'true');
  await updateFrame(1.5);
  await expect(panel.getByRole('status')).toHaveText('2 discovered');
  await expect(panel).toContainText('0 in frame');
  await updateFrame(0);
  await expect(panel.getByRole('status')).toHaveText('1 discovered');
  await expect(panel.getByRole('button', { name: /VX-0002/ })).toHaveCount(0);
  await expect(panel.locator('.vehicle-details')).toContainText('NEW');
  await expect(panel.locator('.vehicle-details dd').last()).toHaveText('0%');
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
  await expect(page.getByRole('region', { name: 'Recorded video' }).getByRole('alert')).toContainText('Replay could not load');
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

test('recorded video stops and releases its source when leaving the AI workspace', async ({ page }) => {
  await installApi(page);
  await page.route('**/backend/api/ai-demo', (route) => route.fulfill({ json: { ...demo, video_available: true } }));
  await page.route('**/backend/api/ai-demo/media/latest.jpg', (route) => route.abort());
  await openDashboard(page);
  const bytes = await replayVideo(page);
  await page.route('**/backend/api/ai-demo/media/browser.mp4', (route) => route.fulfill({ contentType: 'video/webm', body: bytes }));
  await page.getByRole('link', { name: 'AI replay' }).click();
  const video = page.getByLabel('Recorded highway footage', { exact: true });
  await video.evaluate(async (element) => { const media = element as HTMLVideoElement; media.muted = true; media.loop = true; await media.play(); });
  const handle = await video.elementHandle();
  expect(await handle!.evaluate((element) => (element as HTMLVideoElement).paused)).toBe(false);
  await page.getByLabel('Search vehicles').fill('Red');
  await expect(page.getByRole('button', { name: /VX-0001/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /VX-0002/ })).toBeVisible();
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page.locator('video')).toHaveCount(0);
  expect(await handle!.evaluate((element) => (element as HTMLVideoElement).paused)).toBe(true);
  expect(await handle!.getAttribute('src')).toBeNull();
});
