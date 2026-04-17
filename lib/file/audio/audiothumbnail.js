const ffmpeg = require('fluent-ffmpeg')
	, config = require(__dirname+'/../../misc/config.js')
	, uploadDirectory = require(__dirname+'/../uploaddirectory.js');

module.exports = (file, boardUri = null) => {

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

	return new Promise((resolve, reject) => {
		ffmpeg(fileLocation)
			.on('end', () => {
				return resolve();
			})
			.on('error', function(err) {
				return reject(err);
			})
			.complexFilter([{
				filter: 'showwavespic',
				options: { split_channels: 1, s: `${thumbSize}x${thumbSize}` }
			}])
			.save(`${uploadDirectory}/${thumbFolder}/${file.hash}${file.thumbextension}`);
	});

};
