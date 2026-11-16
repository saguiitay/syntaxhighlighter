<?php
/**
 * Safe rendering and local Prism asset integration.
 *
 * @license GPL-2.0-or-later
 */
class SyntaxHighlighter_Prism_Renderer {
	private $plugin;
	private $manifest;
	private $assets_printed = false;

	public function __construct( $plugin ) {
		$this->plugin = $plugin;
		$this->manifest = json_decode( file_get_contents( dirname( __DIR__ ) . '/dist/manifest.json' ), true );
		$url = plugins_url( 'dist/', dirname( __DIR__ ) . '/syntaxhighlighter.php' );
		wp_register_script( 'syntaxhighlighter-core', $url . 'runtime.js', array(), $plugin->pluginver, true );
		foreach ( $this->manifest['dependencies'] as $id => $dependencies ) {
			$handles = array( 'syntaxhighlighter-core' );
			foreach ( $dependencies as $dependency ) {
				$handles[] = 'syntaxhighlighter-prism-' . $dependency;
			}
			wp_register_script( 'syntaxhighlighter-prism-' . $id, $url . 'grammars/' . $id . '.js', $handles, $plugin->pluginver, true );
		}
		wp_register_script( 'syntaxhighlighter-prism', false, array( 'syntaxhighlighter-core' ), $plugin->pluginver, true );
		wp_register_style( 'syntaxhighlighter-core', apply_filters( 'syntaxhighlighter_csscoreurl', $url . 'frontend.css' ), array(), $plugin->pluginver );
		wp_localize_script( 'syntaxhighlighter-core', 'syntaxHighlighterPrismLabels', array(
			'copy' => __( 'Copy code', 'syntaxhighlighter' ),
			'copied' => __( 'Code copied.', 'syntaxhighlighter' ),
			'failed' => __( 'Copy failed. Select the code and copy it manually.', 'syntaxhighlighter' ),
		) );
	}

	public function language( $name ) {
		if ( ! is_string( $name ) ) {
			return 'plain';
		}
		$name = strtolower( trim( $name ) );
		$aliases = (array) apply_filters( 'syntaxhighlighter_prism_aliases', $this->manifest['aliases'] );
		// Old alias filters map to brush IDs; resolve those IDs through the adapter.
		$legacy = isset( $this->plugin->brushes[ $name ] ) ? $this->plugin->brushes[ $name ] : $name;
		$id = isset( $aliases[ $name ] ) ? $aliases[ $name ] : ( isset( $aliases[ $legacy ] ) ? $aliases[ $legacy ] : 'plain' );
		return is_string( $id ) && isset( $this->manifest['dependencies'][ $id ] ) ? $id : 'plain';
	}

	public static function boolean( $value ) {
		return in_array( $value, array( true, 1, '1', 'true', 'on' ), true );
	}

	public function options( $attributes ) {
		$options = array_merge( $this->plugin->settings, (array) $attributes );
		foreach ( array( 'gutter', 'collapse', 'autolinks', 'toolbar', 'wraplines', 'light', 'quickcode', 'smarttabs', 'htmlscript', 'copy' ) as $key ) {
			$options[ $key ] = self::boolean( isset( $options[ $key ] ) ? $options[ $key ] : false );
		}
		foreach ( array( 'firstline' => array( -1000000, 1000000, 1 ), 'tabsize' => array( 1, 16, 4 ), 'fontsize' => array( 50, 200, 100 ) ) as $key => $bounds ) {
			$value = isset( $options[ $key ] ) && is_scalar( $options[ $key ] ) ? $options[ $key ] : $bounds[2];
			$options[ $key ] = max( $bounds[0], min( $bounds[1], (int) $value ) );
		}
		$options['classname'] = preg_replace( '/[^a-zA-Z0-9 _-]/', '', is_string( $options['classname'] ) ? $options['classname'] : '' );
		$options['title'] = wp_strip_all_tags( is_string( $options['title'] ) ? $options['title'] : '' );
		$options['highlight'] = preg_replace( '/[^0-9,\- ]/', '', isset( $options['highlight'] ) && is_string( $options['highlight'] ) ? substr( $options['highlight'], 0, 2000 ) : '' );
		$padding = isset( $options['padlinenumbers'] ) ? $options['padlinenumbers'] : 'false';
		$options['padlinenumbers'] = in_array( $padding, array( 'true', 'false' ), true ) ? $padding : max( 0, min( 12, (int) $padding ) );
		$theme = isset( $options['theme'] ) && is_string( $options['theme'] ) ? $options['theme'] : 'auto';
		$themes = array( 'default' => 'light', 'django' => 'dark', 'eclipse' => 'light', 'emacs' => 'dark', 'fadetogrey' => 'dark', 'midnight' => 'dark', 'rdark' => 'dark' );
		$options['theme'] = isset( $themes[ $theme ] ) ? $themes[ $theme ] : ( in_array( $theme, array( 'light', 'dark', 'auto', 'none' ), true ) ? $theme : 'auto' );
		if ( $options['light'] ) {
			$options['gutter'] = false;
			$options['toolbar'] = false;
			$options['copy'] = false;
		}
		return $options;
	}

	public function enqueue( $language = 'plain' ) {
		if ( 'plain' !== $language ) {
			wp_enqueue_script( 'syntaxhighlighter-prism-' . $language );
		}
		wp_enqueue_script( 'syntaxhighlighter-prism' );
		wp_enqueue_style( 'syntaxhighlighter-core' );
		$theme = $this->plugin->settings['theme'];
		if ( is_string( $theme ) && wp_style_is( 'syntaxhighlighter-theme-' . $theme, 'registered' ) ) {
			wp_enqueue_style( 'syntaxhighlighter-theme-' . $theme );
		}
	}

	public function footer() {
		if ( $this->assets_printed ) {
			return;
		}
		if ( self::boolean( $this->plugin->settings['loadallbrushes'] ) ) {
			foreach ( array_keys( $this->manifest['dependencies'] ) as $language ) {
				$this->enqueue( $language );
			}
		}
		if ( wp_script_is( 'syntaxhighlighter-prism', 'enqueued' ) ) {
			// Render-time discovery may happen after wp_head (widgets, patterns, templates).
			// Print real stylesheet links, not JS-inserted links, including when JS is off.
			wp_print_styles( array( 'syntaxhighlighter-core', 'syntaxhighlighter-theme-' . $this->plugin->settings['theme'] ) );
			$this->assets_printed = true;
			do_action( 'syntaxhighlighter_after_script_output' );
		}
	}

	public function render( $source, $language, $attributes ) {
		$options = $this->options( $attributes );
		if ( $options['htmlscript'] ) {
			$this->enqueue( 'markup' );
		}
		$this->enqueue( $language );
		$this->plugin->usedbrushes[ $language ] = true;
		$classes = array( 'syntaxhighlighter-code', 'language-' . $language, 'notranslate', $options['classname'] );
		if ( $options['wraplines'] ) {
			$classes[] = 'sh-wrap';
		}
		$classes = (array) apply_filters( 'syntaxhighlighter_cssclasses', $classes );
		$data = '';
		foreach ( array( 'firstline', 'gutter', 'highlight', 'tabsize', 'fontsize', 'padlinenumbers', 'autolinks', 'quickcode', 'smarttabs', 'htmlscript' ) as $key ) {
			$value = is_bool( $options[ $key ] ) ? ( $options[ $key ] ? 'true' : 'false' ) : $options[ $key ];
			$data .= ' data-' . $key . '="' . esc_attr( $value ) . '"';
		}
		// Escape exactly once, including raw HTML and unknown languages. Protect later shortcode passes.
		$escaped = str_replace( array( '[', "\r" ), array( '&#x5B;', '&#13;' ), htmlspecialchars( $source, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' ) );
		$code = '<pre tabindex="0" class="' . esc_attr( implode( ' ', $classes ) ) . '"' . $data . '><code class="language-' . esc_attr( $language ) . '">' . $escaped . '</code></pre>';
		$title = '' !== $options['title'] ? '<div class="sh-title">' . esc_html( $options['title'] ) . '</div>' : '';
		$controls = $options['copy'] || $options['toolbar'] ? '<div class="sh-controls"><button type="button" class="sh-copy" hidden>' . esc_html__( 'Copy code', 'syntaxhighlighter' ) . '</button><span class="sh-status" role="status" aria-live="polite"></span></div>' : '';
		if ( $options['collapse'] ) {
			$code = '<details class="sh-collapse"><summary>' . esc_html( $options['title'] ? $options['title'] : __( 'Show code', 'syntaxhighlighter' ) ) . '</summary>' . $controls . $code . '</details>';
			$title = '';
		} else {
			$code = $title . $controls . $code;
		}
		return apply_filters( 'syntaxhighlighter_htmlresult', '<div class="syntaxhighlighter sh-prism sh-theme-' . esc_attr( $options['theme'] ) . '">' . $code . '</div>' );
	}
}
