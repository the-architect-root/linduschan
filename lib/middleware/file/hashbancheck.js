'use strict';

const { HashBans } = require(__dirname+'/../../../db/')
	, dynamicResponse = require(__dirname+'/../../misc/dynamic.js');

module.exports = async (req, res, next) => {

	const { __ } = res.locals;

	// Skip if no files
	if (!res.locals.numFiles || res.locals.numFiles === 0) {
		return next();
	}

	// Check each file's SHA256 hash against banned hashes
	const fileHashes = req.files.file.map(f => f.sha256);
	const bannedHashes = await HashBans.checkMany(fileHashes);

	if (bannedHashes.length > 0) {
		const bannedFiles = req.files.file
			.filter(f => bannedHashes.some(b => b._id === f.sha256))
			.map(f => f.name)
			.join(', ');
		
		return dynamicResponse(req, res, 403, 'message', {
			'title': __('Forbidden'),
			'message': __('File(s) banned from upload: %s', bannedFiles),
			'redirect': req.headers.referer || '/',
		});
	}

	next();

};
