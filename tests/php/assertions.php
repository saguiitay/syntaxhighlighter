<?php
function sh_assert( $condition, $message ) {
	$GLOBALS['sh_assertions'] = ( $GLOBALS['sh_assertions'] ?? 0 ) + 1;
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
}
function sh_source( $html ) {
	preg_match( '#<code\b[^>]*>([\s\S]*?)</code>#', $html, $matches );
	return html_entity_decode( str_replace( '&#13;', "\r", $matches[1] ?? '' ), ENT_QUOTES | ENT_HTML5, 'UTF-8' );
}
function sh_run_tests( $plugin ) {
	$plugin_root = defined( 'SH_TEST_PLUGIN_ROOT' ) ? SH_TEST_PLUGIN_ROOT : dirname( __DIR__, 2 );
	$manifest = json_decode( file_get_contents( $plugin_root . '/dist/manifest.json' ), true );
	foreach ( $manifest['aliases'] as $alias => $language ) {
		sh_assert( $plugin->prism->language( $alias ) === $language, 'Alias: ' . $alias );
	}
	foreach ( array( 'unknown', '"><script>', '', array( 'js' ) ) as $bad ) {
		sh_assert( 'plain' === $plugin->prism->language( $bad ), 'Unknown language must be plain.' );
	}
	$original_brush = $plugin->brushes['js'];
	$plugin->brushes['js'] = 'python';
	sh_assert( 'python' === $plugin->prism->language( 'js' ), 'Legacy alias override was ignored.' );
	$plugin->brushes['js'] = $original_brush;
	$plugin->codeformat = 1;
	$payloads = array(
		'<script>alert("xss")</script>',
		'<img src=x onerror=alert(1)>',
		'const html = \'<script>alert("xss")</script>\';',
		'&lt;literal&gt; &amp; "quotes" [gallery] [js]nested[/js]',
		"λ → 日本語\r\n\ttabs\rmixed\n",
		'',
		str_repeat( 'x', 250000 ),
	);
	$rendered = array();
	foreach ( $payloads as $index => $source ) {
		$html = $plugin->shortcode_callback( array( 'language' => $index % 2 ? 'unknown' : 'typescript' ), $source, 'code' );
		sh_assert( sh_source( $html ) === $source, 'Raw source bytes changed: ' . $index );
		sh_assert( false === strpos( $html, '<script>' ) && false === strpos( $html, '<img ' ), 'Executable source leaked.' );
		$rendered[] = array( 'name' => 'raw-' . $index, 'html' => $html, 'source' => $source );
	}
	$fixtures = json_decode( file_get_contents( dirname( __DIR__ ) . '/fixtures/legacy-content.json' ), true );
	foreach ( $fixtures['shortcodes'] as $fixture ) {
		preg_match( '/^\[([^\s\]]+)[^\]]*\]([\s\S]*)\[\/[^\]]+\]$/', $fixture['content'], $parts );
		$plugin->codeformat = $fixture['format'];
		$html = $plugin->shortcode_callback( array( 'language' => 'plain' ), $parts[2], 'code' );
		sh_assert( sh_source( $html ) === $fixture['source'], 'Classic fixture: ' . $fixture['name'] );
	}
	$plugin->codeformat = 2;
	foreach ( $fixtures['blocks'] as $fixture ) {
		preg_match( '#<pre\b[^>]*>[\s\S]*?</pre>#', $fixture['serialized'], $saved );
		$html = $plugin->render_block( array( 'language' => 'plain' ), $saved[0] );
		sh_assert( sh_source( $html ) === $fixture['source'], 'Block fixture: ' . $fixture['name'] );
		sh_assert( 2 === $plugin->codeformat, 'Block leaked codeformat state.' );
		$rendered[] = array( 'name' => $fixture['name'], 'html' => $html, 'source' => $fixture['source'] );
	}
	$plugin->codeformat = 1;
	$options = array(
		'language' => 'kql', 'firstline' => '42', 'highlight' => '42,44-999999999',
		'gutter' => false, 'collapse' => true, 'wraplines' => true, 'autolinks' => false,
		'classname' => 'ok" onclick="alert(1)', 'title' => '<img src=x onerror=alert(1)>Hello',
		'padlinenumbers' => 99999, 'tabsize' => -5, 'fontsize' => 10000,
	);
	$html = $plugin->shortcode_callback( $options, "StormEvents\n| take 1", 'code' );
	sh_assert( false !== strpos( $html, 'data-gutter="false"' ), 'Boolean false lost.' );
	sh_assert( false !== strpos( $html, '<details' ) && false !== strpos( $html, '<summary>Hello</summary>' ), 'Accessible collapse/title.' );
	sh_assert( false !== strpos( $html, 'data-tabsize="1"' ) && false !== strpos( $html, 'data-fontsize="200"' ), 'Bounds not enforced.' );
	sh_assert( false === strpos( $html, '" onclick="' ), 'Attribute injection.' );
	sh_assert( false !== strpos( $html, 'language-kusto' ), 'KQL mapping.' );
	$rendered[] = array( 'name' => 'options', 'html' => $html, 'source' => "StormEvents\n| take 1" );
	sh_assert( 'dark' === $plugin->prism->options( array( 'theme' => 'midnight' ) )['theme'], 'Legacy theme adapter.' );
	sh_assert( false === $plugin->prism->options( array( 'light' => true ) )['gutter'], 'Legacy light mode.' );
	foreach ( array( 'ts', 'typescript', 'tsx', 'kql', 'kusto' ) as $tag ) {
		sh_assert( in_array( $tag, $plugin->shortcodes, true ), 'New language shortcode missing.' );
	}
	sh_run_rust_tests( $plugin );
	return $rendered;
}

function sh_run_rust_tests( $plugin ) {
	$previous_format = $plugin->codeformat;
	$source = "fn main() {\n\tprintln!(\"<Rust>\");\n}";
	try {
		$plugin->codeformat = 1;
		sh_assert( in_array( 'rust', $plugin->shortcodes, true ), 'Rust shortcode was not registered.' );
		foreach ( array(
			array( array(), 'rust' ),
			array( array( 'language' => 'rust' ), 'code' ),
		) as $shortcode ) {
			$html = $plugin->shortcode_callback( $shortcode[0], $source, $shortcode[1] );
			sh_assert( false !== strpos( $html, 'language-rust' ), 'Rust shortcode did not select its grammar.' );
			sh_assert( $source === sh_source( $html ), 'Rust shortcode source was changed.' );
		}
		$html = $plugin->render_block( array( 'language' => 'rust' ), '<pre>' . htmlspecialchars( $source, ENT_QUOTES, 'UTF-8' ) . '</pre>' );
		sh_assert( false !== strpos( $html, 'language-rust' ), 'Rust block did not select its grammar.' );
		sh_assert( $source === sh_source( $html ), 'Rust block source was changed.' );
		sh_assert( wp_script_is( 'syntaxhighlighter-prism-rust', 'enqueued' ), 'Rust grammar was not enqueued.' );
	} finally {
		$plugin->codeformat = $previous_format;
	}
}
