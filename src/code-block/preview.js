import { useState, useEffect, useRef } from '@wordpress/element';
import { ToggleControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { initialize } from '../frontend';
import { unescapeIsolatedUrls } from '../utils';

const pending = new Map();
async function loadLanguage(id) {
	const entry = window.syntaxHighlighterData.grammars[id];
	if (!entry || window.SyntaxHighlighterPrism.languages[id]) return;
	if (!pending.has(id)) {
		pending.set(id, (async () => {
			await Promise.all(entry.dependencies.map(loadLanguage));
			await new Promise((resolve, reject) => {
				const script = document.createElement('script');
				script.src = entry.url;
				script.onload = resolve;
				script.onerror = () => reject(new Error('Could not load preview grammar.'));
				document.head.append(script);
			});
		})());
	}
	await pending.get(id);
}

export default function Preview({ attributes }) {
	const [visible, setVisible] = useState(false);
	const [error, setError] = useState('');
	const ref = useRef();
	useEffect(() => {
		if (!visible) return;
		let cancelled = false;
		const data = window.syntaxHighlighterData;
		const language = data.aliases[attributes.language] || 'plain';
		loadLanguage(language).then(() => {
			if (cancelled || !ref.current) return;
			const pre = document.createElement('pre');
			pre.className = `syntaxhighlighter-code${attributes.wrapLines ? ' sh-wrap' : ''}`;
			pre.tabIndex = 0;
			const code = document.createElement('code');
			code.className = `language-${language}`;
			code.textContent = unescapeIsolatedUrls(attributes.content);
			pre.append(code);
			Object.assign(pre.dataset, {
				firstline: attributes.firstLineNumber || '1',
				gutter: String(!!attributes.lineNumbers),
				highlight: attributes.highlightLines || '',
				tabsize: String(data.settings.tabSize),
			});
			const container = document.createElement('div');
			container.className = `sh-prism sh-theme-${attributes.theme || data.theme}`;
			container.append(pre);
			ref.current.replaceChildren(container);
			initialize(ref.current);
			setError('');
		}).catch((failure) => {
			if (!cancelled) setError(failure.message);
		});
		return () => { cancelled = true; };
	}, [visible, attributes]);
	return <div className="syntaxhighlighter-editor-preview">
		<ToggleControl label={__('Show syntax preview', 'syntaxhighlighter')} checked={visible} onChange={setVisible} />
		{error && <p role="alert">{error}</p>}
		{visible && <div ref={ref} />}
	</div>;
}
