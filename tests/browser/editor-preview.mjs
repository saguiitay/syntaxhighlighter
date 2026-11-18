import { expect as baseExpect } from '@playwright/test';

const expect = baseExpect.configure({ timeout: 30000 });

export async function verifyEditorPreview(page, baseUrl) {
	await page.addLocatorHandler(
		page.getByRole('dialog', { name: 'Welcome to the editor' }),
		async (dialog) => {
			await dialog.getByRole('button', { name: 'Close' }).click();
		},
	);
	await page.goto(`${baseUrl}/wp-admin/post-new.php`, {
		waitUntil: 'domcontentloaded',
	});
	await page.waitForFunction(
		() => window.wp?.blocks?.getBlockType('syntaxhighlighter/code'),
		null,
		{ timeout: 120000 },
	);
	await page.keyboard.press('Escape');
	const source =
		'StormEvents\n| where State == "TEXAS"\n| summarize Events = count() by EventType';
	const clientId = await page.evaluate((content) => {
		const block = wp.blocks.createBlock('syntaxhighlighter/code', {
			content,
			language: 'kusto',
			lineNumbers: true,
			firstLineNumber: '1',
			theme: 'light',
		});
		wp.data.dispatch('core/block-editor').resetBlocks([block]);
		wp.data.dispatch('core/block-editor').selectBlock(block.clientId);
		return block.clientId;
	}, source);
	await page.waitForFunction(() => {
		const frame = document.querySelector('iframe[name="editor-canvas"]');
		return (frame?.contentDocument || document).querySelector(
			'.wp-block-syntaxhighlighter__textarea',
		);
	});
	const editor = page.frame({ name: 'editor-canvas' }) || page.mainFrame();
	const textarea = editor.locator('.wp-block-syntaxhighlighter__textarea');
	const preview = editor.locator('.syntaxhighlighter-editor-preview');
	await preview.getByRole('checkbox', { name: 'Show syntax preview' }).check();
	await page.screenshot({
		path: 'artifacts/editor-preview.png',
		fullPage: true,
	});
	const code = preview.locator('code');
	await expect(code).toHaveText(source);
	const keyword = code
		.locator('.token')
		.filter({ hasText: /^where$/ })
		.first();
	await expect(keyword).toBeVisible();
	const plainColor = await code.evaluate(
		(node) => getComputedStyle(node).color,
	);
	await expect(keyword).not.toHaveCSS('color', plainColor);

	const updated = source.replace('TEXAS', 'FLORIDA') + '\n| take 5';
	await textarea.fill(updated);
	await expect(code).toHaveText(updated);
	await expect(
		code.locator('.token').filter({ hasText: /^take$/ }),
	).toBeVisible();
	await page.evaluate((id) => {
		wp.data.dispatch('core/block-editor').updateBlockAttributes(id, {
			theme: 'prism-okaidia',
			firstLineNumber: '10',
			highlightLines: '11',
		});
	}, clientId);
	await expect(preview.locator('.sh-prism')).toHaveClass(
		/sh-theme-prism-okaidia/,
	);
	await expect(code).toHaveCSS('background-color', 'rgb(39, 40, 34)');
	await expect(code.locator('.sh-line').first()).toHaveAttribute(
		'data-line',
		'10',
	);
	await expect(code.locator('.sh-highlight')).toHaveAttribute(
		'data-line',
		'11',
	);
	await expect(code).toHaveText(updated);
	await page.screenshot({
		path: 'artifacts/editor-preview-updated.png',
		fullPage: true,
	});
	await preview
		.getByRole('checkbox', { name: 'Show syntax preview' })
		.uncheck();
	await expect(code).toHaveCount(0);
	await preview.getByRole('checkbox', { name: 'Show syntax preview' }).check();
	await expect(code).toHaveText(updated);
	await expect(code).toHaveCSS('background-color', 'rgb(39, 40, 34)');
	await expect(preview.getByRole('alert')).toHaveCount(0);
}
