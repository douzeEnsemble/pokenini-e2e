import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ADMIN_SECRET, TRAINER_SECRET, VERSIONS, startMockSite } from './mock-site.mjs';

/**
 * Runs the real E2E suite against the mock site, healthy then broken in several ways:
 * the suite must pass on a working site and fail exactly where each breakage is.
 */

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const playwright = join(root, 'node_modules', '@playwright', 'test', 'cli.js');

const GAMES = [
  'Bonne Palette : nouvelle partie et une réponse',
  'Chroma ou pas : nouvelle partie et une réponse',
  'Chroma-Trouvé : nouvelle partie et une réponse',
];
const bothPublic = (title) => [`public › ${title}`, `public-mobile › ${title}`];

/**
 * @param {{ breaks?: string[], env?: Record<string, string> }} options
 * @returns {Promise<{ exitCode: number, statuses: Map<string, string> }>}
 */
async function runSuite({ breaks = [], env = {} } = {}) {
  const site = await startMockSite({ breaks });
  const work = await mkdtemp(join(tmpdir(), 'pokenini-e2e-'));
  const report = join(work, 'report.json');

  try {
    const exitCode = await new Promise((resolve) => {
      execFile(
        process.execPath,
        [playwright, 'test', '--reporter=json', `--output=${join(work, 'results')}`],
        {
          cwd: root,
          env: {
            ...process.env,
            CI: '',
            E2E_TARGET: 'staging',
            E2E_BASE_URL: site.url,
            E2E_AUTH_DIR: join(work, 'auth'),
            E2E_EXPECTED_VERSIONS: JSON.stringify(VERSIONS),
            E2E_DEPLOY_TIMEOUT_SECONDS: '5',
            E2E_LOGIN_SECRET: TRAINER_SECRET,
            E2E_ADMIN_LOGIN_SECRET: ADMIN_SECRET,
            E2E_ADMIN: 'false',
            PLAYWRIGHT_JSON_OUTPUT_FILE: report,
            ...env,
          },
          maxBuffer: 64 * 1024 * 1024,
        },
        (error) => resolve(error ? Number(error.code ?? 1) : 0),
      );
    });

    /** @type {Map<string, string>} */
    const statuses = new Map();
    const collect = (suite) => {
      for (const spec of suite.specs ?? []) {
        for (const result of spec.tests) {
          statuses.set(`${result.projectName} › ${spec.title}`, result.status);
        }
      }
      for (const child of suite.suites ?? []) {
        collect(child);
      }
    };
    for (const suite of JSON.parse(await readFile(report, 'utf8')).suites) {
      collect(suite);
    }

    return { exitCode, statuses };
  } finally {
    await site.close();
    await rm(work, { recursive: true, force: true });
  }
}

const withStatus = (statuses, status) =>
  [...statuses]
    .filter(([, value]) => value === status)
    .map(([key]) => key)
    .sort();

describe('the E2E suite against a healthy site', { concurrency: true }, () => {
  test('staging: every project runs and passes, games included', async () => {
    const { exitCode, statuses } = await runSuite();

    assert.equal(exitCode, 0);
    assert.deepEqual(withStatus(statuses, 'unexpected'), []);
    assert.deepEqual(withStatus(statuses, 'skipped'), []);
    const projects = new Set([...statuses.keys()].map((key) => key.split(' › ')[0]));
    assert.deepEqual(
      [...projects].sort(),
      ['admin', 'deploy', 'login', 'login-admin', 'public', 'public-mobile', 'trainer'].sort(),
    );
    for (const game of GAMES) {
      assert.equal(statuses.get(`trainer › ${game}`), 'expected', game);
    }
  });

  test('prod: no game is created and the admin is left out', async () => {
    const { exitCode, statuses } = await runSuite({ env: { E2E_TARGET: 'prod', E2E_EXPECTED_VERSIONS: '' } });

    assert.equal(exitCode, 0);
    assert.deepEqual(withStatus(statuses, 'unexpected'), []);
    assert.deepEqual(withStatus(statuses, 'skipped'), GAMES.map((game) => `trainer › ${game}`).sort());
    assert.equal(statuses.get('deploy › prod répond'), 'expected');
    assert.ok(![...statuses.keys()].some((key) => key.startsWith('admin') || key.startsWith('login-admin')));
  });

  test('prod with the admin box ticked: the admin runs too', async () => {
    const { exitCode, statuses } = await runSuite({ env: { E2E_TARGET: 'prod', E2E_ADMIN: 'true' } });

    assert.equal(exitCode, 0);
    assert.equal(statuses.get('admin › les versions sont celles déployées'), 'expected');
  });

  test('without secrets: only the visitor tests run', async () => {
    const { exitCode, statuses } = await runSuite({ env: { E2E_LOGIN_SECRET: '', E2E_ADMIN_LOGIN_SECRET: '' } });

    assert.equal(exitCode, 0);
    const projects = new Set([...statuses.keys()].map((key) => key.split(' › ')[0]));
    assert.deepEqual([...projects].sort(), ['deploy', 'public', 'public-mobile']);
  });

  test('a deployment still restarting: the suite waits for the new version', async () => {
    const { exitCode } = await runSuite({ breaks: ['slow-deploy'], env: { E2E_DEPLOY_TIMEOUT_SECONDS: '60' } });

    assert.equal(exitCode, 0);
  });
});

const breakages = [
  {
    name: 'wrong login secrets',
    env: { E2E_LOGIN_SECRET: 'wrong', E2E_ADMIN_LOGIN_SECRET: 'wrong' },
    failing: [
      'login › connexion du dresseur de test sur staging',
      "login-admin › connexion de l'admin de test sur staging",
    ],
  },
  {
    name: 'old-version',
    failing: ['deploy › staging sert la version web v62.5.4-prerelease'],
  },
  {
    name: 'js-error',
    failing: [
      ...bothPublic('le hub affiche les dex de démo'),
      ...bothPublic("un dex de démo s'ouvre avec ses Pokémon"),
      'trainer › le hub est celui du dresseur',
    ],
  },
  {
    name: 'http-500',
    failing: bothPublic('les pages statiques répondent'),
  },
  {
    name: 'broken-image',
    failing: [
      ...bothPublic('le hub affiche les dex de démo'),
      ...bothPublic("un dex de démo s'ouvre avec ses Pokémon"),
      'trainer › la liste des dex et un album',
      ...GAMES.map((game) => `trainer › ${game}`),
    ],
  },
  {
    name: 'no-demo',
    failing: [
      ...bothPublic('le hub affiche les dex de démo'),
      ...bothPublic("un dex de démo s'ouvre avec ses Pokémon"),
    ],
  },
  {
    name: 'open-trainer',
    failing: bothPublic("les espaces dresseur et l'administration renvoient les visiteurs à l'accueil"),
  },
  {
    name: 'no-answer',
    failing: GAMES.map((game) => `trainer › ${game}`),
  },
  {
    name: 'wrong-admin-version',
    failing: ['admin › les versions sont celles déployées'],
  },
];

describe('the E2E suite catches each breakage', { concurrency: 3 }, () => {
  for (const { name, env, failing } of breakages) {
    test(name, async () => {
      const { exitCode, statuses } = await runSuite({ breaks: env ? [] : [name], env });

      assert.notEqual(exitCode, 0);
      assert.deepEqual(withStatus(statuses, 'unexpected'), [...failing].sort());
    });
  }
});
