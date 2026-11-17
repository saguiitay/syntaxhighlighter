import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { zipSync, unzipSync } from 'fflate';
import assert from 'node:assert/strict';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const files = [
	'syntaxhighlighter.php',
	'includes/class-prism-renderer.php',
	'syntaxhighlighter.js',
	'syntaxhighlighter_mce-4.js',
	'syntaxhighlighter_mce.js',
	'README.md',
	'readme.txt',
	'LICENSE',
	'CHANGELOG.md',
	'docs/third-party-licenses.md',
	'docs/architecture.md',
	'docs/compatibility.md',
	'docs/development.md',
	'docs/security.md',
	'docs/performance.md',
	'docs/performance-results.json',
	'dist/runtime.js',
	'dist/settings-preview.js',
	'dist/frontend.css',
	'dist/manifest.json',
	'dist/blocks.build.js',
	'dist/blocks.editor.build.css',
	'dist/PRISM-LICENSE',
];
for (const name of (await readdir('dist/grammars')).sort()) {
	if (name.endsWith('.js')) files.push(join('dist/grammars', name));
}
const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
for (const id of Object.keys(manifest.themes)) {
	files.push(join('dist/themes', `${id}.css`));
}
const archive = {};
const hashes = {};
for (const file of files.sort()) {
	const bytes = new Uint8Array(await readFile(file));
	const name = `syntaxhighlighter-prism/${file.replaceAll('\\', '/')}`;
	archive[name] = [bytes, { mtime: new Date(1980, 0, 1), level: 9 }];
	hashes[name] = createHash('sha256').update(bytes).digest('hex');
}
const bytes = zipSync(archive);
assert.deepEqual(
	bytes,
	zipSync(archive),
	'ZIP generation must be deterministic',
);
const unpacked = unzipSync(bytes);
assert.equal(Object.keys(unpacked).length, files.length);
for (const [name, content] of Object.entries(unpacked)) {
	assert.equal(
		createHash('sha256').update(content).digest('hex'),
		hashes[name],
	);
	assert.ok(
		!/node_modules|syntaxhighlighter[23]|third-party-brushes|\/tests\//.test(
			name,
		),
		`Source-only file in ZIP: ${name}`,
	);
}
const packagedManifest = JSON.parse(
	new TextDecoder().decode(
		unpacked['syntaxhighlighter-prism/dist/manifest.json'],
	),
);
for (const id of Object.keys(packagedManifest.dependencies)) {
	assert.ok(unpacked[`syntaxhighlighter-prism/dist/grammars/${id}.js`]);
}
for (const id of Object.keys(packagedManifest.themes)) {
	assert.ok(unpacked[`syntaxhighlighter-prism/dist/themes/${id}.css`]);
}
await mkdir('artifacts', { recursive: true });
const filename = `artifacts/syntaxhighlighter-prism-${pkg.version}.zip`;
await writeFile(filename, bytes);
await writeFile(
	filename + '.sha256',
	createHash('sha256').update(bytes).digest('hex') + '\n',
);
await writeFile(
	'artifacts/package-manifest.json',
	JSON.stringify(hashes, null, 2),
);
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
await writeFile(
	'artifacts/dependency-inventory.json',
	JSON.stringify(
		Object.entries(lock.packages)
			.filter(([path]) => path)
			.map(([path, dependency]) => ({
				path,
				version: dependency.version,
				license: dependency.license || 'See package license',
				developmentOnly: !!dependency.dev,
			})),
		null,
		2,
	),
);
console.log(
	`Verified ${filename}: ${bytes.length} bytes, ${files.length} runtime/license files.`,
);
