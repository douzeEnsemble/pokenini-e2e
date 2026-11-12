import { test, expect } from '@playwright/test';
import { getTarget } from '../targets.mjs';

const target = getTarget();

const versionOf = (html) => html.match(/title="Version ([^"]+)"/)?.[1]?.trim() ?? 'inconnue';

if (null !== target.expectedVersions) {
  test(`${target.name} sert la version web ${target.expectedVersions.web}`, async ({ request }) => {
    // Right after the CD the containers may still be restarting: wait until the footer shows the new version
    await expect(async () => {
      const response = await request.get('/fr/hub');
      expect(response.status()).toBe(200);
      expect(versionOf(await response.text())).toBe(target.expectedVersions.web);
    }).toPass({ intervals: [10_000, 30_000], timeout: target.deployTimeout });
  });
} else {
  test(`${target.name} répond`, async ({ request }) => {
    const response = await request.get('/fr/hub');
    expect(response.status()).toBe(200);
    test.info().annotations.push({ type: 'version', description: versionOf(await response.text()) });
  });
}
