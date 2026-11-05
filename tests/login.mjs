import { expect } from '@playwright/test';

/**
 * Signs a test user in with its secret (pokenini-back E2E_LOGIN_SECRET or E2E_ADMIN_LOGIN_SECRET)
 * and saves the session for the projects that depend on it.
 */
export async function loginWithSecret(page, secret, storageStatePath, checkedPath) {
  const response = await page.request.post('/fr/connect/e2e', {
    headers: { 'X-E2E-Login': secret },
  });

  // 403 : the secret is wrong, or missing on pokenini-back
  expect(response.status(), 'connexion E2E refusée : vérifier le secret dans GitHub et sur pokenini-back').toBe(200);

  await page.goto(checkedPath);
  expect(new URL(page.url()).pathname).toBe(checkedPath);

  await page.context().storageState({ path: storageStatePath });
}
