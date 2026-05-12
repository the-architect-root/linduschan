'use strict';

const { Posts } = require(__dirname+'/../../db/');

module.exports = async (req, res, next) => {

	const { board } = req.query;

	try {
		let threads;
		if (board && board !== 'all') {
			threads = await Posts.getRecent(board, 1, 20, false, false);
		} else {
			threads = await Posts.getRecent(null, 1, 50, false, false);
		}

		const result = threads.map(t => ({
			board: t.board,
			postId: t.postId,
			subject: t.subject || '',
			replyposts: t.replyposts || 0,
			replyfiles: t.replyfiles || 0,
			bumped: t.bumped,
			hasFile: t.files && t.files.length > 0,
			fileHash: t.files && t.files[0] ? t.files[0].hash : null,
			fileThumbExtension: t.files && t.files[0] ? t.files[0].thumbextension : null,
			spoiler: t.spoiler || (t.files && t.files[0] ? t.files[0].spoiler : false),
		}));

		res.json(result);
	} catch (err) {
		return next(err);
	}

};
