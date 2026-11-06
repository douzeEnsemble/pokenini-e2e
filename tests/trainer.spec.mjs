import { test, expect, expectLoadedImages, target } from './fixtures.mjs';

test.describe(`${target.name} : dresseur de test`, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/fr/trainer');
    expect(new URL(page.url()).pathname, 'le dresseur de test doit être connecté').toBe('/fr/trainer');
  });

  test("l'espace dresseur s'affiche", async ({ page }) => {
    await expect(page.locator('#trainer-sidebar')).toBeVisible();
    await expect(page.locator('a[href$="/connect/logout"]').first()).toBeAttached();
  });

  test('le hub est celui du dresseur', async ({ page }) => {
    await page.goto('/fr/hub');
    await expect(page.locator('a[href$="/fr/album/dex"]').first()).toBeVisible();
    await expect(page.locator('#home-demo')).toHaveCount(0);
  });

  test('la liste des dex et un album', async ({ page }) => {
    await page.goto('/fr/album/dex');
    // Only the dex shown on the home page are listed: the test trainer may have none
    await expect(page.locator('#home .dex-item').or(page.locator('#home .alert')).first()).toBeVisible();
    await expectLoadedImages(page);

    // The trainer space lists every dex of the trainer, each with a link to its album.
    // Unreleased dex answer 404 to a trainer, premium and custom ones may be empty: take a plain one.
    await page.goto('/fr/trainer');
    const album = page
      .locator('.trainer-dex-item:not(:has(.dex_not_is_released, .dex_is_premium, .dex_is_custom))')
      .locator('a[href*="/fr/album/"]')
      .first();
    await expect(album).toBeVisible();
    await expectLoadedImages(page);

    await album.click();
    await expect(page).toHaveURL(/\/fr\/album\/[a-z0-9-]+/);
    await expect(page.locator('.album-case-name').first()).toBeVisible();
    await expectLoadedImages(page);
  });

  test('les élections listent leurs dex', async ({ page }) => {
    await page.goto('/fr/election/dex');
    await expect(page.locator('.dex-item').first()).toBeVisible();
  });

  test('les trois jeux listent leurs dex', async ({ page }) => {
    await page.goto('/fr/game');
    for (const path of ['/fr/game/color', '/fr/game/shiny', '/fr/game/which-shiny']) {
      // The menu links to the games too, only check the cards of the page
      await expect(page.locator(`.game-item a[href$="${path}"]`), path).toBeVisible();
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await expect(page.locator('.new-game, .resume-game').first(), path).toBeVisible();
      await page.goto('/fr/game');
    }
  });

  const games = [
    { name: 'Bonne Palette', path: '/fr/game/color', choices: '.color-choices .game-choice' },
    { name: 'Chroma ou pas', path: '/fr/game/shiny', choices: '.shiny-choices .game-choice' },
    { name: 'Chroma-Trouvé', path: '/fr/game/which-shiny', choices: '.which-shiny-choices .game-choice' },
  ];

  for (const game of games) {
    test(`${game.name} : nouvelle partie et une réponse`, async ({ page }) => {
      test.skip(!target.allowsWrites, 'pas de partie créée sur la prod');

      await page.goto(game.path);
      const newGame = page.locator('.new-game').first();
      // Several round counts are offered in a menu, otherwise the button submits directly
      const opensMenu = ((await newGame.getAttribute('class')) ?? '').includes('dropdown-toggle');
      await newGame.click();
      if (opensMenu) {
        await page.locator('.round-count-menu.show .round-count').first().click();
      }

      await expect(page).toHaveURL(new RegExp(`${game.path}/[0-9a-f-]{36}$`));
      await expectLoadedImages(page);

      // A first click picks the choice, a second one confirms it
      await page.locator(game.choices).first().dblclick();
      await expect(page.locator('.answer-box .answer-result')).toBeVisible();
    });
  }
});
