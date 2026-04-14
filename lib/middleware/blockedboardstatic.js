'use strict';

const { Accounts } = require(__dirname+'/../../db/');

module.exports = async (req, res, next) => {
	// Check if the path matches a board or thread static file
	// Static files are served from /{boardUri}/index.html or /{boardUri}/thread/{id}.html
	// The middleware is applied before static file serving, so the path is the original URL
	const pathParts = req.path.split('/').filter(part => part !== '');
	
	// Skip if not accessing a board (path should be /{boardUri}/...)
	if (pathParts.length < 1) {
		return next();
	}

	const boardUri = pathParts[0];
	
	if (!boardUri) {
		return next();
	}

	let isBlocked = false;

	// Check for logged-in users
	if (req.session && req.session.user) {
		isBlocked = await Accounts.isBoardBlocked(req.session.user, boardUri);
	} else {
		// Check for non-logged-in users using cookie
		const blockedBoardsCookie = req.cookies.blockedBoards;
		if (blockedBoardsCookie) {
			try {
				const blockedBoards = JSON.parse(decodeURIComponent(blockedBoardsCookie));
				isBlocked = blockedBoards.includes(boardUri);
			} catch (e) {
				// Invalid cookie, ignore
			}
		}
	}
	
	if (isBlocked) {
		// User has blocked this board
		return res.status(403).render('error', {
			title: 'Board Blocked',
			message: 'You have blocked this board. You cannot view it while it is blocked.',
			errorCode: 403
		});
	}

	next();
};
