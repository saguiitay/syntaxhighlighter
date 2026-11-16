import { readFile, mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { unzipSync } from 'fflate';
import assert from 'node:assert/strict';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const entries = unzipSync(
	await readFile(`artifacts/syntaxhighlighter-prism-${pkg.version}.zip`),
);
await mkdir('.cache', { recursive: true });
const directory = await mkdtemp(resolve('.cache/package-validation-'));
try {
	for (const [name, content] of Object.entries(entries)) {
		assert.ok(
			name.startsWith('syntaxhighlighter-prism/') &&
				!name.split('/').includes('..'),
		);
		const path = join(directory, name);
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, content);
	}
	const result = spawnSync(process.execPath, ['scripts/test-wordpress.mjs'], {
		stdio: 'inherit',
		env: {
			...process.env,
			PLUGIN_DIR: join(directory, 'syntaxhighlighter-prism'),
			WP_VERSION: '7.1.4',
			PHP_VERSION: '8.5',
			WP_PORT: '9482',
		},
	});
	assert.equal(
		result.status,
		0,
		'Packaged plugin failed real WordPress integration',
	);
	console.log(
		'Production ZIP installed and exercised without source, npm or Composer dependencies in the plugin directory.',
	);
} finally {
	await rm(directory, { recursive: true, force: true });
}
