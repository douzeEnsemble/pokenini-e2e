import { test } from '@playwright/test';
import { getTarget } from '../targets.mjs';
import { loginWithSecret } from './login.mjs';

const target = getTarget();

test(`connexion du dresseur de test sur ${target.name}`, async ({ page }) => {
  await loginWithSecret(page, target.loginSecret, target.storageStatePath, '/fr/trainer');
});
