import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const HOSTS = {
  staging: 'https://staging-www.pokenini.fr',
  prod: 'https://www.pokenini.fr',
};

export const TARGETS = Object.keys(HOSTS);

/**
 * E2E_EXPECTED_VERSIONS: {"web": "v1.2.3-release", "back": …, "api": …, "resources": …},
 * sent by the pi-projects CD after a deployment. Without it, the tests take what is deployed.
 */
function readExpectedVersions() {
  const raw = process.env.E2E_EXPECTED_VERSIONS ?? '';
  if ('' === raw || 'null' === raw) {
    return null;
  }

  const versions = JSON.parse(raw);
  for (const brick of ['web', 'back', 'api', 'resources']) {
    if ('string' !== typeof versions?.[brick] || '' === versions[brick]) {
      throw new Error(`E2E_EXPECTED_VERSIONS sans version pour ${brick}`);
    }
  }

  return versions;
}

/**
 * E2E_DEPLOY_TIMEOUT_SECONDS: how long the deploy project waits for the expected web version (14 min by default).
 */
function readDeployTimeout() {
  const raw = process.env.E2E_DEPLOY_TIMEOUT_SECONDS ?? '';
  if ('' === raw) {
    return 14 * 60_000;
  }

  const seconds = Number(raw);
  if (!Number.isInteger(seconds) || seconds <= 0) {
    throw new Error(`E2E_DEPLOY_TIMEOUT_SECONDS doit être un nombre de secondes, reçu « ${raw} »`);
  }

  return seconds * 1000;
}

/**
 * @typedef {ReturnType<typeof getTarget>} Target
 */

export function getTarget() {
  const target = process.env.E2E_TARGET ?? 'staging';
  if (!TARGETS.includes(target)) {
    throw new Error(`E2E_TARGET doit valoir ${TARGETS.join(' ou ')}, reçu « ${target} »`);
  }

  // E2E_AUTH_DIR keeps the saved sessions elsewhere (the self-tests use a temporary folder)
  const authDir = process.env.E2E_AUTH_DIR ?? join(here, '.auth');

  return {
    name: target,
    // E2E_BASE_URL points the tests elsewhere (a local stack for instance)
    baseURL: process.env.E2E_BASE_URL ?? HOSTS[target],
    expectedVersions: readExpectedVersions(),
    deployTimeout: readDeployTimeout(),
    // Writes (games) only happen on staging, prod stays read-only
    allowsWrites: 'staging' === target,
    storageStatePath: join(authDir, `${target}.json`),
    // Signs the test trainer in without Google, see pokenini-back E2E_LOGIN_SECRET
    loginSecret: process.env.E2E_LOGIN_SECRET ?? '',
    adminLoginSecret: process.env.E2E_ADMIN_LOGIN_SECRET ?? '',
    // The admin tests always run on staging, on prod only when asked (E2E_ADMIN=true)
    runsAdmin: 'staging' === target || 'true' === process.env.E2E_ADMIN,
    adminStorageStatePath: join(authDir, `${target}-admin.json`),
  };
}
