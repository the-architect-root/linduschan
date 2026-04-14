'use strict';

// Load captcha config from secrets.js or environment variables
let yandex, hcaptcha, google;
try {
	const secrets = require(__dirname+'/../../configs/secrets.js');
	yandex = secrets.yandex;
	hcaptcha = secrets.hcaptcha;
	google = secrets.google;
} catch (e) {
	yandex = process.env.YANDEX_SITE_KEY ? { siteKey: process.env.YANDEX_SITE_KEY, secretKey: process.env.YANDEX_SECRET_KEY } : null;
	hcaptcha = process.env.HCAPTCHA_SITE_KEY ? { siteKey: process.env.HCAPTCHA_SITE_KEY, secretKey: process.env.HCAPTCHA_SECRET_KEY } : null;
	google = process.env.GOOGLE_CAPTCHA_SITE_KEY ? { siteKey: process.env.GOOGLE_CAPTCHA_SITE_KEY, secretKey: process.env.GOOGLE_CAPTCHA_SECRET_KEY } : null;
}

const { outputFile } = require('fs-extra')
	, formatSize = require(__dirname+'/../converter/formatsize.js')
	, pug = require('pug')
	, path = require('path')
	, commit = require(__dirname+'/../misc/commit.js')
	, uploadDirectory = require(__dirname+'/../file/uploaddirectory.js')
	, redlock = require(__dirname+'/../redis/redlock.js')
	, { addCallback } = require(__dirname+'/../redis/redis.js')
	, { version } = require(__dirname+'/../../package.json')
	, templateDirectory = path.join(__dirname+'/../../views/pages/')
	, { Permissions } = require(__dirname+'/../permission/permissions.js')
	, i18n = require(__dirname+'/../locale/locale.js')
	, config = require(__dirname+'/../../lib/misc/config.js');

let { language, archiveLinksURL, ethereumLinksURL, lockWait, globalLimits, boardDefaults, cacheTemplates,
		reverseImageLinksURL, meta, enableWebring, captchaOptions, globalAnnouncement, enableWeb3 } = config.get
	, renderLocals = null;

const updateLocals = () => {
	({ language, archiveLinksURL, ethereumLinksURL, lockWait, globalLimits, boardDefaults, cacheTemplates,
		reverseImageLinksURL, meta, enableWebring, captchaOptions, globalAnnouncement, enableWeb3 } = config.get);
	renderLocals = {
		Permissions,
		cache: cacheTemplates,
		ethereumLinksURL,
		archiveLinksURL,
		reverseImageLinksURL,
		meta,
		commit,
		version,
		enableWeb3,
		defaultTheme: boardDefaults.theme,
		defaultCodeTheme: boardDefaults.codeTheme,
		postFilesSize: formatSize(globalLimits.postFilesSize.max),
		globalLimits,
		enableWebring,
		googleRecaptchaSiteKey: google ? google.siteKey : '',
		hcaptchaSiteKey: hcaptcha ? hcaptcha.siteKey : '',
		yandexSiteKey: yandex ? yandex.siteKey : '',
		captchaOptions,
		globalAnnouncement,
		globalLanguage: language,
	};
	i18n.init(renderLocals);
	renderLocals.setLocale(renderLocals, language);
};

updateLocals();
addCallback('config', updateLocals);

module.exports = async (htmlName=null, templateName=null, options=null, json=null) => {

	//generate html if applicable
	let html = null;
	if (templateName !== null) {
		const mergedLocals = {
			...options,
			...renderLocals,
		};
		//NOTE: will this cause issues with global locale?
		if (options && options.board && options.board.settings) {
			renderLocals.setLocale(renderLocals, options.board.settings.language);
		} else {
			renderLocals.setLocale(renderLocals, language);
		}
		html = pug.renderFile(`${templateDirectory}${templateName}`, mergedLocals);
	}

	// Disabled static file writing to prevent stale content
	// Static files are no longer written - content is served dynamically
	/*
	//lock to prevent concurrent disk write
	const lock = await redlock.lock(`locks:${htmlName || json.name}`, lockWait);

	//write html/jsons
	let htmlPromise, jsonPromise;
	if (html !== null) {
		htmlPromise= outputFile(`${uploadDirectory}/html/${htmlName}`, html);
	}
	if (json !== null) {
		jsonPromise = outputFile(`${uploadDirectory}/json/${json.name}`, JSON.stringify(json.data));
	}
	await Promise.all([htmlPromise, jsonPromise]);

	//unlock after finishing
	await lock.unlock();
	*/

	return { html, json: json ? json.data : null };

};
