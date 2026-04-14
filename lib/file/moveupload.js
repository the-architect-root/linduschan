'use strict';

const uploadDirectory = require(__dirname+'/uploaddirectory.js')
	, r2Upload = require(__dirname+'/r2upload.js');

module.exports = async (file, filename, folder) => {

	// Try R2 upload first if configured
	if (r2Upload.isConfigured()) {
		try {
			await r2Upload(file, filename, folder);
			return;
		} catch (err) {
			console.warn('R2 upload failed, falling back to local storage:', err);
			// Fall back to local storage
		}
	}

	// Fall back to local storage
	return new Promise((resolve, reject) => {
		file.mv(`${uploadDirectory}/${folder}/${filename}`, function (err) {
			if (err) {
				return reject(err);
			}
			return resolve();
		});
	});

};
