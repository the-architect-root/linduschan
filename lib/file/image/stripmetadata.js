const gm = require('@fatchan/gm')
	, im = require('@fatchan/gm').subClass({ imageMagick: true })
	, uploadDirectory = require(__dirname+'/../uploaddirectory.js');

module.exports = (file, boardUri = null) => {

	// Determine actual file location based on type
	let subfolder = 'file';
	if (file.mimetype && file.mimetype.startsWith('image/')) {
		subfolder = 'uploads/images';
	} else if (file.mimetype && (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/'))) {
		subfolder = 'uploads/videos';
	}
	
	// Add board-specific folder if boardUri is provided
	if (boardUri) {
		subfolder = `${boardUri}/${subfolder}`;
	}
	
	let fileLocation = `${uploadDirectory}/${subfolder}/${file.filename}`;

	console.log('StripMetadata fileLocation:', fileLocation);

	return new Promise((resolve, reject) => {
		im(fileLocation)
			.strip() // Remove EXIF/metadata from original file
			.write(fileLocation, function (err) {
				if (err) {
					// If ImageMagick is not available, skip metadata stripping
					console.warn('ImageMagick not available, skipping metadata strip:', err.message);
					return resolve();
				}
				return resolve();
			});
	});

};
