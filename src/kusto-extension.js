// Extend upstream Kusto; retain its pipe operators, datetime and multiline rules.
Prism.languages.insertBefore('kusto', 'string', {
	'verbatim-string': {
		pattern: /@(?:"(?:""|[^"])*"|'(?:''|[^'])*')/,
		greedy: true,
		alias: 'string',
	},
});
Prism.languages.insertBefore('kusto', 'keyword', {
	'tabular-operator': {
		pattern: /(^[ \t]*|[;|]\s*)(?:project-away|project-keep|project-rename|mv-expand|mv-apply|make-series|parse-where|where|project|extend|summarize|join|union|lookup|sort|order|top|take|limit|distinct|evaluate|parse|serialize|render|as|partition)\b/m,
		lookbehind: true,
		alias: 'keyword',
	},
	'query-keyword': {
		pattern: /\b(?:let|set|declare|query_parameters|datatable|externaldata|materialize|between|matches\s+regex)\b/,
		alias: 'keyword',
	},
	'string-operator': {
		pattern: /\b(?:hasprefix|hassuffix|has_any)(?:_cs)?\b/,
		alias: 'keyword',
	},
});
Prism.languages.kusto.command = {
	pattern: /(^[ \t]*)\.[a-z][a-z\d-]*\b/m,
	lookbehind: true,
	alias: 'keyword',
};
Prism.languages.kusto.function = /\b[a-zA-Z_]\w*(?=\s*\()/;
Prism.languages.insertBefore('kusto', 'number', {
	timespan: {
		pattern: /\b\d+(?:\.\d+)?(?:ticks?|microseconds?|milliseconds?|minutes?|seconds?|hours?|days?|ms|us|ns|d|h|m|s)\b/,
		alias: 'number',
	},
});
