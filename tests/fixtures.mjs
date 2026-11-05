import { test as base, expect } from '@playwright/test';
import { getTarget } from '../targets.mjs';

export const target = getTarget();

/**
 * Every page refuses the Matomo consent and blocks Matomo, so the tests never count as visits,
 * and collects the JS errors and the failed same-site requests to check them at the end.
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    const { hostname } = new URL(target.baseURL);
    await context.addCookies([
      { name: 'tarteaucitron', value: '!matomocloud=false', domain: hostname, path: '/' },
    ]);
    await context.route(/matomo\./, (route) => route.abort());
    await use(context);
  },
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(`JS : ${error.message}`));
    page.on('response', (response) => {
      if (response.status() >= 500) {
        errors.push(`HTTP ${response.status()} : ${response.url()}`);
      }
    });

    await use(page);

    expect(errors, 'erreurs JS ou HTTP 5xx pendant le test').toEqual([]);
  },
});

export { expect };

/**
 * Checks that every image of the page that has been loaded displays (banners, Pokémon, types).
 */
export async function expectLoadedImages(page) {
  const broken = await page.locator('img').evaluateAll((images) => images
    .filter((image) => image.complete && image.getAttribute('loading') !== 'lazy' && image.naturalWidth === 0)
    .map((image) => image.currentSrc || image.src));

  expect(broken, 'images cassées').toEqual([]);
}
