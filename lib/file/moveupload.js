'use strict';

const uploadDirectory = require(__dirname+'/uploaddirectory.js')
	, r2Upload = require(__dirname+'/r2upload.js');

module.exports = async (file, filename, folder, boardUri = null) => {

	if (r2Upload.isConfigured()) {
		try {
			await r2Upload(file, filename, folder);
			return;
		} catch (err) {
			console.warn('R2 upload failed, falling back to local storage:', err);
			// Fall back to local storage
		}
	}

	// Determine subfolder based on file type
	let subfolder = folder;
	if (folder === 'file') {
		if (file.mimetype && file.mimetype.startsWith('image/')) {
			subfolder = 'uploads/images';
		} else if (file.mimetype && (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/'))) {
			subfolder = 'uploads/videos';
		}
	}

	// Add board-specific folder if boardUri is provided
	if (boardUri) {
		subfolder = `${boardUri}/${subfolder}`;
	}

	const targetDir = `${uploadDirectory}/${subfolder}`;
	const targetPath = `${targetDir}/${filename}`;
	console.log('moveUpload: moving file to', targetPath);

	const fs = require('fs');
	if (!fs.existsSync(targetDir)) {
		fs.mkdirSync(targetDir, { recursive: true });
		console.log('moveUpload: created directory', targetDir);
	}

	// Use local storage
	return new Promise((resolve, reject) => {
		file.mv(targetPath, function (err) {
			if (err) {
				console.error('moveUpload error:', err);
				return reject(err);
			}
			console.log('moveUpload: file moved successfully');
			return resolve();
		});
	});

};
