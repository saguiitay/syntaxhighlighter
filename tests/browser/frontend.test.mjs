import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixtures = JSON.parse(
	readFileSync('artifacts/rendered.json', 'utf8'),
).rendered;
const manifest = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
async function setup(page, html, languages = ['typescript', 'kusto', 'tsx']) {
	await page.goto('about:blank');
	await page.setContent(
		`<meta name="viewport" content="width=device-width, initial-scale=1">${html}`,
	);
	await page.addStyleTag({ path: 'dist/frontend.css' });
	await page.addScriptTag({ path: 'dist/prism-core.js' });
	const loaded = new Set();
	async function load(id) {
		if (loaded.has(id)) return;
		for (const dep of manifest.dependencies[id]) await load(dep);
		await page.addScriptTag({ path: `dist/grammars/${id}.js` });
		loaded.add(id);
	}
	for (const id of languages) await load(id);
	await page.addScriptTag({ path: 'dist/frontend.js' });
}
test('all PHP-rendered fixtures preserve literal source and never execute code', async ({
	page,
}) => {
	const errors = [];
	const requests = [];
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('request', (request) => requests.push(request.url()));
	page.on('dialog', () => {
		throw new Error('Displayed source executed');
	});
	await setup(page, fixtures.map((fixture) => fixture.html).join(''));
	const sources = await page
		.locator('pre.syntaxhighlighter-code code')
		.allTextContents();
	expect(sources).toEqual(fixtures.map((fixture) => fixture.source));
	await expect(page.locator('.sh-prism img, .sh-prism script')).toHaveCount(0);
	expect(errors).toEqual([]);
	expect(requests).toEqual([]);
	await expect(page.locator('[data-unhighlighted="large"]')).toHaveCount(1);
});
test('line ranges, first line, safe tokens and repeated initialization', async ({
	page,
}) => {
	await setup(
		page,
		'<div class="sh-prism sh-theme-light"><pre class="syntaxhighlighter-code" data-firstline="42" data-gutter="true" data-padlinenumbers="5" data-highlight="43-44"><code class="language-typescript">const value: number = 42;\n// second\n// third</code></pre></div><pre><code>Unrelated</code></pre>',
	);
	await expect(page.locator('.sh-line')).toHaveCount(3);
	await expect(page.locator('.sh-highlight')).toHaveCount(2);
	await expect(page.locator('.sh-line').first()).toHaveAttribute(
		'data-line',
		'00042',
	);
	await expect(page.locator('.token.keyword').first()).toHaveText('const');
	await page.evaluate(() => {
		document.dispatchEvent(new CustomEvent('syntaxhighlighter:highlight'));
		document.dispatchEvent(new CustomEvent('syntaxhighlighter:highlight'));
	});
	await expect(page.locator('.sh-line')).toHaveCount(3);
	await expect(page.locator('body > pre')).toHaveText('Unrelated');
});
test('copy uses exact original source, announces success and errors', async ({
	page,
}) => {
	await setup(page, fixtures[0].html);
	await page.evaluate(() => {
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: {
				writeText: async (text) => {
					window.copied = text;
				},
			},
		});
	});
	await page.getByRole('button', { name: 'Copy code' }).click();
	expect(await page.evaluate(() => window.copied)).toBe(fixtures[0].source);
	await expect(page.getByRole('status')).toHaveText('Code copied.');
	await page.evaluate(() => {
		navigator.clipboard.writeText = async () => {
			throw new Error('denied');
		};
	});
	await page.getByRole('button', { name: 'Copy code' }).click();
	await expect(page.getByRole('status')).toContainText('Copy failed.');
	await expect(page.locator('pre')).toBeFocused();
});
test('native collapse is keyboard accessible and works without highlighting', async ({
	page,
}) => {
	await page.setContent(
		fixtures.find((fixture) => fixture.name === 'options').html,
	);
	await expect(page.locator('details')).not.toHaveAttribute('open');
	await page.locator('summary').focus();
	await page.keyboard.press('Enter');
	await expect(page.locator('details')).toHaveAttribute('open', '');
	await expect(page.locator('code')).toHaveText('StormEvents\n| take 1');
});
test('mobile, automatic/light/dark modes and literal safe HTTP links', async ({
	page,
}) => {
	await page.setViewportSize({ width: 375, height: 812 });
	const source = 'https://example.com/a?x=1&y=2 javascript:alert(1)';
	await setup(
		page,
		'<div class="sh-prism sh-theme-auto"><pre class="syntaxhighlighter-code" data-autolinks="true"><code class="language-plain">https://example.com/a?x=1&amp;y=2 javascript:alert(1)</code></pre></div>',
	);
	const background = () =>
		page
			.locator('.sh-prism')
			.evaluate((node) => getComputedStyle(node).backgroundColor);
	await page.emulateMedia({ colorScheme: 'light' });
	const light = await background();
	await page.emulateMedia({ colorScheme: 'dark' });
	expect(await background()).not.toBe(light);
	await expect(page.locator('code')).toHaveText(source);
	await expect(page.locator('code a')).toHaveCount(1);
	await expect(page.locator('code a')).toHaveAttribute(
		'href',
		'https://example.com/a?x=1&y=2',
	);
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= window.innerWidth,
		),
	).toBe(true);
});
