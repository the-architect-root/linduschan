'use strict';

const ffmpeg = require('fluent-ffmpeg')
	, uploadDirectory = require(__dirname+'/uploaddirectory.js');

module.exports = async (filename, folder, temp) => {

	return new Promise((resolve, reject) => {
		ffmpeg.ffprobe(temp === true ? filename : `${uploadDirectory}/${folder}/${filename}`, (err, metadata) => {
			if (err) {
				// FFmpeg not available, return basic metadata
				console.warn('FFmpeg not available, skipping ffprobe:', err.message);
				return resolve({ streams: [], format: { duration: 0 } });
			}
			return resolve(metadata);
		});
	});

};
