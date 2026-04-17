'use strict';

const { Accounts } = require(__dirname+'/../../db/')
	, { Permissions } = require(__dirname+'/../../lib/permission/permissions.js')
	, dynamicResponse = require(__dirname+'/../../lib/misc/dynamic.js');

module.exports = {

	blockBoard: async (req, res, next) => {
		const { boardUri, blockType, duration } = req.body;
		
		if (!boardUri || !blockType) {
			return dynamicResponse(req, res, 400, 'message', {
				'title': 'Bad Request',
				'message': 'Board URI and block type are required'
			});
		}

		if (!['temporary', 'permanent'].includes(blockType)) {
			return dynamicResponse(req, res, 400, 'message', {
				'title': 'Bad Request',
				'message': 'Invalid block type'
			});
		}

		let expiryTime = null;
		if (blockType === 'temporary') {
			if (!duration) {
				return dynamicResponse(req, res, 400, 'message', {
					'title': 'Bad Request',
					'message': 'Duration is required for temporary blocks'
				});
			}
			// Duration can be in hours, days, or minutes
			const durationValue = parseInt(duration);
			if (isNaN(durationValue) || durationValue <= 0) {
				return dynamicResponse(req, res, 400, 'message', {
					'title': 'Bad Request',
					'message': 'Invalid duration'
				});
			}
			// Default to hours if no unit specified, otherwise parse unit
			let durationMs = durationValue * 60 * 60 * 1000; // hours
			if (duration.includes('d')) {
				durationMs = durationValue * 24 * 60 * 60 * 1000; // days
			} else if (duration.includes('m')) {
				durationMs = durationValue * 60 * 1000; // minutes
			}
			expiryTime = new Date(Date.now() + durationMs);
		}

		try {
			// For logged-in users, save to database
			if (req.session.user) {
				await Accounts.addBlockedBoard(req.session.user, boardUri, blockType, expiryTime);
			}
			
			// Set cookie for all users (logged-in and non-logged-in)
			// Cookie is used for non-logged-in users, logged-in users use database
			const blockedBoardsCookie = req.cookies.blockedBoards;
			let blockedBoards = [];
			if (blockedBoardsCookie) {
				try {
					blockedBoards = JSON.parse(decodeURIComponent(blockedBoardsCookie));
				} catch (e) {
					// Invalid cookie, start fresh
				}
			}
			
			// Add board to blocked boards if not already present
			if (!blockedBoards.includes(boardUri)) {
				blockedBoards.push(boardUri);
			}
			
			// Set cookie with 30 day expiry
			res.cookie('blockedBoards', encodeURIComponent(JSON.stringify(blockedBoards)), {
				maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
				httpOnly: true,
				sameSite: 'strict'
			});
			
			return dynamicResponse(req, res, 200, 'message', {
				'title': 'Success',
				'message': 'Board blocked successfully'
			});
		} catch (err) {
			return dynamicResponse(req, res, 500, 'message', {
				'title': 'Error',
				'message': 'Failed to block board'
			});
		}
	},

	unblockBoard: async (req, res, next) => {
		const { boardUri } = req.body;
		
		if (!boardUri) {
			return dynamicResponse(req, res, 400, 'message', {
				'title': 'Bad Request',
				'message': 'Board URI is required'
			});
		}

		try {
			// Remove from cookie for all users
			const blockedBoardsCookie = req.cookies.blockedBoards;
			let blockedBoards = [];
			if (blockedBoardsCookie) {
				try {
					blockedBoards = JSON.parse(decodeURIComponent(blockedBoardsCookie));
				} catch (e) {
					// Invalid cookie, start fresh
				}
			}
			
			// Remove board from blocked boards
			blockedBoards = blockedBoards.filter(b => b !== boardUri);
			
			// Update cookie
			res.cookie('blockedBoards', encodeURIComponent(JSON.stringify(blockedBoards)), {
				maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
				httpOnly: true,
				sameSite: 'strict'
			});
			
			// For logged-in users, also handle database logic
			if (req.session.user) {
				const account = await Accounts.db.findOne({ _id: req.session.user });
				const blockedBoard = account.blockedBoards?.find(b => b.boardUri === boardUri);
				
				if (!blockedBoard) {
					return dynamicResponse(req, res, 404, 'message', {
						'title': 'Not Found',
						'message': 'Board not found in blocked list'
					});
				}

				// For temporary blocks, cannot unblock manually
				if (blockedBoard.blockType === 'temporary') {
					return dynamicResponse(req, res, 400, 'message', {
						'title': 'Cannot Unblock',
						'message': 'Temporary blocks cannot be manually unblocked. They will expire automatically.'
					});
				}

				// For permanent blocks, require approval
				if (blockedBoard.blockType === 'permanent') {
					await Accounts.requestUnblockApproval(req.session.user, boardUri);
					return dynamicResponse(req, res, 200, 'message', {
						'title': 'Success',
						'message': 'Unblock request submitted for approval'
					});
				}

				return dynamicResponse(req, res, 400, 'message', {
					'title': 'Bad Request',
					'message': 'Invalid block type'
				});
			}
			
			return dynamicResponse(req, res, 200, 'message', {
				'title': 'Success',
				'message': 'Board unblocked successfully'
			});
		} catch (err) {
			return dynamicResponse(req, res, 500, 'message', {
				'title': 'Error',
				'message': 'Failed to unblock board'
			});
		}
	},

	getBlockedBoards: async (req, res, next) => {
		try {
			const blockedBoards = await Accounts.getBlockedBoards(req.session.user);
			return dynamicResponse(req, res, 200, 'json', { blockedBoards });
		} catch (err) {
			return dynamicResponse(req, res, 500, 'message', {
				'title': 'Error',
				'message': 'Failed to get blocked boards'
			});
		}
	},

	// Admin endpoints for approving/rejecting unblock requests
	approveUnblockRequest: async (req, res, next) => {
		const { username, boardUri } = req.body;
		
		if (!username || !boardUri) {
			return dynamicResponse(req, res, 400, 'message', {
				'title': 'Bad Request',
				'message': 'Username and board URI are required'
			});
		}

		try {
			await Accounts.approveUnblock(username, boardUri, req.session.user);
			// Remove the block after approval
			await Accounts.removeBlockedBoard(username, boardUri);
			return dynamicResponse(req, res, 200, 'message', {
				'title': 'Success',
				'message': 'Unblock request approved'
			});
		} catch (err) {
			return dynamicResponse(req, res, 500, 'message', {
				'title': 'Error',
				'message': 'Failed to approve unblock request'
			});
		}
	},

	rejectUnblockRequest: async (req, res, next) => {
		const { username, boardUri } = req.body;
		
		if (!username || !boardUri) {
			return dynamicResponse(req, res, 400, 'message', {
				'title': 'Bad Request',
				'message': 'Username and board URI are required'
			});
		}

		try {
			await Accounts.rejectUnblock(username, boardUri, req.session.user);
			return dynamicResponse(req, res, 200, 'message', {
				'title': 'Success',
				'message': 'Unblock request rejected'
			});
		} catch (err) {
			return dynamicResponse(req, res, 500, 'message', {
				'title': 'Error',
				'message': 'Failed to reject unblock request'
			});
		}
	},

	getAllUnblockRequests: async (req, res, next) => {
		try {
			const accounts = await Accounts.db.find({
				'blockedBoards.approvalStatus': 'pending'
			}, {
				'projection': {
					'_id': 1,
					'blockedBoards': 1
				}
			}).toArray();

			const requests = [];
			accounts.forEach(account => {
				account.blockedBoards.forEach(block => {
					if (block.approvalStatus === 'pending') {
						requests.push({
							username: account._id,
							boardUri: block.boardUri,
							requestedAt: block.approvalRequestedAt,
						});
					}
				});
			});

			return dynamicResponse(req, res, 200, 'json', { requests });
		} catch (err) {
			return dynamicResponse(req, res, 500, 'message', {
				'title': 'Error',
				'message': 'Failed to get unblock requests'
			});
		}
	},

};
