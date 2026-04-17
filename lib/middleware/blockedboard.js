'use strict';

const { Accounts } = require(__dirname+'/../../db/');

module.exports = async (req, res, next) => {
	const boardUri = res.locals.board ? res.locals.board._id : req.params.board;
	
	if (!boardUri) {
		return next();
	}

	let isBlocked = false;

	// Check for logged-in users - check both database AND cookie
	if (req.session && req.session.user) {
		isBlocked = await Accounts.isBoardBlocked(req.session.user, boardUri);
		// Also check cookie as fallback for incognito/private browsing
		if (!isBlocked) {
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
	} else {
		// Check for non-logged-in users using cookie only
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
