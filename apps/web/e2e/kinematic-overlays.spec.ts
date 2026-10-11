import { expect, test } from '@playwright/test';

// Default workspace parameters: slope 60°/130°, friction angle 30°.
// Fixture verdicts under the default parameters are asserted from the evaluators'
// contract (strict inequalities), not from the drawn zone.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('img', { name: 'stereonet' })).toBeVisible();
});

const status = (page: import('@playwright/test').Page, id: string) =>
  page.locator(`rect[data-id="${id}"]`);

test('planar sliding is the default mode and colours poles by admissibility', async ({ page }) => {
  await expect(page.getByRole('radio', { name: 'Planar sliding' })).toBeChecked();
  await expect(status(page, 'plane-0')).toHaveAttribute('data-status', 'admissible'); // A
  await expect(status(page, 'plane-4')).toHaveAttribute('data-status', 'admissible'); // E
  await expect(status(page, 'plane-1')).toHaveAttribute('data-status', 'rejected'); // B
  await expect(status(page, 'plane-2')).toHaveAttribute('data-status', 'rejected'); // C: dip = φ
  await expect(status(page, 'plane-5')).toHaveAttribute('data-status', 'rejected'); // F: sector edge
  await expect(page.locator('path[data-type="overlayRegion"]')).toHaveCount(1);
});

test('selecting a rejected pole shows the rejection reasons in the inspector', async ({ page }) => {
  await status(page, 'plane-2').click();
  const inspector = page.getByRole('region', { name: 'Feature inspector' });
  await expect(inspector).toContainText('Rejected');
  await expect(inspector).toContainText('Friction/steepness condition not satisfied');
  await expect(inspector).toContainText('Friction margin');
  await expect(inspector).toContainText('Not a factor of safety');
});

test('selecting an admissible pole shows no rejection reasons', async ({ page }) => {
  await status(page, 'plane-0').click();
  const inspector = page.getByRole('region', { name: 'Feature inspector' });
  await expect(inspector).toContainText('Admissible');
  await expect(inspector).not.toContainText('Reasons');
});

test('switching to direct toppling re-evaluates the poles', async ({ page }) => {
  await page.getByRole('radio', { name: 'Direct toppling' }).check();
  await expect(status(page, 'plane-3')).toHaveAttribute('data-status', 'admissible'); // D
  await expect(status(page, 'plane-0')).toHaveAttribute('data-status', 'rejected'); // A
  await expect(page.locator('path[data-type="overlayRegion"]')).toHaveCount(1);
});

test('turning the analysis off removes status, overlays, and restores great circles', async ({
  page,
}) => {
  await page.getByRole('radio', { name: 'Off' }).check();
  await expect(status(page, 'plane-0')).not.toHaveAttribute('data-status', /.+/);
  await expect(page.locator('path[data-type="overlayRegion"]')).toHaveCount(0);
  await expect(page.locator('path[data-type="greatCircle"]')).toHaveCount(6);
});

test('an invalid parameter shows an alert and keeps the last valid analysis', async ({ page }) => {
  // Scoped: Next.js injects its own role="alert" route announcer.
  const alert = page
    .getByRole('region', { name: 'Kinematic analysis controls' })
    .getByRole('alert');

  await page.getByLabel('Friction angle (°)').fill('95');
  await expect(alert).toContainText('Friction angle');
  await expect(status(page, 'plane-0')).toHaveAttribute('data-status', 'admissible');

  await page.getByLabel('Friction angle (°)').fill('50');
  await expect(alert).toHaveCount(0);
  // φ = 50° makes Plane A (dip 45°) fail the friction condition.
  await expect(status(page, 'plane-0')).toHaveAttribute('data-status', 'rejected');
});
