import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const manifest = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
const sandbox = vm.createContext({ window: {} });
vm.runInContext(readFileSync('dist/prism-core.js', 'utf8'), sandbox);
const prism = sandbox.window.SyntaxHighlighterPrism;
function load(id) {
	if (prism.languages[id]) return;
	manifest.dependencies[id].forEach(load);
	vm.runInContext(readFileSync(`dist/grammars/${id}.js`, 'utf8'), sandbox, {
		timeout: 5000,
	});
}
function flatten(tokens, type, output = []) {
	for (const token of tokens) {
		if (typeof token === 'string') continue;
		if (token.type === type || [token.alias].flat().includes(type)) {
			output.push(prism.Token.stringify(token, 'kusto'));
		}
		if (Array.isArray(token.content)) flatten(token.content, type, output);
	}
	return output;
}
test('every shipped grammar and dependency loads in an isolated Prism instance', () => {
	Object.keys(manifest.dependencies).forEach(load);
	assert.equal(sandbox.window.Prism, undefined);
	assert.equal(prism.manual, true);
});
test('TypeScript and TSX retain JavaScript as a distinct grammar', () => {
	load('typescript');
	load('tsx');
	const source =
		'@sealed\nexport interface Box<T> { value: T | null }\ntype Both = A & B;\nenum Kind { One }\nconst value: number = 42;\nasync function read<T>(): Promise<T> { return await fetch(`/${value}`); }';
	const html = prism.highlight(
		source,
		prism.languages.typescript,
		'typescript',
	);
	for (const keyword of ['interface', 'type', 'enum', 'async', 'await']) {
		assert.ok(html.includes(`>${keyword}</span>`), keyword);
	}
	const tsx = prism.highlight(
		'const element = <Box value={42} />;',
		prism.languages.tsx,
		'tsx',
	);
	assert.ok(tsx.includes('token tag'));
	assert.notEqual(prism.languages.javascript, prism.languages.typescript);
});
test('Kusto operators, functions, literals and upstream management commands', () => {
	load('kusto');
	const source = [
		'let start = ago(7d);',
		'StormEvents | where State == "TEXAS" | project-away DamageProperty',
		'| summarize Events=count(), Damage=sum(DamageProperty) by State',
		'| make-series Events=count() on StartTime from start to now() step 1h',
		'| mv-expand Metadata | parse-where Metadata with * "region"',
		'| join kind=leftouter (Other | take 1) on State',
		'| extend Region=tostring(dynamic({"a": 1}).a)',
		'cluster("mycluster.kusto.windows.net").database("Telemetry").Events',
		'.show tables',
		'// comment',
	].join('\n');
	const tokens = prism.tokenize(source, prism.languages.kusto);
	const keywords = flatten(tokens, 'keyword').join(' ');
	for (const keyword of [
		'where',
		'project-away',
		'summarize',
		'make-series',
		'mv-expand',
		'parse-where',
		'join',
	]) {
		assert.ok(keywords.includes(keyword), keyword);
	}
	assert.ok(flatten(tokens, 'function').join(' ').includes('count'));
	assert.ok(flatten(tokens, 'number').join(' ').includes('7d'));
	assert.ok(flatten(tokens, 'comment').length);
	assert.ok(!keywords.includes('StormEvents'));
});
test('Kusto escaped verbatim and multiline strings do not tokenize their content', () => {
	load('kusto');
	for (const literal of [
		'@"a ""quoted"" where string"',
		'```line\n| where x == 1\n```',
	]) {
		const tokens = prism.tokenize(literal, prism.languages.kusto);
		assert.equal(tokens.length, 1);
		assert.ok(flatten(tokens, 'string').length);
	}
});
test('Kusto dotted identifiers are not management commands and uppercase UDFs are functions', () => {
	load('kusto');
	const tokens = prism.tokenize(
		'Metadata.region\ncluster("x").database("db").Events\n.show tables\nMyFunction(2milliseconds)\nT | where Message hasprefix "x"',
		prism.languages.kusto,
	);
	const commands = flatten(tokens, 'command');
	assert.equal(commands.length, 1);
	assert.ok(commands[0].includes('.show'));
	assert.ok(flatten(tokens, 'function').join(' ').includes('MyFunction'));
	assert.ok(flatten(tokens, 'number').join(' ').includes('2milliseconds'));
	assert.ok(flatten(tokens, 'keyword').join(' ').includes('hasprefix'));
});
test('real Kusto examples include joins, dynamic data, query parameters and cross-cluster queries', () => {
	load('kusto');
	const source = readFileSync('tests/fixtures/kusto.kql', 'utf8');
	const tokens = prism.tokenize(source, prism.languages.kusto);
	const html = prism.highlight(source, prism.languages.kusto, 'kusto');
	assert.ok(flatten(tokens, 'keyword').join(' ').includes('join'));
	assert.ok(flatten(tokens, 'function').join(' ').includes('RecentEvents'));
	assert.ok(html.includes('token datetime'));
	assert.ok(html.includes('token verbatim-string'));
});
test(
	'adversarial grammar fixtures terminate within a bounded test timeout',
	{ timeout: 5000 },
	() => {
		vm.runInContext(
			`window.SyntaxHighlighterPrism.tokenize('@"' + '""'.repeat(20000), window.SyntaxHighlighterPrism.languages.kusto);`,
			sandbox,
			{ timeout: 3000 },
		);
	},
);
