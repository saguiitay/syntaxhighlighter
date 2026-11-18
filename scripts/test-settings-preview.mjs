import { runCLI } from '@wp-playground/cli';
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { verifySettingsPreview } from '../tests/browser/settings-preview.mjs';

const wpVersion = process.env.WP_VERSION || '7.1.4';
const phpVersion = process.env.PHP_VERSION || '8.2';
const instance = await runCLI({
	command: 'server',
	wp: wpVersion,
	php: phpVersion,
	port: Number(process.env.WP_PORT || 9483),
	workers: 2,
	login: true,
	intl: false,
	mount: [
		{
			hostPath: resolve('.'),
			vfsPath: '/wordpress/wp-content/plugins/syntaxhighlighter-prism',
		},
		{ hostPath: resolve('tests'), vfsPath: '/test-suite' },
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
	const result = await instance.playground.run({
		code: "<?php require '/test-suite/wordpress/settings-preview.php';",
	});
	assert.equal(result.exitCode, 0, result.errors + result.text);
	assert.equal(result.errors, '', result.errors);
	const data = JSON.parse(new TextDecoder().decode(result.bytes));
	console.log(
		`${data.assertions} focused WordPress preview assertions passed.`,
	);
	browser = await chromium.launch();
	const page = await browser.newPage();
	page.setDefaultTimeout(30000);
	page.setDefaultNavigationTimeout(120000);
	const errors = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await verifySettingsPreview(page, instance.serverUrl, instance.playground);
	assert.deepEqual(errors, [], 'Settings preview caused browser errors.');
	console.log(
		'Live settings, renderer parity, save/reload, error recovery and AJAX permission/nonce checks passed.',
	);
} finally {
	await browser?.close();
	await instance[Symbol.asyncDispose]();
}
