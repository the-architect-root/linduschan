'use strict';

module.exports = async(db, redis) => {
	console.log('migrate old config to db');
	const oldSettings = require(__dirname+'/../configs/main.js');
	let secrets;
	try {
		secrets = require(__dirname+'/../configs/secrets.js');
	} catch (e) {
		secrets = {};
	}
	//delete anythign thats in the secrets
	Object.keys(secrets).forEach(key => {
		delete oldSettings[key];
	});
	//and a few more that arent in the root
	delete oldSettings.captchaOptions.google;
	delete oldSettings.captchaOptions.hcaptcha;
	const templateSettings = require(__dirname+'/../configs/template.js.example');
	const newSettings = { ...templateSettings, ...oldSettings };
	//set default settings into redis instead
	redis.set('globalsettings', newSettings);
};
