# Changelog

## 1.0.0

Initial standalone release. Previously unreleased development builds are
consolidated into this release.

- Use SyntaxHighlighter Prism as the display name, removing the restricted
  WordPress term without changing the plugin slug or compatibility identifiers.
- Require WordPress 7.0+ and focus CI/local WordPress testing on 7.1.4 only,
  retaining PHP 8.2/8.5 coverage.
- Load preview styles and Prism themes inside the block editor's iframe so
  live syntax previews show colors, layout and theme changes correctly.
- Use the `syntaxhighlighter-prism` translation domain in PHP and the block
  editor, including script translation registration, without changing stored
  blocks, shortcodes, settings or compatibility hooks.
- Remove the external GitHub update override so a future WordPress.org release
  can receive standard directory updates under its own slug.
- Refine KQL highlighting against the official lexer: whole typed literals,
  both multiline string forms, accurate number/duration boundaries, negated
  operators, query aliases/options, join variables, hints and dotted properties.
  Distinguish bare `null` and callable `count()`/`range()`; stop treating arbitrary
  pipe words or unsupported `us`/`ns` duration suffixes as language tokens.
- Backport KQL fixes from RunDevelopment/prism#3: query/graph keywords, string
  operators, scalar aliases, boolean spellings, verbatim strings and correct
  management-command/operator boundaries. Retain extended timespan support.
- Remove ignored/empty SCSS sources and unused JSDoc, PHPCS, PHPUnit and Travis
  setup files; keep the current build, editor CSS and maintained test suites.
- Remove unsupported TinyMCE 3/pre-block-editor branches and unused legacy
  brush scanners/helpers; retain the current Classic editor and stored content.
- Remove obsolete SyntaxHighlighter 2/3 engines, Flash assets and third-party
  brushes. Benchmark the current Prism renderer only; retain historical results.
- Add Power Query (M), with `powerquery`, `pq` and `mscript` aliases, to the
  editor selector and shortcodes using the bundled local Prism grammar.
- Add Markdown (`markdown` / `md`) to the editor selector and shortcodes,
  using the bundled local Prism grammar.
- Add Rust to the editor language selector and `[rust]` / `[code language="rust"]`,
  using the bundled local Prism grammar.
- Update the settings preview immediately from unsaved form options using the
  production renderer. Remove forced demo options and honor the copy setting
  independently of the legacy toolbar setting.
- Add site-wide selection of local Prism themes: Coy light/dark/automatic,
  Prism Default, Prism Dark, Funky, Okaidia, Solarized Light, Tomorrow Night
  and Twilight. Blocks and shortcodes inherit the setting unless overridden.
- Keep legacy saved theme values and expose the same choices in the block
  editor, including its preview. Load only used theme styles on the frontend.

### Layout and JSON

- Add JSON to the editor language selector and `[json]` / `[code language="json"]`.
- Tighten code font/line spacing, padding, gutters and the copy toolbar.
- Keep blank-line numbers aligned, including wrapped snippets, without changing
  indentation, blank lines or copied source.
- Align gutter typography with the code and isolate it from surrounding theme
  styles; add consistent column spacing and a subtle separator.

### Coy theme

- Replace the custom light presentation with upstream Prism Coy, scoped to the
  plugin: blue accent, striped paper, lifted shadows and original token colors.
- Adapt the theme to existing scrolling, wrapping, line decorations, controls
  and dark/automatic modes without styling unrelated code on the page.
- Version asset URLs so updated styles do not reuse cached development builds.

### Prism migration and compatibility

- Replace frontend SyntaxHighlighter 2/3 with local, pinned Prism.js 1.30.0.
- Add TypeScript, TSX and Kusto Query Language (`kql`/`kusto`) in blocks,
  shortcodes and the searchable editor language selector.
- Preserve `syntaxhighlighter/code`, its save function, shortcode names,
  Classic encoding metadata and `syntaxhighlighter_settings`; no migration.
- Escape unknown-language and empty snippets on the server. Use safe DOM token
  construction, bounded options/ranges and capability-checked settings.
- Add light/dark/system appearance, literal-source copying with feedback,
  native details/summary collapse, line highlights and configurable numbering.
- Add opt-in editor preview, indentation handling and an Escape-then-Tab exit.
- Load only rendered languages with dependency-aware WordPress handles; combine
  core and controller into one runtime. Exclude old engines from distribution.
- Add reproducible builds, tests, native PHP analysis, dependency audits,
  WordPress/Chromium compatibility checks, benchmarks and deterministic ZIPs.
- Use a distinct displayed/update identity and refuse fork activation while
  the original class is already loaded.
- Require PHP 8.2+. Colors/layout differ from legacy themes;
  obsolete engine-specific extensions need adaptation. See compatibility docs.

Earlier upstream releases and attribution remain documented in `readme.txt`
and Git history.
