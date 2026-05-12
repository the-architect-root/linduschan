'use strict';

const dynamicResponse = require(__dirname+'/../../misc/dynamic.js')
	, deleteTempFiles = require(__dirname+'/../../file/deletetempfiles.js')
	, config = require(__dirname+'/../../misc/config.js')
	, { Permissions } = require(__dirname+'/../../permission/permissions.js');

module.exports = async (req, res, next) => {

	if (!config.get.disableAnonymizerPosting) {
		return next();
	}

	if (res.locals.permissions.get(Permissions.BYPASS_ANONYMIZER_RESTRICTIONS)) {
		return next();
	}

	if (res.locals.anonymizer) {
		deleteTempFiles(req).catch(console.error);
		const { __ } = res.locals;
		return dynamicResponse(req, res, 403, 'message', {
			'title': __('Forbidden'),
			'message': __('Posting from anonymizers (Tor/Lokinet) has been disabled.'),
			'redirect': req.headers.referer || '/',
		});
	}

	return next();

};
