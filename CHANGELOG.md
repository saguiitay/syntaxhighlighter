# Changelog

## 4.0.1 - unreleased fork

- Replace the custom light presentation with upstream Prism Coy, scoped to the
  plugin: blue accent, striped paper, lifted shadows and original token colors.
- Adapt the theme to existing scrolling, wrapping, line decorations, controls
  and dark/automatic modes without styling unrelated code on the page.
- Bump the asset version so updated styles do not reuse cached 4.0.0 URLs.

## 4.0.0 - unreleased fork

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
- Target WordPress 6.8.12+ and PHP 8.2+. Colors/layout differ from legacy themes;
  obsolete engine-specific extensions need adaptation. See compatibility docs.

Earlier upstream releases and attribution remain documented in `readme.txt`
and Git history.
