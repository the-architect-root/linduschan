'use strict';

const { Posts, Boards } = require(__dirname+'/../../db/');

module.exports = async (req, res, next) => {

	try {
		const featuredThreads = await Posts.getFeaturedThreads(50);
		const boards = await Boards.db.find().toArray();

		res.render('globalmanagefeaturedthreads', {
			csrf: req.csrfToken(),
			featuredThreads,
			boards,
			user: res.locals.user,
		});

	} catch (err) {
		return next(err);
	}

};
