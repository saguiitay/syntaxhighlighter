// Backport RunDevelopment/prism#3 at 7df2d65 onto pinned Prism 1.30.0.
Object.assign(Prism.languages.kusto, {
	string: {
		pattern:
			/```[\s\S]*?```|[hH]?(?:"(?:[^\r\n\\"]|\\.)*"|'(?:[^\r\n\\']|\\.)*'|@(?:"(?:[^\r\n"]|"")*"|'(?:[^\r\n']|'')*'))/,
		greedy: true,
	},
	'class-name':
		/\b(?:bool|date|datetime|decimal|double|dynamic|guid|int|int32|int64|long|real|string|time|timespan)\b/,
	keyword:
		/\b(?:access|alias|and|anti|as|asc|auto|between|by|(?:contains|(?:ends|starts)with|has(?:prefix|suffix)?)(?:_cs)?|count|database|datatable|declare|desc|distinct|evaluate|extend|external|external_data|externaldata|facet|find|fork|from|fullouter|getschema|graph-match|graph-shortest-paths|graph-to-table|has_all|has_any|in~?|ingestion|inline|inner|innerunique|into|invoke|join|kind|(?:left|right)(?:anti(?:semi)?|inner|outer|semi)?|let|like|limit|local|lookup|macro-expand|make-graph|make-series|materialize|mv-apply|mv-expand|not|of|on|or|order|parse|parse-kv|parse-where|partition|pattern|print|project|project-away|project-keep|project-rename|project-reorder|query_parameters|range|reduce|render|restrict|sample|sample-distinct|scan|schema|search|serialize|set|sort|step|summarize|table|tables|take|to|top|top-hitters|top-nested|union|view|where|with|with_itemindex|withsource|matches\s+regex|nulls\s+(?:first|last))(?![\w-])/,
	boolean: /\b(?:FALSE|False|TRUE|True|false|null|true)\b/,
	function: /\b[a-z_]\w*(?=\s*\()/i,
	operator: /=>|<\||<>|[!=]~|[!=<>]=?|[-+*/%|]|\.\./,
});
Prism.languages.insertBefore('kusto', 'verb', {
	command: {
		pattern: /(^[ \t]*)\.[a-z][a-z\d-]*\b/m,
		lookbehind: true,
		greedy: true,
		alias: 'keyword',
	},
});

// Keep the plugin's verbatim-string styling and extended timespan units.
Prism.languages.insertBefore('kusto', 'string', {
	'verbatim-string': {
		pattern: /[hH]?@(?:"(?:[^\r\n"]|"")*"|'(?:[^\r\n']|'')*')/,
		greedy: true,
		alias: 'string',
	},
});
Prism.languages.insertBefore('kusto', 'number', {
	timespan: {
		pattern:
			/\b\d+(?:\.\d+)?(?:ticks?|microseconds?|milliseconds?|minutes?|seconds?|hours?|days?|ms|us|ns|d|h|m|s)\b/,
		alias: 'number',
	},
});
