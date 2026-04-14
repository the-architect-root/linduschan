'use strict';

const { Accounts, Boards } = require(__dirname+'/../../db/')
	, { Permissions } = require(__dirname+'/../../lib/permission/permissions.js');

module.exports = async (req, res, next) => {
	const blockedBoards = await Accounts.getBlockedBoards(req.session.user);
	
	// Get board names for blocked boards
	const boardNames = {};
	for (const block of blockedBoards) {
		const board = await Boards.findOne(block.boardUri);
		if (board) {
			boardNames[block.boardUri] = board.settings.name || block.boardUri;
		} else {
			boardNames[block.boardUri] = block.boardUri;
		}
	}

	res.render('blockedboards', {
		blockedBoards,
		boardNames,
	});
};
