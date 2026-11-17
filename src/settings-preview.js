const form = document.getElementById('syntaxhighlighter-settings');
const preview = document.getElementById('syntaxhighlighter-settings-preview');
const status = document.getElementById('syntaxhighlighter-preview-status');
const config = window.syntaxHighlighterSettingsPreview;

if (form && preview && status && config) {
	let timer;
	let controller;
	let revision = 0;
	let lastForm = new URLSearchParams(new FormData(form)).toString();

	async function update(current, values) {
		controller = new AbortController();
		try {
			const body = new URLSearchParams(values);
			body.set('action', 'syntaxhighlighter_preview');
			body.set('nonce', config.nonce);
			const response = await fetch(config.url, {
				method: 'POST',
				credentials: 'same-origin',
				body,
				signal: controller.signal,
			});
			if (!response.ok) throw new Error('Preview request failed.');
			const result = await response.json();
			if (!result.success || typeof result.data?.html !== 'string') {
				throw new Error('Invalid preview response.');
			}
			if (current !== revision) return;
			const parsed = new DOMParser().parseFromString(
				result.data.html,
				'text/html',
			);
			preview.replaceChildren(...parsed.body.childNodes);
			preview.ownerDocument.dispatchEvent(
				new CustomEvent('syntaxhighlighter:highlight', {
					detail: { root: preview },
				}),
			);
			status.textContent = '';
		} catch (error) {
			if (error.name === 'AbortError' || current !== revision) return;
			status.textContent = config.failed;
		} finally {
			if (current === revision) preview.setAttribute('aria-busy', 'false');
		}
	}

	function schedule() {
		const values = new URLSearchParams(new FormData(form)).toString();
		if (values === lastForm) return;
		lastForm = values;
		clearTimeout(timer);
		controller?.abort();
		const current = ++revision;
		status.textContent = config.updating;
		preview.setAttribute('aria-busy', 'true');
		timer = setTimeout(() => update(current, values), 150);
	}

	form.addEventListener('input', schedule);
	form.addEventListener('change', schedule);
	form.addEventListener('submit', () => {
		clearTimeout(timer);
		controller?.abort();
		revision++;
	});
}
