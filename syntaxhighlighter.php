<?php /*

**************************************************************************

Plugin Name:  SyntaxHighlighter Prism
Plugin URI:   https://github.com/saguiitay/syntaxhighlighter
Version:      4.0.2
Description:  Backward-compatible local Prism highlighting, with TypeScript, TSX and Kusto Query Language. Replaces SyntaxHighlighter Evolved.
Author:       SyntaxHighlighter Prism contributors; Alex Mills (Viper007Bond), Automattic
Author URI:   https://github.com/saguiitay/syntaxhighlighter
Text Domain:  syntaxhighlighter-prism
License:      GPL2+
License URI:  https://www.gnu.org/licenses/gpl-2.0.html
Requires at least: 7.0
Requires PHP: 8.2

**************************************************************************/

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( class_exists( 'SyntaxHighlighter', false ) ) {
	register_activation_hook( __FILE__, static function () {
		wp_die( esc_html__( 'Deactivate SyntaxHighlighter Evolved before activating SyntaxHighlighter Prism.', 'syntaxhighlighter-prism' ) );
	} );
	add_action( 'admin_notices', static function () {
		echo '<div class="notice notice-error"><p>' . esc_html__( 'Deactivate SyntaxHighlighter Evolved before activating SyntaxHighlighter Prism.', 'syntaxhighlighter-prism' ) . '</p></div>';
	} );
	return;
} else {

require_once __DIR__ . '/includes/class-prism-renderer.php';

class SyntaxHighlighter {
	// All of these variables are private. Filters are provided for things that can be modified.
	public $pluginver            = '4.0.2';  // Plugin version
	public $prism;
	public $agshver              = false;    // Alex Gorbatchev's SyntaxHighlighter version (dynamically set below due to v2 vs v3)
	public $shfolder             = false;    // Controls what subfolder to load SyntaxHighlighter from (v2 or v3)
	public $settings             = array();  // Contains the user's settings
	public $defaultsettings      = array();  // Contains the default settings
	public $brushes              = array();  // Array of aliases => brushes
	public $shortcodes           = array();  // Array of shortcodes to use
	public $themes               = array();  // Array of themes
	public $usedbrushes          = array();  // Stores used brushes so we know what to output
	public $encoded              = false;    // Used to mark that a character encode took place
	public $codeformat           = false;    // If set, SyntaxHighlighter::get_code_format() will return this value
	public $content_save_pre_ran = false;    // It's possible for the "content_save_pre" filter to run multiple times, so keep track
	public $brush_names          = array();  // Array of brush names for use.
	public $specialchars         = array(); // Array of special characters to be encoded.

	function __construct() {
		// Load localization domain
		load_plugin_textdomain( 'syntaxhighlighter-prism' );

		// Display hooks
		add_filter( 'the_content', array( $this, 'parse_shortcodes' ), 7 ); // Posts
		add_filter( 'the_content', array( $this, 'convert_legacy_pre' ), 10 );
		add_filter( 'comment_text', array( $this, 'parse_shortcodes_comment' ), 7 ); // Comments
		add_filter( 'bp_get_the_topic_post_content', array( $this, 'parse_shortcodes' ), 7 ); // BuddyPress

		// Into the database
		add_filter( 'content_save_pre', array( $this, 'encode_shortcode_contents_slashed_noquickedit' ), 1 ); // Posts
		add_filter( 'pre_comment_content', array( $this, 'encode_shortcode_contents_slashed' ), 1 ); // Comments
		add_filter( 'group_forum_post_text_before_save', array( $this, 'encode_shortcode_contents_slashed' ), 1 ); // BuddyPress
		add_filter( 'group_forum_topic_text_before_save', array( $this, 'encode_shortcode_contents_slashed' ), 1 ); // BuddyPress

		// Out of the database for editing
		add_filter( 'the_editor_content', array( $this, 'the_editor_content' ), 1 ); // Posts
		add_filter( 'comment_edit_pre', array( $this, 'decode_shortcode_contents' ), 1 ); // Comments
		add_filter( 'bp_get_the_topic_text', array( $this, 'decode_shortcode_contents' ), 1 ); // BuddyPress
		add_filter( 'bp_get_the_topic_post_edit_text', array( $this, 'decode_shortcode_contents' ), 1 ); // BuddyPress

		// Outputting SyntaxHighlighter's JS and CSS
		add_action( 'wp_footer', array( $this, 'maybe_output_scripts' ), 15 );
		add_action( 'admin_footer', array( $this, 'maybe_output_scripts' ), 15 ); // For comments

		// Admin hooks
		add_action( 'admin_init', array( $this, 'register_setting' ) );
		add_action( 'admin_menu', array( $this, 'register_settings_page' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_settings_assets' ) );
		add_action( 'wp_ajax_syntaxhighlighter_preview', array( $this, 'ajax_settings_preview' ) );
		add_filter( 'mce_external_plugins', array( $this, 'add_tinymce_plugin' ) );
		add_filter( 'save_post', array( $this, 'mark_as_encoded' ), 10, 2 );
		add_filter( 'plugin_action_links', array( $this, 'settings_link' ), 10, 2 );

		// Editor Blocks
		add_action( 'enqueue_block_assets', array( $this, 'enqueue_block_editor_styles' ) );
		add_action( 'enqueue_block_editor_assets', array( $this, 'enqueue_block_editor_assets' ) );
		register_block_type(
			'syntaxhighlighter/code',
			array(
				'render_callback' => array( $this, 'render_block' ),
			)
		);

		// Register widget hooks
		add_filter( 'widget_text', array( $this, 'widget_text_output' ), 7, 2 );
		add_filter( 'widget_update_callback', array( $this, 'widget_text_save' ), 1, 4 );
		add_filter( 'widget_form_callback', array( $this, 'widget_text_form' ), 1, 2 );


		// Create array of default settings (you can use the filter to modify these)
		$this->defaultsettings = (array) apply_filters( 'syntaxhighlighter_defaultsettings', array(
			'theme'          => 'auto',
			'loadallbrushes' => 0,
			'shversion'      => 3,
			'title'          => '',
			'autolinks'      => 1,
			'classname'      => '',
			'collapse'       => 0,
			'firstline'      => 1,
			'gutter'         => 1,
			'htmlscript'     => 0,
			'light'          => 0,
			'padlinenumbers' => 'false',
			'smarttabs'      => 1,
			'tabsize'        => 4,
			'toolbar'        => 0,
			'wraplines'      => 1, // 2.x only
			'quickcode'      => 1, // 3.x only
			'copy'           => 1,
		) );

		// Create the settings array by merging the user's settings and the defaults
		$usersettings = (array) get_option('syntaxhighlighter_settings');
		$this->settings = wp_parse_args( $usersettings, $this->defaultsettings );

		// Retained public properties now identify the replacement engine.
		$this->shfolder = 'dist';
		$this->agshver = '1.30.0';

		// Create list of brush aliases and map them to their real brushes
		// The key is the language alias
		// The value is the script handle suffix: syntaxhighlighter-brush-ThisBitHere  (your plugin needs to register the script itself)
		$this->brushes = (array) apply_filters( 'syntaxhighlighter_brushes', array(
			'typescript'    => 'typescript',
			'ts'            => 'typescript',
			'tsx'           => 'tsx',
			'kusto'         => 'kusto',
			'kql'           => 'kusto',
			'cs'            => 'csharp',
			'sh'            => 'bash',
			'as3'           => 'as3',
			'actionscript3' => 'as3',
			'arduino'       => 'arduino',
			'bash'          => 'bash',
			'shell'         => 'bash',
			'coldfusion'    => 'coldfusion',
			'cf'            => 'coldfusion',
			'clojure'       => 'clojure',
			'clj'           => 'clojure',
			'cpp'           => 'cpp',
			'c'             => 'cpp',
			'c-sharp'       => 'csharp',
			'csharp'        => 'csharp',
			'css'           => 'css',
			'delphi'        => 'delphi',
			'pas'           => 'delphi',
			'pascal'        => 'delphi',
			'diff'          => 'diff',
			'patch'         => 'diff',
			'erl'           => 'erlang',
			'erlang'        => 'erlang',
			'fsharp'        => 'fsharp',
			'go'            => 'go',
			'golang'        => 'go',
			'groovy'        => 'groovy',
			'haskell'       => 'haskell',
			'java'          => 'java',
			'jfx'           => 'javafx',
			'javafx'        => 'javafx',
			'js'            => 'jscript',
			'jscript'       => 'jscript',
			'javascript'    => 'jscript',
			'json'          => 'json',
			'latex'         => 'latex', // Not used as a shortcode
			'tex'           => 'latex',
			'markdown'      => 'markdown',
			'md'            => 'markdown',
			'matlab'        => 'matlabkey',
			'matlabkey'     => 'matlabkey',
			'objc'          => 'objc',
			'obj-c'         => 'objc',
			'perl'          => 'perl',
			'pl'            => 'perl',
			'php'           => 'php',
			'plain'         => 'plain',
			'text'          => 'plain',
			'ps'            => 'powershell',
			'powerquery'    => 'powerquery',
			'pq'            => 'powerquery',
			'mscript'       => 'powerquery',
			'powershell'    => 'powershell',
			'py'            => 'python',
			'python'        => 'python',
			'r'             => 'r', // Not used as a shortcode
			'splus'         => 'r',
			'rails'         => 'ruby',
			'rb'            => 'ruby',
			'ror'           => 'ruby',
			'ruby'          => 'ruby',
			'rust'          => 'rust',
			'scala'         => 'scala',
			'sql'           => 'sql',
			'swift'         => 'swift',
			'vb'            => 'vb',
			'vbnet'         => 'vb',
			'xml'           => 'xml',
			'xhtml'         => 'xml',
			'xslt'          => 'xml',
			'html'          => 'xml',
			'yaml'           => 'yaml',
			'yml'           => 'yaml',
		) );

		$this->brush_names = (array) apply_filters( 'syntaxhighlighter_brush_names', array(
			'typescript' => __( 'TypeScript', 'syntaxhighlighter-prism' ),
			'tsx'        => __( 'TypeScript JSX (TSX)', 'syntaxhighlighter-prism' ),
			'kusto'      => __( 'Kusto Query Language (KQL)', 'syntaxhighlighter-prism' ),
			'as3'        => __( 'ActionScript',              'syntaxhighlighter-prism' ),
			'arduino'    => __( 'Arduino',                   'syntaxhighlighter-prism' ),
			'bash'       => __( 'BASH / Shell',              'syntaxhighlighter-prism' ),
			'coldfusion' => __( 'ColdFusion',                'syntaxhighlighter-prism' ),
			'clojure'    => __( 'Clojure',                   'syntaxhighlighter-prism' ),
			'cpp'        => __( 'C / C++',                   'syntaxhighlighter-prism' ),
			'csharp'     => __( 'C#',                        'syntaxhighlighter-prism' ),
			'css'        => __( 'CSS',                       'syntaxhighlighter-prism' ),
			'delphi'     => __( 'Delphi / Pascal',           'syntaxhighlighter-prism' ),
			'diff'       => __( 'diff / patch',              'syntaxhighlighter-prism' ),
			'erlang'     => __( 'Erlang',                    'syntaxhighlighter-prism' ),
			'fsharp'     => __( 'F#',                        'syntaxhighlighter-prism' ),
			'go'         => __( 'Go',                        'syntaxhighlighter-prism' ),
			'groovy'     => __( 'Groovy',                    'syntaxhighlighter-prism' ),
			'haskell'    => __( 'Haskell',                   'syntaxhighlighter-prism' ),
			'java'       => __( 'Java',                      'syntaxhighlighter-prism' ),
			'javafx'     => __( 'JavaFX',                    'syntaxhighlighter-prism' ),
			'jscript'    => __( 'JavaScript',                'syntaxhighlighter-prism' ),
			'json'       => __( 'JSON',                      'syntaxhighlighter-prism' ),
			'latex'      => __( 'LaTeX',                     'syntaxhighlighter-prism' ),
			'markdown'   => __( 'Markdown',                  'syntaxhighlighter-prism' ),
			'matlabkey'  => __( 'MATLAB',                    'syntaxhighlighter-prism' ),
			'objc'       => __( 'Objective-C',               'syntaxhighlighter-prism' ),
			'perl'       => __( 'Perl',                      'syntaxhighlighter-prism' ),
			'php'        => __( 'PHP',                       'syntaxhighlighter-prism' ),
			'plain'      => __( 'Plain Text',                'syntaxhighlighter-prism' ),
			'powerquery' => __( 'Power Query (M)',            'syntaxhighlighter-prism' ),
			'powershell' => __( 'PowerShell',                'syntaxhighlighter-prism' ),
			'python'     => __( 'Python',                    'syntaxhighlighter-prism' ),
			'r'          => __( 'R',                         'syntaxhighlighter-prism' ),
			'ruby'       => __( 'Ruby / Ruby on Rails',      'syntaxhighlighter-prism' ),
			'rust'       => __( 'Rust',                      'syntaxhighlighter-prism' ),
			'scala'      => __( 'Scala',                     'syntaxhighlighter-prism' ),
			'swift'      => __( 'Swift',                     'syntaxhighlighter-prism' ),
			'sql'        => __( 'SQL',                       'syntaxhighlighter-prism' ),
			'vb'         => __( 'Visual Basic',              'syntaxhighlighter-prism' ),
			'xml'        => __( 'HTML / XHTML / XML / XSLT', 'syntaxhighlighter-prism' ),
			'yaml'        => __( 'YAML',                     'syntaxhighlighter-prism' ),
		) );

		// Add any custom brushes that aren't making use of the newer "syntaxhighlighter_brush_names" filter.
		foreach ( $this->brushes as $slug => $language ) {
			if ( ! isset( $this->brush_names[ $language ] ) ) {
				$this->brush_names[ $language ] = $slug;
			}
		}

		// Create a list of shortcodes to use. You can use the filter to add/remove ones.
		// If the language/lang parameter is left out, it's assumed the shortcode name is the language.
		// If that's invalid, then "plain" is used.
		$this->shortcodes = array( 'sourcecode', 'source', 'code' );
		$this->shortcodes = array_merge( $this->shortcodes, array_keys( $this->brushes ) );

		// Remove some shortcodes we don't want while still supporting them as language values
		unset( $this->shortcodes[array_search( 'latex', $this->shortcodes )] ); // Remove "latex" shortcode (it'll collide)
		unset( $this->shortcodes[array_search( 'r', $this->shortcodes )] ); // Remove "r" shortcode (too short)

		$this->shortcodes = (array) apply_filters( 'syntaxhighlighter_shortcodes', $this->shortcodes );


		// Register each shortcode with a placeholder callback so that strip_shortcodes() will work
		// The proper callback and such is done in SyntaxHighlighter::shortcode_hack()
		foreach ( $this->shortcodes as $shortcode )
			add_shortcode( $shortcode, '__return_empty_string' );


		// Create list of themes and their human readable names
		// Plugins can add to this list: http://www.viper007bond.com/wordpress-plugins/syntaxhighlighter/adding-a-new-theme/
		$this->prism = new SyntaxHighlighter_Prism_Renderer( $this );
		$this->themes = (array) apply_filters( 'syntaxhighlighter_themes', array_merge( $this->prism->themes(), array(
			'default'    => __( 'Default',      'syntaxhighlighter-prism' ),
			'django'     => __( 'Django',       'syntaxhighlighter-prism' ),
			'eclipse'    => __( 'Eclipse',      'syntaxhighlighter-prism' ),
			'emacs'      => __( 'Emacs',        'syntaxhighlighter-prism' ),
			'fadetogrey' => __( 'Fade to Grey', 'syntaxhighlighter-prism' ),
			'midnight'   => __( 'Midnight',     'syntaxhighlighter-prism' ),
			'rdark'      => __( 'RDark',        'syntaxhighlighter-prism' ),
		) ) );

		// Other special characters that need to be encoded before going into the database (namely to work around kses)
		$this->specialchars = (array) apply_filters( 'syntaxhighlighter_specialchars', array(
			'\0' => '&#92;&#48;',
		) );
	}


	// Register the settings page
	function register_settings_page() {
		add_options_page( __( 'SyntaxHighlighter Settings', 'syntaxhighlighter-prism' ), __( 'SyntaxHighlighter', 'syntaxhighlighter-prism' ), 'manage_options', 'syntaxhighlighter', array( $this, 'settings_page' ) );
	}


	// Register the plugin's setting
	function register_setting() {
		register_setting( 'syntaxhighlighter_settings', 'syntaxhighlighter_settings', array( $this, 'validate_settings' ) );
	}

	function enqueue_block_editor_styles() {
		if ( ! is_admin() ) {
			return;
		}

		wp_enqueue_style(
			'syntaxhighlighter-blocks-css', // Handle.
			plugins_url( 'dist/blocks.editor.build.css', __FILE__ ),
			[],
			( ( defined( 'WP_DEBUG' ) && WP_DEBUG ) || ( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) )
				? filemtime( plugin_dir_path( __FILE__ ) . 'dist/blocks.editor.build.css' )
				: $this->pluginver
		);
		wp_enqueue_style( 'syntaxhighlighter-core' );
		foreach ( $this->prism->themes() as $theme => $name ) {
			$this->prism->enqueue_theme( $theme );
		}
	}

	// Enqueue block assets for the Editor
	function enqueue_block_editor_assets() {
		wp_enqueue_script(
			'syntaxhighlighter-blocks',
			plugins_url( 'dist/blocks.build.js', __FILE__ ),
			array( 'wp-blocks', 'wp-i18n', 'wp-element', 'wp-block-editor', 'wp-components', 'wp-escape-html' ),
			( ( defined( 'WP_DEBUG' ) && WP_DEBUG ) || ( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) )
				? filemtime( plugin_dir_path( __FILE__ ) . 'dist/blocks.build.js' )
				: $this->pluginver
		);
		wp_enqueue_script( 'syntaxhighlighter-core' );
		$manifest = json_decode( file_get_contents( __DIR__ . '/dist/manifest.json' ), true );
		$grammars = array();
		foreach ( $manifest['dependencies'] as $id => $dependencies ) {
			$grammars[ $id ] = array(
				'dependencies' => $dependencies,
				'url' => plugins_url( 'dist/grammars/' . $id . '.js', __FILE__ ),
			);
		}

		// WordPress 5.0+ only, no Gutenberg plugin support
		if ( function_exists( 'wp_set_script_translations' ) ) {
			wp_set_script_translations( 'syntaxhighlighter-blocks', 'syntaxhighlighter-prism' );
		}

		natcasesort( $this->brush_names );

		$settings = (object) array(
			'language' => (object) array(
				'supported' => true,
				'default' => 'plain'
			),
			'lineNumbers' => (object) array(
				'supported' => true,
				'default' => (bool) $this->settings['gutter'],
			),
			'firstLineNumber' => (object) array(
				'supported' => true,
				'default' => (string) $this->settings['firstline'],
			),
			'highlightLines' => (object) array(
				'supported' => true,
				'default' => '',
			),
			'wrapLines' => (object) array(
				'supported' => true,
				'default' => (bool) $this->settings['wraplines'],
			),
			'makeURLsClickable' => (object) array(
				'supported' => true,
				'default' => (bool) $this->settings['autolinks'],
			),
			'quickCode' => (object) array(
				'supported' => true,
				'default' => (bool) $this->settings['quickcode'],
			),
			'tabSize' => (int) $this->settings['tabsize'],
		);

		wp_add_inline_script(
			'syntaxhighlighter-blocks',
			sprintf( '
				var syntaxHighlighterData = {
					brushes: %s,
					settings: %s,
					grammars: %s,
					aliases: %s,
					theme: %s,
					themes: %s,
				};',
				wp_json_encode( $this->brush_names, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT ),
				wp_json_encode( $settings, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT ),
				wp_json_encode( $grammars ),
				wp_json_encode( $this->prism->aliases(), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT ),
				wp_json_encode( $this->prism->options( array() )['theme'] ),
				wp_json_encode( $this->prism->themes(), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT )
			),
			'before'
		);
	}

	/**
	 * Enable the brushes that are used in blocks.
	 *
	 * For the shortcode, brushes are activated by `shortcode_callback()`, but that won't detect brushes that were
	 * used in blocks. For that, we need to extract the data from the block's attributes.
	 *
	 * @since 3.3.0
	 *
	* @param string $content The post content.
	  *
	 * @return string Unmodified $content.
	 */
	/**
	 * Renders the content of the Gutenberg block on the front end
	 * using the shortcode callback. This ensures one source of truth
	 * and allows for forward compatibility.
	 *
	* @param string $content The block's content.
	 *
	 * @return string The rendered content.
	 */
	public function render_block( $attributes, $content ) {
		$remaps = array(
			'lineNumbers' => 'gutter', 'firstLineNumber' => 'firstline',
			'highlightLines' => 'highlight', 'wrapLines' => 'wraplines',
			'makeURLsClickable' => 'autolinks', 'quickCode' => 'quickcode',
		);
		foreach ( $remaps as $from => $to ) {
			if ( isset( $attributes[ $from ] ) ) {
				$attributes[ $to ] = $attributes[ $from ];
			}
		}
		// The saved pre is escaped markup, independent of Classic post encoding metadata.
		$code = preg_match( '#^\\s*<pre\\b[^>]*>([\\s\\S]*?)</pre>\\s*$#i', $content, $matches ) ? $matches[1] : '';
		$code = htmlspecialchars_decode( $code, ENT_QUOTES );
		$code = preg_replace( '/^(\\s*https?:)&#0?47;&#0?47;([^\\s<>"]+\\s*)$/m', '$1//$2', $code );
		$attributes['classname'] = $attributes['className'] ?? '';
		if ( isset( $attributes['align'] ) && in_array( $attributes['align'], array( 'left', 'right', 'center', 'wide', 'full' ), true ) ) {
			$attributes['classname'] .= ' align' . $attributes['align'];
		}
		$previous = $this->codeformat;
		$this->codeformat = 1;
		try {
			$result = $this->shortcode_callback( $attributes, $code, 'code' );
		} finally {
			$this->codeformat = $previous;
		}
		return '<div class="wp-block-syntaxhighlighter-code">' . $result . '</div>';
	}


	// Add the custom TinyMCE plugin which wraps plugin shortcodes in <pre> in TinyMCE
	function add_tinymce_plugin( $plugins ) {
		add_action( 'admin_print_footer_scripts', array( $this, 'output_shortcodes_for_tinymce' ), 9 );
		$plugins['syntaxhighlighter'] = add_query_arg( 'ver', $this->pluginver, plugins_url( 'syntaxhighlighter_mce-4.js', __FILE__ ) );
		wp_enqueue_script( 'syntaxhighlighter', plugins_url( 'syntaxhighlighter.js', __FILE__ ), array(), false, true );

		return $plugins;
	}


	// Add a "Settings" link to the plugins page
	function settings_link( $links, $file ) {
		static $this_plugin;

		if ( empty( $this_plugin ) ) {
			$this_plugin = plugin_basename(__FILE__);
		}

		if ( $file == $this_plugin ) {
			$links[] = '<a href="' . admin_url( 'options-general.php?page=syntaxhighlighter' ) . '">' . __( 'Settings', 'syntaxhighlighter-prism' ) . '</a>';
		}

		return $links;
	}


	// Output list of shortcode tags for the TinyMCE plugin
	function output_shortcodes_for_tinymce() {
		$shortcodes = array();

		foreach ( $this->shortcodes as $shortcode )
			$shortcodes[] = preg_quote( $shortcode );

		echo "<script>\n";
		echo "	var syntaxHLcodes = " . wp_json_encode( implode( '|', $shortcodes ), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT ) . ";\n";
		echo "</script>\n";
	}


	/**
	 * Returns all shortcodes not handled by SyntaxHighlighter unchanged, so they
	 * can be processed by their original handlers after SyntaxHighlighter has
	 * run.
	 *
	 * @param mixed $output The shortcode's returned value (false by default).
	 * @param string $tag The name of the shortcode.
	 * @param array|null $attr The shortcode attributes.
	 * @param array $m Regular expression match array.
	 * @return string|false Return the matched shortcode as-is for all shortcodes not handled by SyntaxHighlighter, returns $output otherwise.
	 */
	function pre_do_shortcode_shortcode_hack_skip_others( $output, $tag, $attr, $m ) {
		if ( ! in_array( $tag, $this->shortcodes, true ) ) {
			return $m[0];
		}
		return $output;
	}

	/**
	 * Process only this plugin's shortcodes.
	 *
	 * If we waited for the normal do_shortcode() call at priority 11,
	 * then wpautop() and maybe others would mangle all of the code.
	 *
	 * So instead we hook in earlier with this function and process
	 * just this plugins's shortcodes. To do this requires some trickery.
	 *
	 * First we need to clear out all existing shortcodes, then register
	 * just this plugin's ones, process them, and then restore the original
	 * list of shortcodes. Additionally, we have to add another hack to other
	 * shortcodes, such as [gallery], to return the entire shortcode string as
	 * it appears in the original content to allow SyntaxHighlighter's shortcode
	 * strings (e.g., [c]) be used within other shortcodes without interference
	 * from SyntaxHighlighter.
	 *
	 * To make matters more complicated, if someone has done [[code]foo[/code]]
	 * in order to display the shortcode (not render it), then do_shortcode()
	 * will strip the outside brackets and when do_shortcode() runs a second
	 * time later on, it will render it.
	 *
	 * So instead before do_shortcode() runs for the first time, we add
	 * even more brackets escaped shortcodes in order to result in
	 * the shortcodes actually being displayed instead rendered.
	 *
	 * Phew!
	 *
	 * @param string $content     The post content.
	 * @param array  $callback    The callback function that should be used for add_shortcode()
	 * @param bool   $ignore_html When true, shortcodes inside HTML elements will be skipped.
	 *
	 * @return string The filtered content, with this plugin's shortcodes parsed.
	 */
	function shortcode_hack( $content, $callback, $ignore_html = true ) {
		global $shortcode_tags;

		// Classic filters must not interpret examples inside serialized code blocks.
		$opening = '<!-- wp:syntaxhighlighter/code';
		$closing = '<!-- /wp:syntaxhighlighter/code -->';
		$offset = 0;
		$protected = '';
		while ( false !== ( $start = strpos( $content, $opening, $offset ) ) ) {
			$end = strpos( $content, $closing, $start + strlen( $opening ) );
			if ( false === $end ) {
				break;
			}
			$end += strlen( $closing );
			$protected .= $this->shortcode_hack( substr( $content, $offset, $start - $offset ), $callback, $ignore_html );
			$protected .= substr( $content, $start, $end - $start );
			$offset = $end;
		}
		if ( $offset ) {
			return $protected . $this->shortcode_hack( substr( $content, $offset ), $callback, $ignore_html );
		}

		// Regex is slow. Let's do some strpos() checks first.
		if ( ! $this->string_has_shortcodes( $content, $this->shortcodes ) ) {
			return $content;
		}

		// Backup current registered shortcodes and clear them all out (we do not backup our own, because we will add and parse them below)
		$orig_shortcode_tags = $shortcode_tags;
		remove_all_shortcodes();

		// Register all of this plugin's shortcodes
		foreach ( $this->shortcodes as $shortcode ) {
			add_shortcode( $shortcode, $callback );
		}

		// Register all other shortcodes, ensuring their content remains unchanged using yet another hack.
		foreach ( array_diff_key( $orig_shortcode_tags, array_flip( $this->shortcodes ) ) as $shortcode_tagname => $shortcode ) {
			add_shortcode( $shortcode_tagname, '__return_empty_string' );
		}
		add_filter( 'pre_do_shortcode_tag', array( $this, 'pre_do_shortcode_shortcode_hack_skip_others' ), 10, 4 );

		$regex = '/' . get_shortcode_regex() . '/';

		// Parse the shortcodes (only this plugins's are registered)
		if ( $ignore_html ) {
			// Extra escape escaped shortcodes because do_shortcode_tag() called by do_shortcode() is going to strip a pair of square brackets when it runs
			$content = preg_replace_callback(
				$regex,
				array( $this, 'shortcode_hack_extra_escape_escaped_shortcodes' ),
				$content
			);

			// Normal, safe parsing
			$content = do_shortcode( $content, true );
		} else {
			// Extra escape escaped shortcodes because do_shortcode_tag() called by do_shortcode() is going to strip a pair of square brackets when it runs.
			// Then call do_shortcode_tag(). This is basically do_shortcode() without calling do_shortcodes_in_html_tags() which breaks things.
			// For context, see https://wordpress.org/support/topic/php-opening-closing-tags-break-code-blocks
			$content = preg_replace_callback(
				$regex,
				array( $this, 'shortcode_hack_extra_escape_escaped_shortcodes_and_parse' ),
				$content
			);
		}

		// Put the original shortcodes back, and remove the hacky pre_do_shortcode_tag filter
		$shortcode_tags = $orig_shortcode_tags;
		remove_filter('pre_do_shortcode_tag', array($this, 'pre_do_shortcode_shortcode_hack_skip_others'), 10);

		return $content;
	}


	/**
	 * A quick checker to see if any of this plugin's shortcodes are in use in a string.
	 * Since all of the tags can't be self-closing, we look for the closing tag.
	 *
	 * @param string $string     The string to look through. This is a post's contents usually.
	 * @param array  $shortcodes The array of shortcodes to look for.
	 *
	 * @return bool Whether any shortcode usage was found.
	 */
	function string_has_shortcodes( $string, $shortcodes ) {
		foreach ( $shortcodes as $shortcode ) {
			if ( false !== strpos( $string, "[/{$shortcode}]" ) ) {
				return true;
			}
		}

		return false;
	}


	/**
	 * Add extra square brackets around escaped shortcodes.
	 * This is to counteract the beginning of the do_shortcode_tag() function.
	 *
	 * @param array $match The array of matches generated by get_shortcode_regex()
	 *
	 * @return string What should be placed into the post content. In this case it's the raw match, or an extra-wrapped raw match.
	 */
	function shortcode_hack_extra_escape_escaped_shortcodes( $match ) {
		if ( $match[1] == '[' && $match[6] == ']' ) {
			return '[' . $match[0] . ']';
		}

		return $match[0];
	}

	/**
	 * This is a combination of this class's shortcode_hack_extra_escape_escaped_shortcodes()
  	 * and do_shortcode_tag() for performance reasons so that we don't have to run some regex twice.
 	 *
	 * @param array $match Regular expression match array.
	 *
	 * @return string|false False on failure, otherwise a parse shortcode tag.
	 */
	function shortcode_hack_extra_escape_escaped_shortcodes_and_parse( $match ) {
		$match[0] = $this->shortcode_hack_extra_escape_escaped_shortcodes( $match );

		return do_shortcode_tag( $match );
	}

	// The main filter for the post contents. The regular shortcode filter can't be used as it's post-wpautop().
	function parse_shortcodes( $content ) {
		return $this->shortcode_hack( $content, array( $this, 'shortcode_callback' ) );
	}

	public function convert_legacy_pre( $content ) {
		if ( false === strpos( $content, 'brush:' ) ) {
			return $content;
		}
		return preg_replace_callback( '#<pre\b([^>]*)>([\s\S]*?)</pre>#i', function ( $match ) {
			if ( ! preg_match( '/\bclass\s*=\s*(["\'])(.*?)\1/is', $match[1], $classes ) || ! preg_match( '/\bbrush:\s*([\w-]+)/', $classes[2], $brush ) ) {
				return $match[0];
			}
			$attributes = array();
			foreach ( explode( ';', $classes[2] ) as $parameter ) {
				$pair = explode( ':', $parameter, 2 );
				if ( 2 === count( $pair ) ) {
					$attributes[ str_replace( '-', '', trim( $pair[0] ) ) ] = trim( $pair[1], " \t\n\r\0\x0B[]'\"" );
				}
			}
			return $this->prism->render( htmlspecialchars_decode( $match[2], ENT_QUOTES ), $this->prism->language( $brush[1] ), $attributes );
		}, $content );
	}


	// HTML entity encode the contents of shortcodes
	function encode_shortcode_contents( $content ) {
		return $this->shortcode_hack( $content, array( $this, 'encode_shortcode_contents_callback' ), false );
	}


	// HTML entity encode the contents of shortcodes. Expects slashed content.
	function encode_shortcode_contents_slashed( $content ) {
		return addslashes( $this->encode_shortcode_contents( stripslashes( $content ) ) );
	}


	// HTML entity encode the contents of shortcodes. Expects slashed content. Aborts if AJAX.
	function encode_shortcode_contents_slashed_noquickedit( $content ) {

		// In certain weird circumstances, the content gets run through "content_save_pre" twice
		// Keep track and don't allow this filter to be run twice
		// I couldn't easily figure out why this happens and didn't bother looking into it further as this works fine
		if ( true == $this->content_save_pre_ran ) {
			return $content;
		}
		$this->content_save_pre_ran = true;

		// Post quick edits aren't decoded for display, so we don't need to encode them (again)
		// This also aborts for (un)trashing to avoid extra encoding.
		if ( empty( $_POST ) || ( ! empty( $_POST['action'] ) && 'inline-save' == $_POST['action'] ) ) {
			return $content;
		}

		return $this->encode_shortcode_contents_slashed( $content );
	}


	// HTML entity decode the contents of shortcodes
	function decode_shortcode_contents( $content ) {
		return $this->shortcode_hack( $content, array( $this, 'decode_shortcode_contents_callback' ), false );
	}


	// The callback function for SyntaxHighlighter::encode_shortcode_contents()
	function encode_shortcode_contents_callback( $atts, $code = '', $tag = false ) {
		$this->encoded = true;
		$code = str_replace( array_keys( $this->specialchars ), array_values( $this->specialchars ), htmlspecialchars( $code ) );
		return '[' . $tag . $this->atts2string( $atts ) . "]{$code}[/$tag]";
	}


	// The callback function for SyntaxHighlighter::decode_shortcode_contents()
	// Shortcode attribute values need to not be quoted with TinyMCE disabled for some reason (weird bug)
	function decode_shortcode_contents_callback( $atts, $code = '', $tag = false ) {
		$quotes = ( user_can_richedit() ) ? true : false;
		$code = str_replace( array_values( $this->specialchars ), array_keys( $this->specialchars ), htmlspecialchars_decode( $code ) );
		return '[' . $tag . $this->atts2string( $atts, $quotes ) . "]{$code}[/$tag]";
	}


	// Dynamically format the post content for the edit form
	function the_editor_content( $content ) {
		global $post;

		// New code format (stored encoded in database)
		if ( 2 == $this->get_code_format( $post ) ) {
			// If TinyMCE is disabled or the HTML tab is set to be displayed first, we need to decode the HTML
			if ( !user_can_richedit() || 'html' == wp_default_editor() )
				$content = $this->decode_shortcode_contents( $content );
		}

		// Old code format (stored raw in database)
		else {
			// If TinyMCE is enabled and is set to be displayed first, we need to encode the HTML
			if ( user_can_richedit() && 'html' != wp_default_editor() )
				$content = $this->encode_shortcode_contents( $content );
		}

		return $content;
	}


	// Run SyntaxHighlighter::encode_shortcode_contents() on the contents of the text widget
	function widget_text_save( $instance, $new_instance, $old_instance, $widgetclass ) {
		if ( 'text' == $widgetclass->id_base ) {
			// Re-save the widget settings but this time with the shortcode contents encoded
			$new_instance['text'] = $this->encode_shortcode_contents( $new_instance['text'] );
			$instance = $widgetclass->update( $new_instance, $old_instance );

			// And flag it as encoded
			$instance['syntaxhighlighter_encoded'] = true;
		}

		return $instance;
	}


	// Run SyntaxHighlighter::decode_shortcode_contents_callback() on the contents of the text widget form
	function widget_text_form( $instance, $widgetclass ) {
		if ( 'text' == $widgetclass->id_base && ! empty( $instance['syntaxhighlighter_encoded'] ) ) {
			$instance['text'] = $this->shortcode_hack( $instance['text'], array( $this, 'decode_shortcode_contents_callback' ) );
		}

		return $instance;
	}


	// Run SyntaxHighlighter::parse_shortcodes() on the contents of a text widget
	function widget_text_output( $content, $instance = false ) {
		$this->codeformat = ( false === $instance || empty( $instance['syntaxhighlighter_encoded'] ) ) ? 1 : 2;
		$content = $this->parse_shortcodes( $content );
		$this->codeformat = false;

		return $content;
	}


	// Run SyntaxHighlighter::parse_shortcodes() on the contents of a comment
	function parse_shortcodes_comment( $content ) {
		$this->codeformat = 2;
		$content = $this->parse_shortcodes( $content );
		$this->codeformat = false;

		return $content;
	}


	// This function determines what version of SyntaxHighlighter was used when the post was written
	// This is because the code was stored differently for different versions of SyntaxHighlighter
	function get_code_format( $post ) {
		if ( false !== $this->codeformat ) {
			return $this->codeformat;
		}

		if ( empty( $post ) ) {
			$post = new stdClass();
		}

		if ( null !== $version = apply_filters( 'syntaxhighlighter_pre_getcodeformat', null, $post ) )
			return $version;

		$version = ( empty( $post->ID ) || get_post_meta( $post->ID, '_syntaxhighlighter_encoded', true ) || get_post_meta( $post->ID, 'syntaxhighlighter_encoded', true ) ) ? 2 : 1;

		return apply_filters( 'syntaxhighlighter_getcodeformat', $version, $post );
	}


	// Adds a post meta saying that HTML entities are encoded (for backwards compatibility)
	function mark_as_encoded( $post_ID, $post ) {
		if ( false == $this->encoded || 'revision' == $post->post_type )
			return;

		delete_post_meta( $post_ID, 'syntaxhighlighter_encoded' ); // Previously used
		add_post_meta( $post_ID, '_syntaxhighlighter_encoded', true, true );
	}


	// Transforms an attributes array into a 'key="value"' format (i.e. reverses the process)
	function atts2string( $atts, $quotes = true ) {
		if ( empty( $atts ) ) {
			return '';
		}

		$atts = $this->attributefix( $atts );

		// Re-map [code="php"] style tags
		if ( isset( $atts[0] ) ) {
			if ( empty( $atts['language'] ) ) {
				$atts['language'] = $atts[0];
			}

			unset( $atts[0] );
		}

		$strings = array();
		foreach ( $atts as $key => $value )
			$strings[] = ( $quotes ) ? $key . '="' . esc_attr( $value ) . '"' : $key . '=' . esc_attr( $value );

		return ' ' . implode( ' ', $strings );
	}


	// Output any needed scripts. This is meant for the footer.
	function maybe_output_scripts() {
		$this->prism->footer();
	}


	// No-name attribute fixing
	function attributefix( $atts = array() ) {
		if ( empty( $atts[0] ) ) {
			return $atts;
		}

		if ( 0 !== preg_match( '#=("|\')(.*?)\1#', $atts[0], $match ) ) {
			// Quoted value
			$atts[0] = $match[2];

		} elseif ( '=' == substr( $atts[0], 0, 1 ) ) {
			// Unquoted value
			$atts[0] = substr( $atts[0], 1 );
		}

		return $atts;
	}


	// Shortcode handler for transforming the shortcodes to their final <pre>'s
	function shortcode_callback( $atts, $code = '', $tag = false ) {
		global $post;
		$atts = $this->attributefix( is_array( $atts ) ? $atts : array() );
		$code = apply_filters( 'syntaxhighlighter_precode', (string) $code, $atts, $tag );
		if ( isset( $atts[0] ) ) {
			$atts['language'] = $atts[0];
			unset( $atts[0] );
		}
		$provided = $atts;
		$defaults = array_fill_keys( array( 'language', 'lang', 'type', 'autolinks', 'classname', 'collapse', 'firstline', 'fontsize', 'gutter', 'highlight', 'htmlscript', 'light', 'padlinenumbers', 'smarttabs', 'tabsize', 'toolbar', 'wraplines', 'quickcode', 'theme', 'copy' ), false );
		$defaults['title'] = $this->settings['title'];
		$atts = (array) apply_filters( 'syntaxhighlighter_shortcodeatts', array_merge( $defaults, $atts ) );
		foreach ( $atts as $key => $value ) {
			if ( false === $value && ! array_key_exists( $key, $provided ) ) {
				unset( $atts[ $key ] );
			}
		}
		$name = isset( $this->brushes[ $tag ] ) ? $tag : ( $atts['language'] ?? $atts['lang'] ?? $atts['type'] ?? 'plain' );
		$language = $this->prism->language( $name );
		if ( 2 == $this->get_code_format( $post ?? null ) ) {
			$code = str_replace( array_values( $this->specialchars ), array_keys( $this->specialchars ), htmlspecialchars_decode( $code, ENT_QUOTES ) );
		}
		return $this->prism->render( $code, $language, $atts );
	}


	public function enqueue_settings_assets( $hook ) {
		if ( 'settings_page_syntaxhighlighter' !== $hook ) {
			return;
		}
		wp_enqueue_style( 'syntaxhighlighter-core' );
		foreach ( $this->themes as $theme => $name ) {
			$this->prism->enqueue_theme( $theme );
		}
		wp_enqueue_script( 'syntaxhighlighter-settings-preview', plugins_url( 'dist/settings-preview.js', __FILE__ ), array( 'syntaxhighlighter-prism-php' ), $this->pluginver, true );
		wp_localize_script( 'syntaxhighlighter-settings-preview', 'syntaxHighlighterSettingsPreview', array(
			'url' => admin_url( 'admin-ajax.php' ),
			'nonce' => wp_create_nonce( 'syntaxhighlighter-preview' ),
			'updating' => __( 'Updating preview...', 'syntaxhighlighter-prism' ),
			'failed' => __( 'Preview could not be updated. The previous preview is still shown; try changing an option again.', 'syntaxhighlighter-prism' ),
		) );
	}

	public function ajax_settings_preview() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'You cannot preview these settings.', 'syntaxhighlighter-prism' ) ), 403 );
		}
		check_ajax_referer( 'syntaxhighlighter-preview', 'nonce' );
		if ( ! isset( $_POST['syntaxhighlighter_settings'] ) || ! is_array( $_POST['syntaxhighlighter_settings'] ) ) {
			wp_send_json_error( array( 'message' => __( 'Preview settings are missing or invalid.', 'syntaxhighlighter-prism' ) ), 400 );
		}
		wp_send_json_success( array( 'html' => $this->settings_preview( wp_unslash( $_POST['syntaxhighlighter_settings'] ) ) ) );
	}

	public function settings_preview( $settings = null ) {
		$previous_settings = $this->settings;
		$previous_format = $this->codeformat;
		try {
			if ( null !== $settings ) {
				$this->settings = $this->validate_settings( $settings );
			}
			$this->codeformat = 1;
			$democode = apply_filters( 'syntaxhighlighter_democode', '[sourcecode language="php"]<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<title>PHP Code Example</title>
</head>
<body>
	<h1>' . __( 'PHP Code Example', 'syntaxhighlighter-prism' ) . '</h1>

	<p><?php echo \'' . __( 'Hello World!', 'syntaxhighlighter-prism' ) . '\'; ?></p>

	<div class="foobar">
' . __( '		This	is	an
		example	of	smart
		tabs.', 'syntaxhighlighter-prism' ) . '
	</div>

	<p><?php echo \'https://wordpress.org/\'; ?></p>
</body>
</html>[/sourcecode]' );
			return $this->parse_shortcodes( $democode );
		} finally {
			$this->settings = $previous_settings;
			$this->codeformat = $previous_format;
		}
	}

	// Settings page
	function settings_page() { ?>

<script>
// <![CDATA[
	jQuery(document).ready(function( $ ) {
		// Confirm pressing of the "Reset to Defaults" button
		$("#syntaxhighlighter-defaults").click(function(){
			var areyousure = confirm("<?php echo esc_js( __( 'Are you sure you want to reset your settings to the defaults?', 'syntaxhighlighter-prism' ) ); ?>");
			if ( true != areyousure ) return false;
		});
		<?php if ( ! empty( $_GET['defaults'] ) ) : ?>
		$("#message p strong").text("<?php echo esc_js( __( 'Settings reset to defaults.', 'syntaxhighlighter-prism' ) ); ?>");
		<?php endif; ?>
	});
// ]]>
</script>

<div class="wrap">
	<h2><?php esc_html_e( 'SyntaxHighlighter Settings', 'syntaxhighlighter-prism' ); ?></h2>

	<form method="post" action="options.php" id="syntaxhighlighter-settings">

	<?php settings_fields('syntaxhighlighter_settings'); ?>


	<table class="form-table">
		<tr valign="top">
			<th scope="row"><?php esc_html_e( 'Highlighting engine', 'syntaxhighlighter-prism' ); ?></th>
			<td>
				<strong>Prism.js 1.30.0</strong>
				<input type="hidden" name="syntaxhighlighter_settings[shversion]" value="<?php echo esc_attr( $this->settings['shversion'] ); ?>" />
				<p><?php esc_html_e( 'Legacy version settings are retained for rollback. Prism supplies copying and optional line wrapping without Flash.', 'syntaxhighlighter-prism' ); ?></p>
			</td>
		</tr>
		<tr valign="top">
			<th scope="row"><label for="syntaxhighlighter-theme"><?php esc_html_e( 'Color Theme', 'syntaxhighlighter-prism' ); ?></label></th>
			<td>
				<select name="syntaxhighlighter_settings[theme]" id="syntaxhighlighter-theme" class="postform">
<?php
					$modern = $this->prism->themes();
					$groups = array(
						__( 'Prism themes', 'syntaxhighlighter-prism' ) => array_intersect_key( $this->themes, $modern ),
						__( 'Legacy and custom themes', 'syntaxhighlighter-prism' ) => array_diff_key( $this->themes, $modern ),
					);
					foreach ( $groups as $label => $choices ) {
						if ( empty( $choices ) ) {
							continue;
						}
						echo '<optgroup label="' . esc_attr( $label ) . '">';
						foreach ( $choices as $theme => $name ) {
							echo '<option value="' . esc_attr( $theme ) . '"' . selected( $this->settings['theme'], $theme, false ) . '>' . esc_html( $name ) . '</option>';
						}
						echo '</optgroup>';
					}
?>
				</select>
				<p class="description"><?php esc_html_e( 'The default for all code blocks and shortcodes, unless a block selects its own theme. Legacy theme names retain their Coy light/dark mappings.', 'syntaxhighlighter-prism' ); ?></p>
			</td>
		</tr>
		<tr valign="top">
			<th scope="row"><?php esc_html_e( 'Load All Brushes', 'syntaxhighlighter-prism' ); ?></th>
			<td>
				<fieldset>
					<legend class="hidden"><?php esc_html_e( 'Load All Brushes', 'syntaxhighlighter-prism' ); ?></legend>
					<label for="syntaxhighlighter-loadallbrushes">
						<input name="syntaxhighlighter_settings[loadallbrushes]" type="checkbox" id="syntaxhighlighter-loadallbrushes" value="1" <?php checked( $this->settings['loadallbrushes'], 1 ); ?> />
						<?php
							echo wp_kses( __( 'Always load all local grammars. This compatibility setting increases page weight; normally rendered blocks and legacy <code>&lt;pre class="brush: ..."&gt;</code> content select their own grammars.', 'syntaxhighlighter-prism' ), array( 'code' => array() ) );
						?>
					</label>
				</fieldset>
			</td>
		</tr>
	</table>

	<h3><?php esc_html_e( 'Defaults', 'syntaxhighlighter-prism' ); ?></h3>

	<p><?php esc_html_e( 'All of the settings below can be configured on a per-code block basis, but you can control the defaults of all code blocks here.', 'syntaxhighlighter-prism' ); ?></p>

	<table class="form-table">
		<tr valign="top">
			<th scope="row"><?php esc_html_e( 'Miscellaneous', 'syntaxhighlighter-prism' ); ?></th>
			<td>
				<fieldset>
					<legend class="hidden"><?php esc_html_e( 'Miscellaneous', 'syntaxhighlighter-prism' ); ?></legend>

					<label for="syntaxhighlighter-gutter"><input name="syntaxhighlighter_settings[gutter]" type="checkbox" id="syntaxhighlighter-gutter" value="1" <?php checked( $this->settings['gutter'], 1 ); ?> /> <?php esc_html_e( 'Display line numbers', 'syntaxhighlighter-prism' ); ?></label><br />
					<label for="syntaxhighlighter-copy"><input name="syntaxhighlighter_settings[copy]" type="checkbox" id="syntaxhighlighter-copy" value="1" <?php checked( $this->settings['copy'], 1 ); ?> /> <?php esc_html_e( 'Display the copy button', 'syntaxhighlighter-prism' ); ?></label><br />
					<label for="syntaxhighlighter-toolbar"><input name="syntaxhighlighter_settings[toolbar]" type="checkbox" id="syntaxhighlighter-toolbar" value="1" <?php checked( $this->settings['toolbar'], 1 ); ?> /> <?php esc_html_e( 'Display the toolbar', 'syntaxhighlighter-prism' ); ?></label><br />
					<label for="syntaxhighlighter-autolinks"><input name="syntaxhighlighter_settings[autolinks]" type="checkbox" id="syntaxhighlighter-autolinks" value="1" <?php checked( $this->settings['autolinks'], 1 ); ?> /> <?php esc_html_e( 'Automatically make URLs clickable', 'syntaxhighlighter-prism' ); ?></label><br />
					<label for="syntaxhighlighter-collapse"><input name="syntaxhighlighter_settings[collapse]" type="checkbox" id="syntaxhighlighter-collapse" value="1" <?php checked( $this->settings['collapse'], 1 ); ?> /> <?php esc_html_e( 'Collapse code boxes', 'syntaxhighlighter-prism' ); ?></label><br />
					<label for="syntaxhighlighter-light"><input name="syntaxhighlighter_settings[light]" type="checkbox" id="syntaxhighlighter-light" value="1" <?php checked( $this->settings['light'], 1 ); ?> /> <?php esc_html_e( 'Use the light display mode, best for single lines of code', 'syntaxhighlighter-prism' ); ?></label><br />
					<label for="syntaxhighlighter-smarttabs"><input name="syntaxhighlighter_settings[smarttabs]" type="checkbox" id="syntaxhighlighter-smarttabs" value="1" <?php checked( $this->settings['smarttabs'], 1 ); ?> /> <?php esc_html_e( 'Use smart tabs allowing tabs being used for alignment', 'syntaxhighlighter-prism' ); ?></label><br />
					<label for="syntaxhighlighter-wraplines"><input name="syntaxhighlighter_settings[wraplines]" type="checkbox" id="syntaxhighlighter-wraplines" value="1" <?php checked( $this->settings['wraplines'], 1 ); ?> /> <?php esc_html_e( 'Wrap long lines (disable for horizontal scrolling)', 'syntaxhighlighter-prism' ); ?></label><br />
					<label for="syntaxhighlighter-quickcode"><input name="syntaxhighlighter_settings[quickcode]" type="checkbox" id="syntaxhighlighter-quickcode" value="1" <?php checked( $this->settings['quickcode'], 1 ); ?> /> <?php esc_html_e( 'Select source on double click', 'syntaxhighlighter-prism' ); ?></label><br />
					<!--<label for="syntaxhighlighter-htmlscript"><input name="syntaxhighlighter_settings[htmlscript]" type="checkbox" id="syntaxhighlighter-htmlscript" value="1" <?php checked( $this->settings['htmlscript'], 1 ); ?> /> <?php esc_html_e( 'Enable &quot;HTML script&quot; mode by default (see the bottom of this page for details). Checking this box is not recommended as this mode only works with certain languages.', 'syntaxhighlighter-prism' ); ?></label>-->
				</fieldset>
			</td>
		</tr>
		<tr valign="top">
			<th scope="row"><label for="syntaxhighlighter-classname"><?php esc_html_e( 'Additional CSS Class(es)', 'syntaxhighlighter-prism' ); ?></label></th>
			<td><input name="syntaxhighlighter_settings[classname]" type="text" id="syntaxhighlighter-classname" value="<?php echo esc_attr( $this->settings['classname'] ); ?>" class="regular-text" /></td>
		</tr>
		<tr valign="top">
			<th scope="row"><label for="syntaxhighlighter-firstline"><?php esc_html_e( 'Starting Line Number', 'syntaxhighlighter-prism' ); ?></label></th>
			<td><input name="syntaxhighlighter_settings[firstline]" type="text" id="syntaxhighlighter-firstline" value="<?php echo esc_attr( $this->settings['firstline'] ); ?>" class="small-text" /></td>
		</tr>
		<tr valign="top">
			<th scope="row"><label for="syntaxhighlighter-padlinenumbers"><?php esc_html_e( 'Line Number Padding', 'syntaxhighlighter-prism' ); ?></label></th>
			<td>
				<select name="syntaxhighlighter_settings[padlinenumbers]" id="syntaxhighlighter-padlinenumbers" class="postform">
<?php
					$linepaddings = array(
						'false' => __( 'Off', 'syntaxhighlighter-prism' ),
						'true'  => __( 'Automatic', 'syntaxhighlighter-prism' ),
						1       => 1,
						2       => 2,
						3       => 3,
						4       => 4,
						5       => 5,
					);

					foreach ( $linepaddings as $value => $name ) {
						echo '					<option value="' . esc_attr( $value ) . '"' . selected( $this->settings['padlinenumbers'], $value, false ) . '>' . esc_html( $name ) . "&nbsp;</option>\n";
					}
?>
				</select>
			</td>
		</tr>
		<tr valign="top">
			<th scope="row"><label for="syntaxhighlighter-tabsize"><?php esc_html_e( 'Tab Size', 'syntaxhighlighter-prism' ); ?></label></th>
			<td><input name="syntaxhighlighter_settings[tabsize]" type="text" id="syntaxhighlighter-tabsize" value="<?php echo esc_attr( $this->settings['tabsize'] ); ?>" class="small-text" /></td>
		</tr>
		<tr valign="top">
			<th scope="row"><label for="syntaxhighlighter-title"><?php esc_html_e( 'Title', 'syntaxhighlighter-prism' ); ?></label></th>
			<td>
				<input name="syntaxhighlighter_settings[title]" type="text" id="syntaxhighlighter-title" value="<?php echo esc_attr( $this->settings['title'] ); ?>" class="regular-text" /><br />
				<?php esc_html_e( 'Some optional default text to display above each code block or as the clickable text for collapsed code blocks.', 'syntaxhighlighter-prism' ); ?>
			</td>
		</tr>
	</table>

	<p class="submit">
<?php
		if ( function_exists( 'submit_button' ) ) {
			submit_button( null, 'primary', 'syntaxhighlighter-submit', false );
			echo ' ';
			submit_button( __( 'Reset to Defaults', 'syntaxhighlighter-prism' ), 'primary', 'syntaxhighlighter-defaults', false );
		} else {
			echo '<input type="submit" name="syntaxhighlighter-submit" class="button-primary" value="' . __( 'Save Changes') . '" />' . "\n";
			echo '<input type="submit" name="syntaxhighlighter-defaults" id="syntaxhighlighter-defaults" class="button-primary" value="' . __( 'Reset to Defaults', 'syntaxhighlighter-prism' ) . '" />' . "\n";
		}
?>
	</p>

	</form>

	<h3><?php esc_html_e( 'Preview', 'syntaxhighlighter-prism' ); ?></h3>

	<p><?php esc_html_e( 'Changes are previewed immediately. Click "Save Changes" to apply them to your site.', 'syntaxhighlighter-prism' ); ?></p>
	<p id="syntaxhighlighter-preview-status" role="status" aria-live="polite"></p>

	<?php

		echo '<div id="syntaxhighlighter-settings-preview"';
		if ( ! empty( $GLOBALS['content_width'] ) )
			echo ' style="max-width:' . intval( $GLOBALS['content_width'] ) . 'px"';
		echo '>';

		echo $this->settings_preview();

		echo '</div>';
?>

	<h3 style="margin-top:30px"><?php esc_html_e( 'Shortcode Parameters', 'syntaxhighlighter-prism' ); ?></h3>

	<p><?php printf( __( 'These are the parameters you can pass to the shortcode and what they do. For the booleans (i.e. on/off), pass %1$s/%2$s or %3$s/%4$s.', 'syntaxhighlighter-prism' ), '<code>true</code>', '<code>1</code>', '<code>false</code>', '<code>0</code>' ); ?></p>

	<ul class="ul-disc">
		<li>
			<?php
				echo wp_kses(
					sprintf(
						// translators: %1$s Lang parameter; %2$s Language parameter; %3$s List of brush names.
						_x( '%1$s or %2$s &#8212; The language syntax to highlight with. You can alternately just use that as the tag, such as <code>[php]code[/php]</code>. Available tags: %3$s.', 'language parameter', 'syntaxhighlighter-prism' ),
						'<code>lang</code>',
						'<code>language</code>',
						implode( ', ', array_keys( $this->brushes ) )
					),
					array(
						'a' => array(
							'href' => array(),
						),
						'code' => array(),
					)
				);
			?>
		</li>
		<li>
			<?php
				printf(
					// translators: %s Autolinks parameter.
					esc_html_x( '%s &#8212; Toggle automatic URL linking.', 'autolinks parameter', 'syntaxhighlighter-prism' ),
					'<code>autolinks</code>'
				);
			?>
		</li>
		<li>
			<?php
				printf(
					// translators: %s Classname parameter.
					esc_html_x( '%s &#8212; Add an additional CSS class to the code box.', 'classname parameter', 'syntaxhighlighter-prism' ),
					'<code>classname</code>'
				);
			?>
		</li>
		<li>
			<?php
				printf(
					// translators: %s Collapse parameter.
					esc_html_x( '%s &#8212; Toggle collapsing the code box by default, requiring a click to expand it. Good for large code posts.', 'collapse parameter', 'syntaxhighlighter-prism' ),
					'<code>collapse</code>'
				);
			?>
		</li>
		<li>
			<?php
				printf(
					// translators: %s Firstline parameter.
					esc_html_x( '%s &#8212; An interger specifying what number the first line should be (for the line numbering).', 'firstline parameter', 'syntaxhighlighter-prism' ),
					'<code>firstline</code>'
				);
			?>
		</li>
		<li>
			<?php
				printf(
					// translators: %s Gutter parameter.
					esc_html_x( '%s &#8212; Toggle the left-side line numbering.', 'gutter parameter', 'syntaxhighlighter-prism' ),
					'<code>gutter</code>'
				);
			?>
		</li>
		<li>
			<?php
				printf(
					// translators: %1$s Highlight parameter; %2$s Example.
					esc_html_x( '%1$s &#8212; A comma-separated list of line numbers to highlight. You can also specify a range. Example: %2$s', 'highlight parameter', 'syntaxhighlighter-prism' ),
					'<code>highlight</code>',
					'<code>2,5-10,12</code>'
				);
			?>
		</li>
		<li>
			<?php
				printf(
					// translators: %s Htmlscript parameter.
					esc_html_x( "%s &#8212; Toggle highlighting any extra HTML/XML. Good for when you're mixing HTML/XML with another language, such as having PHP inside an HTML web page. This only works with certain languages.", 'htmlscript parameter', 'syntaxhighlighter-prism' ),
					'<code>htmlscript</code>'
				);
			?>
		</li>
		<li>
			<?php
				printf(
					// translators: %s Light parameter.
					esc_html_x( '%s &#8212; Toggle light mode which disables the gutter and toolbar all at once.', 'light parameter', 'syntaxhighlighter-prism' ),
					'<code>light</code>'
				);
			?>
		</li>
		<li>
			<?php
				printf(
					// translators: %s Padlinenumbers parameter.
					esc_html_x( '%s &#8212; Controls line number padding. Valid values are <code>false</code> (no padding), <code>true</code> (automatic padding), or an integer (forced padding).', 'padlinenumbers parameter', 'syntaxhighlighter-prism' ),
					'<code>padlinenumbers</code>'
				);
			?>
		</li>
		<li>
			<?php
				printf(
					// translators: %1$s Title parameter; %2$s Collapse parameter.
					esc_html_x( '%1$s (v3 only) &#8212; Sets some text to show up before the code. Very useful when combined with the %2$s parameter.', 'title parameter', 'syntaxhighlighter-prism' ),
					'<code>title</code>',
					'<code>collapse</code>'
				);
			?>
		</li>
		<li>
			<?php
				printf(
					// translators: %s Toolbar parameter.
					esc_html_x( '%s &#8212; Toggle the toolbar (buttons in v2, the about question mark in v3)', 'toolbar parameter', 'syntaxhighlighter-prism' ),
					'<code>toolbar</code>'
				);
			?>
		</li>
		<li>
			<?php
				printf(
					// translators: %s Wraplines parameter.
					esc_html_x( '%s (v2 only) &#8212; Toggle line wrapping.', 'wraplines parameter', 'syntaxhighlighter-prism' ),
					'<code>wraplines</code>'
				);
			?>
		</li>
		<li>
			<?php
				printf(
					// translators: %s Quickcode parameter.
					esc_html_x( '%s &#8212; Enable edit mode on double click.', 'quickcode parameter', 'syntaxhighlighter-prism' ),
					'<code>quickcode</code>'
				);
			?>
		</li>
	</ul>

	<p><?php esc_html_e( 'Some example shortcodes:', 'syntaxhighlighter-prism' ); ?></p>

	<ul class="ul-disc">
		<li><code>[php]<?php esc_html_e( 'your code here', 'syntaxhighlighter-prism' ); ?>[/php]</code></li>
		<li><code>[css autolinks=&quot;false&quot; classname=&quot;myclass&quot; collapse=&quot;false&quot; firstline=&quot;1&quot; gutter=&quot;true&quot; highlight=&quot;1-3,6,9&quot; htmlscript=&quot;false&quot; light=&quot;false&quot; padlinenumbers=&quot;false&quot; smarttabs=&quot;true&quot; tabsize=&quot;4&quot; toolbar=&quot;true&quot; title=&quot;<?php esc_html_e( 'example-filename.php', 'syntaxhighlighter-prism' ); ?>&quot;]<?php esc_html_e( 'your code here', 'syntaxhighlighter-prism' ); ?>[/css]</code></li>
		<li><code>[code lang=&quot;js&quot;]<?php esc_html_e( 'your code here', 'syntaxhighlighter-prism' ); ?>[/code]</code></li>
		<li><code>[sourcecode language=&quot;plain&quot;]<?php esc_html_e( 'your code here', 'syntaxhighlighter-prism' ); ?>[/sourcecode]</code></li>
	</ul>

<?php $this->maybe_output_scripts(); ?>

</div>

<?php
	}


	// Validate the settings sent from the settings page
	function validate_settings( $settings ) {
		if ( ! current_user_can( 'manage_options' ) ) {
			return $this->settings;
		}
		if ( ! empty( $_POST['syntaxhighlighter-defaults'] ) ) {
			return $this->defaultsettings;
		}
		$settings = is_array( $settings ) ? $settings : array();
		$normalized = $this->prism->options( array_merge( $this->defaultsettings, $settings ) );
		$normalized['theme'] = isset( $settings['theme'] ) && is_string( $settings['theme'] ) && isset( $this->themes[ $settings['theme'] ] ) ? $settings['theme'] : $this->defaultsettings['theme'];
		foreach ( array( 'loadallbrushes', 'autolinks', 'collapse', 'gutter', 'light', 'smarttabs', 'toolbar', 'wraplines', 'quickcode', 'copy' ) as $key ) {
			$normalized[ $key ] = SyntaxHighlighter_Prism_Renderer::boolean( $settings[ $key ] ?? false ) ? 1 : 0;
		}
		$normalized['shversion'] = isset( $settings['shversion'] ) ? ( 2 === (int) $settings['shversion'] ? 2 : 3 ) : $this->settings['shversion'];
		return array_merge( $this->settings, $normalized );
	}

}


// Start this plugin once all other plugins are fully loaded
add_action( 'init', 'SyntaxHighlighter', 5 );
function SyntaxHighlighter() {
	global $SyntaxHighlighter;
	$SyntaxHighlighter = new SyntaxHighlighter();
}
}
