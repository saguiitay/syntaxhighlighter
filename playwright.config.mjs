import { defineConfig } from '@playwright/test';
export default defineConfig({
	testDir: './tests/browser',
	workers: 1,
	fullyParallel: false,
	timeout: 30000,
	use: { headless: true },
	reporter: [['list'], ['html', { open: 'never' }]],
});
