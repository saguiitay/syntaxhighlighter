<?php
require '/wordpress/wp-load.php';
wp_set_current_user( 1 );
$root = WP_PLUGIN_DIR . '/syntaxhighlighter-prism';
define( 'SH_TEST_PLUGIN_ROOT', $root );
$suite = dirname( __DIR__ );
require $suite . '/php/assertions.php';
$plugin = $GLOBALS['SyntaxHighlighter'];
sh_run_editor_adapter_tests( $plugin );
$rendered = sh_run_tests( $plugin );
$plugin->codeformat = false;
$legacy_pre = $plugin->convert_legacy_pre( '<pre class="brush: js; first-line: 20; highlight: [20-21];">&lt;script&gt;literal&lt;/script&gt;</pre>' );
sh_assert( '<script>literal</script>' === sh_source( $legacy_pre ) && false !== strpos( $legacy_pre, 'data-firstline="20"' ), 'Legacy direct pre adapter.' );
$fixtures = json_decode( file_get_contents( $suite . '/fixtures/legacy-content.json' ), true );
$nested_source = '[js]<img src=x onerror=alert(1)>[/js] [code]&amp; literal[/code]';
$nested_saved = '<!-- wp:syntaxhighlighter/code {"language":"plain"} -->' . "\n" . '<pre class="wp-block-syntaxhighlighter-code">' . htmlspecialchars( $nested_source, ENT_NOQUOTES, 'UTF-8' ) . '</pre>' . "\n" . '<!-- /wp:syntaxhighlighter/code -->';
sh_assert( $nested_saved === $plugin->encode_shortcode_contents( $nested_saved ), 'Classic save filter must not re-encode serialized block source.' );
$plugin->codeformat = false;
sh_assert( $nested_source === sh_source( apply_filters( 'the_content', $nested_saved ) ), 'Classic rendering must not parse shortcodes inside block source.' );
foreach ( $fixtures['shortcodes'] as $fixture ) {
	$id = wp_insert_post( array( 'post_title' => $fixture['name'], 'post_status' => 'publish', 'post_content' => wp_slash( $fixture['content'] ) ), true );
	sh_assert( ! is_wp_error( $id ), 'Fixture post save failed.' );
	if ( 2 === $fixture['format'] ) { update_post_meta( $id, '_syntaxhighlighter_encoded', 1 ); }
	$GLOBALS['post'] = get_post( $id );
	$html = apply_filters( 'the_content', $GLOBALS['post']->post_content );
	sh_assert( sh_source( $html ) === $fixture['source'], 'Real shortcode parser: ' . $fixture['name'] . ' ' . wp_json_encode( sh_source( $html ) ) );
}
foreach ( $fixtures['blocks'] as $fixture ) {
	$html = do_blocks( $fixture['serialized'] );
	sh_assert( sh_source( $html ) === $fixture['source'], 'Real block parser: ' . $fixture['name'] );
}
$plugin->codeformat = 1;
$encoded = $plugin->encode_shortcode_contents( '[code language="html"]<script>alert(1)</script> &amp; [gallery][/code]' );
$plugin->codeformat = 2;
sh_assert( '<script>alert(1)</script> &amp; [gallery]' === sh_source( $plugin->parse_shortcodes( $encoded ) ), 'Classic encode/decode storage boundary.' );
$classic_sources = array(
	'<?php echo "[gallery] <strong>literal</strong>"; ?>',
	'<div data-template="<?php echo $value; ?>">[gallery] &amp;</div>',
);
foreach ( $classic_sources as $source ) {
	$shortcode = '[code language="php"]' . $source . '[/code]';
	$encoded = $plugin->encode_shortcode_contents( $shortcode );
	$decoded = $plugin->decode_shortcode_contents( $encoded );
	preg_match( '/' . get_shortcode_regex( array( 'code' ) ) . '/', $decoded, $decoded_match );
	sh_assert( $source === ( $decoded_match[5] ?? null ), 'Classic PHP/HTML save and edit round trip.' );
	$plugin->codeformat = 2;
	sh_assert( $source === sh_source( $plugin->parse_shortcodes( $encoded ) ), 'Classic PHP/HTML rendered source changed.' );
	$escaped = '[' . $shortcode . ']';
	sh_assert( $escaped === $plugin->encode_shortcode_contents( $escaped ) && $escaped === $plugin->decode_shortcode_contents( $escaped ), 'Escaped Classic examples must remain literal.' );
}
$other_calls = 0;
$other_callback = static function () use ( &$other_calls ) { ++$other_calls; return 'Other shortcode executed'; };
add_shortcode( 'sh_other', $other_callback );
try {
	$other = '[sh_other][code]literal example[/code][/sh_other]';
	$encoded = $plugin->encode_shortcode_contents( $other . '[code]real code[/code]' );
	sh_assert( 0 === $other_calls && 0 === strpos( $encoded, $other ), 'Classic encoding executed or modified another shortcode.' );
	sh_assert( 'Other shortcode executed' === do_shortcode( '[sh_other]test[/sh_other]' ) && 1 === $other_calls, 'Classic encoding did not restore another shortcode handler.' );
} finally {
	remove_shortcode( 'sh_other' );
}
$pre_filter = static function ( $output, $tag, $atts, $match ) {
	return 'code' === $tag && 'pre-hook' === ( $match[5] ?? null ) ? 'Handled before encoding' : $output;
};
$post_filter = static function ( $output, $tag ) {
	return 'code' === $tag ? $output . '<!-- shortcode hook -->' : $output;
};
add_filter( 'pre_do_shortcode_tag', $pre_filter, 10, 4 );
add_filter( 'do_shortcode_tag', $post_filter, 10, 2 );
try {
	sh_assert( 'Handled before encoding' === $plugin->encode_shortcode_contents( '[code]pre-hook[/code]' ), 'Classic encoding ignored the pre-shortcode hook.' );
	sh_assert( '[code]post-hook[/code]<!-- shortcode hook -->' === $plugin->encode_shortcode_contents( '[code]post-hook[/code]' ), 'Classic encoding ignored the post-shortcode hook.' );
} finally {
	remove_filter( 'pre_do_shortcode_tag', $pre_filter, 10 );
	remove_filter( 'do_shortcode_tag', $post_filter, 10 );
}
$plugin->codeformat = false;
$plugin->settings['theme'] = 'auto';
$post_content = '<!-- wp:group --><div class="wp-block-group">' . $fixtures['blocks'][0]['serialized'] . '</div><!-- /wp:group -->';
$post_content .= "\n[code language=\"typescript\" firstline=\"10\" highlight=\"11\"]interface Box<T> {\n\tvalue: T;\n}[/code]";
$post_content .= "\n[kql]StormEvents\n| where StartTime > ago(7d)\n| summarize count() by State[/kql]";
$id = wp_insert_post( array( 'post_title' => 'Prism integration', 'post_status' => 'publish', 'post_content' => $post_content ) );
update_post_meta( $id, '_syntaxhighlighter_encoded', 1 );
$empty = wp_insert_post( array( 'post_title' => 'No code', 'post_status' => 'publish', 'post_content' => 'A page without code.' ) );
$editor = wp_insert_post( array( 'post_title' => 'Legacy editor fixture', 'post_status' => 'draft', 'post_content' => $fixtures['blocks'][0]['serialized'] ) );
$reusable = wp_insert_post( array( 'post_type' => 'wp_block', 'post_status' => 'publish', 'post_title' => 'Reusable code', 'post_content' => $fixtures['blocks'][0]['serialized'] ) );
$nested = do_blocks( '<!-- wp:group --><div class="wp-block-group"><!-- wp:block {"ref":' . $reusable . '} /--></div><!-- /wp:group -->' );
sh_assert( false !== strpos( $nested, 'syntaxhighlighter-code' ), 'Nested reusable block not rendered.' );
$old_settings = get_option( 'syntaxhighlighter_settings' );
update_option( 'syntaxhighlighter_settings', array( 'theme' => 'midnight', 'firstline' => 17, 'gutter' => 0 ) );
$other = new SyntaxHighlighter();
sh_assert( 17 === $other->settings['firstline'] && 'midnight' === $other->settings['theme'], 'Existing option key not loaded.' );
if ( false === $old_settings ) { delete_option( 'syntaxhighlighter_settings' ); } else { update_option( 'syntaxhighlighter_settings', $old_settings ); }
$subscriber = wp_insert_user( array( 'user_login' => 'prism-reader', 'user_pass' => wp_generate_password(), 'role' => 'subscriber' ) );
wp_set_current_user( $subscriber );
sh_assert( $plugin->settings === $plugin->validate_settings( array( 'title' => 'unauthorized' ) ), 'Subscriber settings boundary.' );
wp_set_current_user( 1 );
echo wp_json_encode( array(
	'wordpress' => get_bloginfo( 'version' ), 'php' => PHP_VERSION,
	'assertions' => $GLOBALS['sh_assertions'],
	'post' => $id, 'empty' => $empty, 'editor' => $editor, 'reusable' => $reusable,
) );
