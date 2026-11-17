# Adding Kusto Query Language syntax highlighting to WordPress

I've recently been updating the syntax highlighting on this blog. I wanted
proper TypeScript and Kusto Query Language (KQL) support, without going through
old posts and fixing code blocks by hand.

I've ended up forking SyntaxHighlighter Evolved and replacing its rendering
engine with [Prism.js](https://prismjs.com/). The fork keeps the existing blocks,
shortcodes and settings. I've also used GitHub Copilot to help with the
implementation and tests, although there were still a few rounds of checking
the output in WordPress and fixing what didn't look right.

Adding another language turned out to be the easy part.

## Why not SQL?

SQL highlighting is a reasonable temporary workaround for a KQL snippet. It
recognizes strings and numbers, and at least gives the query some color.
But it doesn't know much about pipelines, `dynamic` values, duration literals
or operators such as `project-away`.

Let's take a simple query:

```kql
StormEvents
| where State == "TEXAS"
| summarize Events = count() by EventType
| top 10 by Events desc
```

I want `where`, `summarize` and `top` to look like operators, rather than random
words between pipes. Functions and strings should be recognizable too. Nothing
fancy here - just enough to make an example easier to follow.

Here, KQL means [Kusto Query Language](https://learn.microsoft.com/en-us/kusto/query/),
as used in Azure Data Explorer and other Microsoft services. Not Kibana Query
Language, which happens to share the abbreviation.

## Replacing the engine

The original plugin uses SyntaxHighlighter 2 or 3, with separate JavaScript
files called brushes for the different languages. Its PHP class also handles
shortcodes, settings, widgets, Classic editor encoding and Gutenberg blocks.
Replacing the JavaScript isn't the whole upgrade.

I've kept that WordPress integration and replaced the frontend engine.
[Prism 1.30.0 already includes a Kusto grammar](https://github.com/PrismJS/prism/blob/v1.30.0/components/prism-kusto.js),
including pipeline operators, common duration literals, datetime values and
multiline strings. Credit for that work belongs to the Prism contributors -
I haven't written a KQL parser.

### Registering the language

Both `kql` and `kusto` point to Prism's `kusto` component. These are the relevant
entries in `languages.json`, alongside the other supported languages:

```json
{
  "aliases": {
    "typescript": "typescript",
    "ts": "typescript",
    "tsx": "tsx",
    "json": "json",
    "kusto": "kusto",
    "kql": "kusto"
  }
}
```

The build produces local grammar files and a manifest describing their
dependencies. PHP resolves the alias, registers the required assets and passes
the same language information to the editor. An unknown language falls back
to escaped plain text, rather than trying to download an arbitrary component.

### Keeping old posts

I've kept the Gutenberg block name, `syntaxhighlighter/code`, and its original
save function. The saved `pre` markup stays compatible, while PHP handles the
new frontend output. No database migration or content resave is needed.

Classic content is less straightforward. Some older snippets contain raw text;
others contain encoded text, identified by the existing encoding metadata.
Decoding everything would change intentional entities. Escaping everything
again would leave readers looking at `&lt;` instead of `<`.

I've kept those paths separate. There is also a regression test for shortcode
examples inside Gutenberg code blocks: `[js]...[/js]` should remain an example,
not become another shortcode while WordPress saves the post.

I wanted new colors, not a content-repair project.

## Using KQL in WordPress

In the block editor, choose **Kusto Query Language (KQL)** from the searchable
language selector. The source remains a plain code textarea, with an optional
highlighted preview. TypeScript, TSX and JSON are available there too.

For shortcodes, here's a complete example:

```text
[code language="kql" firstline="10" highlight="11-12"]
StormEvents
| where State == "TEXAS"
| summarize Events = count() by EventType
[/code]
```

`[kql]...[/kql]` and `[kusto]...[/kusto]` use the same grammar. Existing
`[code]`, `[sourcecode]` and language-specific tags still work.

I've switched the light appearance to Prism's
[Coy theme, by Tim Shedor](https://github.com/PrismJS/prism/blob/v1.30.0/themes/prism-coy.css),
with a dark adaptation and CSS scoped to the plugin. Copying, line numbers,
highlighted ranges and native collapse are kept separate from the grammar.
The copied text comes from the original source, not the decorated display.

If you're replacing the original plugin, back up first and try it on staging.
Deactivate SyntaxHighlighter Evolved before activating the fork; they share
identifiers and shouldn't run together. The fork requires WordPress 6.8.12+
and PHP 8.2+. Old theme CSS and custom brush scripts may need changes, so
content compatibility doesn't mean an identical appearance.

## Trying a few queries

A one-line filter doesn't tell us much about a highlighter. I've used examples
with joins, nested values and time series to check more of the grammar.
The table-based examples below use the
[StormEvents sample](https://learn.microsoft.com/en-us/kusto/query/samples).

### Adding a lookup

Let's join a small region lookup to the events, then aggregate the results:

```kql
let Regions = datatable(State:string, Region:string)
[
    "TEXAS", "South",
    "WASHINGTON", "West"
];
StormEvents
| join kind=inner Regions on State
| summarize Events = count(),
            Damage = sum(DamageProperty) by Region
```

This gives us a table definition, strings, a
[join](https://learn.microsoft.com/en-us/kusto/query/join-operator) and a few
aggregation functions in one example.

### Reading dynamic values

For JSON-like data, we can use `dynamic` values and property access:

```kql
datatable(Id:int, Metadata:dynamic)
[
    1, dynamic({"region":"west","tags":["a","b"]}),
    2, dynamic({"region":"east","tags":["c"]})
]
| extend Region = tostring(Metadata.region)
| summarize Events = count() by Region
```

The `.region` access matters here. It exposed one of the grammar issues I'll
get to below.

### Building a time series

The StormEvents sample is historical, so I've used explicit dates. Filtering
it with `ago(7d)` would make for a rather quiet example.

```kql
let startTime = datetime(2017-01-01);
let endTime = datetime(2017-02-01);
StormEvents
| where StartTime >= startTime and StartTime < endTime
| make-series Events = count()
    on StartTime
    from startTime to endTime
    step 1d
```

The [make-series operator](https://learn.microsoft.com/en-us/kusto/query/make-series-operator)
adds a time axis, and `1d` is a duration literal. These examples exercise
different tokens; they don't turn the plugin into a query validator.
It doesn't connect to a cluster or execute anything.

## Checking the rough edges

I've made a few small extensions to the upstream grammar. One problem was
management-command matching: `.region` in `Metadata.region` could get command
coloring, even though it isn't a command.

Here's the replacement rule from `src/kusto-extension.js`:

```javascript
Prism.languages.kusto.command = {
    pattern: /(^[ \t]*)\.[a-z][a-z\d-]*\b/m,
    lookbehind: true,
    alias: 'keyword',
};
```

It recognizes commands such as `.show tables` at the start of a line, without
treating every dotted identifier as one. I've also added handling for doubled
quotes in verbatim strings, uppercase function names, more duration units and
some missing string operators. Prism already handled triple-backtick strings
and hyphenated pipeline operators; those aren't additions from this fork.

The tests cover those distinctions, longer examples and a timed adversarial-string
case. They don't prove complete KQL coverage. For the actual language
rules, including [string literals](https://learn.microsoft.com/en-us/kusto/query/scalar-data-types/string),
the Kusto documentation is still the reference.

### Checking WordPress output

I've tested saved content through real WordPress, not just the tokenizer.
The original migration matrix covered WordPress 6.8.12 and 7.1.4 with PHP 8.2
and 8.5, using both a classic theme and a block theme. That environment uses
Playground and SQLite, not MySQL.

The first layout still had too much padding, and blank-line numbers could
overlap the next row. Apparently a working grammar doesn't mean the code
block looks right... There are now focused desktop/mobile checks for those
cases and for surrounding theme styles changing the gutter font.

Security also belongs outside the grammar. PHP escapes the source before
sending it to the browser. The frontend uses `Prism.tokenize` and DOM text
nodes, rather than inserting highlighted HTML through `innerHTML`.
Unsupported languages follow the same escaping path.

### Checking performance

By default, I've limited asset loading to the languages actually rendered and
their dependencies. The runtime is private to the plugin, doesn't scan
unrelated code, and doesn't fetch grammars from a CDN.

The numbers weren't an improvement across the board. In the earlier 4.0.0
benchmark, the TypeScript page went from 12,260 to 8,656 bytes of gzipped JS/CSS,
but median initialization went from 4.9 ms to 9.4 ms. Fewer bytes, slower setup.

The large KQL example took 85.0 ms, compared with 27.6 ms for the old plaintext
fallback. One side wasn't coloring KQL at all, so that's not a comparison of
two equivalent parsers. The
[performance report](https://github.com/saguiitay/syntaxhighlighter/blob/master/docs/performance.md)
has the method and full results. Those measurements predate Coy and the 4.0.2
layout fixes; I haven't rerun them for the current ZIP.

Very large snippets keep their complete, escaped source but skip coloring and
line decorations, with a visible notice. I'd rather have a readable query than
freeze the page trying to color it.

## What's next

The useful part of this update is fairly small: I can use KQL and TypeScript
without changing old posts. Most of the work was keeping code intact through
WordPress, the editor and the copy button.

I'll keep further updates with the
[GitHub fork](https://github.com/saguiitay/syntaxhighlighter). I hope to send the
more general grammar fixes upstream, after separating them from the WordPress
integration. For now, if you find a query that gets the wrong colors, a small,
sanitized example would help.

---

### Editorial notes

- SEO title: KQL syntax highlighting in WordPress with Prism.js
- Meta description: I've added Kusto Query Language highlighting to WordPress
  with Prism.js, while keeping existing SyntaxHighlighter blocks and shortcodes
  working.
- Social announcement: I've updated my WordPress syntax highlighter with KQL,
  TypeScript and JSON support. The interesting part was keeping old posts
  working, not adding another language.
- Suggested screenshots: Kusto selected in Gutenberg; a sample query in Coy
  light/dark modes; aligned numbers beside blank and wrapped lines; copied
  source without line numbers.
- Before publishing: push the reviewed source and documentation to the linked
  repository, check the query examples against the sample database, and add
  the final screenshots. This remains an unpublished editorial draft.
