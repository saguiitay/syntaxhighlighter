// Upstream 1.30 lacks hyphenated operators, timespans and multiline strings.
Prism.languages.insertBefore('kusto', 'string', {
	'multiline-string': {
		pattern: /```[\s\S]*?```/,
		greedy: true,
		alias: 'string',
	},
	'verbatim-string': {
		pattern: /@(?:"(?:""|[^"])*"|'(?:''|[^'])*')/,
		greedy: true,
		alias: 'string',
	},
});
Prism.languages.insertBefore('kusto', 'keyword', {
	'tabular-operator': {
		pattern: /\b(?:project-away|project-keep|project-rename|mv-expand|mv-apply|make-series|parse-where|where|project|extend|summarize|join|union|lookup|sort|order|top|take|limit|distinct|evaluate|parse|serialize|render|as|partition)\b/,
		alias: 'keyword',
	},
	'query-keyword': {
		pattern: /\b(?:let|set|declare|query_parameters|datatable|externaldata|materialize|between|matches\s+regex)\b/,
		alias: 'keyword',
	},
});
Prism.languages.insertBefore('kusto', 'number', {
	timespan: {
		pattern: /\b\d+(?:\.\d+)?(?:ticks?|microseconds?|milliseconds?|minutes?|seconds?|hours?|days?|ms|us|ns|d|h|m|s)\b/,
		alias: 'number',
	},
});
