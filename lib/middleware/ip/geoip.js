'use strict';

const { isAnonymizer } = require(__dirname+'/../../misc/countries.js')
	, config = require(__dirname+'/../../misc/config.js');

module.exports = (req, res, next) => {
	const { countryCodeHeader } = config.get;
	const code = req.headers[countryCodeHeader] || req.headers['cf-ipcountry'] || 'XX';
	res.locals.anonymizer = isAnonymizer(code);
	res.locals.country = {
		code,
	};
	return next();
};
