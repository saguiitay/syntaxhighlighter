import { mkdir, writeFile } from 'node:fs/promises';
import { createPHP, checkResponse } from './php-runtime.mjs';
const php = await createPHP();
try {
	console.log(
		checkResponse(
			await php.run({
				code: `<?php
		foreach (array('/repo/syntaxhighlighter.php', '/repo/includes/class-prism-renderer.php') as $file) {
			token_get_all(file_get_contents($file), TOKEN_PARSE);
			echo "PHP syntax OK: $file\\n";
		}
	`,
			}),
		),
	);
	const text = checkResponse(
		await php.run({ scriptPath: '/repo/tests/php/run.php' }),
	);
	const result = JSON.parse(text);
	await mkdir('artifacts', { recursive: true });
	await writeFile('artifacts/rendered.json', JSON.stringify(result, null, 2));
	console.log(
		`PHP ${result.php}: ${result.assertions} assertions passed; browser render fixtures generated.`,
	);
} finally {
	php.exit();
}
