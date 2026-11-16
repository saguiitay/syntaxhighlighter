import { runCLI } from '@wp-playground/cli';
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

await mkdir('artifacts', { recursive: true });
const wpVersion = process.env.WP_VERSION || '6.8.12';
const phpVersion = process.env.PHP_VERSION || '8.2';
const instance = await runCLI({
	command: 'server',
	wp: wpVersion,
	php: phpVersion,
	port: Number(process.env.WP_PORT || 9480),
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
				step: 'installTheme',
				themeData: {
					resource: 'wordpress.org/themes',
					slug: 'twentytwentyone',
				},
			},
			{
				step: 'installTheme',
				themeData: {
					resource: 'wordpress.org/themes',
					slug: 'twentytwentyfive',
				},
			},
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
	assert.ok(
		ready.status >= 200 && ready.status < 400,
		'WordPress must respond before testing',
	);
	const result = await instance.playground.run({
		code: `<?php require '/wordpress/wp-content/plugins/syntaxhighlighter-prism/tests/wordpress/integration.php';`,
	});
	assert.equal(result.exitCode, 0, result.errors + result.text);
	assert.equal(result.errors, '', result.errors);
	const data = JSON.parse(new TextDecoder().decode(result.bytes));
	console.log(
		`WordPress ${data.wordpress} / PHP ${data.php}: ${data.assertions} integration assertions passed.`,
	);
	browser = await chromium.launch();
	const context = await browser.newContext();
	const page = await context.newPage();
	page.setDefaultNavigationTimeout(120000);
	const errors = [];
	page.on('pageerror', (error) => errors.push(error.message));
	for (const theme of ['twentytwentyone', 'twentytwentyfive']) {
		const response = await instance.playground.run({
			code: `<?php require '/wordpress/wp-load.php'; switch_theme('${theme}'); echo wp_get_theme()->exists() ? 'ok' : 'missing';`,
		});
		assert.equal(
			new TextDecoder().decode(response.bytes),
			'ok',
			`Theme ${theme} must exist`,
		);
		await page.goto(`${instance.serverUrl}/?p=${data.post}`, {
			waitUntil: 'networkidle',
		});
		assert.equal(await page.locator('pre.syntaxhighlighter-code').count(), 3);
		assert.ok(
			(await page.locator('.language-kusto .token').count()) > 0,
			`KQL tokens with ${theme}`,
		);
		assert.ok((await page.locator('.language-typescript .token').count()) > 0);
		const assets = await page
			.locator('script[src],link[rel="stylesheet"]')
			.evaluateAll((nodes) => nodes.map((node) => node.src || node.href));
		assert.ok(
			!assets.some((url) => /syntaxhighlighter[23]|shCore|shBrush/.test(url)),
		);
		assert.ok(!assets.some((url) => /grammars\/(?:python|ruby)\.js/.test(url)));
		await page.screenshot({
			path: `artifacts/${wpVersion}-${phpVersion}-${theme}.png`,
			fullPage: true,
		});
		await page.goto(`${instance.serverUrl}/?p=${data.empty}`, {
			waitUntil: 'networkidle',
		});
		assert.equal(
			await page
				.locator(
					'script[src*="syntaxhighlighter-prism/dist"],link[href*="syntaxhighlighter-prism/dist"]',
				)
				.count(),
			0,
			'No-code page loaded plugin assets',
		);
	}
	await page.goto(
		`${instance.serverUrl}/wp-admin/post.php?post=${data.editor}&action=edit`,
		{ waitUntil: 'domcontentloaded' },
	);
	await page.waitForFunction(
		() => window.wp?.blocks?.getBlockType('syntaxhighlighter/code'),
		{ timeout: 120000 },
	);
	const fixtures = JSON.parse(
		await readFile('tests/fixtures/legacy-content.json', 'utf8'),
	);
	const editorResult = await page.evaluate((fixtures) => {
		const results = [];
		for (const fixture of fixtures.blocks) {
			const [block] = wp.blocks.parse(fixture.serialized);
			results.push({
				name: fixture.name,
				valid: block.isValid,
				content: block.attributes.content,
				serialized: wp.blocks.serialize([block]),
			});
		}
		for (const language of ['typescript', 'tsx', 'kusto', 'kql']) {
			const source =
				'const html = "<script>alert(1)</script>";\nλ &amp; [gallery]';
			const original = wp.blocks.createBlock('syntaxhighlighter/code', {
				language,
				content: source,
				firstLineNumber: '10',
				highlightLines: '10-11',
			});
			const saved = wp.blocks.serialize([original]);
			const [parsed] = wp.blocks.parse(saved);
			results.push({
				name: language,
				valid: parsed.isValid,
				language: parsed.attributes.language,
				content: parsed.attributes.content,
				source,
			});
		}
		return results;
	}, fixtures);
	for (const result of editorResult) {
		assert.equal(
			result.valid,
			true,
			`Gutenberg validation failed: ${result.name}`,
		);
		if (result.source)
			assert.equal(
				result.content,
				result.source,
				`Editor content changed: ${result.name}`,
			);
	}
	assert.ok(
		!errors.some((error) =>
			/validation|syntaxhighlighter|undefined/i.test(error),
		),
		errors.join('\n'),
	);
	data.editor = editorResult;
	data.themes = ['twentytwentyone', 'twentytwentyfive'];
	data.browserErrors = errors;
	await writeFile(
		`artifacts/wordpress-${wpVersion}-php-${phpVersion}.json`,
		JSON.stringify(data, null, 2),
	);
	console.log(
		'Classic and block themes, conditional assets, old/new Gutenberg serialization: passed.',
	);
} finally {
	await browser?.close();
	await instance[Symbol.asyncDispose]();
}
