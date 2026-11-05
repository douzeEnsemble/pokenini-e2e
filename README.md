# Pokénini E2E

Smoke tests [Playwright](https://playwright.dev) lancés contre les vrais sites `staging-www.pokenini.fr` et `www.pokenini.fr`.

## Ce qui est testé

| Projet                     | Connexion        | Contenu                                                                                                                                                                                                                                                                                                   |
| -------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deploy`                   | non              | Après un déploiement, attend que le pied de page affiche la version web déployée (jusqu'à 14 min). Sinon, vérifie que le site répond. Les autres projets en dépendent.                                                                                                                                    |
| `public`, `public-mobile`  | non              | Hub et dex de démo, ouverture d'un album de démo, pages statiques, redirection des pages réservées vers l'accueil.                                                                                                                                                                                        |
| `login` puis `trainer`     | dresseur de test | Espace dresseur, hub dresseur, liste des dex et un album, élections, les trois jeux. **Sur staging uniquement** : une partie de chaque jeu est créée et une manche jouée. La prod reste en lecture seule.                                                                                                 |
| `login-admin` puis `admin` | admin de test    | Pages de l'administration et versions affichées (web, back, api, resources), comparées aux versions déployées quand il y en a. Lecture seule : aucune action n'est lancée (elles sont toutes en POST). **Toujours sur staging, sur la prod seulement à la demande** (case « admin » du lancement manuel). |

Chaque test échoue sur une erreur JS, une réponse HTTP 5xx ou une image cassée. Matomo est refusé et bloqué, donc les tests ne comptent pas comme des visites.

## Quand ça tourne

Workflow `.github/workflows/e2e.yaml` :

- après chaque déploiement : le CD de pi-projects envoie un `repository_dispatch` `deployed` avec les versions déployées de staging et de la prod ;
- chaque nuit à 05:00 UTC (staging et prod) ;
- sur les PR de ce dépôt (staging) ;
- à la demande : Actions > E2E > Run workflow, avec le site et la case admin.

En cas d'échec, le rapport HTML, les traces et les captures sont dans l'artefact `playwright-report-<site>`.

## Dresseur et admin de test

Les tests se connectent sans Google, avec un secret : `POST /fr/connect/e2e` avec l'en-tête `X-E2E-Login: <secret>` (pokenini-web). pokenini-back compare le secret à ses deux secrets :

- `E2E_LOGIN_SECRET` connecte `E2E_USER_ID` (`e2e-test-trainer`), simple dresseur ;
- `E2E_ADMIN_LOGIN_SECRET` connecte `E2E_ADMIN_USER_ID` (`e2e-test-admin`), admin.

Les rôles viennent du secret, jamais des listes `LIST_*`. Un secret vide côté back désactive la connexion correspondante.

## Secrets GitHub

| Dépôt        | Secret                                                       | Rôle                                                                                                      |
| ------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| pokenini-e2e | `E2E_LOGIN_SECRET`, `E2E_ADMIN_LOGIN_SECRET`                 | Connexion des tests. Sans eux, seuls les tests visiteur tournent.                                         |
| pi-projects  | `E2E_LOGIN_SECRET`, `E2E_ADMIN_LOGIN_SECRET` (mêmes valeurs) | Écrits par le CD dans le `.env.secret` des deux stacks pokenini-back.                                     |
| pi-projects  | `E2E_DISPATCH_TOKEN`                                         | Fine-grained token, droit _Contents_ en écriture sur pokenini-e2e, pour déclencher les tests après le CD. |

Pour changer un secret de connexion : le modifier dans les deux dépôts, puis relancer le CD de pi-projects (Actions > CD > Run workflow).

## Qualité et tests de la suite

Workflow `.github/workflows/ci.yaml`, sur chaque PR et sur `main`. Rien n'est envoyé aux vrais sites.

| Job                               | Contenu                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ESLint, Prettier, types, Markdown | ESLint avec les règles Playwright (`await` oubliés, assertions manquantes, `waitForTimeout`…), format Prettier, vérification des types par TypeScript à partir du JSDoc, markdownlint.                                                                                                                                                                                                                                                     |
| EditorConfig, YAML, workflows     | editorconfig-checker, yamllint, actionlint (avec shellcheck sur les `run:`), zizmor (sécurité des workflows). Versions épinglées dans `requirements-lint.txt`.                                                                                                                                                                                                                                                                             |
| npm audit                         | Failles connues et signatures des paquets npm.                                                                                                                                                                                                                                                                                                                                                                                             |
| Unit tests                        | `targets.mjs` et la config Playwright, couverture de 100 % exigée.                                                                                                                                                                                                                                                                                                                                                                         |
| Self-tests                        | La vraie suite tourne contre un faux Pokénini local (`selftest/mock-site.mjs`). Elle doit passer sur un site sain (staging, prod, prod avec admin, sans secrets, déploiement lent) et échouer exactement aux bons tests pour chaque panne simulée : mauvais secret, ancienne version, erreur JS, HTTP 500, image cassée, dex de démo absent, pages dresseur ouvertes aux visiteurs, réponse de jeu absente, mauvaise version dans l'admin. |

Dependabot met à jour les paquets npm, les linters Python et les actions GitHub chaque semaine.

Quand une page du site change, mettre à jour le test **et** le faux site, sinon les self-tests échouent.

## En local

```shell
npm ci && npx playwright install chromium
E2E_TARGET=staging npx playwright test
E2E_TARGET=prod E2E_LOGIN_SECRET=… E2E_ADMIN_LOGIN_SECRET=… E2E_ADMIN=true npx playwright test

npm run lint        # ESLint, Prettier, types, Markdown
npm run fix         # corrige ESLint et Prettier
npm run test:unit
npm run test:self   # demande Chromium
```

`E2E_BASE_URL` pointe les tests ailleurs (une stack locale par exemple), `E2E_AUTH_DIR` change le dossier des sessions et `E2E_DEPLOY_TIMEOUT_SECONDS` la durée d'attente de la version déployée. `E2E_EXPECTED_VERSIONS` (JSON `{"web": …, "back": …, "api": …, "resources": …}`) attend et vérifie des versions précises.
