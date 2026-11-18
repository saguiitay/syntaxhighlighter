# Performance measurements

The recorded snapshot below is from an **internal development build (4.0.0)**,
before the Coy stylesheet update. Its byte counts do not describe the newer
stylesheet, and it is not a new benchmark of 1.0.0. Run the benchmark again to
measure the current build.

Run `npm run build`, then `npm run benchmark`. Raw samples are written to
`artifacts/benchmark.json`; the delivery snapshot is `performance-results.json`.
The current benchmark measures Prism only. The obsolete engines have been
removed from the source tree; historical comparison data below is unchanged.

## Method

Five fresh Chromium contexts per scenario, loopback HTTP with gzip and
cache disabled. Report medians of synchronous DOMContentLoaded initialization,
not estimates. Byte counts are the actual gzipped JS/CSS response bodies
(HTTP headers and the HTML document excluded). CDP ScriptDuration samples are
also recorded in the JSON. There is no network throttling. This is a repeatable
renderer microbenchmark, **not** a production Core Web Vitals or TTFB claim.
Environment, Chromium/Node versions and CPU are included with the raw samples.

The historical legacy baseline used the unchanged 3.0.9b core, brushes and default styles
from commit `60d9239`, still available in Git history. It had no TypeScript or Kusto grammar: the baseline used
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
| One TypeScript | 12,260 B | 8,656 B | 4 / 5 | 4.9 / 9.4 ms |
| Five languages | 17,015 B | 14,779 B | 8 / 10 | 14.7 / 19.4 ms |
| Twenty blocks | 12,693 B | 9,968 B | 5 / 6 | 18.0 / 22.0 ms |
| Large KQL | 11,830 B | 7,191 B | 4 / 3 | 27.6 / 85.0 ms |

This final run reduced transferred JS+CSS by 13.1%-39.2% on code pages.
Initialization regressed in all four code scenarios in this run; the earlier
twenty-block improvement did not reproduce. Native Kusto coloring costs
substantially more than the old plaintext fallback. Do not interpret that as a
parser-speed comparison or promise these timings on other hardware. Measurements
are local medians on a shared Windows workstation, not isolated laboratory
results. The final snapshot uses Node 24.18.0 and Chromium 145.0.7632.6.

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
