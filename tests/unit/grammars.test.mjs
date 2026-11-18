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
test('Kusto word operators include their negation and case-insensitive membership tildes', () => {
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
			'!hasprefix',
			'!hasprefix_cs',
			'has_any',
			'has_all',
			'in~',
			'!in~',
			'!between',
			'!contains',
			'!contains_cs',
			'!endswith',
			'!endswith_cs',
			'!has',
			'!has_cs',
			'!hassuffix',
			'!hassuffix_cs',
			'!startswith',
			'!startswith_cs',
		],
	);
	assert.deepEqual(
		kustoTokens(
			'T | where Message!contains"x" and Message!in~("a")',
			'keyword',
		),
		['where', '!contains', 'and', '!in~'],
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
test('Kusto scalar aliases and boolean spellings keep null distinct from booleans', () => {
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
	]);
	assert.deepEqual(kustoTokens(source, 'keyword'), ['null']);
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
test('Kusto lexer multiline strings retain prefixes and protect embedded commands and comments', () => {
	const strings = [
		'```plain\n.show tables\n```',
		'h```hidden\n// not a comment\n```',
		'~~~alternate\n| where x == 1\n~~~',
		'H~~~hidden alternate\n.show tables\n~~~',
	];
	const source = strings.join('\n');
	assert.deepEqual(kustoTokens(source, 'string'), strings);
	assert.deepEqual(kustoTokens(source, 'command'), []);
	assert.deepEqual(kustoTokens(source, 'comment'), []);
	assert.deepEqual(kustoTokens('nameh"ordinary" $h"also ordinary"', 'string'), [
		'"ordinary"',
		'"also ordinary"',
	]);
});
test('Kusto lexer typed scalar literals stay whole without pretending raw dates are datetime literals', () => {
	for (const [type, literals] of [
		[
			'datetime',
			['datetime(2007-01-01T10:00:00Z)', 'date(2007-01-01)', 'datetime(null)'],
		],
		['timespan', ['time(1.02:03:04.5)', 'timespan(null)']],
		['typed-boolean', ['bool(null)', 'bool(TRUE)']],
		[
			'typed-number',
			[
				'int(-1)',
				'int32(1)',
				'long(0xFF)',
				'int64(null)',
				'real(nan)',
				'double(+inf)',
				'decimal(1.25)',
			],
		],
		[
			'guid',
			[
				'guid(12345678-1234-1234-1234-123456789abc)',
				'guid(null)',
				'12345678-1234-1234-1234-123456789abc',
				'abcdefab-cdef-abcd-efab-cdefabcdefab',
			],
		],
	]) {
		assert.deepEqual(kustoTokens(literals.join('\n'), type), literals, type);
	}
	assert.deepEqual(
		kustoTokens(
			'2007-01-01 10:20:30 mydatetime(2007-01-01) $datetime(2007-01-01)',
			'datetime',
		),
		[],
	);
});
test('Kusto lexer numbers respect hexadecimal case, trailing dots, exponents and identifier boundaries', () => {
	assert.deepEqual(kustoTokens('0XDEAD 0xff 1. 1.e3 1e-3 42 1..2', 'number'), [
		'0XDEAD',
		'0xff',
		'1.',
		'1.e3',
		'1e-3',
		'42',
		'1',
		'2',
	]);
	assert.deepEqual(
		kustoTokens('123column 1efoo 0xNOPE 2dollars inf -inf +inf nan', 'number'),
		[],
	);
});
test('Kusto lexer timespans use supported suffixes without consuming identifier prefixes', () => {
	const units = (
		'm min minute minutes s sec second seconds d day days h hr hrs hour hours ' +
		'ms milli millis millisec millisecond milliseconds ' +
		'micro micros microsec microsecond microseconds ' +
		'nano nanos nanosec nanosecond nanoseconds tick ticks'
	).split(' ');
	const literals = units.map((unit, index) => `${index + 1}.5${unit}`);
	assert.deepEqual(kustoTokens(literals.join(' '), 'timespan'), literals);
	assert.deepEqual(
		kustoTokens(
			'1minutes_count 2millisecondsExtra 3hours_column 1us 1ns 1\u00b5s 1e3s',
			'timespan',
		),
		[],
	);
});
test('Kusto lexer recognizes query aliases and options without coloring arbitrary pipe words', () => {
	const keywords = (
		'filter mvapply mvexpand entity_group toscalar totable typeof ' +
		'datascope with_source with_step_name isfuzzy best_effort ' +
		'timechart barchart columnchart scatterchart'
	).split(' ');
	assert.deepEqual(kustoTokens(keywords.join(' '), 'keyword'), keywords);
	assert.deepEqual(
		kustoTokens(
			'T | pretend-operator value\nT | WHERE x\nT | hasprefix_column',
			'keyword',
		),
		[],
	);
	const operators =
		'containscs notcontains notcontainscs likecs notlike notlikecs';
	assert.deepEqual(kustoTokens(operators, 'keyword'), operators.split(' '));
});
test('Kusto lexer dollar identifiers, dotted properties and hints do not become scalar keywords', () => {
	const source = [
		'T | join kind=leftouter hint.strategy=shuffle hint.shufflekey=Key (U)',
		'on $left.Key == $right.Key',
		'| project A=Metadata.string, B=Metadata.true, C=Metadata.count, D=$123',
	].join('\n');
	assert.deepEqual(kustoTokens(source, 'variable'), [
		'$left',
		'$right',
		'$123',
	]);
	assert.deepEqual(kustoTokens(source, 'property'), [
		'Key',
		'Key',
		'string',
		'true',
		'count',
	]);
	assert.deepEqual(kustoTokens(source, 'parameter'), [
		'hint.strategy',
		'hint.shufflekey',
	]);
	assert.deepEqual(kustoTokens(source, 'class-name'), []);
	assert.deepEqual(kustoTokens(source, 'boolean'), []);
});
test('Kusto callable count and range differ from bare query operators', () => {
	const source = [
		'T | where (Flag) | summarize Events=count(), Values=make_list(Value)',
		'range x from 1 to 3 step 1',
		'print Samples=range(1,3,1), Data=database("db").table("Events")',
	].join('\n');
	for (const name of ['count', 'range', 'database', 'table', 'make_list']) {
		assert.ok(kustoTokens(source, 'function').includes(name), name);
	}
	assert.ok(kustoTokens(source, 'keyword').includes('where'));
	assert.ok(kustoTokens(source, 'keyword').includes('range'));
	assert.ok(!kustoTokens(source, 'function').includes('where'));
});
test(
	'adversarial grammar fixtures terminate within a bounded test timeout',
	{ timeout: 5000 },
	() => {
		load('kusto');
		for (const source of [
			'@"' + '""'.repeat(20000),
			'datetime('.repeat(15000),
			'long('.repeat(20000),
			'h~~~' + '// where\n'.repeat(10000),
		]) {
			sandbox.adversarialKusto = source;
			vm.runInContext(
				`window.SyntaxHighlighterPrism.tokenize(adversarialKusto, window.SyntaxHighlighterPrism.languages.kusto);`,
				sandbox,
				{ timeout: 3000 },
			);
		}
	},
);
