import { runCLI } from '@wp-playground/cli';
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

await mkdir('artifacts', { recursive: true });
const wpVersion = process.env.WP_VERSION || '6.8.12';
const phpVersion = process.env.PHP_VERSION || '8.2';
const artifactPrefix = process.env.PLUGIN_DIR ? 'package-' : '';
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
			hostPath: resolve(process.env.PLUGIN_DIR || '.'),
			vfsPath: '/wordpress/wp-content/plugins/syntaxhighlighter-prism',
		},
		{ hostPath: resolve('tests'), vfsPath: '/test-suite' },
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
		code: `<?php require '/test-suite/wordpress/integration.php';`,
	});
	assert.equal(result.exitCode, 0, result.errors + result.text);
	assert.equal(result.errors, '', result.errors);
	const data = JSON.parse(new TextDecoder().decode(result.bytes));
	console.log(
		`WordPress ${data.wordpress} / PHP ${data.php}: ${data.assertions} integration assertions passed.`,
	);
	browser = await chromium.launch();
	const context = await browser.newContext();
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
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
		await page
			.getByRole('button', { name: 'Copy code', exact: true })
			.first()
			.click();
		assert.equal(
			(await page.evaluate(() => navigator.clipboard.readText())).replace(
				/\r\n/g,
				'\n',
			),
			(
				await page
					.locator('pre.syntaxhighlighter-code code')
					.first()
					.textContent()
			).replace(/\r\n/g, '\n'),
			'Real clipboard must contain literal code, not line numbers',
		);
		const assets = await page
			.locator('script[src],link[rel="stylesheet"]')
			.evaluateAll((nodes) => nodes.map((node) => node.src || node.href));
		assert.ok(
			!assets.some((url) => /syntaxhighlighter[23]|shCore|shBrush/.test(url)),
		);
		assert.ok(!assets.some((url) => /grammars\/(?:python|ruby)\.js/.test(url)));
		await page.screenshot({
			path: `artifacts/${artifactPrefix}${wpVersion}-${phpVersion}-${theme}.png`,
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
	await page.keyboard.press('Escape');
	await page.waitForFunction(() =>
		wp.data
			.select('core/block-editor')
			.getBlocks()
			.some((block) => block.name === 'syntaxhighlighter/code'),
	);
	const edited = await page.evaluate(async () => {
		const block = wp.data
			.select('core/block-editor')
			.getBlocks()
			.find((item) => item.name === 'syntaxhighlighter/code');
		const before = { ...block.attributes };
		wp.data
			.dispatch('core/block-editor')
			.updateBlockAttributes(block.clientId, { language: 'kusto' });
		const after = wp.data
			.select('core/block-editor')
			.getBlock(block.clientId).attributes;
		await wp.data.dispatch('core/editor').savePost();
		return {
			before,
			after,
			content: wp.data.select('core/editor').getEditedPostContent(),
		};
	});
	assert.equal(edited.after.language, 'kusto', 'Language changes must persist');
	assert.equal(edited.before.content, edited.after.content);
	assert.equal(edited.after.firstLineNumber, '12');
	assert.equal(edited.after.highlightLines, '12,14-15');
	assert.ok(edited.content.includes('"language":"kusto"'));
	const iframe = page.frameLocator('iframe[name="editor-canvas"]');
	const textarea = (await page.locator('iframe[name="editor-canvas"]').count())
		? iframe.locator('.wp-block-syntaxhighlighter__textarea')
		: page.locator('.wp-block-syntaxhighlighter__textarea');
	assert.equal(
		await textarea.first().inputValue(),
		edited.before.content,
		'Old blocks must remain editable without transformed text',
	);
	await textarea.first().focus();
	await textarea.first().evaluate((input) => input.setSelectionRange(0, 0));
	await textarea.first().press('Tab');
	assert.equal(
		await textarea.first().inputValue(),
		'\t' + edited.before.content,
	);
	await textarea.first().press('Escape');
	await textarea.first().press('Tab');
	assert.equal(
		await textarea.first().inputValue(),
		'\t' + edited.before.content,
		'Escape then Tab must leave without inserting text',
	);
	await page.evaluate((source) => {
		const block = wp.data
			.select('core/block-editor')
			.getBlocks()
			.find((item) => item.name === 'syntaxhighlighter/code');
		wp.data
			.dispatch('core/block-editor')
			.updateBlockAttributes(block.clientId, { content: source });
	}, edited.before.content);
	assert.equal(
		await page.getByText('Attempt Block Recovery', { exact: true }).count(),
		0,
	);
	assert.ok(
		!errors.some((error) =>
			/validation|syntaxhighlighter|undefined/i.test(error),
		),
		errors.join('\n'),
	);
	data.editor = editorResult;
	data.themes = ['twentytwentyone', 'twentytwentyfive'];
	data.browserErrors = errors;
	data.packagedPlugin = Boolean(process.env.PLUGIN_DIR);
	data.realClipboard = true;
	data.keyboardIndentation = true;
	await writeFile(
		`artifacts/${artifactPrefix}wordpress-${wpVersion}-php-${phpVersion}.json`,
		JSON.stringify(data, null, 2),
	);
	console.log(
		'Classic and block themes, conditional assets, old/new Gutenberg serialization: passed.',
	);
} finally {
	await browser?.close();
	await instance[Symbol.asyncDispose]();
}
