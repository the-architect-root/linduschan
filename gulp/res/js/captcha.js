/* globals __ captchaOptions captchaformsection */
const captchaCookieRegex = /captchaid=(.[^;]*)/ig;
class CaptchaController {

	constructor() {
		this.captchaFields = [];
		this.refreshing = false;
	}

	init() {
		this.captchaFields = document.getElementsByClassName('captchafield');
		this.refreshing = false;
		for (let captcha of this.captchaFields) {
			this.setupCaptchaField(captcha);
		}
	}

	captchaAge() {
		const captchaCookieMatch = document.cookie.match(captchaCookieRegex);
		if (!captchaCookieMatch) { return; }
		const cookieParams = new URLSearchParams(captchaCookieMatch[0]);
		const captchaIdCookie = cookieParams.get('captchaid');
		if (captchaIdCookie) {
			const captchaExpiry = new Date(parseInt(captchaIdCookie.slice(0,8),16)*1000);
			return (Date.now() - captchaExpiry);
		}
	}

	startRefreshTimer() {
		clearTimeout(this.refreshTimer); //this wont throw an error if its null, so no need to check
		const captchaAge = this.captchaAge();
		if (captchaAge != null) {
			console.log('Refreshing captcha in ', 300000-captchaAge);
			this.refreshTimer = setTimeout(() => {
				this.refreshCaptchas();
			}, 300000-captchaAge);
		}
	}

	setupCaptchaField(captcha) {
		console.log('setupCaptchaField called, type:', captchaOptions.type, 'preload:', captcha.closest('form').dataset.captchaPreload);
		if (captcha.closest('form').dataset.captchaPreload == 'true') {
			console.log('Preloading captcha');
			return this.loadCaptcha(captcha);
		}
		if (captchaOptions.type === 'grid' || captchaOptions.type === 'grid2') {
			let hoverListener = captcha.closest('details') || captcha;
			//captcha.parentElement.previousSibling.previousSibling.tagName === 'SUMMARY' ? captcha.parentElement.previousSibling.previousSibling :  captcha.parentElement;
			hoverListener.addEventListener('mouseover', () => this.loadCaptcha(captcha), { once: true });
		} else { //captchaOptions.type === 'text'
			console.log('Setting up text captcha');
			captcha.placeholder = __('loading...');

			// Load captcha when post form is opened
			const postForm = document.getElementById('postform');
			if (postForm) {
				postForm.addEventListener('opened', () => {
					console.log('Post form opened, loading captcha');
					this.loadCaptcha(captcha);
				}, { once: true });
			}

			// Fallback: load on focus if form is already open or event doesn't fire
			captcha.addEventListener('focus', () => {
				console.log('Captcha field focused, calling loadCaptcha');
				this.loadCaptcha(captcha);
			}, { once: true });
		}
	}

	refreshCaptchas(e) {
		if (this.refreshing) {
			return null;
		}
		this.refreshing = true;
		e && e.target.classList.add('spin');
		for (let captchacheck of document.querySelectorAll('input[name="captcha"]')) {
			captchacheck.checked = false;
		}
		document.cookie = 'captchaid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
		
		// Clear existing and reload
		for (let captcha of this.captchaFields) {
			const captchaDiv = captcha.previousSibling;
			captchaDiv.innerHTML = '';
			this.loadCaptcha(captcha, '/captcha?v=' + Date.now());
		}
		this.startRefreshTimer();
		this.refreshing = false;
		e && e.target.classList.remove('spin');
	}

	removeCaptcha() {
		const postForm = document.getElementById('postform');
		const captchaField = postForm.querySelector('.captcha');
		if (captchaField) {
			//delete the whole row
			const captchaRow = captchaField.closest('.row');
			captchaRow.remove();
		}
	}

	addMissingCaptcha() {
		const postSubmitButton = document.getElementById('submitpost');
		const captchaFormSectionHtml = captchaformsection({ captchaOptions });
		postSubmitButton.insertAdjacentHTML('beforebegin', captchaFormSectionHtml);
		const captchaFormSection = postSubmitButton.previousSibling;
		const captchaField = captchaFormSection.querySelector('.captchafield');
		this.loadCaptcha(captchaField);
	}

	showCaptchaError(field, message) {
		const captchaDiv = field.previousSibling;
		captchaDiv.innerHTML = '';
		captchaDiv.style.display = 'flex';
		captchaDiv.style.alignItems = 'center';
		captchaDiv.style.justifyContent = 'center';
		captchaDiv.style.padding = '10px';
		captchaDiv.style.backgroundColor = 'rgba(255,0,0,0.1)';
		captchaDiv.style.borderRadius = '4px';
		captchaDiv.style.minHeight = '60px';
		captchaDiv.textContent = message;
		if (captchaOptions.type === 'text') {
			field.placeholder = __('Error - click ↻ to retry');
		}
	}

	loadCaptcha(field, imgSrc = '/captcha') {
		const captchaDiv = field.previousSibling;
		console.log('loadCaptcha called, field:', field, 'captchaDiv:', captchaDiv);
		if (!captchaDiv) {
			console.error('No captcha div found!');
			return;
		}
		console.log('captchaDiv children:', captchaDiv.children.length, 'innerHTML:', captchaDiv.innerHTML.substring(0, 100));
		if (captchaDiv.children.length > 0) {
			console.log('Already has children, returning');
			return;
		}
		
		const captchaImg = document.createElement('img');
		const refreshDiv = document.createElement('div');
		captchaDiv.style.display = '';
		captchaImg.style.margin = '0 auto';
		captchaImg.style.display = 'flex';
		refreshDiv.classList.add('captcharefresh', 'noselect');
		refreshDiv.addEventListener('click', (e) => this.refreshCaptchas(e), true);
		refreshDiv.textContent = '↻';
		if (captchaOptions.type === 'text') {
			field.placeholder = __('loading');
		}
		console.log('Setting img src:', imgSrc);
		captchaImg.src = imgSrc;
		captchaImg.onload = () => {
			console.log('Captcha loaded successfully');
			if (captchaOptions.type === 'text') {
				field.placeholder = __('Captcha text');
			}
			captchaDiv.appendChild(captchaImg);
			captchaDiv.appendChild(refreshDiv);
			this.startRefreshTimer();
		};
		captchaImg.onerror = (e) => {
			console.log('Captcha failed to load:', e);
			this.showCaptchaError(field, __('Error loading captcha - click ↻ to retry'));
		};
	}

}

const captchaController = new CaptchaController();

window.addEventListener('DOMContentLoaded', () => {

	captchaController.init();

});
