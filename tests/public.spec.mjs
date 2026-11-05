import { test, expect, expectLoadedImages, target } from './fixtures.mjs';

test.describe(`${target.name} : visiteur`, () => {
  test('la racine mène au hub', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/(fr|en)$/);
    await expect(page.locator('#home h1')).toBeVisible();
    await expect(page.locator('a[href$="/connect"]').first()).toBeAttached();
  });

  test('le hub affiche les dex de démo', async ({ page }) => {
    await page.goto('/fr/hub');
    const demo = page.locator('#home-demo .dex-item');
    await expect(demo.first()).toBeVisible();
    await expectLoadedImages(page);
  });

  test("un dex de démo s'ouvre avec ses Pokémon", async ({ page }) => {
    await page.goto('/fr/hub');
    await page.locator('#home-demo .dex-item a').first().click();
    await expect(page).toHaveURL(/\/fr\/album\/[a-z0-9-]+\?t=/);
    await expect(page.locator('.album-case-name').first()).toBeVisible();
    await expectLoadedImages(page);
  });

  test('les pages statiques répondent', async ({ page }) => {
    for (const path of ['/fr/policy', '/fr/legals', '/fr/cookies', '/fr/credits', '/en/hub']) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
    }
  });

  test("les espaces dresseur et l'administration renvoient les visiteurs à l'accueil", async ({ page }) => {
    for (const path of ['/fr/trainer', '/fr/game', '/fr/election/dex', '/fr/album/dex', '/fr/istration']) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/fr$/);
    }
  });
});
