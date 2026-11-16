<?php
require '/wordpress/wp-load.php';
wp_set_current_user( 1 );
$root = WP_PLUGIN_DIR . '/syntaxhighlighter-prism';
require $root . '/tests/php/assertions.php';
$plugin = $GLOBALS['SyntaxHighlighter'];
$rendered = sh_run_tests( $plugin );
$plugin->codeformat = false;
$legacy_pre = $plugin->convert_legacy_pre( '<pre class="brush: js; first-line: 20; highlight: [20-21];">&lt;script&gt;literal&lt;/script&gt;</pre>' );
sh_assert( '<script>literal</script>' === sh_source( $legacy_pre ) && false !== strpos( $legacy_pre, 'data-firstline="20"' ), 'Legacy direct pre adapter.' );
$fixtures = json_decode( file_get_contents( $root . '/tests/fixtures/legacy-content.json' ), true );
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
