window.addEventListener('DOMContentLoaded', () => {
	// --- Toggle Collapsible Create Form ---
	window.toggleBlogForm = () => {
		const form = document.getElementById('blogPostForm');
		if (form) form.classList.toggle('open');
	};

	// --- Cover Image Pick + Crop Preview ---
	const coverPick = document.getElementById('coverPick');
	const coverWrap = document.getElementById('coverCropWrap');
	const coverPreviewImg = document.getElementById('coverPreviewImg');
	const cropSlider = document.getElementById('cropSlider');
	const cropY = document.getElementById('cropY');
	if (coverPick && coverWrap && coverPreviewImg && cropSlider && cropY) {
		coverPick.addEventListener('change', (e) => {
			const file = e.target.files[0];
			if (file) {
				const reader = new FileReader();
				reader.onload = (ev) => {
					coverPreviewImg.onload = () => {
						coverWrap.style.display = 'block';
					};
					coverPreviewImg.src = ev.target.result;
				};
				reader.readAsDataURL(file);
			} else {
				coverWrap.style.display = 'none';
			}
		});
		cropSlider.addEventListener('input', () => {
			cropY.value = cropSlider.value;
			coverPreviewImg.style.objectPosition = `50% ${cropSlider.value}%`;
		});
	}

	// --- Cover Image Picker (Create Blog) ---
	const coverPickBtn = document.getElementById('coverPickBtn');
	const coverInput = document.getElementById('coverInput');
	if (coverPickBtn && coverInput) {
		coverPickBtn.addEventListener('click', () => coverInput.click());
	}

	// --- Inline Image Insertion (New Entry / Dashboard) ---
	const fileInput = document.getElementById('blogMedia');
	const uploadBtn = document.getElementById('mediaUploadBtn');
	const mediaList = document.getElementById('mediaList');
	const contentTextarea = document.getElementById('blogContent');

	if (fileInput && uploadBtn && mediaList && contentTextarea) {
		let selectedFiles = [];

		uploadBtn.addEventListener('click', () => fileInput.click());

		fileInput.addEventListener('change', (e) => {
			for (const file of e.target.files) {
				if (!selectedFiles.find(f => f.name === file.name && f.size === file.size)) {
					selectedFiles.push(file);
				}
			}
			fileInput.value = '';
			renderMediaList();
			insertAllAtCursor();
		});

		function insertAllAtCursor() {
			selectedFiles.forEach(file => {
				insertFileMarkdown(file);
			});
		}

		function insertFileMarkdown(file) {
			const ta = contentTextarea;
			const ext = file.name.split('.').pop();
			const md = `![${file.name}](/file/PLACEHOLDER_${file.name}.${ext})`;
			const start = ta.selectionStart;
			const end = ta.selectionEnd;
			const before = ta.value.substring(0, start);
			const after = ta.value.substring(end);
			ta.value = before + md + '\n' + after;
			const cursor = start + md.length + 1;
			ta.focus();
			ta.setSelectionRange(cursor, cursor);
		}

		function swapFiles(i, j) {
			if (i < 0 || j < 0 || i >= selectedFiles.length || j >= selectedFiles.length) return;
			[selectedFiles[i], selectedFiles[j]] = [selectedFiles[j], selectedFiles[i]];
			swapLinesInTextarea(i, j);
			renderMediaList();
		}

		function swapLinesInTextarea(i, j) {
			const ta = contentTextarea;
			const lines = ta.value.split('\n');
			const placeholders = selectedFiles.map(f => {
				const ext = f.name.split('.').pop();
				return `PLACEHOLDER_${f.name}.${ext}`;
			});
			const pat = placeholders.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
			let lineIndices = [];
			lines.forEach((line, idx) => {
				pat.forEach((p, pi) => {
					if (line.includes(p)) lineIndices[pi] = idx;
				});
			});
			const li = lineIndices[i];
			const lj = lineIndices[j];
			if (li !== undefined && lj !== undefined && li !== lj) {
				[lines[li], lines[lj]] = [lines[lj], lines[li]];
				ta.value = lines.join('\n');
			}
		}

		function renderMediaList() {
			mediaList.innerHTML = '';
			selectedFiles.forEach((file, index) => {
				const url = URL.createObjectURL(file);
				const item = document.createElement('div');
				item.className = 'media-inline-item';

				const img = document.createElement('img');
				img.src = url;
				img.alt = file.name;
				item.appendChild(img);

				const name = document.createElement('span');
				name.className = 'media-inline-name';
				name.textContent = file.name;
				item.appendChild(name);

				const upBtn = document.createElement('button');
				upBtn.type = 'button';
				upBtn.className = 'media-inline-up';
				upBtn.innerHTML = '&#9650;';
				upBtn.disabled = index === 0;
				upBtn.addEventListener('click', () => swapFiles(index, index - 1));
				item.appendChild(upBtn);

				const downBtn = document.createElement('button');
				downBtn.type = 'button';
				downBtn.className = 'media-inline-down';
				downBtn.innerHTML = '&#9660;';
				downBtn.disabled = index === selectedFiles.length - 1;
				downBtn.addEventListener('click', () => swapFiles(index, index + 1));
				item.appendChild(downBtn);

				const removeBtn = document.createElement('button');
				removeBtn.type = 'button';
				removeBtn.className = 'media-inline-remove';
				removeBtn.textContent = '\u00D7';
				removeBtn.addEventListener('click', () => {
					removeFileMarkdown(file);
					selectedFiles.splice(index, 1);
					renderMediaList();
				});
				item.appendChild(removeBtn);

				mediaList.appendChild(item);
			});
			updateFileInput();
		}

		function removeFileMarkdown(file) {
			const ta = contentTextarea;
			const ext = file.name.split('.').pop();
			const placeholder = `PLACEHOLDER_${file.name}.${ext}`;
			const lines = ta.value.split('\n');
			const filtered = lines.filter(l => !l.includes(placeholder));
			ta.value = filtered.join('\n');
		}

		function updateFileInput() {
			const dt = new DataTransfer();
			selectedFiles.forEach(f => dt.items.add(f));
			fileInput.files = dt.files;
		}

		// Also handle entry-edit page's existing media removal
		const removeInput = document.getElementById('removeMediaInput');
		const previewsContainer = document.getElementById('mediaPreviews');
		if (removeInput && previewsContainer) {
			previewsContainer.addEventListener('click', (e) => {
				if (e.target.classList.contains('media-remove') && e.target.dataset.existing === 'true') {
					e.target.parentElement.remove();
					const removed = removeInput.value ? removeInput.value.split(',') : [];
					removed.push(e.target.dataset.filename);
					removeInput.value = removed.join(',');
				}
			});
		}
	}

	// --- Markdown Toolbar ---
	const toolbar = document.querySelector('.blog-editor-toolbar');
	const textarea = document.getElementById('blogContent');
	if (toolbar && textarea) {
		toolbar.addEventListener('click', (e) => {
			const btn = e.target.closest('.md-btn');
			if (!btn) return;

			const ta = textarea;
			const start = ta.selectionStart;
			const end = ta.selectionEnd;
			const sel = ta.value.substring(start, end);
			const before = ta.value.substring(0, start);
			const after = ta.value.substring(end);

			const tag = btn.dataset.tag;
			const wrap = btn.dataset.wrap;

			let result, cursor;

			if (wrap) {
				if (sel) {
					result = before + wrap + sel + after;
				} else {
					result = before + wrap + after;
				}
				cursor = start + wrap.length + (sel || '').length;
			} else if (tag) {
				if (sel) {
					result = before + tag + sel + tag + after;
				} else {
					const lbl = btn.dataset.label || 'text';
					result = before + tag + lbl + tag + after;
				}
				cursor = start + tag.length + (sel || lbl).length + tag.length;
			}

			ta.value = result;
			ta.focus();
			ta.setSelectionRange(cursor, cursor);
		});

		// --- Font Size Dropdown ---
		const fontSizeSelect = toolbar.querySelector('.md-font-size');
		if (fontSizeSelect) {
			fontSizeSelect.addEventListener('change', function() {
				const tag = this.value;
				if (!tag) return;
				const ta = textarea;
				const start = ta.selectionStart;
				const end = ta.selectionEnd;
				const sel = ta.value.substring(start, end);
				const before = ta.value.substring(0, start);
				const after = ta.value.substring(end);
				const lbl = sel || 'text';
				const result = before + tag + lbl + tag + after;
				ta.value = result;
				ta.focus();
				const cursor = start + tag.length + lbl.length + tag.length;
				ta.setSelectionRange(cursor, cursor);
				this.value = '';
			});
		}
	}

	// --- Media Lightbox ---
	const blogMediaItems = document.querySelectorAll('.blog-media img, .blog-text img');
	blogMediaItems.forEach(media => {
			media.style.cursor = 'pointer';
			media.addEventListener('click', () => {
				const overlay = document.createElement('div');
				overlay.id = 'blog-media-overlay';
				overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.9);z-index:999999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
				const clone = media.cloneNode(true);
				clone.style.cssText = 'max-width:95vw;max-height:95vh;object-fit:contain;';
				if (media.nodeName === 'VIDEO') {
					clone.controls = true;
					clone.autoplay = true;
				}
				overlay.appendChild(clone);
				overlay.addEventListener('click', () => overlay.remove());
				document.body.appendChild(overlay);
			});
		});
});