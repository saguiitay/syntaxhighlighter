# Third-party inventory and licenses

The fork's PHP, JavaScript and CSS are GPL-2.0-or-later. Original copyright and
license notices in the repository and `LICENSE` remain intact. Credit belongs
to Alex Mills (Viper007Bond), Automattic, Alex Gorbatchev and the original
contributors for their respective work. This fork is not an Automattic release.

| Component | Pinned version | Use | License |
|---|---|---|---|
| Prism.js core and 40 grammar/dependency files | 1.30.0 | Local frontend/editor highlighting | MIT, full notice in `dist/PRISM-LICENSE` |
| WordPress packages | Provided by the supported WordPress installation | Block editor APIs, not copied into the editor bundle | GPL-2.0-or-later |
| SyntaxHighlighter 2 and 3, third-party brushes | Original repository versions | Source-only baseline benchmarks; **excluded from ZIP** | See original notices and license files in their directories |
| TinyMCE shortcode adapters | Original plugin, with integration hardening | Classic editor preservation | Original plugin GPL license/notices |

The Kusto grammar is upstream Prism work, not invented by this fork.
`src/kusto-extension.js` is the fork's small integration-time extension.
The build copies Prism's complete license, including its contributors notice,
alongside the runtime.

Development-only packages (esbuild, ESLint, Prettier, Playwright, PHP.wasm,
WordPress Playground, fflate, PHPStan and WordPress stubs) are not shipped.
`package-lock.json` and `composer.lock` record exact dependency resolutions.
`npm run archive` generates `artifacts/dependency-inventory.json` from npm's lock
with versions, licenses and development flags; Composer's two development
packages and their licenses are recorded in `composer.lock`. No PHP runtime
library or Composer autoloader is required on a production server.
