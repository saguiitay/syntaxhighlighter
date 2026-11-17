import { build, transform } from 'esbuild';
import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const components = require('prismjs/components.json').languages;
const { aliases } = JSON.parse(await readFile('languages.json', 'utf8'));
const themes = JSON.parse(await readFile('themes.json', 'utf8'));
await mkdir('dist/grammars', { recursive: true });
await mkdir('dist/themes', { recursive: true });
const grammarIds = new Set();
function visit(id) {
	if (id === 'plain' || grammarIds.has(id)) return;
	if (!components[id]) throw new Error(`Unknown Prism grammar: ${id}`);
	for (const dep of [components[id].require || []].flat()) visit(dep);
	grammarIds.add(id);
}
Object.values(aliases).forEach(visit);
const manifest = {
	aliases,
	dependencies: {},
	themes: Object.fromEntries(
		Object.entries(themes).map(([id, theme]) => [id, theme.name]),
	),
};
for (const id of grammarIds) {
	manifest.dependencies[id] = [components[id].require || []].flat();
	let source = await readFile(
		require.resolve(`prismjs/components/prism-${id}.js`),
		'utf8',
	);
	if (id === 'kusto')
		source += '\n' + (await readFile('src/kusto-extension.js', 'utf8'));
	const { code } = await transform(
		`(function(Prism){${source}\n})(window.SyntaxHighlighterPrism);`,
		{ minify: true },
	);
	await writeFile(`dist/grammars/${id}.js`, code);
}
const core = await readFile(
	require.resolve('prismjs/components/prism-core.js'),
	'utf8',
);
const { code } = await transform(
	`window.SyntaxHighlighterPrism=(function(){var window,global;var module={exports:{}};${core}\nmodule.exports.manual=true;module.exports.disableWorkerMessageHandler=true;return module.exports;})();`,
	{ minify: true },
);
await writeFile('dist/prism-core.js', code);
await writeFile('dist/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
await build({
	entryPoints: ['src/frontend.js'],
	bundle: true,
	minify: true,
	outfile: 'dist/frontend.js',
	target: 'es2020',
});
await build({
	entryPoints: ['src/settings-preview.js'],
	bundle: true,
	minify: true,
	outfile: 'dist/settings-preview.js',
	target: 'es2020',
});
await writeFile(
	'dist/runtime.js',
	code + '\n' + (await readFile('dist/frontend.js', 'utf8')),
);
const coy = await readFile(
	require.resolve('prismjs/themes/prism-coy.css'),
	'utf8',
);
await build({
	stdin: {
		contents: `.sh-prism {\n${coy}\n}\n${await readFile('src/frontend.css', 'utf8')}`,
		loader: 'css',
	},
	supported: { nesting: false },
	banner: {
		css: '/*! Prism.js Coy theme by Tim Shedor. MIT; see PRISM-LICENSE. */',
	},
	minify: true,
	outfile: 'dist/frontend.css',
});
for (const [id, theme] of Object.entries(themes)) {
	const filename = id === 'prism-default' ? 'prism' : id;
	const css = await readFile(
		require.resolve(`prismjs/themes/${filename}.css`),
		'utf8',
	);
	// Keep upstream token rules without replacing the compact code/gutter layout.
	const tokenStart = css.search(/^\.token[.\s,{]/m);
	if (tokenStart < 0) throw new Error(`Missing token rules in ${filename}`);
	await build({
		stdin: {
			contents: `.sh-prism.sh-theme-${id} {
				--sh-bg: ${theme.background};
				--sh-ink: ${theme.foreground};
				--sh-muted: ${theme.muted};
				--sh-rule: ${theme.muted}66;
				--sh-keyword: ${theme.foreground};
				--sh-stripe: transparent;
				--sh-shadow: transparent;
				.token { color: inherit; background: transparent; opacity: 1; }
				${css.slice(tokenStart)}
			}`,
			loader: 'css',
		},
		supported: { nesting: false },
		banner: {
			css: `/*! ${theme.name} theme from Prism.js. MIT; see PRISM-LICENSE. */`,
		},
		minify: true,
		outfile: `dist/themes/${id}.css`,
	});
}
await build({
	entryPoints: ['src/index.js'],
	bundle: true,
	minify: true,
	outfile: 'dist/blocks.build.js',
	loader: { '.js': 'jsx', '.scss': 'empty' },
	jsxFactory: 'wp.element.createElement',
	jsxFragment: 'wp.element.Fragment',
	plugins: [
		{
			name: 'wordpress-externals',
			setup(builder) {
				builder.onResolve({ filter: /^@wordpress\// }, ({ path }) => ({
					path,
					namespace: 'wordpress',
				}));
				builder.onLoad(
					{ filter: /.*/, namespace: 'wordpress' },
					({ path }) => ({
						contents: `module.exports = wp.${path.slice('@wordpress/'.length).replace(/-([a-z])/g, (_, c) => c.toUpperCase())};`,
					}),
				);
			},
		},
	],
});
await copyFile('src/editor.css', 'dist/blocks.editor.build.css');
await copyFile(require.resolve('prismjs/LICENSE'), 'dist/PRISM-LICENSE');
console.log(
	`Built editor, frontend and ${grammarIds.size} dependency-aware local grammars.`,
);
