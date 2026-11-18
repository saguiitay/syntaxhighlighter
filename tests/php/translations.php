<?php
function sh_run_translation_tests( $plugin ) {
	$original = $GLOBALS['sh_translations'];
	$GLOBALS['sh_translations'] = array(
		'syntaxhighlighter' => array( 'Copy code' => 'Legacy copy label' ),
		'syntaxhighlighter-prism' => array(
			'Copy code' => 'Copier le code',
			'Show code' => 'Afficher le code',
			'Automatic (Coy light/dark)' => 'Automatique',
		),
	);
	try {
		$source = "StormEvents\n| take 1";
		$html = $plugin->shortcode_callback( array(
			'language' => 'kql', 'copy' => true, 'collapse' => true, 'title' => '',
		), $source, 'code' );
		sh_assert( false !== strpos( $html, '>Copier le code</button>' ), 'Copy button did not use this plugin\'s translation catalog.' );
		sh_assert( false !== strpos( $html, '<summary>Afficher le code</summary>' ), 'Collapse label did not use this plugin\'s translation catalog.' );
		sh_assert( $source === sh_source( $html ), 'Translating controls changed the query source.' );
		sh_assert( 'Automatique' === $plugin->prism->themes()['auto'], 'Theme selector did not use this plugin\'s translation catalog.' );
		$plugin->enqueue_block_editor_assets();
		$domain = $GLOBALS['sh_script_translations']['syntaxhighlighter-blocks'] ?? '';
		sh_assert( 'Copier le code' === ( $GLOBALS['sh_translations'][ $domain ]['Copy code'] ?? '' ), 'Editor script was not associated with this plugin\'s translation catalog.' );
	} finally {
		$GLOBALS['sh_translations'] = $original;
	}
}
