import { test } from '@playwright/test';
import { getTarget } from '../targets.mjs';
import { loginWithSecret } from './login.mjs';

const target = getTarget();

test(`connexion de l'admin de test sur ${target.name}`, async ({ page }) => {
  await loginWithSecret(page, target.adminLoginSecret, target.adminStorageStatePath, '/fr/istration/versions');
});
