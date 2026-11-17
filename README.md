# SyntaxHighlighter Prism for WordPress

A replacement fork of **SyntaxHighlighter Evolved**, using local Prism.js
instead of the old SyntaxHighlighter engines. Adds TypeScript, TSX and
**Kusto Query Language (KQL)** while retaining existing blocks, shortcodes and
settings. Not maintained or released by Automattic.

## Install or replace the original

1. Back up the site and test on staging.
2. Deactivate **SyntaxHighlighter Evolved**. Do not run both plugins together:
   they intentionally share the class, block, shortcode and option identifiers.
3. Upload `artifacts/syntaxhighlighter-prism-4.0.2.zip` using **Plugins > Add
   New > Upload Plugin**, then activate **SyntaxHighlighter Prism for WordPress**.
4. Review **Settings > SyntaxHighlighter**, existing posts and any custom brush
   integrations. No content migration, resave or database operation is required.

The ZIP is self-contained: production needs WordPress **6.8.12+** and PHP
**8.2+**, not Node.js, npm or Composer. Its folder/update identity is
`syntaxhighlighter-prism`, not the upstream WordPress.org slug. The `Update URI`
prevents replacement by WordPress.org's original plugin; there is no automatic
GitHub updater. Nothing is published by the build.

For rollback, deactivate this fork and reactivate the original plugin; old
settings/content remain in place. New TypeScript/Kusto blocks will not acquire
native language support in the original plugin.

## Gutenberg

Add **SyntaxHighlighter Code**, choose a language in the searchable sidebar
control, and enter literal code. Set line numbers, starting line, highlighted
ranges, wrapping, collapse and theme in the sidebar. **Show syntax preview**
loads only the selected local grammar/dependencies. Tab inserts indentation;
Escape then Tab (or Shift+Tab) moves out of the editor. Existing
`syntaxhighlighter/code` blocks keep their serialized `pre` format and attributes.

## Classic editor and shortcodes

```text
[code language="typescript" firstline="10" highlight="11-12"]
interface Box<T> {
    value: T | null;
}
const answer: Box<number> = { value: 42 };
[/code]
```

```text
[code language="kql" theme="dark" collapse="true" title="Storm events"]
StormEvents
| where StartTime > ago(7d)
| summarize Events = count() by State
| top 10 by Events desc
[/code]
```

`[kusto]`, `[kql]`, `[ts]`, `[typescript]`, `[tsx]`, `[source]`,
`[sourcecode]`, and existing language tags also work. Both `kql` and `kusto`
mean **Kusto**, not Kibana Query Language. Unknown languages render escaped
plaintext, never raw executable HTML. Complete aliases/options and extension
changes are in [compatibility](docs/compatibility.md).

## Appearance and interaction

Choose the site-wide theme under **Settings > SyntaxHighlighter > Color Theme**.
The settings preview follows unsaved form changes immediately; **Save Changes**
applies them to the site. It uses the same renderer as published snippets.
Available choices include **Coy** (light/dark/automatic), Prism Default, Prism
Dark, Funky, Okaidia, Solarized Light, Tomorrow Night and Twilight.
Blocks and shortcodes inherit it unless they specify their own theme, for
example `theme="prism-okaidia"` or `theme="light"`.
Automatic follows `prefers-color-scheme`; Coy remains the default appearance.
Themes keep the compact layout, gutters and copying controls. Only themes used
on the page load additional local CSS; the editor loads all choices for preview.
Old theme choices map to light/dark equivalents rather than pixel-identical
SyntaxHighlighter skins. `theme="none"` disables token colors.

`gutter`, `firstline`, `highlight="2,5-8"`, `wraplines`, `collapse`,
`title`, `autolinks`, `tabsize`, `smarttabs`, `padlinenumbers`, `fontsize`,
`toolbar`, `quickcode`, `light` and `classname` retain documented equivalents.
The copy button is independently controlled with `copy="false"` or the site
setting. Copying needs HTTPS/localhost and Clipboard permission; failure is
announced with instructions for manual selection.

Code is server-escaped and readable without JavaScript; native collapse still
works. Syntax colors, line decorations and copying enhance that safe baseline.
Blocks larger than 200,000 UTF-16 code units or 10,000 lines retain their complete
source but show an explicit notice instead of expensive highlighting.

## Development

Use Node **24.18+**, npm **11.16+**, and optionally PHP/Composer for native checks:

```text
npm ci --ignore-scripts
npm run build
npx playwright install chromium
npm run check
npm run test:wordpress
npm run benchmark
npm run archive
composer install
composer analyse
```

The JS toolchain includes PHP.wasm and real WordPress/SQLite tests, so Docker
and MySQL are not prerequisites. Builds and packaging work on Windows/Linux.
No development dependency goes in the plugin ZIP.

See [development and exact tested versions](docs/development.md),
[architecture](docs/architecture.md), [performance measurements](docs/performance.md),
[security](docs/security.md), [licenses](docs/third-party-licenses.md), and
the [KQL implementation article](docs/blog/kql-syntax-highlighting-wordpress.md).

## Limits

This is a highlighting integration, not a Kusto parser or query runner.
Old custom brush JavaScript, Flash/about/print toolbars and pixel-specific legacy
theme CSS do not run on Prism. JavaFX uses Java highlighting; tag-based
ColdFusion is less complete than CFScript. Template output must pass through
the supported render hooks/API, and themes must call `wp_footer()`.
Hosted GitHub Actions results are not claimed until the workflow is pushed/run;
the local validation record describes what was actually executed.
