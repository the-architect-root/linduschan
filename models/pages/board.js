'use strict';

const Posts = require(__dirname+'/../../db/posts.js')
	, { buildBoard } = require(__dirname+'/../../lib/build/tasks.js');

module.exports = async (req, res, next) => {

	const page = req.params.page === 'index' ? 1 : (req.params.page ? Number(req.params.page) : 1);
	let html, json;
	try {
		const threadCount = await Posts.getPages(req.params.board);
		const maxPage = Math.min(Math.ceil(threadCount / 10), Math.ceil(res.locals.board.settings.threadLimit/10)) || 1;
		if (page > maxPage) {
			return next();
		}
		({ html, json } = await buildBoard({
			board: res.locals.board,
			page,
			maxPage
		}));
	} catch (err) {
		console.error('Board page error:', err);
		return next(err);
	}

	if (req.path.endsWith('.json')) {
		return res.set('Cache-Control', 'max-age=0').json(json);
	} else {
		res.sendFile(path.join(__dirname, '../../static/html', req.params.board, page === 1 ? 'index' : `${page}.html`));
		return res.set('Cache-Control', 'max-age=0').send(html);
	}

};
