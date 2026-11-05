import assert from 'node:assert/strict';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { TARGETS, getTarget } from '../targets.mjs';

const VARIABLES = [
  'E2E_TARGET',
  'E2E_BASE_URL',
  'E2E_EXPECTED_VERSIONS',
  'E2E_DEPLOY_TIMEOUT_SECONDS',
  'E2E_AUTH_DIR',
  'E2E_LOGIN_SECRET',
  'E2E_ADMIN_LOGIN_SECRET',
  'E2E_ADMIN',
];

const VERSIONS = { web: 'v1.0.0', back: 'v2.0.0', api: 'v3.0.0', resources: 'v4.0.0' };

describe('getTarget', () => {
  /** @type {Record<string, string | undefined>} */
  let saved = {};

  beforeEach(() => {
    saved = Object.fromEntries(VARIABLES.map((name) => [name, process.env[name]]));
    for (const name of VARIABLES) {
      delete process.env[name];
    }
  });

  afterEach(() => {
    for (const [name, value] of Object.entries(saved)) {
      if (undefined === value) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });

  test('lists staging and prod', () => {
    assert.deepEqual(TARGETS, ['staging', 'prod']);
  });

  test('defaults to staging, read-write, with the admin and no secret', () => {
    const target = getTarget();

    assert.equal(target.name, 'staging');
    assert.equal(target.baseURL, 'https://staging-www.pokenini.fr');
    assert.equal(target.expectedVersions, null);
    assert.equal(target.deployTimeout, 14 * 60_000);
    assert.equal(target.allowsWrites, true);
    assert.equal(target.runsAdmin, true);
    assert.equal(target.loginSecret, '');
    assert.equal(target.adminLoginSecret, '');
    assert.match(target.storageStatePath, /[/\\]\.auth[/\\]staging\.json$/);
    assert.match(target.adminStorageStatePath, /[/\\]\.auth[/\\]staging-admin\.json$/);
  });

  test('prod is read-only and leaves the admin out', () => {
    process.env.E2E_TARGET = 'prod';
    const target = getTarget();

    assert.equal(target.name, 'prod');
    assert.equal(target.baseURL, 'https://www.pokenini.fr');
    assert.equal(target.allowsWrites, false);
    assert.equal(target.runsAdmin, false);
    assert.match(target.storageStatePath, /prod\.json$/);
  });

  for (const [value, runsAdmin] of /** @type {[string, boolean][]} */ ([
    ['true', true],
    ['false', false],
    ['1', false],
  ])) {
    test(`prod runs the admin only with E2E_ADMIN=true (${value})`, () => {
      process.env.E2E_TARGET = 'prod';
      process.env.E2E_ADMIN = value;

      assert.equal(getTarget().runsAdmin, runsAdmin);
    });
  }

  test('refuses an unknown target', () => {
    process.env.E2E_TARGET = 'preprod';

    assert.throws(() => getTarget(), { message: 'E2E_TARGET doit valoir staging ou prod, reçu « preprod »' });
  });

  test('reads the overrides and the secrets', () => {
    process.env.E2E_BASE_URL = 'http://localhost:8080';
    process.env.E2E_AUTH_DIR = '/tmp/auth';
    process.env.E2E_LOGIN_SECRET = 'trainer';
    process.env.E2E_ADMIN_LOGIN_SECRET = 'admin';
    const target = getTarget();

    assert.equal(target.baseURL, 'http://localhost:8080');
    assert.equal(target.storageStatePath, join('/tmp/auth', 'staging.json'));
    assert.equal(target.adminStorageStatePath, join('/tmp/auth', 'staging-admin.json'));
    assert.equal(target.loginSecret, 'trainer');
    assert.equal(target.adminLoginSecret, 'admin');
  });

  for (const raw of ['', 'null']) {
    test(`no expected versions when E2E_EXPECTED_VERSIONS is « ${raw} »`, () => {
      process.env.E2E_EXPECTED_VERSIONS = raw;

      assert.equal(getTarget().expectedVersions, null);
    });
  }

  test('reads the expected versions', () => {
    process.env.E2E_EXPECTED_VERSIONS = JSON.stringify(VERSIONS);

    assert.deepEqual(getTarget().expectedVersions, VERSIONS);
  });

  for (const brick of Object.keys(VERSIONS)) {
    for (const value of [undefined, '', 12]) {
      test(`refuses expected versions with ${brick} set to ${JSON.stringify(value)}`, () => {
        process.env.E2E_EXPECTED_VERSIONS = JSON.stringify({ ...VERSIONS, [brick]: value });

        assert.throws(() => getTarget(), { message: `E2E_EXPECTED_VERSIONS sans version pour ${brick}` });
      });
    }
  }

  test('refuses expected versions that are not an object', () => {
    process.env.E2E_EXPECTED_VERSIONS = '"v1.0.0"';

    assert.throws(() => getTarget(), { message: 'E2E_EXPECTED_VERSIONS sans version pour web' });
  });

  test('reads the deploy timeout in seconds', () => {
    process.env.E2E_DEPLOY_TIMEOUT_SECONDS = '30';

    assert.equal(getTarget().deployTimeout, 30_000);
  });

  for (const raw of ['0', '-5', '1.5', 'abc']) {
    test(`refuses the deploy timeout « ${raw} »`, () => {
      process.env.E2E_DEPLOY_TIMEOUT_SECONDS = raw;

      assert.throws(() => getTarget(), {
        message: `E2E_DEPLOY_TIMEOUT_SECONDS doit être un nombre de secondes, reçu « ${raw} »`,
      });
    });
  }
});
