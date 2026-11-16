import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';
import { cpus, platform, release } from 'node:os';

const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
const typescript =
	'interface Box<T> { value: T | null; }\nconst value: number = 42;\nconsole.log(value);';
const kusto =
	'StormEvents\n| where StartTime > ago(7d)\n| where State == "TEXAS"\n| summarize Events=count(), Damage=sum(DamageProperty) by State\n| top 10 by Events desc\n';
const cases = {
	'no-code': [],
	'one-typescript': [{ language: 'typescript', source: typescript }],
	'five-languages': [
		{ language: 'typescript', source: typescript },
		{ language: 'kusto', source: kusto },
		{ language: 'php', source: '<?php echo "<hello>";' },
		{
			language: 'python',
			source: 'def greet(name):\n    return f"Hello {name}"',
		},
		{ language: 'markup', source: '<div class="example">Hello</div>' },
	],
	'twenty-blocks': Array.from({ length: 20 }, (_, i) => ({
		language: i % 2 ? 'typescript' : 'kusto',
		source: i % 2 ? typescript : kusto,
	})),
	'large-kql': [{ language: 'kusto', source: kusto.repeat(500) }],
};
const baseline = {
	typescript: 'jscript',
	kusto: 'plain',
	php: 'php',
	python: 'python',
	markup: 'xml',
};
const escape = (text) =>
	text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function assets(engine, blocks) {
	if (!blocks.length) return { js: [], css: [] };
	if (engine === 'legacy') {
		return {
			js: [
				'syntaxhighlighter3/scripts/shCore.js',
				...new Set(
					blocks.map(({ language }) => {
						const names = {
							jscript: 'JScript',
							plain: 'Plain',
							php: 'Php',
							python: 'Python',
							xml: 'Xml',
						};
						return `syntaxhighlighter3/scripts/shBrush${names[baseline[language]]}.js`;
					}),
				),
			],
			css: [
				'syntaxhighlighter3/styles/shCore.css',
				'syntaxhighlighter3/styles/shThemeDefault.css',
			],
		};
	}
	const grammars = new Set();
	function visit(id) {
		if (grammars.has(id)) return;
		manifest.dependencies[id].forEach(visit);
		grammars.add(id);
	}
	blocks.forEach(({ language }) => visit(language));
	return {
		js: [
			'dist/runtime.js',
			...[...grammars].map((id) => `dist/grammars/${id}.js`),
		],
		css: ['dist/frontend.css'],
	};
}
function html(engine, blocks) {
	const selected = assets(engine, blocks);
	const markup = blocks
		.map(({ language, source }) =>
			engine === 'legacy'
				? `<pre class="brush: ${baseline[language]}; toolbar: false;">${escape(source)}</pre>`
				: `<div class="sh-prism sh-theme-light"><pre class="syntaxhighlighter-code" data-firstline="1" data-gutter="true" data-wraplines="false"><code class="language-${language}">${escape(source)}</code></pre></div>`,
		)
		.join('');
	const js = [...selected.js];
	return `<!doctype html><meta charset="utf-8"><title>Highlight benchmark</title>${selected.css.map((url) => `<link rel="stylesheet" href="/${url}">`).join('')}${markup}
	<script>document.addEventListener('DOMContentLoaded',()=>{window.shStart=performance.now();});</script>
	${js.map((url) => `<script src="/${url}"></script>`).join('')}
	${blocks.length ? (engine === 'legacy' ? "<script>document.addEventListener('DOMContentLoaded',()=>{SyntaxHighlighter.highlight();});</script>" : '') : ''}
	<script>document.addEventListener('DOMContentLoaded',()=>{window.shDuration=performance.now()-window.shStart;});</script>`;
}
const root = resolve('.');
const server = createServer(async (request, response) => {
	const url = new URL(request.url, 'http://localhost');
	if (url.pathname === '/bench') {
		response.setHeader('content-type', 'text/html; charset=utf-8');
		response.end(
			html(url.searchParams.get('engine'), cases[url.searchParams.get('case')]),
		);
		return;
	}
	const path = resolve(root, '.' + url.pathname);
	if (
		!path.startsWith(root + sep) ||
		!/^(?:\/dist\/|\/syntaxhighlighter3\/)/.test(url.pathname)
	) {
		response.writeHead(404).end();
		return;
	}
	try {
		const bytes = gzipSync(await readFile(path));
		response.writeHead(200, {
			'content-type': path.endsWith('.css')
				? 'text/css'
				: 'application/javascript',
			'content-encoding': 'gzip',
			'content-length': bytes.length,
			'cache-control': 'no-store',
		});
		response.end(bytes);
	} catch (error) {
		console.error(error);
		response.writeHead(500).end();
	}
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const browser = await chromium.launch();
const output = {
	environment: {
		node: process.version,
		os: `${platform()} ${release()}`,
		cpu: cpus()[0].model,
		chromium: browser.version(),
		repetitions: 5,
	},
	method:
		'Loopback HTTP gzip; fresh browser context per sample; DOMContentLoaded synchronous initialization; median of five; legacy TypeScript uses JScript and KQL uses plaintext because the original has no native grammar. Counts exclude the HTML document.',
	results: [],
};
try {
	for (const [name, blocks] of Object.entries(cases)) {
		for (const engine of ['legacy', 'prism']) {
			const selected = assets(engine, blocks);
			const bytes = async (files, gzip) =>
				(
					await Promise.all(
						files.map(async (file) => {
							const data = await readFile(file);
							return gzip ? gzipSync(data).length : data.length;
						}),
					)
				).reduce((sum, size) => sum + size, 0);
			const samples = [];
			for (let trial = 0; trial < 5; trial++) {
				const context = await browser.newContext();
				const page = await context.newPage();
				const errors = [];
				page.on('pageerror', (error) => errors.push(error.message));
				const cdp = await context.newCDPSession(page);
				await cdp.send('Performance.enable');
				await page.goto(
					`http://127.0.0.1:${server.address().port}/bench?engine=${engine}&case=${name}`,
					{ waitUntil: 'load' },
				);
				if (errors.length) throw new Error(errors.join('\n'));
				const duration = await page.evaluate(() => window.shDuration);
				const metrics = await cdp.send('Performance.getMetrics');
				samples.push({
					initializationMs: duration,
					scriptMs:
						metrics.metrics.find((metric) => metric.name === 'ScriptDuration')
							.value * 1000,
				});
				await context.close();
			}
			const median = (key) =>
				samples.map((sample) => sample[key]).sort((a, b) => a - b)[2];
			const row = {
				scenario: name,
				engine,
				blocks: blocks.length,
				javascriptBytes: await bytes(selected.js, false),
				javascriptGzip: await bytes(selected.js, true),
				cssBytes: await bytes(selected.css, false),
				cssGzip: await bytes(selected.css, true),
				requests: selected.js.length + selected.css.length,
				initializationMs: median('initializationMs'),
				scriptMs: median('scriptMs'),
				samples,
			};
			output.results.push(row);
			console.log(
				`${name} / ${engine}: JS ${row.javascriptGzip}B gzip, CSS ${row.cssGzip}B gzip, ${row.requests} requests, ${row.initializationMs.toFixed(2)}ms init`,
			);
		}
	}
	await mkdir('artifacts', { recursive: true });
	await writeFile('artifacts/benchmark.json', JSON.stringify(output, null, 2));
} finally {
	await browser.close();
	await new Promise((done, reject) =>
		server.close((error) => (error ? reject(error) : done())),
	);
}
