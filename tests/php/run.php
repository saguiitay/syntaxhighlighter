<?php
error_reporting( E_ALL );
set_error_handler( static function ( $severity, $message, $file, $line ) {
	throw new ErrorException( $message, 0, $severity, $file, $line );
} );
require __DIR__ . '/stubs.php';
require dirname( __DIR__, 2 ) . '/syntaxhighlighter.php';
require __DIR__ . '/assertions.php';
SyntaxHighlighter();
$rendered = sh_run_tests( $SyntaxHighlighter );
$sh_capability = false;
sh_assert( $SyntaxHighlighter->validate_settings( array( 'title' => 'changed' ) ) === $SyntaxHighlighter->settings, 'Capability bypass.' );
$sh_capability = true;
$validated = $SyntaxHighlighter->validate_settings( array( 'theme' => 'dark', 'title' => '<script>x</script>', 'copy' => 'false' ) );
sh_assert( 'dark' === $validated['theme'] && 'x' === $validated['title'] && 0 === $validated['copy'], 'Settings sanitization.' );
$validated = $SyntaxHighlighter->validate_settings( array( 'theme' => 'midnight', 'shversion' => 2 ) );
sh_assert( 'midnight' === $validated['theme'] && 2 === $validated['shversion'], 'Legacy settings must remain usable on rollback.' );
echo json_encode( array( 'php' => PHP_VERSION, 'assertions' => $sh_assertions, 'rendered' => $rendered ), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR );
