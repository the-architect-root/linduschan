(function() {
	if (!isThread) return;

	const init = () => {
		const panel = document.getElementById('catalog-viewer-panel');
		if (!panel) return;

		const boardMatch = window.location.pathname.match(/^\/(\w+)\/thread\/\d+.html/);
		if (!boardMatch) return;
		const currentBoard = boardMatch[1];

		const content = document.getElementById('catalog-viewer-content');
		const tabs = panel.querySelectorAll('.tab');
		const closeBtn = panel.querySelector('.close-btn');

		let currentMode = 'board';
		let loaded = false;

		const toggleBtn = document.createElement('button');
		toggleBtn.id = 'cv-toggle';
		toggleBtn.textContent = '\u00AB';
		toggleBtn.title = 'Show Catalog';
		toggleBtn.className = 'visible';
		document.body.appendChild(toggleBtn);

		const open = () => {
			panel.classList.remove('collapsed');
			toggleBtn.classList.remove('visible');
			document.body.classList.add('cv-panel-open');
			if (!loaded) {
				loaded = true;
				fetchThreads(currentMode);
			}
		};

		const close = () => {
			panel.classList.add('collapsed');
			toggleBtn.classList.add('visible');
			document.body.classList.remove('cv-panel-open');
		};

		toggleBtn.addEventListener('click', open);

		closeBtn.addEventListener('click', close);

		const renderThreads = (threads) => {
			if (!threads || threads.length === 0) {
				content.innerHTML = '<div class="cv-no-threads">No threads</div>';
				return;
			}
			const html = threads.map(t => {
				const thumbHtml = t.hasFile && !t.spoiler && t.fileHash
					? `<img class="cv-thumb" src="/${t.board}/file/thumb/${t.fileHash}${t.fileThumbExtension}" loading="lazy" alt="">`
					: `<div class="cv-no-thumb">${t.hasFile ? '' : 'N/A'}</div>`;
				const subject = t.subject || `#${t.postId}`;
				return `<div class="cv-thread" data-board="${t.board}" data-post-id="${t.postId}">
					${thumbHtml}
					<div class="cv-info">
						<div class="cv-subject">${subject}</div>
						<div class="cv-board">/${t.board}/</div>
						<div class="cv-stats">R:${t.replyposts} / I:${t.replyfiles}</div>
					</div>
				</div>`;
			}).join('');
			content.innerHTML = html;
			content.querySelectorAll('.cv-thread').forEach(el => {
				el.addEventListener('click', () => {
					const board = el.dataset.board;
					const postId = el.dataset.postId;
					window.location.href = `/${board}/thread/${postId}.html`;
				});
			});
		};

		const fetchThreads = async (mode) => {
			content.innerHTML = '<div class="cv-loading">Loading...</div>';
			try {
				let url;
				if (mode === 'board') {
					url = `/api/catalog-viewer.json?board=${currentBoard}`;
				} else {
					url = '/api/catalog-viewer.json';
				}
				const res = await fetch(url);
				if (!res.ok) throw new Error('Failed to fetch');
				let data = await res.json();
				if (mode === 'all') {
					data = data.filter(t => t.board !== currentBoard);
				}
				renderThreads(data);
			} catch (e) {
				content.innerHTML = '<div class="cv-error">Error loading</div>';
			}
		};

		tabs.forEach(tab => {
			tab.addEventListener('click', () => {
				tabs.forEach(t => t.classList.remove('active'));
				tab.classList.add('active');
				currentMode = tab.dataset.mode;
				fetchThreads(currentMode);
			});
		});
	};

	if (document.readyState === 'loading') {
		window.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
