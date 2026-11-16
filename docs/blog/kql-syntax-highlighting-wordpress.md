# Adding Kusto Query Language Syntax Highlighting to WordPress

**Suggested SEO title:** KQL Syntax Highlighting in WordPress with Prism.js

**Meta description:** Add Kusto Query Language highlighting to WordPress with
Prism.js, Gutenberg and shortcodes, without migrating existing code snippets.

Kusto Query Language is easier to explain when readers can see where a pipeline
changes shape. A `where` clause narrows the rows; `summarize` changes their
granularity; `make-series` builds a time axis. Give every word the same color
and those boundaries disappear, especially in a long troubleshooting article.

That matters whether your readers use Azure Data Explorer, Azure Monitor, or
Microsoft Fabric Eventhouse. They often copy a query, change a table name or
time window, and run it elsewhere. The publishing tool must preserve the query
as carefully as it presents it. A colorful snippet that loses an ampersand or
adds line numbers to the clipboard is not an improvement.

This article describes integrating Prism's existing Kusto grammar into a fork
of SyntaxHighlighter Evolved. Prism supplies the underlying tokenizer and
grammar. The fork supplies the WordPress compatibility layer, local asset
loading, safe rendering and a few focused grammar refinements.

## Why SQL highlighting is the wrong substitute

KQL is not SQL with different capitalization. Its tabular pipeline,
`dynamic` values, duration literals and operators such as `mv-expand` and
`project-away` have their own conventions. A SQL brush may recognize strings
and numbers, but it does not explain the structure of this query:

```kql
StormEvents
| where StartTime > ago(7d)
| where State == "TEXAS"
| summarize Events = count() by State
| top 10 by Events desc
```

`ago(7d)` is an expression containing a duration, not a column named `7d`.
The pipes introduce tabular transformations. Using a real Kusto grammar makes
the snippet easier to scan without pretending that highlighting validates it.
Also be explicit about the name: in this integration, KQL means **Kusto Query
Language**, not Kibana Query Language.

## What the original WordPress plugin did

SyntaxHighlighter Evolved has more compatibility machinery than its frontend
appearance suggests. Its PHP class registers language aliases, settings,
shortcodes, widgets, comments, BuddyPress hooks and TinyMCE adapters. It parses
its shortcodes before WordPress's normal paragraph formatting can alter code.

Its Gutenberg block is named `syntaxhighlighter/code`. The editor saves a
`pre` element, while a PHP callback renders the frontend. Classic snippets have
an additional complication: older posts may store raw code, while newer posts
store encoded text with metadata identifying that format.

Replacing only the JavaScript files would miss those boundaries. Decoding every
snippet globally can turn intentional entities into different code. Escaping
every stored string twice makes readers see `&lt;` instead of `<`. The migration
therefore retains the storage adapters and changes the rendering boundary, not
the database.

The original footer loaded SyntaxHighlighter 2 or 3 brushes and inserted its
styles through JavaScript. The replacement registers local Prism assets through
WordPress and discovers languages as content actually renders. That also covers
code nested in reusable blocks instead of assuming every snippet belongs
directly to the main post.

## Start with Prism's Kusto component

Prism 1.30.0 includes `components/prism-kusto.js`. Its grammar is a collection of
token rules for comments, strings, pipeline verbs, commands, keywords,
functions, datetimes, numbers, operators and punctuation.

Some useful capabilities are already upstream: hyphenated verbs following a
pipe, triple-backtick multiline strings, common duration suffixes and datetime
forms. These are **not inventions of this fork**. The build uses the upstream
file and appends a small extension rather than maintaining a separate parser.

Tokenization does not contact an Azure service, resolve a table, authenticate a
user or execute a command. It classifies text. Query validity still belongs to
Kusto and the environment where the query is eventually run.

## Register languages once, then resolve aliases

The shared language registry includes these actual mappings:

```json
{
  "typescript": "typescript",
  "ts": "typescript",
  "tsx": "tsx",
  "kusto": "kusto",
  "kql": "kusto"
}
```

The PHP selector labels Kusto as **Kusto Query Language (KQL)**. Both Kusto
spellings resolve to the same grammar, so the frontend does not need duplicate
files or special cases. Existing brush aliases are adapted to Prism identifiers;
for example, `jscript` becomes `javascript` and `xml` becomes `markup`.

A final-map filter, `syntaxhighlighter_prism_aliases`, allows trusted PHP
extensions to adjust aliases. Its results are validated against the built
manifest. An unknown language becomes escaped plaintext rather than a failed
request or an unsafe HTML fallback.

## Gutenberg and shortcodes should meet at one renderer

The block keeps its registered name and save function. This avoids turning a
frontend-engine upgrade into a content migration or a block-validation problem.
The sidebar gains searchable language selection, and a plain code textarea
continues to preserve indentation. An optional preview uses the same local
grammar and frontend controller.

Classic authors can write:

```text
[code language="kql" firstline="10" highlight="11-12"]
StormEvents
| where StartTime > ago(7d)
| summarize count() by State
[/code]
```

`[kql]...[/kql]` and `[kusto]...[/kusto]` are equivalent. Existing `[code]`,
`[sourcecode]`, language-specific tags and their settings still enter the
compatibility layer.

One subtle regression test protects code containing shortcode examples. The
Classic parser must not process `[js]...[/js]` inside a serialized Gutenberg
code block. Otherwise saving a post can modify the code before the block
renderer even sees it. The implementation skips those serialized regions when
applying Classic transformations.

## Queries worth using as fixtures

A grammar test should include more than a one-line filter. Aggregation and
joins expose different combinations of functions, parameters and identifiers:

```kql
let Regions = datatable(State:string, Region:string)
[
    "TEXAS", "South",
    "WASHINGTON", "West"
];
StormEvents
| join kind=leftouter Regions on State
| summarize Events = count(),
            Damage = sum(DamageProperty) by Region
```

The public StormEvents sample is historical. Replace `ago(7d)` with a window
present in your dataset when running the time-filtered examples.

Dynamic values need both JSON-like syntax and ordinary property access:

```kql
datatable(Id:int, Metadata:dynamic)
[
    1, dynamic({"region":"west","tags":["a","b"]}),
    2, dynamic({"region":"east","tags":["c"]})
]
| extend Region = tostring(Metadata.region)
| summarize Events = count() by Region
```

Time-series examples exercise duration literals and a multiline operator:

```kql
let startTime = ago(7d);
let endTime = now();
StormEvents
| where StartTime between (startTime .. endTime)
| make-series Events = count()
    on StartTime
    from startTime to endTime
    step 1h
```

The repository's `tests/fixtures/kusto.kql` also contains cross-cluster
references, query parameters, uppercase user-defined functions, verbatim
strings and management-command syntax. Its combined examples are highlighting
fixtures, not a production script intended to run unchanged.

## Small grammar corrections with specific tests

Inspection of the pinned upstream grammar found a few concrete gaps. Its
management-command pattern matched dotted property access, so `.region` in
`Metadata.region` could receive command coloring. The extension anchors
management commands to the beginning of a line:

```javascript
Prism.languages.kusto.command = {
    pattern: /(^[ \t]*)\.[a-z][a-z\d-]*\b/m,
    lookbehind: true,
    alias: 'keyword',
};
```

That leaves ordinary dotted identifiers alone while recognizing `.show tables`.
Another refinement handles doubled quotes in verbatim strings such as
`@"a ""quoted"" string"`. Additional rules recognize uppercase function names,
more explicit duration units, missing string operators and selected top-level
tabular operators.

These are deliberately bounded changes, backed by token assertions and a
timed adversarial-string test. They do not attempt to validate schemas, infer
types, parse every management-command variant or produce a complete KQL syntax
tree. Generic improvements could be proposed upstream separately; none is
claimed contributed or accepted merely because this fork uses it.

## Treat code as data before the browser runs

Security starts in PHP, not in Prism. After selecting the correct Classic/block
decoding path, the renderer escapes the source once and emits semantic
`pre > code` markup. Unsupported languages take the same escaping path.
With JavaScript disabled, a displayed script remains text.

The frontend uses `Prism.tokenize` and constructs token spans with DOM methods.
It does not insert highlighted HTML strings with `innerHTML`. The copy button
keeps the original source separately, while line numbers are visual
decorations. Native `details` and `summary` provide collapse without depending
on JavaScript or a toolbar workaround.

Automatic links only recognize HTTP and HTTPS. Language names cannot become
arbitrary script paths. All runtime assets are local, and snippets are not sent
to external services. WordPress's Settings API supplies the usual capability
and nonce checks for administrator changes.

## Measure the real tradeoffs

Only rendered languages and their dependencies are enqueued. The private core
and UI controller share a runtime file, with automatic Prism scanning disabled
so unrelated code on the page is left alone. There is no document-wide mutation
observer or remote grammar autoloader.

The reproducible benchmark compares the old engine with the replacement across
five page shapes. Read the accompanying performance report rather than assuming
a newer library wins every metric. Local gzip transfer decreased, but some
small-page initialization and request counts increased. Real Kusto coloring
also costs more CPU than the original plaintext fallback; that is not an
equivalent-grammar speed comparison.

Very large snippets receive an explicit notice and retain their complete,
escaped, copyable source without expensive tokenization or line decoration.
The threshold is a responsiveness policy, not proof that every grammar is
immune to pathological input.

## Lessons for a compatible upgrade

The most important boundary was not between two highlighting libraries. It was
between stored text, editor serialization, WordPress formatting and safe output.
Keeping that boundary stable allowed a new engine without asking authors to
resave old posts.

Preserve identifiers that represent content contracts. Replace obsolete
runtime behavior where necessary, but document equivalents: old themes become
light/dark mappings, and Flash-era controls become native browser interactions.
Test actual WordPress rendering and editing, not just whether a bundle builds.

Future work could refine more Kusto tokens, improve scheduling for large
snippets, and contribute narrowly useful grammar fixes upstream. None requires
turning the plugin into a query editor, adopting Monaco, or sending readers'
queries elsewhere.

## References and editorial assets

- [Kusto Query Language overview](https://learn.microsoft.com/en-us/kusto/query/)
- [StormEvents sample data](https://learn.microsoft.com/en-us/kusto/query/samples)
- [Kusto string literals](https://learn.microsoft.com/en-us/kusto/query/scalar-data-types/string)
- [Kusto join operator](https://learn.microsoft.com/en-us/kusto/query/join-operator)
- [Kusto make-series operator](https://learn.microsoft.com/en-us/kusto/query/make-series-operator)
- [Microsoft Fabric Eventhouse](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/eventhouse)
- [Prism components and downloads](https://prismjs.com/download.html)
- [Upstream Prism Kusto grammar](https://github.com/PrismJS/prism/blob/v1.30.0/components/prism-kusto.js)
- [WordPress block deprecations](https://developer.wordpress.org/block-editor/reference-guides/block-api/block-deprecation/)
- [Fork implementation](https://github.com/saguiitay/syntaxhighlighter)

**Short social announcement:** Kusto queries deserve more than SQL coloring.
This WordPress plugin fork adds local Prism-based KQL and TypeScript
highlighting while keeping existing SyntaxHighlighter blocks and shortcodes.
The implementation notes cover compatibility, grammar tests and safe copying.

**Suggested screenshots:** the searchable Gutenberg language selector with
Kusto selected; the StormEvents aggregation in light and dark modes; a collapsed
query opened by keyboard; and a copy/paste example showing source without line
numbers. Use sanitized sample queries, not production cluster names or data.

*Editorial draft only. Neither this article nor the plugin is published by the
build or test workflow.*
