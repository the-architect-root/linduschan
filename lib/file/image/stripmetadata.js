const gm = require('@fatchan/gm')
	, im = require('@fatchan/gm').subClass({ imageMagick: true })
	, uploadDirectory = require(__dirname+'/../uploaddirectory.js');

module.exports = (file) => {

	return new Promise((resolve, reject) => {
		im(`${uploadDirectory}/file/${file.filename}`)
			.strip() // Remove EXIF/metadata from original file
			.write(`${uploadDirectory}/file/${file.filename}`, function (err) {
				if (err) {
					// If ImageMagick is not available, skip metadata stripping
					console.warn('ImageMagick not available, skipping metadata strip');
					return resolve();
				}
				return resolve();
			});
	});

};
