import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildConfig } from '../playwright.config.mjs';

/** @type {import('../targets.mjs').Target} */
const STAGING = {
  name: 'staging',
  baseURL: 'https://staging-www.pokenini.fr',
  expectedVersions: null,
  deployTimeout: 14 * 60_000,
  allowsWrites: true,
  storageStatePath: '/auth/staging.json',
  loginSecret: '',
  adminLoginSecret: '',
  runsAdmin: true,
  adminStorageStatePath: '/auth/staging-admin.json',
};

const projectsOf = (target) => (buildConfig(target, false).projects ?? []).map((project) => project.name);
const project = (target, name) =>
  (buildConfig(target, false).projects ?? []).find((candidate) => candidate.name === name);

describe('buildConfig', () => {
  test('targets the site and gives the deploy wait a margin', () => {
    const config = buildConfig(STAGING, false);

    assert.equal(config.use?.baseURL, 'https://staging-www.pokenini.fr');
    assert.equal(project(STAGING, 'deploy')?.timeout, 15 * 60_000);
    assert.equal(project({ ...STAGING, deployTimeout: 5_000 }, 'deploy')?.timeout, 65_000);
  });

  test('without secrets, only the visitor projects', () => {
    assert.deepEqual(projectsOf(STAGING), ['deploy', 'public', 'public-mobile']);
  });

  test('the trainer secret adds the trainer projects with its session', () => {
    const target = { ...STAGING, loginSecret: 'secret' };

    assert.deepEqual(projectsOf(target), ['deploy', 'public', 'public-mobile', 'login', 'trainer']);
    assert.deepEqual(project(target, 'login')?.dependencies, ['deploy']);
    assert.deepEqual(project(target, 'trainer')?.dependencies, ['login']);
    assert.equal(project(target, 'trainer')?.use?.storageState, '/auth/staging.json');
  });

  test('the admin secret adds the admin projects with its session', () => {
    const target = { ...STAGING, adminLoginSecret: 'secret' };

    assert.deepEqual(projectsOf(target), ['deploy', 'public', 'public-mobile', 'login-admin', 'admin']);
    assert.deepEqual(project(target, 'login-admin')?.dependencies, ['deploy']);
    assert.deepEqual(project(target, 'admin')?.dependencies, ['login-admin']);
    assert.equal(project(target, 'admin')?.use?.storageState, '/auth/staging-admin.json');
  });

  test('no admin projects when the admin is not asked for', () => {
    const target = { ...STAGING, adminLoginSecret: 'secret', runsAdmin: false };

    assert.deepEqual(projectsOf(target), ['deploy', 'public', 'public-mobile']);
  });

  test('locally: no retry and the list report', () => {
    const config = buildConfig(STAGING, false);

    assert.equal(config.retries, 0);
    assert.deepEqual(config.reporter, [['list']]);
  });

  test('on GitHub Actions: one retry and the GitHub and HTML reports', () => {
    const config = buildConfig(STAGING, true);

    assert.equal(config.retries, 1);
    assert.deepEqual(config.reporter, [['github'], ['html', { open: 'never' }], ['list']]);
  });
});
