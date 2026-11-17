<?php
// Minimal unit boundary. Real WordPress tests run the same assertions separately.
define( 'ABSPATH', '/wordpress/' );
$sh_filters = array();
$sh_scripts = array();
$sh_styles = array();
$sh_capability = true;
function register_block_type( $name, $args ) {}
function load_plugin_textdomain( $domain ) {}
function add_action( ...$args ) { add_filter( ...$args ); }
function add_filter( $tag, $callback, $priority = 10, $accepted = 1 ) {
	global $sh_filters;
	$sh_filters[ $tag ][ $priority ][] = array( $callback, $accepted );
}
function apply_filters( $tag, $value, ...$args ) {
	global $sh_filters;
	if ( empty( $sh_filters[ $tag ] ) ) { return $value; }
	ksort( $sh_filters[ $tag ] );
	foreach ( $sh_filters[ $tag ] as $callbacks ) {
		foreach ( $callbacks as $callback ) {
			$value = call_user_func_array( $callback[0], array_slice( array_merge( array( $value ), $args ), 0, $callback[1] ) );
		}
	}
	return $value;
}
function do_action( $tag, ...$args ) { apply_filters( $tag, $args[0] ?? null, ...array_slice( $args, 1 ) ); }
function __( $text, $domain = '' ) { return $text; }
function esc_html__( $text, $domain = '' ) { return esc_html( $text ); }
function esc_attr( $text ) { return htmlspecialchars( (string) $text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' ); }
function esc_html( $text ) { return esc_attr( $text ); }
function wp_strip_all_tags( $text ) { return strip_tags( $text ); }
function get_option( $key ) { return array(); }
function get_post_meta( ...$args ) { return false; }
function wp_parse_args( $args, $defaults ) { return array_merge( $defaults, $args ); }
function add_shortcode( $name, $callback ) {}
function plugins_url( $path, $file ) { return '/plugin/' . $path; }
function wp_register_script( $handle, $src, $deps = array(), ...$args ) {
	$GLOBALS['sh_scripts'][ $handle ] = array( 'src' => $src, 'deps' => $deps, 'enqueued' => false );
}
function wp_register_style( $handle, $src, ...$args ) {
	$GLOBALS['sh_styles'][ $handle ] = array( 'src' => $src, 'enqueued' => false );
}
function wp_enqueue_script( $handle, ...$args ) { $GLOBALS['sh_scripts'][ $handle ]['enqueued'] = true; }
function wp_enqueue_style( $handle, ...$args ) { $GLOBALS['sh_styles'][ $handle ]['enqueued'] = true; }
function wp_localize_script( ...$args ) {}
function wp_add_inline_script( $handle, $data, $position = 'after' ) { $GLOBALS['sh_inline_scripts'][ $handle ][] = $data; }
function wp_script_is( $handle, $state ) { return ! empty( $GLOBALS['sh_scripts'][ $handle ]['enqueued'] ); }
function wp_style_is( $handle, $state ) {
	return 'registered' === $state ? isset( $GLOBALS['sh_styles'][ $handle ] ) : ! empty( $GLOBALS['sh_styles'][ $handle ]['enqueued'] );
}
function wp_print_styles( $handles ) { $GLOBALS['sh_printed_styles'] = $handles; }
function current_user_can( $cap ) { return $GLOBALS['sh_capability']; }
function wp_json_encode( $data, $flags = 0 ) { return json_encode( $data, $flags ); }
function is_admin() { return false; }
