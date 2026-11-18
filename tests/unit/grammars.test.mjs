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
function kustoTokens(source, type) {
	load('kusto');
	return Array.from(prism.tokenize(source, prism.languages.kusto))
		.filter(
			(token) => token.type === type || [token.alias].flat().includes(type),
		)
		.map((token) => token.content);
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
test('JSON highlights nested properties, strings and primitive values', () => {
	const language = manifest.aliases.json;
	load(language);
	const tokens = prism.tokenize(
		'{"name":"demo","enabled":true,"count":3,"options":null,"items":[1,{"label":"nested"}]}',
		prism.languages[language],
	);
	const properties = flatten(tokens, 'property').join(' ');
	assert.ok(properties.includes('"name"'));
	assert.ok(properties.includes('"label"'));
	assert.ok(flatten(tokens, 'string').join(' ').includes('"nested"'));
	assert.ok(flatten(tokens, 'boolean').join(' ').includes('true'));
	assert.ok(flatten(tokens, 'number').join(' ').includes('3'));
	assert.ok(flatten(tokens, 'null').join(' ').includes('null'));
});
test('Markdown aliases highlight headings, emphasis, links and code fences', () => {
	for (const alias of ['markdown', 'md']) {
		const language = manifest.aliases[alias];
		load(language);
		const tokens = prism.tokenize(
			[
				'# Guide',
				'',
				'**bold** and *italic* with `inline()`.',
				'',
				'[Docs](https://example.com)',
				'',
				'```rust',
				'fn main() {}',
				'```',
			].join('\n'),
			prism.languages[language],
		);
		for (const [type, text] of [
			['title', 'Guide'],
			['bold', 'bold'],
			['italic', 'italic'],
			['code-snippet', 'inline()'],
			['url', 'https://example.com'],
			['code-block', 'fn main() {}'],
		]) {
			assert.ok(
				flatten(tokens, type).join(' ').includes(text),
				`${alias}: ${type}`,
			);
		}
	}
});
test('Power Query aliases highlight M queries, quoted identifiers and escaped strings', () => {
	for (const alias of ['powerquery', 'pq', 'mscript']) {
		const language = manifest.aliases[alias];
		load(language);
		const tokens = prism.tokenize(
			[
				'let',
				'    // Keep active rows.',
				'    #"Source Table" = #table(type table [Name = text, Active = logical], {{"Hello ""M""", true}}),',
				'    Result = Table.SelectRows(#"Source Table", each [Active] = true)',
				'in',
				'    Result',
			].join('\n'),
			prism.languages[language],
		);
		for (const [type, text] of [
			['keyword', 'let'],
			['keyword', '#table'],
			['keyword', 'each'],
			['quoted-identifier', '#"Source Table"'],
			['function', 'Table.SelectRows'],
			['data-type', 'text'],
			['string', '"Hello ""M"""'],
			['boolean', 'true'],
			['comment', 'Keep active rows.'],
		]) {
			assert.ok(
				flatten(tokens, type).join(' ').includes(text),
				`${alias}: ${type}`,
			);
		}
	}
});
test('Rust highlights lifetimes, macros, raw strings and nested comments', () => {
	const language = manifest.aliases.rust;
	load(language);
	const tokens = prism.tokenize(
		[
			"fn greet<'a>(name: &'a str) {",
			'\t/* outer /* nested */ comment */',
			'\tlet message = r#"Hello, "Rust"!"#;',
			'\tprintln!("{}", name);',
			'}',
		].join('\n'),
		prism.languages[language],
	);
	assert.ok(flatten(tokens, 'keyword').join(' ').includes('fn'));
	assert.ok(flatten(tokens, 'lifetime-annotation').join(' ').includes("'a"));
	assert.ok(flatten(tokens, 'macro').join(' ').includes('println!'));
	assert.ok(
		flatten(tokens, 'string').join(' ').includes('r#"Hello, "Rust"!"#'),
	);
	assert.ok(
		flatten(tokens, 'comment')
			.join(' ')
			.includes('/* outer /* nested */ comment */'),
	);
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
	assert.ok(flatten(tokens, 'function').join(' ').includes('sum'));
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
test('Kusto PR 3 recognizes query keywords outside pipes without identifier prefixes', () => {
	const keywords = (
		'count datatable distinct evaluate extend externaldata external_data ' +
		'facet find fork getschema invoke join limit lookup ' +
		'macro-expand make-graph make-series materialize ' +
		'mv-apply mv-expand order parse parse-kv parse-where partition ' +
		'project project-away project-keep project-rename project-reorder ' +
		'reduce render sample sample-distinct scan search serialize sort ' +
		'summarize take top top-hitters top-nested union ' +
		'graph-match graph-shortest-paths graph-to-table ' +
		'kind with_itemindex withsource'
	).split(' ');
	assert.deepEqual(
		kustoTokens(
			keywords.join(' ') + '\ncount_column graph-match-column',
			'keyword',
		),
		keywords,
	);
});
test('Kusto PR 3 fixes string operators and consumes case-insensitive membership tildes', () => {
	assert.deepEqual(
		kustoTokens(
			'hasprefix hasprefix_cs !hasprefix !hasprefix_cs has_any has_all in~ !in~ ' +
				'!between !contains !contains_cs !endswith !endswith_cs !has !has_cs ' +
				'!hassuffix !hassuffix_cs !startswith !startswith_cs\n' +
				'hasperfix hasperfix_cs has_anything in_column hasprefix-column',
			'keyword',
		),
		[
			'hasprefix',
			'hasprefix_cs',
			'hasprefix',
			'hasprefix_cs',
			'has_any',
			'has_all',
			'in~',
			'in~',
			'between',
			'contains',
			'contains_cs',
			'endswith',
			'endswith_cs',
			'has',
			'has_cs',
			'hassuffix',
			'hassuffix_cs',
			'startswith',
			'startswith_cs',
		],
	);
});
test('Kusto PR 3 keeps obfuscated verbatim strings and their embedded comments intact', () => {
	const strings = [
		'@"say ""hello"" // still a string"',
		"@'it''s // still a string'",
		'h@"secret ""value"""',
		"H@'secret ''value'''",
		'@"first"',
		'"second"',
	];
	const source =
		strings.slice(0, 4).join('\n') + '\n' + strings.slice(4).join(' ');
	assert.deepEqual(kustoTokens(source, 'string'), strings);
	assert.deepEqual(kustoTokens(source, 'comment'), []);
});
test('Kusto PR 3 adds scalar aliases and boolean spellings without matching identifiers', () => {
	const source =
		'date double int32 int64 time\ntrue True TRUE false False FALSE null\n' +
		'trueValue TrueValue TRUE_VALUE falseValue FalseValue FALSE_VALUE\n' +
		'MyFunction() _MyFunction()';
	assert.deepEqual(kustoTokens(source, 'class-name'), [
		'date',
		'double',
		'int32',
		'int64',
		'time',
	]);
	assert.deepEqual(kustoTokens(source, 'boolean'), [
		'true',
		'True',
		'TRUE',
		'false',
		'False',
		'FALSE',
		'null',
	]);
	assert.deepEqual(kustoTokens(source, 'function'), [
		'MyFunction',
		'_MyFunction',
	]);
});
test('Kusto PR 3 keeps commands line-leading after strings and symbolic operators whole', () => {
	const source = [
		'.show tables',
		'  .create-or-alter function MyFunction() { print x = 1 }',
		'.set-or-append Results <| print x = 1 <> 2',
		'print x = bag.property, y = "text".property',
		'| join hint.strategy=broadcast (Other) on Key',
		'print text = "value"',
		'  .show tables',
	].join('\n');
	assert.deepEqual(kustoTokens(source, 'command'), [
		'.show',
		'.create-or-alter',
		'.set-or-append',
		'.show',
	]);
	const operators = kustoTokens(source, 'operator');
	assert.ok(operators.includes('<|'));
	assert.ok(operators.includes('<>'));
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
