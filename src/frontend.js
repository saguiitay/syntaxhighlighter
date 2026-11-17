const originals = new WeakMap();
const initialized = new WeakSet();
const labels = () => ({
	copy: 'Copy code',
	copied: 'Code copied.',
	failed: 'Copy failed. Select the code and copy it manually.',
	...window.syntaxHighlighterPrismLabels,
});

export function highlighted(line, ranges) {
	return ranges.split(',').some((range) => {
		if (!/^\s*\d+(?:\s*-\s*\d+)?\s*$/.test(range)) return false;
		const [start, end = start] = range.split('-').map(Number);
		return line >= start && line <= end;
	});
}

function appendText(parent, text, autolinks, fixedTabs) {
	if (fixedTabs && text.includes('\t')) {
		text.split('\t').forEach((part, index) => {
			if (index) {
				const tab = document.createElement('span');
				tab.className = 'sh-tab';
				tab.style.width = `${fixedTabs}ch`;
				tab.textContent = '\t';
				parent.append(tab);
			}
			appendText(parent, part, autolinks, 0);
		});
		return;
	}
	if (!autolinks) {
		parent.append(document.createTextNode(text));
		return;
	}
	let from = 0;
	for (const match of text.matchAll(/https?:\/\/[^\s<>"']+/g)) {
		parent.append(document.createTextNode(text.slice(from, match.index)));
		const link = document.createElement('a');
		link.href = match[0];
		link.textContent = match[0];
		link.rel = 'nofollow noopener noreferrer';
		parent.append(link);
		from = match.index + match[0].length;
	}
	parent.append(document.createTextNode(text.slice(from)));
}

function decorate(pre, code, source, Prism) {
	let language = code.className.match(/\blanguage-([a-z0-9-]+)\b/)?.[1];
	if (
		pre.dataset.htmlscript === 'true' &&
		['javascript', 'css'].includes(language)
	) {
		language = 'markup';
	}
	let tokens = [source];
	if (Prism?.languages[language]) {
		tokens = Prism.tokenize(source, Prism.languages[language]);
	}
	const fragment = document.createDocumentFragment();
	const first = Number(pre.dataset.firstline || 1);
	const last = first + source.split(/\r\n|\r|\n/).length - 1;
	const numberWidth = Math.max(String(first).length, String(last).length);
	let number = first;
	const padding = pre.dataset.padlinenumbers;
	const width =
		padding === 'true' ? numberWidth : Math.min(12, Number(padding) || 0);
	pre.style.setProperty('--sh-gutter', `${Math.max(2, width, numberWidth)}ch`);
	let line;
	function newLine() {
		line = document.createElement('span');
		line.className = 'sh-line';
		line.dataset.line = String(number).padStart(width, '0');
		if (highlighted(number, pre.dataset.highlight || '')) {
			line.classList.add('sh-highlight');
		}
		fragment.append(line);
		number++;
	}
	newLine();
	function append(token, classes = []) {
		if (Array.isArray(token)) {
			token.forEach((part) => append(part, classes));
		} else if (typeof token === 'string') {
			const parts = token.split(/(\r\n|\r|\n)/);
			parts.forEach((part, index) => {
				if (index % 2) {
					fragment.append(document.createTextNode(part));
					newLine();
				} else if (part) {
					const target = classes.length ? document.createElement('span') : line;
					if (target !== line) {
						target.className = ['token', ...classes].join(' ');
						line.append(target);
					}
					appendText(
						target,
						part,
						pre.dataset.autolinks === 'true',
						pre.dataset.smarttabs === 'false'
							? Number(pre.dataset.tabsize) || 4
							: 0,
					);
				}
			});
		} else {
			append(token.content, [
				...classes,
				token.type,
				...[token.alias || []].flat(),
			]);
		}
	}
	append(tokens);
	code.replaceChildren(fragment);
}

export function initialize(root = document) {
	const blocks = [
		...(root.matches?.('pre.syntaxhighlighter-code') ? [root] : []),
		...root.querySelectorAll('pre.syntaxhighlighter-code'),
	];
	for (const pre of blocks) {
		if (initialized.has(pre)) continue;
		const container = pre.closest('.sh-prism');
		const code = pre.querySelector('code');
		if (!container || !code) continue;
		initialized.add(pre);
		const source = code.textContent;
		originals.set(pre, source);
		pre.style.tabSize = String(
			Math.max(1, Math.min(16, Number(pre.dataset.tabsize) || 4)),
		);
		pre.style.fontSize = `${Math.max(50, Math.min(200, Number(pre.dataset.fontsize) || 100))}%`;
		if (source.length <= 200000 && source.split(/\r\n|\r|\n/).length <= 10000) {
			decorate(pre, code, source, window.SyntaxHighlighterPrism);
		} else {
			pre.dataset.unhighlighted = 'large';
			const notice = document.createElement('p');
			notice.className = 'sh-large-notice';
			notice.textContent =
				'Large code block: syntax colors and line decorations are disabled; the full source is available to read and copy.';
			pre.before(notice);
		}
		const copy = container.querySelector('.sh-copy');
		const status = container.querySelector('.sh-status');
		if (copy) {
			copy.hidden = false;
			copy.textContent = labels().copy;
			copy.addEventListener('click', async () => {
				try {
					if (!navigator.clipboard?.writeText)
						throw new Error('Clipboard unavailable');
					await navigator.clipboard.writeText(originals.get(pre));
					status.textContent = labels().copied;
				} catch {
					status.textContent = labels().failed;
					pre.focus();
				}
			});
		}
		if (pre.dataset.quickcode === 'true') {
			pre.addEventListener('dblclick', () => {
				const range = document.createRange();
				range.selectNodeContents(code);
				const selection = window.getSelection();
				selection.removeAllRanges();
				selection.addRange(range);
			});
		}
	}
}

if (typeof document !== 'undefined') {
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => initialize(), {
			once: true,
		});
	} else {
		initialize();
	}
	document.addEventListener('syntaxhighlighter:highlight', (event) => {
		initialize(event.detail?.root || document);
	});
	// Jetpack infinite scroll is event-driven, never a document-wide observer.
	if (window.jQuery) {
		window
			.jQuery(document.body)
			.on('post-load.syntaxhighlighter-prism', () => initialize());
	}
}
