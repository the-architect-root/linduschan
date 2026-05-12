/* globals __ */
class KeymapController {
	constructor() {
		this.isTyping = false;
		this.init();
	}

	init() {
		// Track if user is typing in any input/textarea
		this.setupTypingDetection();
		
		// Main keyboard listener
		document.addEventListener('keydown', (e) => this.handleKeydown(e));
		
		// Track regular form submissions to sync cooldown
		this.setupSubmitTracking();
	}
	
	setupSubmitTracking() {
		// Monitor all form submissions
		document.addEventListener('submit', (e) => {
			const form = e.target;
			// Only track post forms
			if (form.id === 'postform' || form.action?.includes('/post')) {
				this.lastSubmitTime = Date.now();
			}
		}, true);
	}

	setupTypingDetection() {
		// Detect when user focuses any input field
		document.addEventListener('focusin', (e) => {
			if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
				this.isTyping = true;
			}
		});
		
		document.addEventListener('focusout', (e) => {
			if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
				this.isTyping = false;
			}
		});
	}

	handleKeydown(e) {
		if (!e || !e.key) return;
		const key = e.key.toLowerCase();
		const isCtrl = e.ctrlKey || e.metaKey;
		
		// Check if user is typing in an input/textarea
		const activeElement = document.activeElement;
		const isInputActive = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');
		
		// Ctrl+Enter to submit form when in reply box
		if (isCtrl && key === 'enter' && isInputActive) {
			e.preventDefault();
			this.submitForm();
			return;
		}
		
		// Don't intercept other keys when typing
		if (isInputActive) {
			return;
		}
		
		// Navigation shortcuts (only when not typing and no modifier keys)
		if (!isCtrl && !e.altKey && !e.shiftKey) {
			switch(key) {
				case 'h':
					e.preventDefault();
					window.location.href = '/index.html';
					break;
					
				case 'b':
					e.preventDefault();
					window.location.href = '/boards.html';
					break;
					
				case 'r':
					e.preventDefault();
					this.openReply();
					break;
			}
		}
	}

	openReply() {
		console.log('R pressed - trying to open reply');
		
		// Try to find the post form
		let postForm = document.getElementById('postform');
		console.log('postform by ID:', postForm);
		
		if (!postForm) {
			postForm = document.querySelector('.form-post, form[action*="/post"]');
			console.log('postform by class:', postForm);
		}
		
		if (!postForm) {
			const messageField = document.querySelector('textarea[name="message"], #message');
			if (messageField) {
				postForm = messageField.closest('form');
			}
		}
		
		if (postForm) {
			// Check if form is in a details/summary collapsible section
			const details = postForm.closest('details');
			if (details) {
				console.log('Opening details element');
				details.open = true;
			}
			
			// Check for parent details
			const parentDetails = postForm.parentElement?.closest('details');
			if (parentDetails && parentDetails !== details) {
				console.log('Opening parent details');
				parentDetails.open = true;
			}
			
			// Check if there's a post button that needs clicking to show form
			const postButton = document.querySelector('.post-button, #post-button, [data-post-form-trigger]');
			if (postButton) {
				console.log('Clicking post button:', postButton);
				postButton.click();
			}
			
			// Find message field and focus
			const messageField = postForm.querySelector('textarea[name="message"], textarea#message, #message');
			console.log('Message field:', messageField);
			
			if (messageField) {
				// Make sure field is visible first
				messageField.style.display = messageField.style.display || 'block';
				
				// Focus with slight delay to allow any animations
				setTimeout(() => {
					messageField.focus();
					messageField.scrollIntoView({ behavior: 'smooth', block: 'center' });
					console.log('Focused message field');
				}, 100);
			}
		} else {
			console.log('No post form found');
		}
	}

	submitForm() {
		// Find the active form or post form
		const activeElement = document.activeElement;
		let form = null;
		
		if (activeElement) {
			form = activeElement.closest('form');
		}
		
		// Fallback to postform if no form found
		if (!form) {
			form = document.getElementById('postform');
		}
		
		if (form) {
			const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
			if (submitBtn) {
				submitBtn.click();
			} else {
				// Fallback: try to submit form directly
				form.submit();
			}
		}
	}
}

// Initialize when DOM is ready
const keymapController = new KeymapController();
