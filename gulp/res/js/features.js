/* globals __ */
class FeaturesController {
	constructor() {
		this.init();
	}

	init() {
		this.initPostHighlight();
		this.initImageGallery();
	}

	// ===== POST HIGHLIGHT =====
	initPostHighlight() {
		document.addEventListener('click', (e) => {
			const postNum = e.target.closest('.post-number, [data-post-id]');
			if (!postNum) return;
			
			const postId = postNum.dataset.postId || postNum.textContent.replace('No.', '');
			if (!postId) return;
			
			// Highlight all backlinks to this post
			document.querySelectorAll('.post').forEach(post => {
				post.style.opacity = '0.5';
			});
			
			document.querySelectorAll(`a[href$="#${postId}"]`).forEach(link => {
				const post = link.closest('.post');
				if (post) {
					post.style.opacity = '1';
					post.style.background = 'rgba(255,255,0,0.1)';
				}
			});
			
			// Reset after 3 seconds
			setTimeout(() => {
				document.querySelectorAll('.post').forEach(post => {
					post.style.opacity = '';
					post.style.background = '';
				});
			}, 3000);
		});
	}

	// ===== IMAGE GALLERY =====
	initImageGallery() {
		document.addEventListener('keydown', (e) => {
			if (e.key === 'g' && !this.isTyping()) {
				e.preventDefault();
				this.openImageGallery();
			}
		});
	}

	isTyping() {
		const active = document.activeElement;
		return active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
	}

	openImageGallery() {
		// Get all file thumbnails from posts
		const thumbImages = Array.from(document.querySelectorAll('.post .file-thumb, .file-thumb img, img[src*="/file/thumb/"], a[href*="/file/"] img'))
			.filter(img => {
				if (!img.src) return false;
				// Exclude UI images
				if (img.src.includes('noimage') || img.src.includes('spoiler') || img.src.includes('deleted')) return false;
				if (img.src.includes('favicon') || img.src.includes('logo')) return false;
				return true;
			})
			.map(img => {
				// Get the parent anchor tag which has the full image link
				const anchor = img.closest('a[href*="/file/"]');
				if (anchor) {
					const href = anchor.getAttribute('href');
					// Extract board and filename from href like /b/file/abc123.jpg
					const match = href.match(/\/([^/]+)\/file\/(.+)$/);
					if (match) {
						return {
							thumbSrc: img.src,
							fullSrc: href,
							board: match[1],
							filename: match[2]
						};
					}
				}
				// Fallback: try to construct full image URL from thumb
				if (img.src.includes('/thumb/')) {
					const fullSrc = img.src.replace('/thumb/', '/');
					return { thumbSrc: img.src, fullSrc };
				}
				return { thumbSrc: img.src, fullSrc: img.src };
			})
			.filter(item => item); // Remove nulls
		
		if (thumbImages.length === 0) {
			console.log('No images found in thread');
			return;
		}
		
		console.log('Gallery images found:', thumbImages.length);
		
		let currentIndex = 0;
		let isLoading = false;
		
		const modal = document.createElement('div');
		modal.id = 'image-gallery';
		modal.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: rgba(0,0,0,0.95);
			z-index: 10000;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
		`;
		
		const updateImage = () => {
			if (isLoading) return;
			isLoading = true;
			
			const imgData = thumbImages[currentIndex];
			console.log('Loading image:', imgData.fullSrc);
			
			// Show loading state
			modal.innerHTML = `
				<div style="color: white; font-size: 16px;">Loading...</div>
				<div style="position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); color: white; font-size: 14px;">
					${currentIndex + 1} / ${thumbImages.length} • Press ← → to navigate, ESC to close
				</div>
			`;
			
			// Create and load full image
			const fullImg = new Image();
			fullImg.onload = () => {
				isLoading = false;
				modal.innerHTML = `
					<img src="${imgData.fullSrc}" style="max-width: 95%; max-height: 85vh; object-fit: contain; cursor: zoom-in;">
					<div style="position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); color: white; font-size: 14px; background: rgba(0,0,0,0.7); padding: 8px 16px; border-radius: 20px;">
						${currentIndex + 1} / ${thumbImages.length} • ← → to navigate • ESC to close
					</div>
				`;
				
				// Add click to zoom toggle
				const displayedImg = modal.querySelector('img');
				if (displayedImg) {
					displayedImg.addEventListener('click', (e) => {
						e.stopPropagation();
						if (displayedImg.style.objectFit === 'contain') {
							displayedImg.style.objectFit = 'none';
							displayedImg.style.width = 'auto';
							displayedImg.style.height = 'auto';
							displayedImg.style.cursor = 'zoom-out';
						} else {
							displayedImg.style.objectFit = 'contain';
							displayedImg.style.width = '';
							displayedImg.style.height = '';
							displayedImg.style.cursor = 'zoom-in';
						}
					});
				}
			};
			
			fullImg.onerror = () => {
				isLoading = false;
				modal.innerHTML = `
					<div style="color: #ff6666; font-size: 16px;">Failed to load image</div>
					<div style="position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); color: white; font-size: 14px;">
						${currentIndex + 1} / ${thumbImages.length}
					</div>
				`;
			};
			
			fullImg.src = imgData.fullSrc;
		};
		
		updateImage();
		
		// Click background to close
		modal.addEventListener('click', (e) => {
			if (e.target === modal) modal.remove();
		});
		
		document.addEventListener('keydown', function galleryNav(e) {
			if (e.key === 'Escape') {
				modal.remove();
				document.removeEventListener('keydown', galleryNav);
			} else if (e.key === 'ArrowRight') {
				currentIndex = (currentIndex + 1) % thumbImages.length;
				updateImage();
			} else if (e.key === 'ArrowLeft') {
				currentIndex = (currentIndex - 1 + thumbImages.length) % thumbImages.length;
				updateImage();
			}
		});
		
		document.body.appendChild(modal);
	}
}

// Initialize
const featuresController = new FeaturesController();

// Expose for debugging
window.featuresController = featuresController;
