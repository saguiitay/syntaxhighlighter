import assert from 'node:assert/strict';
import { expect as baseExpect } from '@playwright/test';

const expect = baseExpect.configure({ timeout: 30000 });

export async function verifySettingsPreview(page, baseUrl, playground) {
	async function readSettings() {
		const result = await playground.run({
			code: "<?php require '/wordpress/wp-load.php'; echo wp_json_encode(get_option('syntaxhighlighter_settings'));",
		});
		assert.equal(result.exitCode, 0, result.errors);
		assert.equal(result.errors, '');
		return JSON.parse(new TextDecoder().decode(result.bytes));
	}
	await page.goto(
		`${baseUrl}/wp-admin/options-general.php?page=syntaxhighlighter`,
		{ waitUntil: 'networkidle' },
	);
	const preview = page.locator('#syntaxhighlighter-settings-preview');
	await expect(preview.locator('.token').first()).toBeVisible();
	await expect(preview.locator('.sh-title')).toHaveCount(0);
	await expect(preview.locator('pre')).toHaveAttribute('data-highlight', '');
	await expect(preview.locator('pre')).toHaveAttribute(
		'data-htmlscript',
		'false',
	);
	const saved = await readSettings();
	await page.locator('#syntaxhighlighter-theme').selectOption('prism-okaidia');
	await expect(preview.locator('.sh-prism')).toHaveClass(
		/sh-theme-prism-okaidia/,
	);
	await expect(preview.locator('code')).toHaveCSS(
		'background-color',
		'rgb(39, 40, 34)',
	);

	await page.locator('#syntaxhighlighter-firstline').fill('42');
	await page.locator('#syntaxhighlighter-padlinenumbers').selectOption('3');
	await page.locator('#syntaxhighlighter-tabsize').fill('8');
	await page.locator('#syntaxhighlighter-smarttabs').uncheck();
	await page.locator('#syntaxhighlighter-wraplines').uncheck();
	await page.locator('#syntaxhighlighter-autolinks').uncheck();
	await page.locator('#syntaxhighlighter-quickcode').uncheck();
	await page.locator('#syntaxhighlighter-copy').uncheck();
	await page.locator('#syntaxhighlighter-toolbar').check();
	await page.locator('#syntaxhighlighter-title').fill('Preview title');
	await expect(preview).toHaveAttribute('aria-busy', 'false');
	await expect(preview.locator('.sh-title')).toHaveText('Preview title');
	await expect(preview.locator('.sh-line').first()).toHaveAttribute(
		'data-line',
		'042',
	);
	await expect(preview.locator('pre')).toHaveAttribute('data-tabsize', '8');
	await expect(preview.locator('pre')).toHaveAttribute(
		'data-quickcode',
		'false',
	);
	await expect(preview.locator('pre')).not.toHaveClass(/sh-wrap/);
	await expect(preview.locator('.sh-tab').first()).toBeVisible();
	await expect(preview.locator('code a')).toHaveCount(0);
	await expect(preview.locator('.sh-copy')).toHaveCount(0);
	assert.deepEqual(await readSettings(), saved, 'Live preview saved options.');

	await page.locator('#syntaxhighlighter-collapse').check();
	await page.locator('#syntaxhighlighter-copy').check();
	await page.locator('#syntaxhighlighter-toolbar').uncheck();
	await page.locator('#syntaxhighlighter-gutter').uncheck();
	await page.locator('#syntaxhighlighter-autolinks').check();
	await page.locator('#syntaxhighlighter-title').fill('Collapsed query');
	await expect(preview).toHaveAttribute('aria-busy', 'false');
	await expect(preview.locator('summary')).toHaveText('Collapsed query');
	await expect(preview.locator('details')).not.toHaveAttribute('open');
	await preview.locator('summary').click();
	await expect(preview.locator('.sh-copy')).toBeVisible();
	await expect(preview.locator('pre')).toHaveAttribute(
		'data-autolinks',
		'true',
	);
	await expect(
		preview.locator('a[href="https://wordpress.org/"]'),
	).toBeVisible();
	await expect(preview.locator('pre')).toHaveAttribute('data-gutter', 'false');
	await page.locator('#syntaxhighlighter-light').check();
	await expect(preview).toHaveAttribute('aria-busy', 'false');
	await expect(preview.locator('.sh-controls')).toHaveCount(0);

	const previous = await preview.innerHTML();
	const failPreview = async (route) => {
		if (
			new URLSearchParams(route.request().postData()).get('action') ===
			'syntaxhighlighter_preview'
		) {
			await route.fulfill({ status: 500, body: 'Preview unavailable' });
		} else {
			await route.continue();
		}
	};
	await page.route('**/admin-ajax.php', failPreview);
	await page.locator('#syntaxhighlighter-title').fill('Not applied');
	await expect(page.locator('#syntaxhighlighter-preview-status')).toContainText(
		'Preview could not be updated',
	);
	assert.equal(await preview.innerHTML(), previous);
	await page.unroute('**/admin-ajax.php', failPreview);
	await page.locator('#syntaxhighlighter-title').fill('Recovered');
	await expect(preview.locator('summary')).toHaveText('Recovered');

	const config = await page.evaluate(
		() => window.syntaxHighlighterSettingsPreview,
	);
	const denied = await page.request.post(config.url, {
		form: {
			action: 'syntaxhighlighter_preview',
			nonce: 'invalid',
			'syntaxhighlighter_settings[theme]': 'dark',
		},
	});
	assert.equal(denied.status(), 403, 'Invalid nonce was accepted.');
	const missing = await page.request.post(config.url, {
		form: { action: 'syntaxhighlighter_preview', nonce: config.nonce },
	});
	assert.equal(missing.status(), 400, 'Missing settings were accepted.');
	const unauthorized = await playground.run({
		code: "<?php require '/wordpress/wp-load.php'; wp_set_current_user(0); $GLOBALS['SyntaxHighlighter']->ajax_settings_preview();",
	});
	assert.equal(
		JSON.parse(new TextDecoder().decode(unauthorized.bytes)).success,
		false,
		'Unauthorized preview request was accepted.',
	);

	await page.locator('#syntaxhighlighter-light').uncheck();
	await page.locator('#syntaxhighlighter-collapse').uncheck();
	await page.locator('#syntaxhighlighter-title').fill('Saved preview');
	await expect(preview.locator('.sh-title')).toHaveText('Saved preview');
	await Promise.all([
		page.waitForNavigation({ waitUntil: 'networkidle' }),
		page.locator('#syntaxhighlighter-submit').click(),
	]);
	await expect(page.locator('#syntaxhighlighter-theme')).toHaveValue(
		'prism-okaidia',
	);
	await expect(preview.locator('.sh-title')).toHaveText('Saved preview');
	await expect(preview.locator('.sh-prism')).toHaveClass(
		/sh-theme-prism-okaidia/,
	);
	assert.equal((await readSettings()).theme, 'prism-okaidia');
}
