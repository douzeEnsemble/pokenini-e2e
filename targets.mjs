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

export function getTarget() {
  const target = process.env.E2E_TARGET ?? 'staging';
  if (!TARGETS.includes(target)) {
    throw new Error(`E2E_TARGET doit valoir ${TARGETS.join(' ou ')}, reçu « ${target} »`);
  }

  return {
    name: target,
    // E2E_BASE_URL points the tests elsewhere (a local stack for instance)
    baseURL: process.env.E2E_BASE_URL ?? HOSTS[target],
    expectedVersions: readExpectedVersions(),
    // Writes (games) only happen on staging, prod stays read-only
    allowsWrites: 'staging' === target,
    storageStatePath: join(here, '.auth', `${target}.json`),
    // Signs the test trainer in without Google, see pokenini-back E2E_LOGIN_SECRET
    loginSecret: process.env.E2E_LOGIN_SECRET ?? '',
    adminLoginSecret: process.env.E2E_ADMIN_LOGIN_SECRET ?? '',
    // The admin tests always run on staging, on prod only when asked (E2E_ADMIN=true)
    runsAdmin: 'staging' === target || 'true' === process.env.E2E_ADMIN,
    adminStorageStatePath: join(here, '.auth', `${target}-admin.json`),
  };
}
