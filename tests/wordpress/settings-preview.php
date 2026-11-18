<?php
require '/wordpress/wp-load.php';
wp_set_current_user( 1 );
require dirname( __DIR__ ) . '/php/assertions.php';
$plugin = $GLOBALS['SyntaxHighlighter'];
$original = $plugin->settings;
$original_format = $plugin->codeformat;
$saved = get_option( 'syntaxhighlighter_settings' );
try {
	$plugin->codeformat = 2;
	$selected = array_merge( $original, array(
		'theme' => 'prism-okaidia', 'title' => 'Preview title', 'firstline' => 42,
		'padlinenumbers' => 3, 'tabsize' => 8, 'gutter' => 0, 'copy' => 0,
		'toolbar' => 1, 'smarttabs' => 0, 'autolinks' => 0, 'wraplines' => 0,
		'quickcode' => 0,
	) );
	$html = $plugin->settings_preview( $selected );
	sh_assert( false !== strpos( $html, 'sh-theme-prism-okaidia' ), 'Preview ignored the selected theme.' );
	sh_assert( false !== strpos( $html, '<div class="sh-title">Preview title</div>' ), 'Preview ignored the title.' );
	foreach ( array(
		'firstline' => '42', 'padlinenumbers' => '3', 'tabsize' => '8',
		'gutter' => 'false', 'smarttabs' => 'false', 'autolinks' => 'false',
		'quickcode' => 'false', 'htmlscript' => 'false', 'highlight' => '',
	) as $key => $value ) {
		sh_assert( false !== strpos( $html, 'data-' . $key . '="' . $value . '"' ), 'Preview ignored ' . $key );
	}
	sh_assert( false === strpos( $html, 'class="sh-copy"' ), 'Toolbar forced a disabled copy button back on.' );
	sh_assert( false === strpos( $html, ' sh-wrap' ), 'Preview ignored disabled wrapping.' );
	sh_assert( 2 === $plugin->codeformat && $original === $plugin->settings, 'Preview leaked temporary rendering state.' );
	sh_assert( $saved === get_option( 'syntaxhighlighter_settings' ), 'Unsaved preview changed the database.' );

	$selected['collapse'] = 1;
	$html = $plugin->settings_preview( $selected );
	sh_assert( false !== strpos( $html, '<summary>Preview title</summary>' ), 'Preview ignored collapsing.' );
	$selected['light'] = 1;
	$selected['gutter'] = 1;
	$selected['copy'] = 1;
	$html = $plugin->settings_preview( $selected );
	sh_assert( false !== strpos( $html, 'data-gutter="false"' ) && false === strpos( $html, 'class="sh-controls"' ), 'Compact mode did not use production option normalization.' );

	$filter = static function () { return '[sourcecode language="kql"]StormEvents | take 1[/sourcecode]'; };
	add_filter( 'syntaxhighlighter_democode', $filter );
	try {
		$html = $plugin->settings_preview();
		sh_assert( 'StormEvents | take 1' === sh_source( $html ) && false !== strpos( $html, 'language-kusto' ), 'Demo customization filter was lost.' );
	} finally {
		remove_filter( 'syntaxhighlighter_democode', $filter );
	}
	$filter = static function () { throw new RuntimeException( 'Preview filter failure' ); };
	add_filter( 'syntaxhighlighter_democode', $filter );
	try {
		$plugin->settings_preview( $selected );
		sh_assert( false, 'Preview unexpectedly swallowed the filter failure.' );
	} catch ( RuntimeException $error ) {
		sh_assert( 'Preview filter failure' === $error->getMessage(), 'Unexpected preview failure.' );
	} finally {
		remove_filter( 'syntaxhighlighter_democode', $filter );
	}
	sh_assert( 2 === $plugin->codeformat && $original === $plugin->settings, 'Failed preview leaked rendering state.' );

	require_once ABSPATH . 'wp-admin/includes/admin.php';
	$plugin->settings = array_merge( $original, array( 'collapse' => 1, 'copy' => 1, 'toolbar' => 1, 'title' => 'Filtered preview' ) );
	$source = '<?php echo "<script>literal & [gallery]</script>"; ?>';
	$demo_filter = static function () use ( $source ) {
		return '<img src="x" onerror="shPreviewInjected()"><script data-preview-unsafe>shPreviewInjected()</script>'
			. '[sourcecode language="php"]' . $source . '[/sourcecode]';
	};
	$translation_filter = static function ( $translation, $text ) {
		return 0 === strpos( $text, 'These are the parameters you can pass' ) ? '<img src=x onerror=shTranslationInjected()>' . $text : $translation;
	};
	add_filter( 'syntaxhighlighter_democode', $demo_filter );
	add_filter( 'gettext_syntaxhighlighter-prism', $translation_filter, 10, 2 );
	ob_start();
	try {
		$plugin->settings_page();
		$page = ob_get_contents();
	} finally {
		ob_end_clean();
		remove_filter( 'syntaxhighlighter_democode', $demo_filter );
		remove_filter( 'gettext_syntaxhighlighter-prism', $translation_filter, 10 );
	}
	sh_assert( false === strpos( $page, '<script data-preview-unsafe' ) && false === strpos( $page, 'onerror="shPreviewInjected()"' ), 'Settings preview emitted executable filtered HTML.' );
	preg_match( '#<pre\b[^>]*>[\s\S]*?</pre>#', $page, $preview_markup );
	sh_assert( $source === sh_source( $preview_markup[0] ?? '' ), 'Late preview escaping changed literal code.' );
	sh_assert( false !== strpos( $page, '<details class="sh-collapse"><summary>Filtered preview</summary>' ), 'Late preview escaping removed collapse controls.' );
	sh_assert( false !== strpos( $page, '<button type="button" class="sh-copy" hidden>' ), 'Late preview escaping removed the copy button.' );
	sh_assert( false !== strpos( $page, 'tabindex="0"' ) && false !== strpos( $page, 'role="status" aria-live="polite"' ), 'Late preview escaping removed keyboard or status accessibility.' );
	sh_assert( false !== strpos( $page, 'data-firstline="' . $original['firstline'] . '"' ) && false !== strpos( $page, 'data-htmlscript="false"' ), 'Late preview escaping removed runtime options.' );
	sh_assert( false !== strpos( $page, '&lt;img src=x onerror=shTranslationInjected()&gt;' ), 'Shortcode help translation was not escaped.' );
	sh_assert( false !== strpos( $page, '<code>true</code>/<code>1</code>' ), 'Shortcode help lost its formatted examples.' );
} finally {
	$plugin->settings = $original;
	$plugin->codeformat = $original_format;
}
echo wp_json_encode( array( 'assertions' => $GLOBALS['sh_assertions'] ) );
