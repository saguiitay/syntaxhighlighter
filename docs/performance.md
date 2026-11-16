# Performance measurements

Run `npm run build`, then `npm run benchmark`. Raw samples are written to
`artifacts/benchmark.json`; the delivery snapshot is `performance-results.json`.

## Method

Five fresh Chromium contexts per engine/scenario, loopback HTTP with gzip and
cache disabled. Report medians of synchronous DOMContentLoaded initialization,
not estimates. Byte counts are the actual gzipped JS/CSS response bodies
(HTTP headers and the HTML document excluded). CDP ScriptDuration samples are
also recorded in the JSON. There is no network throttling. This is a repeatable
renderer microbenchmark, **not** a production Core Web Vitals or TTFB claim.
Environment, Chromium/Node versions and CPU are included with the raw samples.

The legacy baseline uses the unchanged 3.0.9b core, brushes and default styles
from commit `60d9239`. It has no TypeScript or Kusto grammar: the baseline uses
JScript for TypeScript and Plain for KQL, as a site owner would have to do.
Therefore large-KQL CPU timings compare **plaintext decoration against real
Kusto tokenization**, not equivalent grammar accuracy. SyntaxHighlighter 2 is
not the default baseline.

Scenarios: no blocks; one three-line TypeScript block; five TypeScript, Kusto,
PHP, Python and markup blocks; twenty alternating TypeScript/Kusto blocks; and
500 repeated six-line Kusto queries (roughly 76 KB). No content is truncated.

## Recorded results

| Scenario | Legacy JS+CSS gzip | Prism JS+CSS gzip | Legacy / Prism requests | Legacy / Prism init median |
|---|---:|---:|---:|---:|
| No code | 0 B | 0 B | 0 / 0 | harness only |
| One TypeScript | 12,260 B | 8,656 B | 4 / 5 | 4.4 / 10.1 ms |
| Five languages | 17,015 B | 14,718 B | 8 / 10 | 15.9 / 20.5 ms |
| Twenty blocks | 12,693 B | 9,907 B | 5 / 6 | 23.0 / 19.0 ms |
| Large KQL | 11,830 B | 7,130 B | 4 / 3 | 28.1 / 100.5 ms |

This run reduced transferred JS+CSS by 13.5%-39.7% on code pages. Small
TypeScript and mixed-language pages have modest initialization regressions;
twenty-block initialization improved. Native Kusto coloring costs substantially
more than the old plaintext fallback. Do not interpret that as a parser-speed
comparison or promise these timings on other hardware.

## Refinements and limits

The first measurement exposed extra requests. Combining the private Prism core
and scoped controller into `runtime.js` removed one request from every code
page and reduced gzip overhead, without loading unrelated grammars. Grammar
dependencies still produce more requests for TypeScript/mixed-language pages;
they are deterministic, deduplicated WordPress handles, suitable for HTTP/2.
Shipping an all-language bundle would save requests but increase transfer on
ordinary pages, so it was rejected.

Only rendered blocks/shortcodes enqueue assets, including nested reusable
blocks, widget content and template calls. Actual WordPress tests verify a
no-code page requests no plugin assets and unrelated Python/Ruby grammars are
absent from a TypeScript/Kusto page. The legacy `loadallbrushes` setting
deliberately overrides conditional loading.

Synchronous highlighting is skipped above 200,000 UTF-16 code units or 10,000
lines. A visible notice explains that colors and line decorations are disabled;
the entire escaped source remains readable/copyable. This limits expensive
tokenization/DOM work, but is not a proof of regex complexity for every
upstream grammar. A focused adversarial Kusto regression has a test timeout.

No whole-document observer, automatic Prism scanning, worker fetches or CDN
requests are used. Dynamic publishers should dispatch
`syntaxhighlighter:highlight` with `detail.root` after inserting content.
An event-only Jetpack `post-load` adapter is provided.

CSS is one scoped stylesheet. Late render discovery prints a real stylesheet
link in the footer rather than relying on JavaScript to insert CSS. This covers
templates/widgets and works without JS, but may cause late styling on slow
connections. No layout-shift score was measured; an early site-specific enqueue
can be appropriate for templates with known code content.
