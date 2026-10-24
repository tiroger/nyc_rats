import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('atlas loads without runtime errors, filters reports, and survives a shared-link reload', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('New York,from the ground up.');
  const total = page.getByTestId('total-reports');
  await expect(total).not.toHaveText('0');
  const citywide = Number((await total.innerText()).replaceAll(',', ''));
  await page.getByRole('group', { name: 'Filter by borough' }).getByRole('button', { name: 'Brooklyn', exact: true }).click();
  await expect(page).toHaveURL(/borough=Brooklyn/);
  const filtered = Number((await total.innerText()).replaceAll(',', ''));
  expect(filtered).toBeGreaterThan(0); expect(filtered).toBeLessThan(citywide);
  await page.getByLabel('Time period').selectOption('2019');
  await expect(page).toHaveURL(/from=2019-01/);
  const expected = await total.innerText();
  await page.reload();
  await expect(total).toHaveText(expected);
  await expect(page.getByRole('group', { name: 'Filter by borough' }).getByRole('button', { name: 'Brooklyn', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('map controls, ZIP selection, seasonality, and CSV export work together', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('heading', { name: 'A city of tiny footprints.' }).waitFor();
  await page.getByRole('button', { name: 'ZIP areas', exact: true }).click();
  await expect(page.getByRole('button', { name: 'ZIP areas', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.getByRole('button', { name: 'Reset map zoom', exact: true }).click();
  await page.locator('.zip-ranking button').first().click();
  await expect(page.getByRole('status')).toContainText('reported sightings');
  await page.getByRole('button', { name: 'Close ZIP details' }).click();
  await page.getByRole('button', { name: /January 2020, .* reports. Explore month./ }).click();
  await expect(page.getByLabel('Time period')).toHaveValue('custom');
  await expect(page).toHaveURL(/from=2020-01&to=2020-01/);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download monthly data' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('ratlas-all-nyc-2020-01-2020-01.csv');
  await page.getByText('View monthly data table').click();
  await expect(page.getByRole('table')).toContainText('January 2020');
});

test('data load failure offers recovery instead of a blank page', async ({ page }) => {
  await page.route('**/data/sightings.json', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'A little snag underground.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('atlas has no serious accessibility violations', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('total-reports').waitFor();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map(v => ({ id: v.id, description: v.description, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([]);
});
