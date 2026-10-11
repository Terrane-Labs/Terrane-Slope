import { expect, test } from '@playwright/test';

test('initializes the rendering shell and calls the Rust/WASM boundary', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Terrane Slope' })).toBeVisible();
  await expect(page.getByLabel('Three-dimensional rendering canvas')).toBeVisible();
  await expect(page.getByText('WASM boundary: terrane-slope-core:ready')).toBeVisible();
});
