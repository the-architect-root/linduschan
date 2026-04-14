'use strict';

// Load debugLogs from secrets.js or environment variables
let debugLogs;
try {
	const secrets = require(__dirname+'/../../configs/secrets.js');
	debugLogs = secrets.debugLogs;
} catch (e) {
	debugLogs = process.env.DEBUG_LOGS === 'true';
}

const i18n = require('i18n')
	, path = require('path');

i18n.configure({
	directory: path.join(__dirname, '/../../locales'),
	defaultLocale: 'en-GB',
	retryInDefaultLocale: false,
	updateFiles: false, //holy FUCK why is that an option
	cookie: null,
	header: null,
	queryParameter: null,
});

debugLogs && console.log('Locales loaded:', i18n.getLocales());

module.exports = i18n;
