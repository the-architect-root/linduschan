'use strict';

const { Files } = require(__dirname+'/../../db/')
	, config = require(__dirname+'/../../lib/misc/config.js')
	, { func: pruneFiles } = require(__dirname+'/../../schedules/tasks/prune.js')
	, deletePostFiles = require(__dirname+'/../../lib/file/deletepostfiles.js');

module.exports = async (locals, unlinkOnly) => {

	const { posts, __, __n } = locals;
	const { pruneImmediately } = config.get;

	//get filenames from all the posts
	let files = [];
	let boardUri = null;
	for (let i = 0; i < posts.length; i++) {
		const post = posts[i];
		// Extract board URI from first post (assuming all posts are from same board)
		if (!boardUri && post.board) {
			// board could be an ObjectId or a string
			boardUri = typeof post.board === 'object' ? post.board._id : post.board;
			// If it's an ObjectId, try to get the URI from the board settings
			if (typeof boardUri === 'object') {
				// This might need adjustment based on actual data structure
				boardUri = post.boardUri || post.board.uri;
			}
		}
		if (post.files.length > 0) {
			files = files.concat(post.files.map(file => {
				return {
					filename: file.filename,
					hash: file.hash,
					thumbextension: file.thumbextension,
					hasThumb: file.hasThumb,
					mimetype: file.mimetype,
				};
			}));
		}
	}
	files = [...new Set(files)];

	if (files.length == 0) {
		return {
			message: __('No files found')
		};
	}

	if (files.length > 0) {
		const fileNames = files.map(x => x.filename);
		await Files.decrement(fileNames);
		if (pruneImmediately) {
			await pruneFiles(fileNames);
		}
	}

	if (unlinkOnly) {
		return {
			message: __n('Unlinked %s files', files.length),
			action:'$set',
			query: {
				'files': []
			}
		};
	} else {
		//delete all the files
		await deletePostFiles(files, boardUri);
		return {
			message: __n('Deleted %s files from server', files.length),
			//NOTE: only deletes from selected posts. other posts with same image will 404
			action:'$set',
			query: {
				'files': []
			}
		};
	}

};
