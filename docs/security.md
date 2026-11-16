# Security review and validation

## Review result

A dedicated read-only security review examined the migration diff
`60d9239..fab7b34`: PHP rendering/settings, frontend token construction, editor
preview, build isolation and dependency changes. It reported **no security
vulnerabilities in the reviewed changes** and independently reran the original
122 PHP assertions and five grammar tests successfully. It did not independently
run the browser or WordPress suites. Later compatibility/grammar refinements
have additional automated checks; the review result is not a blanket audit of
all upstream code or every future commit.

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| — | — | Reviewed migration diff | — | No vulnerabilities reported | — |

No severity is assigned to an absence of findings. This is not a guarantee of
vulnerability-free software or an audit of every third-party Prism grammar.

## Boundaries strengthened by the migration

- Every code body, including unknown languages and empty snippets, passes
  through server-side `htmlspecialchars` with substitution for invalid UTF-8.
  JavaScript is not a security boundary. Raw and encoded Classic storage are
  handled independently from block serialization to avoid double escaping.
- The frontend uses `Prism.tokenize`, `createElement`, `createTextNode` and
  `replaceChildren`, not token HTML inserted through `innerHTML`. Code is never
  evaluated. Neither code strings nor grammar names become executable URLs.
- A fixed local manifest resolves language IDs. User attributes cannot select
  arbitrary paths, CSS classes, script URLs or event handlers. Custom PHP
  filters are trusted code and can deliberately override final HTML, as in
  WordPress generally.
- Highlight ranges stay compact and are compared against actual rendered lines.
  No loop expands an attacker-supplied billion-line range. Numeric display
  options and class strings are bounded/sanitized.
- HTTP(S)-only automatic links are created as DOM nodes with safe link
  relationships. Other schemes remain text. The copy button receives the
  original source, not decorated line numbers or token HTML.
- Native Settings API `options.php` supplies WordPress nonce/capability checks.
  The sanitizer additionally requires `manage_options`, escapes title/classes
  and normalizes values. No new public settings endpoint was introduced.
- Editor and TinyMCE inline configuration uses JSON, including HTML-sensitive
  character escaping for extensible data. Code source is never interpolated
  into inline scripts. No Flash, `eval`, CDN or remote grammar autoload exists.

The original TinyMCE storage adapters and shortcode-parser contracts remain.
Incomplete shortcodes and unrelated raw post HTML are not magically sanitized
by this plugin; normal WordPress authoring/KSES rules still apply. The plugin
only treats properly delimited snippets as code.

## Tests and dependencies

PHP tests cover literal script/image/event payloads, quotes, unknown/array
language values, empty/long/Unicode/mixed-line-ending source, option injection,
range bounds, alias overrides, legacy settings and non-admin settings writes.
Real WordPress tests include nested-looking shortcodes, Classic encoding,
reusable/nested blocks and real editor persistence. Browser tests verify no
source-created script/image nodes, no dialogs/page errors, safe HTTP links,
copy success/permission failure and duplicate initialization.

The complete npm audit initially found development-tool advisories. Patched,
exact overrides for body-parser, fast-uri, isomorphic-git, proxy-addr and qs,
plus fflate 0.8.3, removed them. `npm audit --registry=https://registry.npmjs.org`
and the production-only audit returned **zero vulnerabilities** in this
environment. Composer audit also returned no advisories. The environment's
default registry rate-limited an audit request; the public npm security endpoint
was used explicitly instead. These are point-in-time results, not future
guarantees.

Production ships only Prism and plugin code: no npm/Composer dependencies,
development server, old engines or third-party legacy brush runtime. See
`docs/third-party-licenses.md` and the generated dependency inventory.
Lockfiles and SHA-pinned CI actions make the development supply chain auditable.

The 200,000-code-unit / 10,000-line highlighting guard is a responsiveness limit,
not universal protection against all grammar complexity. Kusto adversarial
inputs have focused timed regressions. Use ordinary WordPress limits and
permissions for very large/untrusted post bodies.

## Reporting

Do not post exploit payloads or credentials publicly. Use GitHub's private
vulnerability reporting if enabled for this fork, or contact the maintainer
through an established private channel. No public release was created.
