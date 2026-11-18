import {
	PanelBody,
	PanelRow,
	SelectControl,
	ToggleControl,
	TextControl,
	ToolbarGroup,
	ComboboxControl,
} from '@wordpress/components';

import { Fragment } from '@wordpress/element';

import { InspectorControls, BlockControls } from '@wordpress/block-editor';
import { __ } from '@wordpress/i18n';
import languageToolbar from './toolbar.language';

export default ( { attributes, setAttributes } ) => {
	const blockSettings = [];
	const toolbar = [];

	const {
		language,
		lineNumbers,
		firstLineNumber,
		highlightLines,
		wrapLines,
		makeURLsClickable,
		quickCode,
	} = attributes;

	const { settings, brushes } = window.syntaxHighlighterData;

	// Language
	if ( settings.language.supported ) {
		const options = [];
		for ( const brush in brushes ) {
			options.push( {
				label: brushes[ brush ],
				value: brush,
			} );
		}

		blockSettings.push(
			<PanelRow key="code-language">
				<ComboboxControl
					label={ __( 'Code Language', 'syntaxhighlighter-prism' ) }
					value={ language }
					options={ options }
					onChange={ ( nextLanguage ) => setAttributes( { language: nextLanguage } ) }>
				</ComboboxControl>
			</PanelRow>
		);

		toolbar.push( languageToolbar( { attributes, setAttributes, options } ) );
	}

	// Line numbers
	if ( settings.lineNumbers.supported ) {
		blockSettings.push(
			<PanelRow key="show-line-numbers">
				<ToggleControl
					label={ __( 'Show Line Numbers', 'syntaxhighlighter-prism' ) }
					checked={ lineNumbers }
					onChange={ ( nextLineNumbers ) => setAttributes( { lineNumbers: nextLineNumbers } ) }>
				</ToggleControl>
			</PanelRow>,
		);
	}

	// First line number
	if ( lineNumbers && settings.firstLineNumber.supported ) {
		blockSettings.push(
			<PanelRow key="first-line-number">
				<TextControl
					label={ __( 'First Line Number', 'syntaxhighlighter-prism' ) }
					type="number"
					value={ firstLineNumber }
					onChange={ ( nextFirstLineNumber ) => setAttributes( { firstLineNumber: nextFirstLineNumber } ) }
					min="1"
					max="100000">
				</TextControl>
			</PanelRow>,
		);
	}

	// Highlight line(s)
	if ( settings.highlightLines.supported ) {
		blockSettings.push(
			<PanelRow key="highlight-lines">
				<TextControl
					label={ __( 'Highlight Lines', 'syntaxhighlighter-prism' ) }
					value={ highlightLines }
					help={ __( 'A comma-separated list of line numbers to highlight. Can also be a range. Example: 1,5,10-20', 'syntaxhighlighter-prism' ) }
					onChange={ ( nextHighlightLines ) => setAttributes( { highlightLines: nextHighlightLines } ) }>
				</TextControl>
			</PanelRow>,
		);
	}

	// Wrap long lines
	if ( settings.wrapLines.supported ) {
		blockSettings.push(
			<PanelRow key="wrap-long-lines">
				<ToggleControl
					label={ __( 'Wrap Long Lines', 'syntaxhighlighter-prism' ) }
					checked={ wrapLines }
					onChange={ ( nextWrapLines ) => setAttributes( { wrapLines: nextWrapLines } ) }>
				</ToggleControl>
			</PanelRow>,
		);
	}

	// Make URLs clickable
	if ( settings.makeURLsClickable.supported ) {
		blockSettings.push(
			<PanelRow key="make-urls-clickable">
				<ToggleControl
					label={ __( 'Make URLs Clickable', 'syntaxhighlighter-prism' ) }
					checked={ makeURLsClickable }
					onChange={ ( nextMakeURLsClickable ) => setAttributes( { makeURLsClickable: nextMakeURLsClickable } ) }>
				</ToggleControl>
			</PanelRow>,
		);
	}

	// Quick code
	if ( settings.quickCode.supported ) {
		blockSettings.push(
			<PanelRow key="edit-mode">
				<ToggleControl
					label={ __( 'Enable edit mode on double click', 'syntaxhighlighter-prism' ) }
					checked={ quickCode }
					onChange={ ( nextQuickCode ) => setAttributes( { quickCode: nextQuickCode } ) }>
				</ToggleControl>
			</PanelRow>,
		);
	}

	return <Fragment>
		<BlockControls>
			<ToolbarGroup>
				{ toolbar }
			</ToolbarGroup>
		</BlockControls>
		<InspectorControls key="syntaxHighlighterInspectorControls">
			<PanelBody title={ __( 'Settings', 'syntaxhighlighter-prism' ) }>
				<SelectControl
					label={ __( 'Theme', 'syntaxhighlighter-prism' ) }
					value={ attributes.theme || '' }
					options={ [
						{ label: __( 'Site setting', 'syntaxhighlighter-prism' ), value: '' },
						...Object.entries( window.syntaxHighlighterData.themes ).map( ( [ value, label ] ) => ( { value, label } ) ),
					] }
					onChange={ ( theme ) => setAttributes( { theme: theme || undefined } ) }
				/>
				<ToggleControl
					label={ __( 'Collapse code', 'syntaxhighlighter-prism' ) }
					checked={ !! attributes.collapse }
					onChange={ ( collapse ) => setAttributes( { collapse } ) }
				/>
				{ blockSettings }
			</PanelBody>
		</InspectorControls>
	</Fragment>;
};
