# Third-party inventory and licenses

The fork's PHP, JavaScript and CSS are GPL-2.0-or-later. Original copyright and
license notices in the repository and `LICENSE` remain intact. Credit belongs
to Alex Mills (Viper007Bond), Automattic, Alex Gorbatchev and the original
contributors for their respective work. This fork is not an Automattic release.

| Component | Pinned version | Use | License |
|---|---|---|---|
| Prism.js core and manifest-listed grammars/dependencies | 1.30.0 | Local frontend/editor highlighting | MIT, full notice in `dist/PRISM-LICENSE` |
| Prism Coy theme by Tim Shedor | 1.30.0 | Build-time scoped frontend/editor styling, with plugin adaptations | MIT, attribution in `dist/frontend.css`; full notice in `dist/PRISM-LICENSE` |
| Prism Default, Dark, Funky, Okaidia, Solarized Light, Tomorrow Night and Twilight themes | 1.30.0 | Scoped upstream token rules with compact plugin layout and controls | MIT, attribution in each `dist/themes/*.css`; full notice in `dist/PRISM-LICENSE` |
| WordPress packages | Provided by the supported WordPress installation | Block editor APIs, not copied into the editor bundle | GPL-2.0-or-later |
| TinyMCE shortcode adapters | Original plugin, with integration hardening | Classic editor preservation | Original plugin GPL license/notices |

The Kusto grammar is upstream Prism work, not invented by this fork.
`src/kusto-extension.js` backports the fixes in
[RunDevelopment/prism#3](https://github.com/RunDevelopment/prism/pull/3)
at commit `7df2d65a518a5a5f84ef25a1bea623e19a5a8e53` onto Prism 1.30.0,
alongside the plugin's verbatim-string token and extended timespan units.
That pull request is not assumed to be merged into the pinned npm release.
The build copies Prism's complete license, including its contributors notice,
alongside the runtime.
The obsolete SyntaxHighlighter engines and third-party brushes have been removed;
their original sources and license notices remain available in Git history.

Development-only packages (esbuild, ESLint, Prettier, Playwright, PHP.wasm,
WordPress Playground, fflate, PHPStan and WordPress stubs) are not shipped.
`package-lock.json` and `composer.lock` record exact dependency resolutions.
`npm run archive` generates `artifacts/dependency-inventory.json` from npm's lock
with versions, licenses and development flags; Composer's two development
packages and their licenses are recorded in `composer.lock`. No PHP runtime
library or Composer autoloader is required on a production server.
