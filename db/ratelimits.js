'use strict';

const Mongo = require(__dirname+'/db.js')
	, db = Mongo.db.collection('ratelimit');

module.exports = {

	db,

	resetQuota: (identifier, action) => {
		return db.deleteOne({ '_id': `${identifier}-${action}` });
	},

	incrmentQuota: async (identifier, action, amount, retries = 3) => {
		const key = `${identifier}-${action}`;
		try {
			const result = await db.findOneAndUpdate(
				{
					'_id': key
				},
				{
					'$inc': {
						'sequence_value': amount
					},
					'$setOnInsert': {
						'expireAt': new Date()
					}
				},
				{
					'upsert': true
				}
			);
			return result.value ? result.value.sequence_value : 0;
		} catch (err) {
			// Handle duplicate key error from race condition
			if (err.code === 11000 && retries > 0) {
				// Retry after a small delay
				await new Promise(resolve => setTimeout(resolve, 10));
				return module.exports.incrmentQuota(identifier, action, amount, retries - 1);
			}
			throw err;
		}
	},

	deleteAll: () => {
		return db.deleteMany({});
	},

};
