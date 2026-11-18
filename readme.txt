=== SyntaxHighlighter Prism for WordPress ===
Contributors: saguiitay, Viper007Bond, automattic, donncha
Tags: code, syntax highlighting, typescript, kusto, prism
Requires at least: 7.0
Requires PHP: 8.2
Tested up to: 7.1
Stable tag: 4.0.2
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Local Prism highlighting for KQL, TypeScript, JSON, Power Query and more. Preserves existing SyntaxHighlighter Evolved content.

== Description ==

Display code examples with locally bundled Prism.js, including Kusto Query Language (KQL), TypeScript, TSX, JSON, Power Query (M), Rust and Markdown.

Use it for KQL examples from Microsoft Fabric Eventhouse and Azure Data Explorer, or for other source code on your site. The plugin highlights text; it does not execute code, run queries or connect to these services.

SyntaxHighlighter Prism is independently maintained and based on SyntaxHighlighter Evolved. It retains existing blocks, shortcodes and settings without a database migration or post resave. It is not maintained or released by Automattic.

= Features =

* A SyntaxHighlighter Code block with a searchable language selector and optional live syntax preview.
* Support for existing SyntaxHighlighter shortcodes and the Classic editor.
* Line numbers, highlighted lines, wrapping, collapsible snippets and a copy button.
* Bundled Prism themes, including Coy with light, dark and automatic appearance.
* On-demand frontend grammar loading by default, with no external grammar CDN.

= Usage =

In the block editor, add a SyntaxHighlighter Code block, choose a language and enter your code. Enable Show syntax preview to see highlighting while editing.

For shortcodes, use a language value such as `kql`, `typescript`, `json` or `powerquery`:

    [code language="kql"]
    StormEvents
    | take 10
    [/code]

Both `kql` and `kusto` mean Kusto Query Language, not Kibana Query Language.

Change site-wide defaults under Settings > SyntaxHighlighter. Individual blocks and shortcodes can override supported display options.

[Supported languages and compatibility notes](https://github.com/saguiitay/syntaxhighlighter/blob/master/docs/compatibility.md).

= Source and development =

Human-readable source, build instructions and issue tracking are available in the [GitHub repository](https://github.com/saguiitay/syntaxhighlighter). The installable plugin includes its built assets; your WordPress server does not need Node.js, npm or Composer.

== Installation ==

1. Back up your site and test the replacement on staging.
2. If SyntaxHighlighter Evolved is installed, deactivate it before activating this plugin. Do not run both together.
3. Upload the plugin ZIP through Plugins > Add New > Upload Plugin, install it, then activate SyntaxHighlighter Prism for WordPress.
4. Review Settings > SyntaxHighlighter and check existing posts. No content migration or post resave is needed.

== Frequently Asked Questions ==

= Can I replace SyntaxHighlighter Evolved without rewriting my posts? =

Yes. Existing blocks, shortcodes, settings and Classic editor encoding metadata are retained. Deactivate the original plugin first.

The appearance changes because Prism replaces the old highlighting engines. Custom legacy brushes, engine-specific extensions and theme CSS may need adaptation. See the compatibility notes linked above.

= Does this connect to Eventhouse or Azure Data Explorer? =

No. KQL support displays query text with syntax highlighting. It does not execute queries, authenticate to a service or send snippets to an external highlighting service.

= Why is my code visible without syntax colors? =

Check that you selected a supported language and that JavaScript is enabled. Your theme must call the standard WordPress hooks, including `wp_footer()`.

If highlighting fails only when an optimization plugin is active, temporarily disable its JavaScript/CSS optimization and check for loading-order or asset errors.

= Why does the copy button not work? =

Copying requires HTTPS or localhost and browser clipboard permission. If copying fails, the plugin provides instructions for selecting the code manually.

= Can I switch back to the original plugin? =

Deactivate this plugin, then reactivate SyntaxHighlighter Evolved. Existing content and settings remain in place. Languages and shortcode tags added by this plugin may not work in the original.

== Changelog ==

= 4.0.2 =

* Add JSON, Rust, Markdown and Power Query (M) to the language selector and shortcodes.
* Refine KQL strings, operators, numbers and durations against the official language lexer.
* Add selectable local Prism themes and a settings preview that follows unsaved changes.
* Fix live preview styling inside the block editor's iframe.
* Improve code spacing, blank-line numbering and gutter alignment.
* Use the syntaxhighlighter-prism translation domain and remove the external GitHub update override.
* Require WordPress 7.0+ and PHP 8.2+.

= 4.0.1 =

* Use locally bundled Prism Coy styling, scoped to this plugin.
* Retain line controls, scrolling, wrapping and dark/automatic appearance.

= 4.0.0 =

* Replace the old highlighting engines with locally bundled Prism.js 1.30.0.
* Add TypeScript, TSX and Kusto Query Language support.
* Preserve stored blocks, shortcodes and settings without a migration.
* Add optional editor preview, source copying and configurable line controls.

== Upgrade Notice ==

= 4.0.2 =

Deactivate SyntaxHighlighter Evolved before activating this plugin. Existing content is retained, but themes and custom legacy brushes should be checked on staging.

== Credits ==

Based on SyntaxHighlighter Evolved by Alex Mills (Viper007Bond), Automattic, donncha and other contributors. Earlier release history and individual contributor acknowledgments are available in the [upstream repository](https://github.com/Automattic/syntaxhighlighter) and this project's Git history.

Syntax highlighting uses [Prism.js](https://prismjs.com/), distributed under the MIT license. Original attribution and bundled-library notices are retained; see the [third-party licenses](https://github.com/saguiitay/syntaxhighlighter/blob/master/docs/third-party-licenses.md).
