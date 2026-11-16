# Development, checks and delivery

## Toolchain

- Node 24.18+ and npm 11.16+ (exact baseline in `.nvmrc`).
- PHP 8.2+ and Composer 2 for native lint/static checks, optional for the
  npm-driven PHP.wasm/WordPress suites.
- Chromium from Playwright 1.58.2. Docker/MySQL are not required.

The Windows machine initially had Node 22.23.5 but no PHP/Composer and an
unavailable Docker daemon. Validation provisioned Node 24.18, checksum-verified
portable native PHP 8.5.12 and Composer 2.11.2. Tool caches under `.cache` and
generated artifacts are ignored, never included in the plugin ZIP.

```text
npm ci --ignore-scripts
npm run build
npx playwright install chromium
npm run check
composer install --no-interaction --prefer-dist
composer validate --strict
composer analyse
composer audit
npm audit --registry=https://registry.npmjs.org
npm run test:wordpress
npm run benchmark
npm run archive
npm run test:package
```

`npm run check` builds, runs JS grammar tests, ESLint, Prettier, PHP syntax/unit
checks through PHP.wasm, and Playwright frontend tests. The PHP command generates
`artifacts/rendered.json`, which the browser fixtures consume. Run it before
`test:browser` when invoking individual commands.

`composer analyse` runs pinned PHPStan 2.3.6 at level 1 against pinned WordPress
7.1.2 stubs, with a 512 MB analysis memory limit. There is no blanket error-ignore
list or PHP runtime dependency. Native lint commands:

```text
php -l syntaxhighlighter.php
php -l includes/class-prism-renderer.php
php tests/php/run.php
```

The old external MySQL/PHPUnit bootstrap is retained for contributors using
WordPress's unit-test infrastructure; the mandatory self-contained suites do
not rely on the original trivial PHPUnit smoke test.

## Actual WordPress testing

`npm run test:wordpress` starts an ephemeral, loopback-only Playground site with
SQLite, verifies readiness, activates the plugin, executes PHP assertions, and
drives Chromium through the frontend and real Gutenberg editor. It installs
official Twenty Twenty-One (classic) and Twenty Twenty-Five (block) themes,
checks conditional assets, old/new serialization, language persistence,
editable source, clipboard behavior and keyboard indentation.

The site/browser are closed in `finally`; no background service is left running.
Official WordPress/theme downloads are required on first use; no source snippets
are sent externally. Two workers avoid editor request deadlock while limiting
local resource use. This is integration testing on SQLite/PHP.wasm, not a claim
of MySQL/MariaDB coverage.

PowerShell matrix selection:

```powershell
$env:WP_VERSION = '7.1.4'
$env:PHP_VERSION = '8.5'
npm run test:wordpress
```

On a POSIX shell, use `WP_VERSION=7.1.4 PHP_VERSION=8.5 npm run test:wordpress`.
Default minimum is WordPress 6.8.12 with PHP 8.2. These exact versions, rather
than floating `latest`, are pinned in CI. Update them deliberately as supported
branches receive security releases.

Validated endpoints before delivery:

| WordPress | PHP | Environment |
|---|---|---|
| 6.8.12 | 8.2.35 | WordPress Playground / Chromium; both themes |
| 7.1.4 | 8.5.12 | WordPress Playground / Chromium; both themes |
| PHP units and lint | 8.5.12 | Native Windows PHP |
| PHP units and syntax | 8.2.35 | PHP.wasm |

The full four-corner CI matrix also includes WordPress 6.8.12/PHP 8.5 and
WordPress 7.1.4/PHP 8.2. Delivery validation JSON in `artifacts` is the authority
for locally completed matrix runs. Do not describe a pending run as passed.
Test counts and final matrix results are summarized in the delivery response.

## Build and grammars

`scripts/build.mjs` uses esbuild, with WordPress packages externalized to their
registered `wp.*` APIs. No React/editor framework is bundled. Prism core is
private (`SyntaxHighlighterPrism`), with no automatic scanning/worker loader.
The core/controller share `runtime.js`; grammar files are generated from
upstream components and an explicit dependency graph in `dist/manifest.json`.
The Kusto extension is appended only to its own grammar.

To add a language: update `languages.json`, its PHP/editor label if appropriate,
add a focused fixture and run all checks. The build rejects unknown grammar
names. Do not accept browser-provided component URLs or fetch remote grammars.

`dist` is generated, not committed. A source checkout must be built; a production
ZIP includes every required asset. Changing `save.js` or source selectors
requires explicit legacy fixtures and a Gutenberg deprecation strategy.

## Packaging

`npm run archive` writes:

- `artifacts/syntaxhighlighter-prism-4.0.0.zip` and its SHA-256 file.
- `artifacts/package-manifest.json`, hashing every packaged file.
- `artifacts/dependency-inventory.json`, listing locked npm packages/licenses.

Packaging uses an allowlist, sorted paths, fixed ZIP timestamps and compression.
It verifies all entries/checksums and repeats ZIP generation to assert stable
bytes. Old engines, tests, build sources, node_modules and vendor are excluded.
`npm run test:package` extracts the ZIP into a dedicated temporary cache folder,
mounts **that folder**, not the source tree, as the WordPress plugin, runs real
integration/editor tests with the test suite mounted separately, then removes
the extraction. Production requires no build tools.

## CI

`.github/workflows/ci.yml` runs on pull requests and pushes to `master`.
Jobs cover JS/build/format/browser/audit/benchmark/package, the four WordPress/PHP
combinations, and native PHP 8.2/8.5 lint/unit/Composer audit/static analysis.
Node caching is lockfile-based; actions are SHA-pinned and permissions read-only.
Artifacts include test JSON, screenshots, benchmark samples and the ZIP.

The workflow is configured and local equivalents are exercised. **No hosted
GitHub Actions success is claimed before pushing and observing a run.** This
task does not push, publish a plugin, upload screenshots to third parties or
create a public release.
