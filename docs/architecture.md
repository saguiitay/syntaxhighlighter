# Architecture

## Baseline (commit 60d9239)

The original 3.7.2 plugin has one entry point, `syntaxhighlighter.php`, and one
global `SyntaxHighlighter` object, initialized at `init` priority 5. There is no
block.json. `src/index.js` registers `syntaxhighlighter/code`; `save.js` saves a
`pre`, with the content selected as text. **Keep this save function and schema
compatible.** Changing the frontend render callback does not change saved posts.

The PHP class owns settings, aliases, a pre-wpautop shortcode parser, widgets,
comments, BuddyPress hooks, TinyMCE adapters, and block rendering. Shortcodes
are temporarily registered and parsed before normal WordPress shortcodes.
`_syntaxhighlighter_encoded` (and its older unprefixed form) distinguish raw and
entity-encoded Classic content. These paths must not be replaced by a global
entity decoder.

Bundled engines: SyntaxHighlighter 2.1.364 and 3.0.9b; optional third-party
Clojure, F#, LaTeX, MATLAB, Objective-C and R brushes. The footer prints used
brushes and inline initialization, then inserts CSS using JavaScript. Version 2
has historical Flash-related code. No frontend jQuery requirement, except the
optional infinite-scroll adapter. TinyMCE uses jQuery from WordPress.

The source tree contains `src/code-block`, `src/toolbar-dropdown`, artwork in
`assets`, both engine directories, `third-party-brushes`, and `tests/bin`.
The original PHPUnit suite contains just a parse-error smoke test and needs an
external WordPress/MySQL installation. There are no JS tests or GitHub Actions.
Travis targets obsolete PHP 7.0-7.3. The npm build uses wp-scripts, Unix shell
commands and Composer archive; no built `dist` is checked in.

Baseline validation on Windows / Node 22.23.5: `npm test` fails (no test
script); PHP, PHPUnit and Composer are not installed; Docker's Linux daemon is
unavailable. These are baseline environment/tooling failures, not passing tests.

## Compatibility contracts

Retain the block name, save markup, source selector, attribute names, shortcode
tags (except the already excluded `latex` and `r`), option key
`syntaxhighlighter_settings`, encoding metadata, public class and initializer.
The fork replaces the original and cannot be activated alongside it.
See [compatibility.md](compatibility.md) for aliases, options and extension hooks.

Upstream research: Automattic/syntaxhighlighter#214 requests TypeScript;
Automattic/syntaxhighlighter#286 and Automattic/syntaxhighlighter#307 describe
double escaping and bare-pre extraction regressions;
Automattic/syntaxhighlighter#185 requests searchable languages. Recent upstream
PRs also address dependency security and gutter sizing. The fork's issue tracker
is disabled; no existing fork PRs were returned. No upstream change is assumed
merged solely because it was proposed.

## Implemented design

Keep the proven WordPress storage/editor adapters. Isolate language resolution,
option normalization, escaped semantic HTML and asset dependencies in
`includes/class-prism-renderer.php`. The server makes code safe even with JS
disabled. Render-time enqueueing covers nested/reusable blocks, widgets and
template hooks rather than guessing from the main post.

Use locally bundled Prism 1.30.0, with automatic scanning and workers disabled.
Build a combined core/controller runtime and dependency-aware grammar files. Only
rendered languages are enqueued. Preserve upstream licenses. No CDN, telemetry,
network grammar loader, eval, MutationObserver or database migration.

Keep serialized editor markup unchanged. Use supported block-editor APIs and a
plain textarea, with an opt-in preview sharing frontend tokens/styles. No Monaco.
Native details/summary supplies collapse without JS; code is readable without JS.
Line decoration and copying must never mutate the original code text.

Identity: **SyntaxHighlighter Prism for WordPress**, distributable
slug `syntaxhighlighter-prism`, version 4.0.1. Minimum WordPress 6.8.12 / PHP 8.2:
a contemporary WordPress baseline and security-supported PHP, avoiding obsolete
editor compatibility shims. Actual tested versions, not aspirational claims,
are recorded in development/security/performance documentation.
