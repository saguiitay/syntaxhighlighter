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
test('Coy is scoped, preserves its paper and palette, and supports scrolling and wrapping', async ({
	page,
}) => {
	await page.setViewportSize({ width: 1000, height: 500 });
	await setup(
		page,
		'<div class="sh-prism sh-theme-light"><pre class="syntaxhighlighter-code" data-gutter="true" data-highlight="2"><code class="language-typescript">const greeting = "Coy";\nconst total = 42;</code></pre></div><pre id="unrelated"><code class="language-typescript"><span class="token keyword">Unrelated code</span></code></pre>',
	);
	const code = page.locator('.sh-prism code');
	await expect(code).toHaveCSS('border-left-width', '10px');
	await expect(code).toHaveCSS('border-left-color', 'rgb(53, 140, 203)');
	await expect(code).toHaveCSS('background-color', 'rgb(253, 253, 253)');
	const stripes = await code.evaluate((node) => {
		const style = getComputedStyle(node);
		return {
			period: Number.parseFloat(style.backgroundSize.split(' ')[1]),
			lineHeight: Number.parseFloat(style.lineHeight),
		};
	});
	expect(stripes.period).toBeCloseTo(stripes.lineHeight * 2, 1);
	await expect(code.locator('.token.keyword').first()).toHaveCSS(
		'color',
		'rgb(25, 144, 184)',
	);
	await expect(code.locator('.token.string')).toHaveCSS(
		'color',
		'rgb(47, 156, 10)',
	);
	await expect(code.locator('.token.number')).toHaveCSS(
		'color',
		'rgb(201, 44, 44)',
	);
	await expect(page.locator('#unrelated code')).toHaveCSS(
		'border-left-width',
		'0px',
	);
	await expect(page.locator('#unrelated .token')).toHaveCSS(
		'color',
		'rgb(0, 0, 0)',
	);
	await page.screenshot({ path: 'artifacts/coy-light-desktop.png' });
	await page.locator('.sh-prism').evaluate((node) => {
		node.classList.replace('sh-theme-light', 'sh-theme-dark');
	});
	await expect(code).toHaveCSS('background-color', 'rgb(24, 36, 51)');
	await expect(code.locator('.token.keyword').first()).toHaveCSS(
		'color',
		'rgb(128, 205, 229)',
	);
	await page.screenshot({ path: 'artifacts/coy-dark-desktop.png' });
	await page.setViewportSize({ width: 375, height: 812 });
	await code.evaluate((node) => {
		node.textContent = 'x'.repeat(250);
	});
	const pre = page.locator('.sh-prism pre');
	expect(
		await pre.evaluate((node) => node.scrollWidth > node.clientWidth),
	).toBe(true);
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= window.innerWidth,
		),
	).toBe(true);
	await pre.evaluate((node) => node.classList.add('sh-wrap'));
	expect(
		await pre.evaluate((node) => node.scrollWidth <= node.clientWidth),
	).toBe(true);
	await page.screenshot({ path: 'artifacts/coy-mobile-wrapped.png' });
	await page.locator('.sh-prism').evaluate((node) => {
		node.classList.replace('sh-theme-dark', 'sh-theme-none');
	});
	await code.evaluate((node) => {
		node.className = 'language-css';
		const token = document.createElement('span');
		token.className = 'token string';
		token.textContent = '"Coy"';
		node.replaceChildren(token);
	});
	await expect(code.locator('.token')).toHaveCSS('color', 'rgb(0, 0, 0)');
	await expect(code.locator('.token')).toHaveCSS(
		'background-color',
		'rgba(0, 0, 0, 0)',
	);
});
test('compact layout keeps blank-line numbers aligned without changing source whitespace', async ({
	page,
}) => {
	const source = [
		'import OpenAI from "openai";',
		'import { observeOpenAI } from "observability/openai";',
		'',
		'const observer = observeOpenAI(new OpenAI(), {',
		'  serviceName: "openai-demo",',
		'});',
		'try {',
		'  await observer.client.responses.create({',
		'    model: "gpt-4.1-mini",',
		'    input: "Explain why 12 squared is 144.",',
		'  });',
		'} finally {',
		'  await observer.shutdown();',
		'}',
		'  ',
		'',
	].join('\n');
	await setup(
		page,
		`<div class="sh-prism sh-theme-light"><div class="sh-controls"><button class="sh-copy" hidden>Copy code</button><span class="sh-status" role="status"></span></div><pre class="syntaxhighlighter-code language-typescript" data-gutter="true" data-padlinenumbers="2"><code class="language-typescript">${source}</code></pre></div>`,
	);
	expect(await page.locator('.sh-prism code').textContent()).toBe(source);
	await expect(page.locator('.sh-line').nth(2)).toHaveAttribute(
		'data-line',
		'03',
	);
	const metrics = await page.locator('.sh-line').evaluateAll((lines) =>
		lines.map((line) => ({
			top: line.getBoundingClientRect().top,
			height: line.getBoundingClientRect().height,
			lineHeight: Number.parseFloat(getComputedStyle(line).lineHeight),
			gutter: Number.parseFloat(getComputedStyle(line).paddingLeft),
		})),
	);
	expect(metrics).toHaveLength(source.split('\n').length);
	for (const [index, metric] of metrics.entries()) {
		expect(metric.height).toBeCloseTo(metric.lineHeight, 0);
		if (index) {
			expect(metric.top - metrics[index - 1].top).toBeCloseTo(
				metric.lineHeight,
				0,
			);
		}
	}
	expect(metrics[0].lineHeight).toBeLessThanOrEqual(21);
	expect(metrics[0].gutter).toBeLessThan(35);
	const controls = await page.locator('.sh-controls').boundingBox();
	expect(controls.height).toBeLessThanOrEqual(32);
	await page.evaluate(() => {
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText: async (text) => (window.copied = text) },
		});
	});
	await page.getByRole('button', { name: 'Copy code' }).click();
	expect(await page.evaluate(() => window.copied)).toBe(source);
	await page.screenshot({ path: 'artifacts/compact-code-desktop.png' });
	await page.setViewportSize({ width: 375, height: 812 });
	await page.locator('pre').evaluate((node) => node.classList.add('sh-wrap'));
	const wrapped = await page.locator('.sh-line').evaluateAll((lines) =>
		lines.map((line) => ({
			top: line.getBoundingClientRect().top,
			height: line.getBoundingClientRect().height,
		})),
	);
	expect(wrapped[1].height).toBeGreaterThan(wrapped[2].height);
	for (let index = 1; index < wrapped.length; index++) {
		expect(wrapped[index].top - wrapped[index - 1].top).toBeCloseTo(
			wrapped[index - 1].height,
			0,
		);
	}
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= window.innerWidth,
		),
	).toBe(true);
	await page.screenshot({ path: 'artifacts/compact-code-mobile.png' });
});
