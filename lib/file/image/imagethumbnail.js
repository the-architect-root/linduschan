const gm = require('@fatchan/gm')
	, im = require('@fatchan/gm').subClass({ imageMagick: true })
	, ffmpeg = require('fluent-ffmpeg')
	, config = require(__dirname+'/../../misc/config.js')
	, uploadDirectory = require(__dirname+'/../uploaddirectory.js')
	, fs = require('fs-extra');

module.exports = (file, boardUri = null, actualFileLocation = null) => {

	const { thumbSize, ffmpegGifThumbnails, animatedGifThumbnails } = config.get;
	
	// Determine thumb folder based on boardUri
	const thumbFolder = boardUri ? `${boardUri}/file/thumb` : 'file/thumb';

	//decide whether to animate gif thumbnail and update thumbextension
	let firstFrameOnly = true;
	if (file.hasThumb
		&& file.mimetype === 'image/gif'
		&& animatedGifThumbnails === true) {
		firstFrameOnly = false;
		file.thumbextension = '.gif';
	}

	//if enabled, make animated gif thumbs with ffmpeg
	if (ffmpegGifThumbnails && !firstFrameOnly) {
		const thumbSizeFilter = file.geometry.width > file.geometry.height ? `${thumbSize}:-1` : `-1:${thumbSize}`;
		const complexFilters = [
				/* this complex filter scales (resizes), and works some magic to preserve transparency,
					with an additional filter to reduce the aliasing on outlines of transparent parts. */
			`[0:v] scale=${thumbSizeFilter},split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse`
		];
		return new Promise((resolve, reject) => {
			ffmpeg(`${uploadDirectory}/file/${file.filename}`)
				.on('end', () => {
					return resolve();
				})
				.on('error', function(err) {
					return reject(err);
				})
				.outputOptions('-loop 0')
				.complexFilter(complexFilters)
				.save(`${uploadDirectory}/${thumbFolder}/${file.hash}${file.thumbextension}`);
		});
	}

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
	
	let fileLocation = actualFileLocation || `${uploadDirectory}/${subfolder}/${file.filename}`;

	console.log('ImageThumbnail fileLocation:', fileLocation);

	// Use ImageMagick for thumbnail generation
	let thumbnailing;
	if (file.mimetype === 'image/webp') {
		//animated webp (which we cant tell apart from non-anim) need to be processed with imagemagick and cant make animated thumbs
		thumbnailing = im(`${fileLocation}[0]`);
	} else {
		thumbnailing = gm(`${fileLocation}${firstFrameOnly ? '[0]' : ''}`);
		if (!firstFrameOnly) {
			//try (and fail) to make gm thumbnailing less shit.
			thumbnailing.coalesce();
		}
	}

	return new Promise((resolve, reject) => {
		thumbnailing
			.resize(thumbSize, thumbSize + '^')
			.write(`${uploadDirectory}/${thumbFolder}/${file.hash}${file.thumbextension}`, function (err) {
				if (err) {
					// If ImageMagick is not available, copy original as thumbnail
					console.warn('ImageMagick not available, using original as thumbnail:', err.message);
					fs.copy(fileLocation, `${uploadDirectory}/${thumbFolder}/${file.hash}${file.thumbextension}`)
						.then(() => resolve())
						.catch(reject);
					return;
				}
				return resolve();
			});
	});

};
