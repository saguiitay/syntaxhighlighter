import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('editor labels use the standalone translation catalog without changing the saved block identity', () => {
	const translations = new Map([
		['SyntaxHighlighter Code', 'Code Prism traduit'],
		['Code Language', 'Langue du code'],
		['Show Line Numbers', 'Afficher les numeros de ligne'],
		[
			'Tip: you can choose a code language from the block settings.',
			'Choisissez une langue dans les reglages du bloc.',
		],
	]);
	const settings = Object.fromEntries(
		[
			'language',
			'lineNumbers',
			'firstLineNumber',
			'highlightLines',
			'wrapLines',
			'makeURLsClickable',
			'quickCode',
		].map((key) => [key, { supported: true, default: '' }]),
	);
	let registered;
	const context = vm.createContext({
		window: {
			syntaxHighlighterData: {
				settings,
				brushes: { kusto: 'Kusto' },
				themes: { auto: 'Automatic' },
			},
		},
		wp: {
			blocks: {
				registerBlockType: (name, block) => {
					registered = { name, block };
				},
			},
			i18n: {
				__: (text, domain) =>
					domain === 'syntaxhighlighter-prism'
						? (translations.get(text) ?? text)
						: text,
			},
			element: {
				createElement: (type, props, ...children) => ({
					type,
					props,
					children,
				}),
				Fragment: 'Fragment',
			},
			components: {},
			blockEditor: {},
			escapeHtml: {},
		},
	});
	vm.runInContext(readFileSync('dist/blocks.build.js', 'utf8'), context);
	assert.equal(registered.name, 'syntaxhighlighter/code');
	assert.equal(
		registered.block.title,
		translations.get('SyntaxHighlighter Code'),
	);
	const tree = registered.block.edit({
		attributes: { content: 'StormEvents | take 1', language: 'kusto' },
		setAttributes() {},
		className: 'wp-block-code',
	});
	const output = JSON.stringify(tree);
	for (const text of translations.values()) {
		assert.ok(
			output.includes(text),
			`Missing translated editor label: ${text}`,
		);
	}
});
