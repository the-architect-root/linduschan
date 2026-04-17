'use strict';

const { remove } = require('fs-extra')
	, uploadDirectory = require(__dirname+'/uploaddirectory.js');

module.exports = (files, boardUri = null) => {

	//delete all the files and thumbs
	return Promise.all(files.map(async file => {
		// Determine paths based on boardUri
		let fileFolder = 'file';
		if (file.mimetype && file.mimetype.startsWith('image/')) {
			fileFolder = 'uploads/images';
		} else if (file.mimetype && (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/'))) {
			fileFolder = 'uploads/videos';
		}
		
		// Try board-specific paths first, then fallback to old paths
		const boardFilePath = boardUri ? `${uploadDirectory}/${boardUri}/${fileFolder}/${file.filename}` : null;
		const boardThumbPath = boardUri && file.hasThumb ? `${uploadDirectory}/${boardUri}/file/thumb/${file.hash}${file.thumbextension}` : null;
		
		const oldFilePath = `${uploadDirectory}/file/${file.filename}`;
		const oldThumbPath = file.hasThumb ? `${uploadDirectory}/file/thumb/${file.hash}${file.thumbextension}` : null;
		
		return Promise.all([
			// Try board-specific file path, then old path
			boardFilePath ? remove(boardFilePath).catch(() => remove(oldFilePath).catch(console.error)) : remove(oldFilePath).catch(console.error),
			file.hasThumb ? (boardThumbPath ? remove(boardThumbPath).catch(() => remove(oldThumbPath).catch(console.error)) : remove(oldThumbPath).catch(console.error)) : void 0,
		]).catch(console.error);
	}));

};
