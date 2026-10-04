import { test, expect, type Page } from '@playwright/test';
import { installApi, openDashboard, openIncident } from './api-fixture';
import { installTransport } from './transport-fixture';

const aiResult = { run: { width: 3840, height: 2160, frames: 40, sample_fps: 5, embedding_backend: 'resnet18', device: 'cpu', ocr_status: 'attempted' }, vehicles: [{ vehicle_id: 'VX-0001', color: 'Blue', first_seen: 0, last_seen: 3, observation_count: 8, decision: 'NEW', identity_confidence: 0, evidence: {} }, { vehicle_id: 'VX-0002', color: 'Red', first_seen: 1, last_seen: 6, observation_count: 12, decision: 'TRACKED', identity_confidence: 0.76, evidence: { visual_similarity: 0.81 } }], video_available: false };
async function navigate(page: Page, name: string) {
  if (await page.getByRole('button', { name: 'Open navigation' }).isVisible()) await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name, exact: true }).click();
}

test('routes and Back retain filters, camera search, map viewport and exactly one polling schedule', async ({ page }) => {
  const state = await installApi(page);
  let aiReads = 0;
  await page.route('**/backend/api/ai-demo', (route) => { aiReads++; return route.fulfill({ json: aiResult }); });
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openDashboard(page);
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();
  await page.getByRole('button', { name: 'Fit Dublin coverage' }).click();
  await page.getByRole('checkbox', { name: 'Transport', exact: true }).uncheck();
  await page.locator('.city-map').focus();
  await page.keyboard.press('ArrowRight');
  const marker = page.locator('.leaflet-marker-icon[title^="Dublin Port:"]');
  const markerOffset = async () => {
    const point = (await marker.boundingBox())!;
    const map = (await page.locator('.city-map').boundingBox())!;
    return { x: point.x + point.width / 2 - map.x - map.width / 2, y: point.y + point.height / 2 - map.y - map.height / 2 };
  };
  const original = await markerOffset();
  await page.getByLabel('Theme', { exact: true }).selectOption('dark');
  expect(await markerOffset()).toEqual(original);
  const initialReads = state.mapReads;
  const workflowReads = state.workflowReads;
  await navigate(page, 'Incidents');
  await expect(page.getByRole('link', { name: 'Incidents', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.getByLabel('Search incidents').fill('quay');
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByLabel('Severity', { exact: true }).selectOption('high');
  await expect(page.getByRole('button', { name: 'Remove severity filter' })).toBeVisible();
  await navigate(page, 'Cameras');
  await page.getByLabel('Search cameras').fill('DCU');
  await page.goBack();
  await expect(page.getByLabel('Search incidents')).toHaveValue('quay');
  await expect(page.getByRole('button', { name: 'Remove severity filter' })).toBeVisible();
  await navigate(page, 'Overview');
  await expect(page.getByRole('checkbox', { name: 'Transport', exact: true })).not.toBeChecked();
  await expect(marker).toBeVisible();
  const restored = await markerOffset();
  expect(Math.abs(restored.x - original.x)).toBeLessThan(2);
  expect(Math.abs(restored.y - original.y)).toBeLessThan(2);
  expect(aiReads).toBe(0);
  expect(state.mapReads).toBe(initialReads);
  expect(state.workflowReads).toBe(workflowReads);
  await navigate(page, 'AI replay');
  await expect(page.getByRole('heading', { name: 'Highway vehicle replay' })).toBeVisible();
  await expect.poll(() => aiReads).toBe(1);
  await page.clock.fastForward(15_000);
  await expect.poll(() => state.mapReads).toBe(initialReads + 1);
  await expect.poll(() => state.workflowReads).toBe(workflowReads + 1);
  await navigate(page, 'Cameras');
  await expect(page.getByLabel('Search cameras')).toHaveValue('DCU');
  expect(state.pageErrors).toEqual([]);
});

test('direct routes, system theme changes and saved theme overrides work across visits', async ({ page }) => {
  await installApi(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/incidents');
  await expect(page.getByRole('heading', { name: 'Incidents', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByLabel('Theme', { exact: true })).toHaveValue('system');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByLabel('Theme', { exact: true }).selectOption('dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByLabel('Theme', { exact: true })).toHaveValue('dark');
  await page.goto('/cameras');
  await expect(page.getByRole('heading', { name: 'Camera network', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByLabel('Theme', { exact: true }).selectOption('system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('theme bootstrap applies before hydration even when application scripts are unavailable', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => localStorage.setItem('sentinelx.theme', 'dark'));
  await page.route('**/_next/static/**/*.js', (route) => route.abort());
  await page.goto('/cameras', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(20, 25, 23)');
});

test('evidence return keeps one dialog and restores the originating row focus', async ({ page }) => {
  await installApi(page);
  await page.goto('/incidents');
  const opener = page.getByRole('button', { name: 'Inspect Slow traffic on Custom House Quay', exact: true });
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Open camera evidence' }).click();
  await expect(dialog).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: 'Close details' })).toBeFocused();
  await expect(dialog.locator('.observation-row').nth(1)).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Back to incident' }).click();
  await expect(page.getByRole('dialog', { name: 'Slow traffic on Custom House Quay' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
});

test('mobile navigation traps focus, restores it and closes on route navigation', async ({ page }) => {
  await installApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openDashboard(page);
  const opener = page.getByRole('button', { name: 'Open navigation' });
  await opener.focus(); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Navigation' });
  await expect(dialog.getByRole('button', { name: 'Close navigation' })).toBeFocused();
  for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true); }
  await page.keyboard.press('Escape'); await expect(opener).toBeFocused();
  await navigate(page, 'Incidents');
  await expect(page).toHaveURL('/incidents');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await opener.click();
  await expect(page.getByRole('dialog').getByRole('link', { name: 'Incidents' })).toHaveAttribute('aria-current', 'page');
});

for (const theme of ['light', 'dark'] as const) for (const width of [1440, 1024, 390]) {
  test(`${theme} workspace and drawer visual review at ${width}px`, async ({ page }) => {
    const state = await installApi(page);
    await installTransport(page);
    await page.route('**/backend/api/ai-demo', (route) => route.fulfill({ json: aiResult }));
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await openDashboard(page);
    await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible();
    for (const [name, slug] of [['Overview', 'overview'], ['Incidents', 'incidents'], ['Cameras', 'cameras'], ['Ireland transport', 'transport'], ['AI replay', 'ai']]) {
      if (name !== 'Overview') await navigate(page, name);
      await expect(page.locator('h1')).toBeVisible();
      if (name === 'Cameras' || name === 'Overview') {
        for (const img of await page.locator('.camera-card img').all()) { await img.scrollIntoViewIfNeeded(); await expect.poll(() => img.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0); }
      }
      if (name === 'Ireland transport') { await expect(page.getByText('Retrieved from TII · capture time unknown')).toBeVisible(); await page.getByRole('button', { name: 'Load nearby transport', exact: true }).click(); await expect(page.getByText('Finglas Road', { exact: true })).toBeVisible(); }
      if (name === 'AI replay') await expect(page.locator('.vehicle-card')).toHaveCount(2);
      await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
      await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); });
      const pageHeight = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
      const screenshot = await page.screenshot({ path: `../output/playwright/redesign/${theme}-${width}-${slug}.png`, fullPage: true, animations: 'disabled' });
      expect(screenshot.readUInt32BE(20), 'Full-page capture includes the complete collection and footer').toBeGreaterThanOrEqual(pageHeight - 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (name === 'Incidents') {
        const detail = await openIncident(page);
        await expect(detail.locator('.evidence-card img').first()).toBeVisible();
        await expect.poll(() => detail.locator('.evidence-card img').first().evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
        await page.screenshot({ path: `../output/playwright/redesign/${theme}-${width}-incident-drawer.png`, animations: 'disabled' });
        await expect(page.getByRole('dialog')).toHaveCSS('animation-name', 'none');
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
      }
      if (name === 'Cameras') {
        await page.getByRole('button', { name: /Open camera Custom House/ }).click();
        await expect(page.getByRole('dialog').locator('.detail-snapshot img')).toBeVisible();
        await page.screenshot({ path: `../output/playwright/redesign/${theme}-${width}-camera-drawer.png`, animations: 'disabled' });
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
      }
    }
    await page.getByRole('button', { name: 'Operator sign in' }).click();
    await expect(page.getByRole('dialog', { name: 'Operator sign in' })).toBeVisible();
    await page.screenshot({ path: `../output/playwright/redesign/${theme}-${width}-login.png`, animations: 'disabled' });
    await page.keyboard.press('Escape');
    expect(state.pageErrors).toEqual([]);
  });
}

test('large collections, long labels and missing snapshots remain searchable without overflow', async ({ page }) => {
  const state = await installApi(page);
  state.data.cameras = Array.from({ length: 40 }, (_, i) => ({ ...state.data.cameras[0], id: `camera-${i}`, name: `Camera ${i} — Extremely long location and provider label for accessibility and wrapping verification`, image_url: i === 0 ? '' : state.data.cameras[0].image_url }));
  state.data.incidents = Array.from({ length: 60 }, (_, i) => ({ ...state.data.incidents[0], id: `incident-${i}`, title: `Incident ${i} — A long operational description spanning the Dublin network with additional context` }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/cameras');
  await expect(page.locator('.camera-card')).toHaveCount(40);
  await expect(page.locator('.camera-card').first()).toContainText('No image was supplied.');
  await page.getByLabel('Search cameras').fill('Camera 39');
  await expect(page.locator('.camera-card')).toHaveCount(1);
  await page.screenshot({ path: '../output/playwright/redesign/long-camera-label.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await navigate(page, 'Incidents');
  await expect(page.locator('.incident-card')).toHaveCount(60);
  await page.getByLabel('Search incidents').fill('Incident 59');
  await expect(page.locator('.incident-card')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('primary, supporting, severity and action text tokens meet WCAG AA contrast in both themes', async ({ page }) => {
  await installApi(page);
  await openDashboard(page);
  for (const theme of ['light', 'dark']) {
    await page.getByLabel('Theme', { exact: true }).selectOption(theme);
    const ratios = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const luminance = (token: string) => {
        const hex = style.getPropertyValue(token).trim().replace('#', '');
        const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
        return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
      };
      return [['--ink', '--surface'], ['--muted', '--surface'], ['--muted', '--surface-soft'], ['--muted', '--paper'], ['--green', '--mint'], ['--green', '--surface'], ['--on-accent', '--accent'], ['--red', '--red-bg'], ['--amber', '--amber-bg']].map(([fg, bg]) => { const a = luminance(fg); const b = luminance(bg); return { fg, bg, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) }; });
    });
    for (const value of ratios) expect(value.ratio, `${theme}: ${value.fg} on ${value.bg}`).toBeGreaterThanOrEqual(4.5);
  }
});

test('desktop icon rail navigates accessibly and retains collapse state', async ({ page }) => {
  await installApi(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openDashboard(page);
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await expect(page.locator('.sidebar')).toHaveCSS('width', '76px');
  await navigate(page, 'Cameras');
  await expect(page.locator('.sidebar')).toHaveCSS('width', '76px');
  await expect(page.getByRole('link', { name: 'Cameras', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: 'Expand sidebar' }).click();
  await expect(page.locator('.sidebar')).toHaveCSS('width', '234px');
});

test('stacked operator login restores focus and browser Back releases every modal scroll lock', async ({ page }) => {
  await installApi(page);
  await openDashboard(page);
  await navigate(page, 'Incidents');
  const detail = await openIncident(page);
  const manage = detail.getByRole('button', { name: 'Sign in to manage' });
  await manage.click();
  await expect(page.getByRole('dialog', { name: 'Operator sign in' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(manage).toBeFocused();
  await manage.click();
  await page.goBack();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});
