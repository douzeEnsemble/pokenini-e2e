import http from 'node:http';

/**
 * A tiny fake Pokénini, with just the markup the E2E tests rely on.
 * The self-tests run the real E2E suite against it, healthy and broken in several ways (see BREAKS),
 * to check that the suite passes on a working site and catches each breakage.
 */

export const TRAINER_SECRET = 'trainer-secret';
export const ADMIN_SECRET = 'admin-secret';

export const VERSIONS = {
  web: 'v62.5.4-prerelease',
  back: 'v8.6.2-prerelease',
  api: 'v64.2.2-prerelease',
  resources: 'v2.1.0-prerelease',
};

export const BREAKS = [
  // The hub throws a JS error
  'js-error',
  // A static page answers 500
  'http-500',
  // The banners do not load
  'broken-image',
  // The footer never shows the expected web version
  'old-version',
  // The footer shows the expected web version after a few requests only (containers restarting)
  'slow-deploy',
  // The admin shows another api version
  'wrong-admin-version',
  // The hub has no demo dex
  'no-demo',
  // Answering a game round shows no answer
  'no-answer',
  // The trainer pages are open to visitors
  'open-trainer',
];

const GAME_ID = '123e4567-e89b-12d3-a456-426614174000';
const GAMES = {
  color: { choices: 'color-choices', roundCounts: true },
  shiny: { choices: 'shiny-choices', roundCounts: false },
  'which-shiny': { choices: 'which-shiny-choices', roundCounts: true },
};

// 1×1 transparent PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

// Opens the dropdown menus and asks a second click to confirm a game choice, like the real site
const SCRIPT = `
document.querySelectorAll('.dropdown-toggle').forEach((button) => {
  button.addEventListener('click', () => button.nextElementSibling.classList.add('show'));
});
let picked = null;
document.querySelectorAll('.game-choice').forEach((choice) => {
  choice.addEventListener('click', (event) => {
    if (picked !== choice) {
      event.preventDefault();
      picked = choice;
    }
  });
});`;

/**
 * @param {{ breaks?: string[] }} options
 * @returns {Promise<{ url: string, close: () => Promise<void> }>}
 */
export function startMockSite({ breaks = [] } = {}) {
  for (const name of breaks) {
    if (!BREAKS.includes(name)) {
      throw new Error(`Unknown break ${name}`);
    }
  }
  const broken = (name) => breaks.includes(name);
  let hubRequests = 0;

  const page = (body, { session, webVersion = VERSIONS.web, extra = '' }) => `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Pokénini</title></head><body>
<nav>${session ? '<a href="/fr/connect/logout">Déconnexion</a>' : '<a href="/fr/connect">Connexion</a>'}</nav>
<main>${body}</main>
<footer><p id="copyright" title="Version ${webVersion}">©</p></footer>
${extra}<script>${SCRIPT}</script>
</body></html>`;

  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://mock');
    const path = url.pathname;
    const session = /session=(trainer|admin)/.exec(request.headers.cookie ?? '')?.[1] ?? null;

    /** @type {(status: number, body?: string | Buffer, headers?: Record<string, string>) => void} */
    const send = (status, body = '', headers = {}) => {
      response.writeHead(status, { 'content-type': 'text/html; charset=utf-8', ...headers });
      response.end(body);
    };
    const html = (body, options = {}) => send(200, page(body, { session, ...options }));
    const redirect = (location, status = 302) => send(status, '', { location });

    if ('/img/banner.png' === path) {
      return broken('broken-image') ? send(404) : send(200, PNG, { 'content-type': 'image/png' });
    }

    if ('/fr/connect/e2e' === path) {
      if ('POST' !== request.method) {
        return send(405);
      }
      const secret = request.headers['x-e2e-login'];
      const profile = { [TRAINER_SECRET]: 'trainer', [ADMIN_SECRET]: 'admin' }[String(secret)];

      return profile
        ? send(302, '', { location: '/fr/hub', 'set-cookie': `session=${profile}; Path=/; HttpOnly` })
        : send(403, 'Invalid credentials.');
    }

    if ('/' === path) {
      return redirect('/fr');
    }

    if (['/fr', '/fr/hub', '/en/hub'].includes(path)) {
      let webVersion = VERSIONS.web;
      if ('/fr/hub' === path) {
        hubRequests += 1;
        if (broken('old-version') || (broken('slow-deploy') && hubRequests < 3)) {
          webVersion = 'v62.5.3-prerelease';
        }
      }
      const banner = '<img src="/img/banner.png" alt="">';
      const content = session
        ? `<a href="/fr/album/dex">Mes dex</a>`
        : broken('no-demo')
          ? ''
          : `<div id="home-demo"><div class="dex-item"><a href="/fr/album/demo?t=abc">${banner}Démo</a></div></div>`;
      const extra = broken('js-error') && '/fr/hub' === path ? '<script>throw new Error("boom")</script>' : '';

      return html(`<div id="home"><h1>Pokénini</h1>${content}</div>`, { webVersion, extra });
    }

    if (['/fr/policy', '/fr/legals', '/fr/cookies', '/fr/credits'].includes(path)) {
      return broken('http-500') && '/fr/credits' === path ? send(500, 'Oops') : html('<h1>Page</h1>');
    }

    if ('/fr/album/demo' === path || ('/fr/album/home' === path && session)) {
      return html('<img src="/img/banner.png" alt=""><span class="album-case-name">Bulbizarre</span>');
    }

    const isAdminPath = path.startsWith('/fr/istration');
    if (isAdminPath ? 'admin' !== session : !session && !broken('open-trainer')) {
      return redirect('/fr');
    }

    if ('/fr/istration' === path) {
      return redirect('/fr/istration/update_data');
    }
    if ('/fr/istration/versions' === path) {
      const rows = Object.entries(VERSIONS).map(([brick, version]) => {
        const shown = broken('wrong-admin-version') && 'api' === brick ? 'v64.2.1-prerelease' : version;
        return `<div id="versions-row-${brick}"><span class="versions-version">${shown}</span></div>`;
      });
      return html(`<h1>Versions</h1>${rows.join('')}`);
    }
    if (isAdminPath) {
      return html('<h1>Administration</h1>');
    }

    if ('/fr/trainer' === path) {
      return html('<div id="trainer-sidebar">Dresseur</div>');
    }
    if ('/fr/album/dex' === path || '/fr/election/dex' === path) {
      return html('<div class="dex-item"><a href="/fr/album/home"><img src="/img/banner.png" alt="">Home</a></div>');
    }
    if ('/fr/game' === path) {
      return html(
        Object.keys(GAMES)
          .map((game) => `<a href="/fr/game/${game}">${game}</a>`)
          .join(''),
      );
    }

    for (const [game, { choices, roundCounts }] of Object.entries(GAMES)) {
      if (`/fr/game/${game}` === path) {
        if ('POST' === request.method) {
          return redirect(`/fr/game/${game}/${GAME_ID}`, 303);
        }
        return html(
          roundCounts
            ? `<div><button type="button" class="new-game dropdown-toggle">Nouvelle partie</button>
<div class="dropdown-menu round-count-menu"><form method="post">
<button name="round_count" value="10" class="round-count">10</button></form></div></div>`
            : '<form method="post"><button class="new-game">Nouvelle partie</button></form>',
        );
      }
      if (`/fr/game/${game}/${GAME_ID}` === path) {
        if ('POST' === request.method) {
          return html(
            broken('no-answer')
              ? '<div class="answer-box"></div>'
              : '<div class="answer-box"><span class="answer-result">Bravo</span></div>',
          );
        }
        return html(
          `<img src="/img/banner.png" alt=""><form method="post" class="${choices}"><button class="game-choice">1</button></form>`,
        );
      }
    }

    return send(404, 'Not found');
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = 'object' === typeof address && address ? address.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}
