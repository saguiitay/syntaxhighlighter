import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime, createNodeFsMountHandler } from '@php-wasm/node';

export async function createPHP(version = process.env.PHP_VERSION || '8.2') {
	const php = new PHP(
		await loadNodeRuntime(version, { emscriptenOptions: { processId: 1 } }),
	);
	php.mkdir('/repo');
	await php.mount('/repo', createNodeFsMountHandler(process.cwd()));
	return php;
}

export function checkResponse(response) {
	if (response.exitCode !== 0 || response.errors) {
		throw new Error(response.errors + '\n' + response.text);
	}
	return response.text;
}
