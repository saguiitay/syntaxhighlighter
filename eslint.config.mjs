export default [
	{ ignores: ['dist/**', 'node_modules/**', 'src/toolbar-dropdown/**'] },
	{
		files: ['src/**/*.js', 'scripts/**/*.mjs', 'tests/**/*.mjs', '*.mjs'],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			parserOptions: { ecmaFeatures: { jsx: true } },
		},
		rules: {
			'no-unreachable': 'error',
			'no-constant-condition': 'error',
			'no-dupe-keys': 'error',
			'no-duplicate-case': 'error',
			'no-var': 'error',
			'prefer-const': 'error',
			eqeqeq: ['error', 'always'],
		},
	},
];
