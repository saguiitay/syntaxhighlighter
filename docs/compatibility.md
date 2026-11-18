# Backward compatibility

## Storage and rendering

No migration or resave is needed. The registered block remains
`syntaxhighlighter/code`. The original `save.js`, `pre` source selector and
editable source schema remain; frontend markup is produced by the server.
Gutenberg validates legacy fixtures and re-saves literal source. WordPress may
canonicalize optional JSON defaults or equivalent HTML entities when saving,
as it normally does; byte-identical entire post serialization is not promised.
Code content and meaningful attributes are tested separately.

Existing attributes: `content`, `language`, `lineNumbers`, `firstLineNumber`
(string), `highlightLines`, `wrapLines`, `makeURLsClickable`, `quickCode`,
plus WordPress `className` and `align`. New optional `theme` and `collapse`
attributes only add comment JSON; they do not change saved markup.
No block deprecation is needed because the save format did not change.

Classic content keeps both raw format 1 and entity-encoded format 2, using
`_syntaxhighlighter_encoded` / `syntaxhighlighter_encoded`, widget flags and the
existing comment/BuddyPress adapters. Only format 2 is decoded before one safe
HTML escape. Blocks are decoded independently of Classic metadata. Serialized
code-block regions are protected from Classic parsing/encoding so examples
containing `[js]...[/js]` cannot be transformed accidentally.

Square brackets use the historical hexadecimal entity before WordPress's
second shortcode pass. Decimal `&#91;` is not equivalent here: WordPress
unescapes it internally. Regression tests exercise actual `[gallery]` content.
Raw CR characters are emitted as numeric references so the frontend DOM and
copy button can retain Classic mixed line endings. Editing through an HTML
textarea may normalize line endings, as in the original editor.
The clipboard API receives the original source; an operating-system clipboard
may normalize line endings (for example to CRLF on Windows).

The original URL anti-embed escaping remains in the unchanged save function.
The editor display/preview and frontend restore isolated `https:&#47;&#47;`
protocols. Intentionally typed numeric protocol entities are ambiguous in old
saved content; this historical representation cannot be inferred losslessly.
Valid UTF-8 is supported; invalid UTF-8 is replaced safely, not executed.

## Shortcodes

`code`, `sourcecode`, `source`, all original language-specific tags, and new
`ts`, `typescript`, `tsx`, `kql`, `kusto`, `sh`, `cs` tags are registered.
`json` and `rust` are also available as language values and standalone shortcodes.
Markdown supports both `markdown` and `md` language values and standalone tags.
Power Query (M) supports `powerquery`, `pq` and `mscript` values and tags.
`latex` and `r` remain **language values but not standalone shortcodes**,
matching the original collision exclusions; use `tex` and `splus` tags instead.
`language`, `lang`, `type` and historical `[code="php"]` identify languages.

Unknown languages now produce escaped plaintext, not the original unsafe raw
fallback. Empty blocks render a valid empty code container. Malformed/unclosed
shortcodes are ordinary WordPress content, not a supported code enclosure.
Escape such examples or put them inside a complete plugin code block.

### Complete bundled alias map

`languages.json` is the authoritative machine-readable inventory, including
new canonical Prism identifiers. Original aliases are all retained:

| Aliases | Prism grammar |
|---|---|
| as3, actionscript3, actionscript | actionscript |
| arduino | arduino |
| bash, shell, sh | bash |
| coldfusion, cf, cfscript | cfscript |
| clojure, clj | clojure |
| cpp, c | cpp (which loads c) |
| c-sharp, csharp, cs | csharp |
| css | css |
| delphi, pas, pascal | pascal |
| diff, patch | diff |
| erl, erlang | erlang |
| fsharp | fsharp |
| go, golang | go |
| groovy | groovy |
| haskell | haskell |
| java, jfx, javafx | java |
| js, jscript, javascript | javascript |
| json | json |
| ts, typescript | typescript |
| tsx | tsx, with jsx/typescript dependencies |
| kql, kusto | kusto |
| latex, tex | latex |
| markdown, md | markdown |
| matlab, matlabkey | matlab |
| objc, obj-c, objectivec | objectivec |
| perl, pl | perl |
| php | php |
| plain, text, none | escaped plaintext |
| powerquery, pq, mscript | powerquery |
| ps, powershell | powershell |
| py, python | python |
| r, splus | r |
| rails, rb, ror, ruby | ruby |
| rust | rust |
| scala | scala |
| sql | sql |
| swift | swift |
| vb, vbnet | vbnet |
| xml, xhtml, xslt, html, markup | markup |
| yaml, yml | yaml |

JavaFX uses Java as the nearest maintained Prism equivalent. ColdFusion uses
CFScript; tag-based CFML will not have identical coloring. MATLAB/R/LaTeX and
the other third-party legacy brush languages have native Prism equivalents.
Colors and token classification necessarily differ from SyntaxHighlighter.

### KQL grammar updates

The local Kusto extension builds on
[RunDevelopment/prism#3](https://github.com/RunDevelopment/prism/pull/3),
revision `7df2d65a518a5a5f84ef25a1bea623e19a5a8e53`, without upgrading
Prism 1.30.0 or downloading code at runtime. It includes query/graph keywords,
correct string operators and `in~`/`!in~`, escaped and obfuscated verbatim
strings, scalar type aliases, boolean spellings, uppercase function names,
line-leading management commands and complete `<|`/`<>` operators.
Further refinements follow the official Kusto.Language
[lexer](https://github.com/microsoft/Kusto-Query-Language/blob/master/src/Kusto.Language/Parser/TokenParser.cs)
and [syntax facts](https://github.com/microsoft/Kusto-Query-Language/blob/master/src/Kusto.Language/Syntax/SyntaxFacts.cs):

- Both multiline string delimiters (triple backticks and triple tildes),
  including `h`/`H` prefixes, protect their contents from other token rules.
- Typed datetime, timespan, numeric, boolean and GUID literals stay whole;
  raw GUIDs, uppercase hexadecimal prefixes, trailing decimal dots and
  exponents are recognized without coloring parts of identifiers.
- Query aliases such as `filter`, `mvapply` and `mvexpand`, additional query
  options/render modes, complete negated word operators and known `hint.*`
  parameters have explicit rules. Arbitrary words after a pipe are not keywords.
- `$left`/`$right` and other dollar identifiers, dotted properties and callable
  `count()`/`range()` are distinguished from ordinary scalar keywords.
  Bare `null` is a keyword, not a boolean literal.
- Timespan suffixes follow the lexer, including `hr`, `hrs`, `milli`, `micros`
  and `nanos`. Previously colored `us`, `ns` and micro-sign `s` abbreviations
  are not lexer suffixes and no longer receive timespan coloring; use
  `microsecond`/`nanosecond` spellings instead.

This remains a regex-based highlighter, not the official parser or a query
validator. Context-dependent names, syntax recovery and semantic validity are
not reproduced, and typed-literal rules intentionally do not balance nested
expressions. These changes affect colors only: saved and copied source is
unchanged. No Kusto.Language binaries or source files are bundled.

## Legacy option matrix

| Option / setting | Prism behavior / difference |
|---|---|
| language, lang, type, unnamed language | Alias resolution above; unknown becomes safe plain |
| firstline | Starting displayed number; bounded -1,000,000 to 1,000,000 |
| gutter | Line numbers using CSS-generated decorations; no numbers in code text |
| highlight | Comma-separated lines/ranges in displayed numbering; checked per actual line, never expanded into an enormous PHP array |
| collapse | Native details/summary, keyboard and JS-disabled compatible; independent of toolbar |
| title | Escaped text above source or in collapse summary; no HTML |
| autolinks | HTTP/HTTPS only, DOM-created links; displayed/copied text unchanged |
| toolbar | Modern copy controls, not Flash/print/about UI |
| copy (new) | Copy button independently enabled by default; `light` disables controls |
| wraplines | Real pre-wrap in Prism, including former v3 content; false scrolls horizontally |
| quickcode | Double-click selects source, not a writable fake editing mode |
| light | Legacy compact mode: gutter and controls off; **not** the color theme |
| classname | ASCII class tokens only; preserved on the pre |
| fontsize | Percentage, clamped to 50-200 for a usable layout |
| padlinenumbers | false, true (automatic), or width up to 12 |
| tabsize | Native tab stops; clamped 1-16 |
| smarttabs | true uses tab stops; false uses fixed-width tab spans, retaining literal tab text |
| htmlscript | PHP's native mixed-markup grammar; JS/CSS use local markup with embedded script/style grammar. Other languages retain native highlighting, not a general mixed-language parser |
| theme | Site-wide Prism theme selection, inherited unless overridden per block/shortcode. default/eclipse -> Coy light; django/emacs/fadetogrey/midnight/rdark -> Coy dark; auto follows system; none removes token colors |
| shversion | Stored unchanged for rollback; no old engine is shipped/selected |
| loadallbrushes | Explicit opt-out of conditional loading: queues all bundled grammars |

The option key remains `syntaxhighlighter_settings`. Legacy theme names are
preserved when settings are saved, rather than overwriting them with the mapped
color mode. New installations default to automatic theme and copying.
Existing `wraplines=true` now genuinely wraps in Prism; this was ineffective in
the old v3 engine. Set false for the old horizontal-scroll appearance.

Inputs beyond the highlighting limits show a visible fallback notice. The full
code is retained; colors, line decorations and auto-link enhancement are skipped.
Without JS, all source remains escaped/readable, native collapse works, and
visual line/token enhancements are absent.

## Extension points

| Original hook | Status |
|---|---|
| syntaxhighlighter_defaultsettings | Retained, same option structure plus copy |
| syntaxhighlighter_brushes | Retained alias-to-legacy-brush adapter, including overrides to bundled grammars |
| syntaxhighlighter_brush_names | Retained editor labels |
| syntaxhighlighter_shortcodes | Retained tag additions/removals |
| syntaxhighlighter_themes | Retained selector entries; registered `syntaxhighlighter-theme-*` styles are enqueued, but CSS must target the new markup |
| syntaxhighlighter_specialchars | Retained Classic encoding adapter |
| syntaxhighlighter_pre_getcodeformat, syntaxhighlighter_getcodeformat | Retained |
| syntaxhighlighter_precode | Retained before normalization/escaping |
| syntaxhighlighter_shortcodeatts | Retained complete legacy default keys; validated again afterward |
| syntaxhighlighter_cssclasses | Retained, now an array of real pre classes, **not engine parameter strings** |
| syntaxhighlighter_htmlresult | Retained final HTML filter; trusted PHP extensions remain responsible for their output |
| syntaxhighlighter_csscoreurl | Retained for the single scoped stylesheet |
| syntaxhighlighter_after_script_output | Retained footer notification; dependencies finish printing in WordPress's normal footer script phase |
| syntaxhighlighter_democode | Retained settings preview |
| syntaxhighlighter_allowedatts | Obsolete engine parameter schema; not invoked. Add behavior explicitly in the renderer; arbitrary engine class parameters no longer execute |
| syntaxhighlighter_cssthemeurl | Obsolete separate bundled theme files; use csscoreurl or a registered custom theme stylesheet |
| syntaxhighlighter_clipboardurl | Removed Flash-only behavior; use the browser clipboard |

New `syntaxhighlighter_prism_aliases` filters the final alias => bundled grammar
map, shared with the editor. Values not in the build manifest become plain.
Old custom brush scripts cannot run on Prism; add a reviewed local Prism
component to the build and manifest, then map its aliases. No browser autoloader
downloads unknown code. Removing a tag through legacy filters does not remove a
canonical language value from the shipped alias map; remove/remap it with the
new final-map filter if that is required.

Direct legacy `<pre class="brush: js; first-line: 20;">` markup in post content
is adapted server-side after blocks render. Code emitted directly by a PHP
template must call the render API, for example:

```php
$highlighter = $GLOBALS['SyntaxHighlighter'];
echo $highlighter->prism->render(
    $source,
    $highlighter->prism->language( 'kql' ),
    array()
);
```

This explicit API always takes raw text and a resolved language. The older
`shortcode_callback()` instead respects the current post's encoding metadata.
Do not construct unescaped pre HTML.

## Replacement identity

The global class/function and `$SyntaxHighlighter` are compatibility contracts.
The fork therefore replaces, not supplements, the original plugin. Activation
refuses to proceed if the original class is already loaded; on a conflicting
existing installation it skips this fork and reports an admin notice. WordPress
activation also rejects loading the unguarded original class after the fork.
Do not install both as active network/site plugins.

The distributable directory and Update URI are distinct. No automatic upstream
WordPress.org update, database upgrade, public release or publishing step exists.
