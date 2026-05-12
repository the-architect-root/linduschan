'use strict';

const Mongo = require(__dirname+'/db.js')
	, db = Mongo.db.collection('hashbans');

module.exports = {

	db,

	add: (hash, reason = 'Banned file') => {
		return db.insertOne({
			_id: hash,
			reason,
			date: new Date(),
		});
	},

	addMany: (hashes, reason = 'Banned file') => {
		const docs = hashes.map(hash => ({
			_id: hash,
			reason,
			date: new Date(),
		}));
		return db.insertMany(docs, { ordered: false }).catch(() => {}); // ignore duplicates
	},

	isBanned: async (hash) => {
		const banned = await db.findOne({ _id: hash });
		return banned ? banned.reason : null;
	},

	checkMany: async (hashes) => {
		const banned = await db.find({
			_id: { $in: hashes }
		}).toArray();
		return banned;
	},

	remove: (hash) => {
		return db.deleteOne({ _id: hash });
	},

	list: () => {
		return db.find({}).toArray();
	},

};
