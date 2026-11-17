# SyntaxHighlighter Prism for WordPress

A replacement fork of **SyntaxHighlighter Evolved**, using local Prism.js
1.30.0 instead of the old SyntaxHighlighter engines. Supports TypeScript, TSX,
**Kusto Query Language (KQL)**, JSON, Rust, Markdown and Power Query (M),
alongside the original languages. Existing blocks, shortcodes and settings
are retained. Not maintained or released by Automattic.

## Install or replace the original

1. Back up the site and test on staging.
2. Deactivate **SyntaxHighlighter Evolved**. Do not run both plugins together:
   they intentionally share the class, block, shortcode and option identifiers.
3. Build a current ZIP using the [development commands](#development) below.
   Upload it using **Plugins > Add New > Upload Plugin**, then activate
   **SyntaxHighlighter Prism for WordPress**.
4. Review **Settings > SyntaxHighlighter**, existing posts and any custom brush
   integrations. No content migration or post resave is required.

The ZIP is self-contained: production needs WordPress **6.8.12+** and PHP
**8.2+**, not Node.js, npm or Composer. Its folder/update identity is
`syntaxhighlighter-prism`, not the upstream WordPress.org slug. The `Update URI`
prevents replacement by WordPress.org's original plugin; there is no automatic
GitHub updater. Nothing is published by the build.

Existing ZIPs are not rebuilt when source changes. Rebuild before deploying
unreleased changes; a ZIP's versioned filename alone does not establish that it
contains the latest source.

For rollback, deactivate this fork and reactivate the original plugin; old
settings/content remain in place. Languages and shortcode tags added by this
fork may not work in the original plugin.

## Gutenberg

Add **SyntaxHighlighter Code**, choose a language in the searchable sidebar
control, and enter literal code. Set line numbers, starting line, highlighted
ranges, wrapping, collapse and theme in the sidebar. **Show syntax preview**
loads only the selected local grammar/dependencies. Tab inserts indentation;
Escape then Tab (or Shift+Tab) moves out of the editor. Existing
`syntaxhighlighter/code` blocks keep their serialized `pre` format and attributes.

## Languages

The searchable editor selector includes C/C++, C#, CSS, Go, HTML/XML, Java,
JavaScript, PHP, Python, Ruby, SQL and other bundled languages.

| Language | Language values / shortcode tags |
|---|---|
| C# | `csharp`, `cs`, `c-sharp` |
| JSON | `json` |
| TypeScript | `typescript`, `ts` |
| TypeScript JSX | `tsx` |
| Kusto Query Language | `kusto`, `kql` |
| Rust | `rust` |
| Markdown | `markdown`, `md` |
| Power Query (M) | `powerquery`, `pq`, `mscript` |

Choose the language in the editor, or use these values as a `language` attribute
or standalone shortcodes such as `[rust]...[/rust]`, `[md]...[/md]` and `[pq]...[/pq]`.
Both `kql` and `kusto` mean **Kusto**, not Kibana Query Language.
The [complete alias map](docs/compatibility.md#complete-bundled-alias-map)
includes the remaining languages.

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
`[sourcecode]`, and existing language tags also work. Unknown languages render
escaped plaintext, never raw executable HTML. Complete aliases/options and extension
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
setting; enabling the toolbar does not override a disabled copy button.
Copying needs HTTPS/localhost and Clipboard permission; failure is
announced with instructions for manual selection.

Code is server-escaped and readable without JavaScript; native collapse still
works. Syntax colors, line decorations and copying enhance that safe baseline.
Blocks larger than 200,000 UTF-16 code units or 10,000 lines retain their complete
source but show an explicit notice instead of expensive highlighting.

## Development

Use Node **24.18+** and npm **11.16+** to build an installable ZIP:

```text
npm ci --ignore-scripts
npm run build
npm run archive
```

The archive is written to `artifacts/syntaxhighlighter-prism-4.0.2.zip`.
Building alone updates `dist`; archiving creates the ZIP. No build tool is
required on the WordPress server.

Run validation separately:

```text
npx playwright install chromium
npm run check
npm run test:wordpress
npm run benchmark
```

For settings-preview work, `npm run test:settings-preview` runs focused
WordPress/browser checks after a build, without the broader suite or packaging.
The benchmark measures the current Prism renderer; the old-engine comparison
is retained as historical data in [performance measurements](docs/performance.md).

Native PHP checks additionally use PHP **8.2+** and Composer:
run `composer install` followed by `composer analyse`.
The JS toolchain includes PHP.wasm and real WordPress/SQLite tests, so Docker
and MySQL are not prerequisites. Builds and packaging work on Windows/Linux.
No development dependency goes in the plugin ZIP.

See [development and exact tested versions](docs/development.md),
[architecture](docs/architecture.md), [performance measurements](docs/performance.md),
[security](docs/security.md), and [licenses](docs/third-party-licenses.md).

The [CI workflow](.github/workflows/ci.yml) covers JavaScript, browser, packaging,
WordPress/PHP matrix and native PHP checks. Browser jobs are pinned to Ubuntu
24.04 for the installed Playwright version. See [GitHub Actions](https://github.com/saguiitay/syntaxhighlighter/actions)
for hosted run results; workflow configuration alone is not evidence of a pass.

## Limits

This highlights source text; it does not execute code, run queries or render
Markdown into document HTML.
The old engines, Flash assets and third-party brush implementations have been
removed from the source tree, not the saved-content compatibility adapters.
Old custom brush JavaScript, Flash/about/print toolbars and pixel-specific legacy
theme CSS do not run on Prism. JavaFX uses Java highlighting; tag-based
ColdFusion is less complete than CFScript. Template output must pass through
the supported render hooks/API, and themes must call `wp_footer()`.
