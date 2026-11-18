import { runCLI } from '@wp-playground/cli';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { verifyEditorPreview } from '../tests/browser/editor-preview.mjs';

await mkdir('artifacts', { recursive: true });
const wpVersion = process.env.WP_VERSION || '6.8.12';
const phpVersion = process.env.PHP_VERSION || '8.2';
const instance = await runCLI({
	command: 'server',
	wp: wpVersion,
	php: phpVersion,
	port: Number(process.env.WP_PORT || 9484),
	workers: 2,
	login: true,
	intl: false,
	mount: [
		{
			hostPath: resolve('.'),
			vfsPath: '/wordpress/wp-content/plugins/syntaxhighlighter-prism',
		},
	],
	blueprint: {
		preferredVersions: { wp: wpVersion, php: phpVersion },
		steps: [
			{
				step: 'activatePlugin',
				pluginPath: 'syntaxhighlighter-prism/syntaxhighlighter.php',
			},
		],
	},
});
let browser;
try {
	const ready = await fetch(instance.serverUrl, { redirect: 'manual' });
	assert.ok(ready.status >= 200 && ready.status < 400);
	browser = await chromium.launch();
	const page = await browser.newPage();
	page.setDefaultTimeout(30000);
	page.setDefaultNavigationTimeout(120000);
	const errors = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto(instance.serverUrl, { waitUntil: 'networkidle' });
	assert.equal(
		await page.locator('link[href*="syntaxhighlighter-prism/dist"]').count(),
		0,
		'Editor styles leaked onto a frontend page without code.',
	);
	await verifyEditorPreview(page, instance.serverUrl);
	assert.deepEqual(errors, [], 'Editor preview caused browser errors.');
	console.log(
		`WordPress ${wpVersion} / PHP ${phpVersion}: editor preview colors, live typing, themes, line options and toggle recovery passed.`,
	);
} finally {
	await browser?.close();
	await instance[Symbol.asyncDispose]();
}
