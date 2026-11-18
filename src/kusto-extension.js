// Refine Prism 1.30.0 and RunDevelopment/prism#3 using Kusto's lexical rules.
function stringPattern(body) {
	// Only a standalone h/H belongs to a string; keep identifier suffixes separate.
	return new RegExp(`(^|[^\\w$])[hH](?:${body})|(?:${body})`);
}

Prism.languages.kusto = {
	comment: Prism.languages.kusto.comment,
	'verbatim-string': {
		pattern: stringPattern(/@(?:"(?:[^\r\n"]|"")*"|'(?:[^\r\n']|'')*')/.source),
		lookbehind: true,
		greedy: true,
		alias: 'string',
	},
	string: {
		pattern: stringPattern(
			/(?:"(?:[^\r\n\\"]|\\.)*"|'(?:[^\r\n\\']|\\.)*'|@?(?:```[\s\S]*?```|~~~[\s\S]*?~~~))/
				.source,
		),
		lookbehind: true,
		greedy: true,
	},
	datetime: {
		pattern: /(^|[^\w$])(?:date|datetime)\([^()\r\n\u2028\u2029]*\)/,
		lookbehind: true,
		greedy: true,
		alias: 'number',
	},
	timespan: [
		{
			pattern: /(^|[^\w$])(?:time|timespan)\([^()\r\n\u2028\u2029]*\)/,
			lookbehind: true,
			greedy: true,
			alias: 'number',
		},
		{
			pattern:
				/\b\d+(?:\.\d+)?(?:minutes?|min|milliseconds?|millisec|millis?|microseconds?|microsec|micros?|nanoseconds?|nanosec|nanos?|seconds?|sec|hours?|hrs?|days?|ticks?|ms|[dhms])(?!\w)/,
			alias: 'number',
		},
	],
	'typed-number': {
		pattern:
			/(^|[^\w$])(?:int|int32|long|int64|real|double|decimal)\([^()\r\n\u2028\u2029]*\)/,
		lookbehind: true,
		greedy: true,
		alias: 'number',
	},
	'typed-boolean': {
		pattern: /(^|[^\w$])bool\([^()\r\n\u2028\u2029]*\)/,
		lookbehind: true,
		greedy: true,
		alias: 'boolean',
	},
	guid: [
		{
			pattern: /(^|[^\w$])guid\([^()\r\n\u2028\u2029]*\)/,
			lookbehind: true,
			greedy: true,
			alias: 'number',
		},
		{
			pattern: /\b[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}(?!\w)/,
			alias: 'number',
		},
	],
	variable: /\$\w+/,
	command: {
		pattern: /(^[ \t]*)\.[a-z][a-z\d-]*\b/m,
		lookbehind: true,
		greedy: true,
		alias: 'keyword',
	},
	'builtin-function': {
		pattern: /(^|[^\w$])(?:count|database|range|table)(?=\s*\()/,
		lookbehind: true,
		alias: 'function',
	},
	parameter: {
		pattern:
			/\bhint\.(?:concurrency|distribution|materialized|num_partitions|progressive_top|remote|shufflekey|spread|strategy)(?!\w)/,
		alias: 'keyword',
	},
	number:
		/\b(?:0[xX][0-9a-fA-F]+|(?:\d+\.(?!\.)\d*|\d+)(?:[eE][+-]?\d+)?)(?!\w)/,
	property: {
		pattern: /(\.\s*)[a-zA-Z_]\w*(?!\w|\s*\()/,
		lookbehind: true,
	},
	'class-name':
		/\b(?:bool|boolean|date|datetime|decimal|double|dynamic|float|guid|int|int32|int64|long|real|string|time|timespan|uniqueid|uuid)\b/,
	keyword: [
		/!(?:between|in~?|(?:contains|endswith|has(?:prefix|suffix)?|startswith)(?:_cs)?)(?![\w-])/,
		{
			pattern:
				/(^|[^\w$])(?:access|accumulate|alias|and|anti|as|asc|assert-schema|auto|between|best_effort|by|(?:contains|endswith|has(?:prefix|suffix)?|startswith)(?:_cs)?|containscs|count|database|datascope|datatable|declare|default|desc|distinct|entity_group|evaluate|extend|external|external_data|externaldata|facet|filter|find|first|flags|fork|from|fullouter|getschema|graph-match|graph-shortest-paths|graph-to-table|has_all|has_any|in~?|ingestion|inline|inner|innerunique|into|invoke|isfuzzy|join|kind|last|(?:left|right)(?:anti(?:semi)?|inner|outer|semi)?|let|like(?:cs)?|limit|local|lookup|macro-expand|make-graph|make-series|materialize|materialized-view-combine|mv-apply|mv-expand|mvapply|mvexpand|not|notcontains(?:cs)?|notlike(?:cs)?|null|nulls|of|on|or|order|parse|parse-kv|parse-where|partition|pattern|print|project|project-away|project-keep|project-rename|project-reorder|query_parameters|range|reduce|render|restrict|sample|sample-distinct|scan|schema|search|serialize|set|sort|step|summarize|table|tables|take|to|top|top-hitters|top-nested|toscalar|totable|typeof|union|view|where|with|with_itemindex|with_source|with_step_name|withsource|anomalychart|areachart|barchart|card|columnchart|ladderchart|linechart|piechart|pivotchart|scatterchart|stackedareachart|timechart|timeline|timepivot|treemap|matches\s+regex)(?![\w-])/,
			lookbehind: true,
		},
	],
	boolean: /\b(?:FALSE|False|TRUE|True|false|true)\b/,
	function: {
		pattern: /(^|[^\w$])[a-zA-Z_]\w*(?=\s*\()/,
		lookbehind: true,
	},
	operator: /=>|<\||<>|[!=]~|!=|[<>]=?|={1,2}|[-+*/%|]|\.\./,
	punctuation: /[()[\]{},;.:@?!]/,
};
