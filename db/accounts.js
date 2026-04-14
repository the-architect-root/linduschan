'use strict';

const Mongo = require(__dirname+'/db.js')
	, db = Mongo.db.collection('accounts')
	, bcrypt = require('bcrypt')
	, cache = require(__dirname+'/../lib/redis/redis.js')
	, { MONTH } = require(__dirname+'/../lib/converter/timeutils.js')
	, { Permissions } = require(__dirname+'/../lib/permission/permissions.js');

module.exports = {

	db,

	countUsers: (usernames) => {
		return db.countDocuments({
			'_id': {
				'$in': usernames
			}
		});
	},

	count: (filter) => {
		if (filter) {
			return db.countDocuments(filter);
		} else {
			return db.estimatedDocumentCount();
		}
	},

	findOne: async (username) => {
		const account = await db.findOne({ '_id': username });
		//hmmm
		if (account != null) {
			account.permissions = account.permissions.toString('base64');
		}
		return account;
	},

	insertOne: async (original, username, password, permissions, web3=false) => {
		// hash the password
		let passwordHash;
		if (password) {
			passwordHash = await bcrypt.hash(password, 12);
		}
		//add to db
		const res = await db.insertOne({
			'_id': username,
			original,
			passwordHash,
			'permissions': Mongo.Binary(permissions.array),
			'ownedBoards': [],
			'staffBoards': [],
			'twofactor': null,
			web3,
		});
		cache.del(`users:${username}`);
		return res;
	},

	changePassword: async (username, newPassword) => {
		const passwordHash = await bcrypt.hash(newPassword, 12);
		const res = await db.updateOne({
			'_id': username
		}, {
			'$set': {
				'passwordHash': passwordHash
			}
		});
		cache.del(`users:${username}`);
		return res;
	},

	setAccountPermissions: async (username, permissions) => {
		const res = await db.updateOne({
			'_id': username
		}, {
			'$set': {
				'permissions': Mongo.Binary(permissions.array),
			}
		});
		cache.del(`users:${username}`);
		return res;
	},

	setNewRolePermissions: async (oldPermissions, permissions) => {
		const res = await db.updateMany({
			'permissions': Mongo.Binary(oldPermissions.array),
		}, {
			'$set': {
				'permissions': Mongo.Binary(permissions.array),
			}
		});
		cache.deletePattern('users:*');
		return res;
	},

	updateLastActiveDate: (username) => {
		return db.updateOne({
			'_id': username
		}, {
			'$set': {
				lastActiveDate: new Date()
			}
		});
	},

	updateTwofactor: (username, secret) => {
		return db.updateOne({
			'_id': username
		}, {
			'$set': {
				'twofactor': secret
			}
		});
	},

	getInactive: (duration=(MONTH*3)) => {
		return db.find({
			'permissions': {
				'$not': {
					//exempts ROOT users from being returned
					'$bitsAllSet': [Permissions.ROOT],
				},
			},
			'lastActiveDate': {
				'$lt': new Date(Date.now() - duration),
			},
		}).toArray();
	},

	find: (filter, skip=0, limit=0) => {
		return db.find(filter, {
			'projection': {
				'passwordHash': 0
			}
		}).skip(skip).limit(limit).toArray();
	},

	deleteOne: async (username) => {
		const res = await db.deleteOne({
			'_id': username
		});
		cache.del(`users:${username}`);
		return res;
	},

	deleteMany: async (usernames) => {
		const res = await db.deleteMany({
			'_id': {
				'$in': usernames
			}
		});
		cache.del(usernames.map(n => `users:${n}`));
		return res;
	},

	addOwnedBoard: async (username, board) => {
		const res = await db.updateOne({
			'_id': username
		}, {
			'$addToSet': {
				'ownedBoards': board
			}
		});
		cache.del(`users:${username}`);
		return res;
	},

	removeOwnedBoard: async (username, board) => {
		const res = await db.updateOne({
			'_id': username
		}, {
			'$pull': {
				'ownedBoards': board
			}
		});
		cache.del(`users:${username}`);
		return res;
	},

	addStaffBoard: async (usernames, board) => {
		const res = await db.updateMany({
			'_id': {
				'$in': usernames
			}
		}, {
			'$addToSet': {
				'staffBoards': board
			}
		});
		cache.del(usernames.map(n => `users:${n}`));
		return res;
	},

	removeStaffBoard: async (usernames, board) => {
		const res = await db.updateMany({
			'_id': {
				'$in': usernames
			}
		}, {
			'$pull': {
				'staffBoards': board
			}
		});
		cache.del(usernames.map(n => `users:${n}`));
		return res;
	},

	clearStaffAndOwnedBoards: async (usernames) => {
		const res = await db.updateMany({
			'_id': {
				'$in': usernames
			}
		}, {
			'$set': {
				'staffBoards': [],
				'ownedBoards': [],
			}
		});
		cache.del(usernames.map(n => `users:${n}`));
		return res;
	},

	getOwnedOrStaffBoards: (usernames) => {
		return db.find({
			'_id': {
				'$in': usernames
			},
			'$or': [
				{
					'ownedBoards.0': {
						'$exists': true
					},
				},
				{
					'staffBoards.0': {
						'$exists': true
					}
				}
			]
		}, {
			'projection': {
				'ownedBoards': 1,
				'staffBoards': 1,
			}
		}).toArray();
	},

	deleteAll: () => {
		return db.deleteMany({});
	},

	addBlockedBoard: async (username, boardUri, blockType, expiryTime = null) => {
		const blockData = {
			boardUri,
			blockType, // 'temporary' or 'permanent'
			blockedAt: new Date(),
		};
		if (blockType === 'temporary' && expiryTime) {
			blockData.expiryTime = new Date(expiryTime);
		} else if (blockType === 'permanent') {
			blockData.approvalStatus = 'none'; // permanent blocks don't need approval to create, only to unblock
		}
		const res = await db.updateOne({
			'_id': username
		}, {
			'$addToSet': {
				'blockedBoards': blockData
			}
		});
		cache.del(`users:${username}`);
		return res;
	},

	removeBlockedBoard: async (username, boardUri) => {
		const res = await db.updateOne({
			'_id': username
		}, {
			'$pull': {
				'blockedBoards': {
					boardUri
				}
			}
		});
		cache.del(`users:${username}`);
		return res;
	},

	isBoardBlocked: async (username, boardUri) => {
		const account = await db.findOne({
			'_id': username,
			'blockedBoards.boardUri': boardUri
		}, {
			'projection': {
				'blockedBoards.$': 1
			}
		});
		if (!account || !account.blockedBoards || account.blockedBoards.length === 0) {
			return false;
		}
		const blockedBoard = account.blockedBoards[0];
		
		// Check if temporary block has expired
		if (blockedBoard.blockType === 'temporary' && blockedBoard.expiryTime) {
			if (new Date() > new Date(blockedBoard.expiryTime)) {
				// Block has expired, remove it
				await exports.removeBlockedBoard(username, boardUri);
				return false;
			}
			return true;
		}
		
		// Permanent block
		if (blockedBoard.blockType === 'permanent') {
			return true;
		}
		
		return false;
	},

	requestUnblockApproval: async (username, boardUri) => {
		const res = await db.updateOne({
			'_id': username,
			'blockedBoards.boardUri': boardUri
		}, {
			'$set': {
				'blockedBoards.$.approvalStatus': 'pending',
				'blockedBoards.$.approvalRequestedAt': new Date(),
			}
		});
		cache.del(`users:${username}`);
		return res;
	},

	approveUnblock: async (username, boardUri, adminUsername) => {
		const res = await db.updateOne({
			'_id': username,
			'blockedBoards.boardUri': boardUri
		}, {
			'$set': {
				'blockedBoards.$.approvalStatus': 'approved',
				'blockedBoards.$.approvedBy': adminUsername,
				'blockedBoards.$.approvedAt': new Date(),
			}
		});
		cache.del(`users:${username}`);
		return res;
	},

	rejectUnblock: async (username, boardUri, adminUsername) => {
		const res = await db.updateOne({
			'_id': username,
			'blockedBoards.boardUri': boardUri
		}, {
			'$set': {
				'blockedBoards.$.approvalStatus': 'rejected',
				'blockedBoards.$.approvedBy': adminUsername,
				'blockedBoards.$.approvedAt': new Date(),
			}
		});
		cache.del(`users:${username}`);
		return res;
	},

	getBlockedBoards: async (username) => {
		const account = await db.findOne({
			'_id': username
		}, {
			'projection': {
				'blockedBoards': 1
			}
		});
		if (!account || !account.blockedBoards) {
			return [];
		}
		// Filter out expired temporary blocks
		const validBlocks = account.blockedBoards.filter(block => {
			if (block.blockType === 'temporary' && block.expiryTime) {
				return new Date() <= new Date(block.expiryTime);
			}
			return true;
		});
		
		// Update database if any blocks expired
		if (validBlocks.length !== account.blockedBoards.length) {
			await db.updateOne({
				'_id': username
			}, {
				'$set': {
					'blockedBoards': validBlocks
				}
			});
			cache.del(`users:${username}`);
		}
		
		return validBlocks;
	},

};
