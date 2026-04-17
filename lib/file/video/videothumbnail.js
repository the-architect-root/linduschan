'use strict';

const ffmpeg = require('fluent-ffmpeg')
	, config = require(__dirname+'/../../misc/config.js')
	, uploadDirectory = require(__dirname+'/../uploaddirectory.js');

module.exports = async (file, geometry, timestamp, boardUri = null) => {

	const { thumbSize } = config.get;
	
	// Determine thumb folder based on boardUri
	const thumbFolder = boardUri ? `${boardUri}/file/thumb` : 'file/thumb';

	// Determine actual file location based on type
	let subfolder = 'file';
	if (file.mimetype && (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/'))) {
		subfolder = 'uploads/videos';
	}
	
	// Add board-specific folder if boardUri is provided
	if (boardUri) {
		subfolder = `${boardUri}/${subfolder}`;
	}
	
	let fileLocation = `${uploadDirectory}/${subfolder}/${file.filename}`;

	let inputArgs = [
		timestamp === 0 ? '-t 0' : `-ss ${timestamp}`
	];
	let outputArgs = [
		`-vf scale=${geometry.width > geometry.height ? thumbSize + ':-2' : '-2:' + thumbSize}`,
		'-frames:v 1'
	];

	// workaround: FFmpeg native WebM decoder doesn't handle alpha.
	if (file.codec === 'vp8') { inputArgs.push('-c:v libvpx'); }
	if (file.codec === 'vp9') { inputArgs.push('-c:v libvpx-vp9'); }

	return new Promise((resolve, reject) => {
		const command = ffmpeg(fileLocation)
			.on('end', () => {
				return resolve();
			})
			.on('error', function(err) {
				// FFmpeg not available, skip thumbnail generation
				console.warn('FFmpeg not available, skipping video thumbnail:', err.message);
				return resolve(); // Resolve anyway to not block upload
			});
		command
			.inputOptions(inputArgs)
			.outputOptions(outputArgs)
			.output(`${uploadDirectory}/${thumbFolder}/${file.hash}${file.thumbextension}`)
			.run();
	});
};
