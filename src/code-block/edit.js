
import { PlainText } from '@wordpress/block-editor';
import { __ } from '@wordpress/i18n';
import settings from './settings';
import { Fragment } from '@wordpress/element';
import Preview from './preview';
import { unescapeIsolatedUrls } from '../utils';

export default function editSyntaxHighlighterBlock( { attributes, setAttributes, className } ) {
	const {
		content,
	} = attributes;

	const { settings: { tabSize } } = window.syntaxHighlighterData;

	const editView = <div className={ className + ' wp-block-code' }>
		<PlainText
			className="wp-block-syntaxhighlighter__textarea"
			style={ { tabSize, MozTabSize: '' + tabSize } }
			value={ unescapeIsolatedUrls( content ) }
			onKeyDown={ ( event ) => {
				if ( event.key === 'Escape' ) {
					event.target.syntaxHighlighterReleaseTab = true;
				}
				if ( event.key === 'Tab' && event.target.syntaxHighlighterReleaseTab ) {
					event.target.syntaxHighlighterReleaseTab = false;
					return;
				}
				if ( event.key === 'Tab' && ! event.shiftKey && ! event.ctrlKey && ! event.metaKey && ! event.altKey ) {
					event.preventDefault();
					const input = event.target;
					const start = input.selectionStart;
					const current = unescapeIsolatedUrls( content );
					const next = current.slice( 0, start ) + '\t' + current.slice( input.selectionEnd );
					setAttributes( { content: next } );
					requestAnimationFrame( () => { input.selectionStart = input.selectionEnd = start + 1; } );
				}
			} }
			onChange={ ( nextContent ) => setAttributes( { content: nextContent } ) }
			placeholder={ __( 'Tip: you can choose a code language from the block settings.', 'syntaxhighlighter' ) }
			aria-label={ __( 'SyntaxHighlighter Code', 'syntaxhighlighter' ) }
		/>
	</div>;

	return <Fragment>
		{ settings( { attributes, setAttributes } ) }
		{ editView }
		<Preview attributes={ attributes } />
	</Fragment>
	;
}
