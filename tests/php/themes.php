<?php
function sh_run_theme_tests( $plugin ) {
	$original = $plugin->settings;
	$manifest = json_decode( file_get_contents( dirname( __DIR__, 2 ) . '/dist/manifest.json' ), true );
	$first = true;
	try {
		foreach ( $manifest['themes'] as $theme => $name ) {
			$settings = $plugin->validate_settings( array_merge( $original, array( 'theme' => $theme ) ) );
			sh_assert( $theme === $settings['theme'], 'Selected theme was not saved: ' . $theme );
			$plugin->settings = $settings;
			$html = $plugin->shortcode_callback( array( 'language' => 'csharp' ), 'int count = 1;', 'code' );
			sh_assert( false !== strpos( $html, 'sh-theme-' . $theme ), 'Shortcode did not inherit the site theme: ' . $theme );
			$html = $plugin->render_block( array( 'language' => 'csharp' ), '<pre>int count = 1;</pre>' );
			sh_assert( false !== strpos( $html, 'sh-theme-' . $theme ), 'Block did not inherit the site theme: ' . $theme );
			sh_assert( wp_style_is( 'syntaxhighlighter-theme-' . $theme, 'enqueued' ), 'Selected stylesheet was not enqueued: ' . $theme );
			if ( $first ) {
				foreach ( array_keys( $manifest['themes'] ) as $other ) {
					if ( $other !== $theme ) {
						sh_assert( ! wp_style_is( 'syntaxhighlighter-theme-' . $other, 'enqueued' ), 'Unused theme stylesheet was enqueued: ' . $other );
					}
				}
				$first = false;
			}
			$html = $plugin->render_block( array( 'language' => 'csharp', 'theme' => 'light' ), '<pre>int count = 1;</pre>' );
			sh_assert( false !== strpos( $html, 'sh-theme-light' ), 'Block theme did not override the site default.' );
		}
		$plugin->settings = $original;
		$settings = $plugin->validate_settings( array( 'theme' => 'midnight' ) );
		sh_assert( 'midnight' === $settings['theme'], 'Legacy theme was not retained for rollback.' );
		sh_assert( 'dark' === $plugin->prism->options( array( 'theme' => 'midnight' ) )['theme'], 'Legacy theme did not resolve to Coy dark.' );
		sh_assert( 'auto' === $plugin->prism->options( array( 'theme' => '../../outside' ) )['theme'], 'Unknown theme was not rejected.' );
		$plugin->prism->footer();
		foreach ( array_keys( $manifest['themes'] ) as $theme ) {
			sh_assert( in_array( 'syntaxhighlighter-theme-' . $theme, $GLOBALS['sh_printed_styles'], true ), 'Footer omitted a rendered theme: ' . $theme );
		}
		$plugin->enqueue_block_editor_assets();
		$scripts = $GLOBALS['sh_inline_scripts']['syntaxhighlighter-blocks'];
		$data = end( $scripts );
		foreach ( $manifest['themes'] as $theme => $name ) {
			sh_assert( false !== strpos( $data, wp_json_encode( $theme ) . ':' . wp_json_encode( $name ) ), 'Block editor did not receive a theme choice: ' . $theme );
		}
	} finally {
		$plugin->settings = $original;
	}
}
