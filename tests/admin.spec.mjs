import { test, expect, target } from './fixtures.mjs';

// Read-only: every admin action is a POST, these tests only open the pages and never submit anything
test.describe(`${target.name} : admin de test`, () => {
  test("l'accueil de l'administration mène à la mise à jour des données", async ({ page }) => {
    await page.goto('/fr/istration');
    await expect(page).toHaveURL(/\/fr\/istration\/update_data$/);
  });

  const pages = [
    '/fr/istration/update_data',
    '/fr/istration/calculate_data',
    '/fr/istration/invalidate_data',
    '/fr/istration/update_availabilities',
    '/fr/istration/trigger_pipeline',
    '/fr/istration/reports',
  ];

  for (const path of pages) {
    test(`la page ${path} s'affiche`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      expect(new URL(page.url()).pathname, 'la session admin doit être active').toBe(path);
      await expect(page.locator('h1')).toBeVisible();
    });
  }

  test('les versions sont celles déployées', async ({ page }) => {
    await page.goto('/fr/istration/versions');
    for (const brick of ['web', 'back', 'api', 'resources']) {
      const version = page.locator(`#versions-row-${brick} .versions-version`);
      const expected = target.expectedVersions?.[brick];
      // Without a deployment to check, every brick must at least show a version
      await expect(version, brick).toContainText(expected ?? /v\d+\.\d+\.\d+/);
    }
  });
});
